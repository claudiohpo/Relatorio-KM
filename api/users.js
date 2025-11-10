const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "km_db";
const USERS_COLLECTION = process.env.USERS_COLLECTION || "usuarios";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 1 minuto
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

const BREVO_SMTP_HOST = process.env.BREVO_SMTP_HOST;
const BREVO_SMTP_PORT = parseInt(process.env.BREVO_SMTP_PORT, 10);
const BREVO_SMTP_LOGIN = process.env.BREVO_SMTP_LOGIN || "";
const BREVO_SMTP_PASSWORD = process.env.BREVO_SMTP_PASSWORD || "";
const BREVO_MAIL_FROM =
  process.env.BREVO_MAIL_FROM || process.env.BREVO_SMTP_LOGIN || "";
const APP_BASE_URL = process.env.APP_BASE_URL || "";

let clientPromise = null;

let mailTransporter = null;

function getMailTransporter() {
  if (mailTransporter) return mailTransporter;
  if (!BREVO_SMTP_LOGIN || !BREVO_SMTP_PASSWORD) {
    throw new Error(
      "SMTP não configurado. Defina BREVO_SMTP_LOGIN e BREVO_SMTP_PASSWORD."
    );
  }

  mailTransporter = nodemailer.createTransport({
    host: BREVO_SMTP_HOST,
    port: BREVO_SMTP_PORT,
    secure: BREVO_SMTP_PORT === 465,
    auth: {
      user: BREVO_SMTP_LOGIN,
      pass: BREVO_SMTP_PASSWORD,
    },
  });

  return mailTransporter;
}

function isBcryptHash(value) {
  return /^\$2[aby]\$/.test(String(value || ""));
}

async function verifyUserPassword(usersCollection, user, candidatePassword) {
  const storedPassword = String(user.password || "");
  const candidate = String(candidatePassword || "");

  if (!storedPassword) {
    return false;
  }

  if (isBcryptHash(storedPassword)) {
    return bcrypt.compareSync(candidate, storedPassword);
  }

  const match = storedPassword === candidate;
  if (match) {
    const novoHash = bcrypt.hashSync(candidate, 12);
    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          password: novoHash,
          updatedAt: new Date(),
        },
      }
    );
  }
  return match;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function resolveBaseUrl(req) {
  if (APP_BASE_URL) {
    return APP_BASE_URL.replace(/\/$/, "");
  }

  const host = req.headers.host || "localhost";
  const forwardedProto = req.headers["x-forwarded-proto"];
  const isLocalhost = /localhost|127\.0\.0\.1/.test(host);
  const protocol = forwardedProto
    ? String(forwardedProto).split(",")[0]
    : isLocalhost
    ? "http"
    : "https";

  return `${protocol}://${host}`.replace(/\/$/, "");
}

function buildResetLink(req, username, token) {
  const baseUrl = resolveBaseUrl(req);
  return `${baseUrl}/reset.html?token=${encodeURIComponent(
    token
  )}&u=${encodeURIComponent(username)}`;
}

async function sendResetEmail({ to, username, link }) {
  const transporter = getMailTransporter();
  const fromAddress = BREVO_MAIL_FROM; // || BREVO_SMTP_LOGIN;
  if (!fromAddress) {
    throw new Error("Remetente SMTP não configurado. Defina BREVO_MAIL_FROM.");
  }

  const subject = "Redefinição de senha - Sistema de Controle de KM";
  const textBody =
    `Olá ${username},\n\n` +
    `Recebemos uma solicitação para redefinir a senha da sua conta. ` +
    `Se você fez essa solicitação, clique no link abaixo dentro de 1 hora:\n\n` +
    `${link}\n\n` +
    `Se você não solicitou a redefinição, ignore este email.`;

  const htmlBody = `
    <p>Olá <strong>${username}</strong>,</p>
    <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
    <p>Se você fez essa solicitação, clique no botão abaixo dentro de 1 hora:</p>
    <p style="text-align:center; margin:24px 0;">
      <a href="${link}" style="background:#2b7cff;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;display:inline-block;">
        Redefinir senha
      </a>
    </p>
    <p>Se o botão não funcionar, copie e cole o link no seu navegador:</p>
    <p><a href="${link}">${link}</a></p>
    <p>Se você não solicitou esta redefinição, pode ignorar este email.</p>
  `;

  await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    text: textBody,
    html: htmlBody,
  });
}

// Função para obter a conexão com o banco de dados
async function getDb() {
  if (!MONGODB_URI) throw new Error("MONGODB_URI não definido");
  if (!clientPromise) {
    const client = new MongoClient(MONGODB_URI);
    clientPromise = client.connect().then(() => client);
  }
  const client = await clientPromise;
  return client.db(DB_NAME);
}

// Função para ler o corpo da requisição em ambientes sem suporte a req.body
async function readRawBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on && req.on("data", (chunk) => (data += chunk));
    req.on && req.on("end", () => resolve(data || null));
    req.on && req.on("error", () => resolve(null));
  });
}

// Função para processar a solicitação
module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end(
        JSON.stringify({ error: "Method Not Allowed. Use POST com action." })
      );
    }

    // prefirir req.body se disponível; senão leia raw e parse
    let body = req.body && Object.keys(req.body).length ? req.body : null;
    if (!body) {
      const raw = await readRawBody(req);
      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch (e) {
          res.statusCode = 400;
          return res.end(
            JSON.stringify({ error: "Corpo inválido. Envie JSON válido." })
          );
        }
      } else {
        body = {};
      }
    }

    const action = body.action;
    if (!action) {
      res.statusCode = 400;
      return res.end(
        JSON.stringify({
          error: "Campo 'action' obrigatório (register | login).",
        })
      );
    }

    const db = await getDb();
    const users = db.collection(USERS_COLLECTION);

    // Recuperação de senha
    if (action === "recover") {
      const { username, email } = body;
      if (!username || !email) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Preencha usuário e email." }));
      }

      const usernameNormalized = String(username).trim().toLowerCase();
      const user = await users.findOne({ username: usernameNormalized });
      if (!user) {
        res.statusCode = 404;
        return res.end(
          JSON.stringify({ error: "Usuário ou email informado está errado." })
        );
      }

      const storedEmailNormalized = (user.email || "").trim().toLowerCase();
      if (storedEmailNormalized !== String(email).trim().toLowerCase()) {
        res.statusCode = 404;
        return res.end(
          JSON.stringify({ error: "Usuário ou email informado está errado." })
        );
      }

      const tokenRaw = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashToken(tokenRaw);
      const expiry = Date.now() + PASSWORD_RESET_TOKEN_TTL_MS;

      await users.updateOne(
        { _id: user._id },
        {
          $set: {
            resetTokenHash: tokenHash,
            resetTokenExpiry: expiry,
            updatedAt: new Date(),
          },
        }
      );

      const resetLink = buildResetLink(req, user.username, tokenRaw);

      try {
        await sendResetEmail({
          to: user.email,
          username: user.username,
          link: resetLink,
        });
      } catch (emailError) {
        console.error("Erro ao enviar email de redefinição:", emailError);
        res.statusCode = 500;
        return res.end(
          JSON.stringify({
            error:
              "Não foi possível enviar o email de redefinição. Tente novamente mais tarde.",
          })
        );
      }

      res.statusCode = 200;
      return res.end(
        JSON.stringify({
          message:
            "Se os dados estiverem corretos, você receberá um email com o link para redefinir a senha.\n" +
            "Caso não receba, verifique sua caixa de spam ou lixo eletrônico."
        })
      );
    }

    if (action === "verify-reset-token") {
      const { username, token } = body;
      if (!username || !token) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Token inválido." }));
      }

      const usernameNormalized = String(username).trim().toLowerCase();
      const user = await users.findOne({ username: usernameNormalized });

      if (!user || !user.resetTokenHash || !user.resetTokenExpiry) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Token inválido ou expirado." }));
      }

      const expectedHash = String(user.resetTokenHash);
      const providedHash = hashToken(token);
      const expiry = Number(user.resetTokenExpiry || 0);

      if (!expectedHash || expectedHash !== providedHash || expiry < Date.now()) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Token inválido ou expirado." }));
      }

      res.statusCode = 200;
      return res.end(JSON.stringify({ message: "Token válido." }));
    }

    if (action === "reset-password") {
      const { username, token, newPassword } = body;
      if (!username || !token || !newPassword) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Dados incompletos." }));
      }

      if (String(newPassword).length < 6) {
        res.statusCode = 400;
        return res.end(
          JSON.stringify({
            error: "A nova senha deve conter pelo menos 6 caracteres.",
          })
        );
      }

      const usernameNormalized = String(username).trim().toLowerCase();
      const user = await users.findOne({ username: usernameNormalized });

      if (!user || !user.resetTokenHash || !user.resetTokenExpiry) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Token inválido ou expirado." }));
      }

      const expectedHash = String(user.resetTokenHash);
      const providedHash = hashToken(token);
      const expiry = Number(user.resetTokenExpiry || 0);

      if (!expectedHash || expectedHash !== providedHash || expiry < Date.now()) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Token inválido ou expirado." }));
      }

      const hashedPassword = bcrypt.hashSync(String(newPassword), 12);

      await users.updateOne(
        { _id: user._id },
        {
          $set: {
            password: hashedPassword,
            resetTokenHash: null,
            resetTokenExpiry: null,
            failedLoginAttempts: 0,
            lockedUntil: null,
            updatedAt: new Date(),
          },
        }
      );

      res.statusCode = 200;
      return res.end(JSON.stringify({ message: "Senha redefinida com sucesso." }));
    }

    // Registro de novo usuário
    if (action === "register") {
      const { username, email, password } = body;
      if (!username || !email || !password) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Dados incompletos." }));
      }

      const usernameNormalized = String(username).trim().toLowerCase();
      if (!/^[a-z0-9_\-]+$/.test(usernameNormalized)) {
        res.statusCode = 400;
        return res.end(
          JSON.stringify({
            error: "Nome de usuário inválido. Use letras, números, '_' ou '-'.",
          })
        );
      }

      const existing = await users.findOne({ username: usernameNormalized });
      if (existing) {
        res.statusCode = 409;
        return res.end(JSON.stringify({ error: "Usuário já existe." }));
      }

      const emailNormalized = String(email).trim().toLowerCase();
      const existingEmail = await users.findOne({
        email: emailNormalized,
      });
      if (existingEmail) {
        res.statusCode = 409;
        return res.end(JSON.stringify({ error: "Email já está em uso." }));
      }

      const hashedPassword = bcrypt.hashSync(String(password), 12);

      await users.insertOne({
        username: usernameNormalized,
        email: emailNormalized,
        password: hashedPassword,
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      res.statusCode = 201;
      return res.end(JSON.stringify({ message: "Usuário criado." }));
    }

    if (action === "change-password") {
      const headerUser = String(req.headers["x-usuario"] || "").trim().toLowerCase();
      const { username, currentPassword, newPassword } = body;

      const usernameNormalized = String(username || "").trim().toLowerCase();

      if (!headerUser || !usernameNormalized || headerUser !== usernameNormalized) {
        res.statusCode = 403;
        return res.end(
          JSON.stringify({ error: "Usuário inválido para troca de senha." })
        );
      }

      if (!currentPassword || !newPassword) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Dados incompletos." }));
      }

      if (String(newPassword).length < 6) {
        res.statusCode = 400;
        return res.end(
          JSON.stringify({
            error: "A nova senha deve conter pelo menos 6 caracteres.",
          })
        );
      }

      if (String(currentPassword) === String(newPassword)) {
        res.statusCode = 400;
        return res.end(
          JSON.stringify({ error: "A nova senha deve ser diferente da atual." })
        );
      }

      const user = await users.findOne({ username: usernameNormalized });
      if (!user) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: "Usuário não encontrado." }));
      }

      const senhaCorreta = await verifyUserPassword(users, user, currentPassword);
      if (!senhaCorreta) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ error: "Senha atual incorreta." }));
      }

      const hashedPassword = bcrypt.hashSync(String(newPassword), 12);

      await users.updateOne(
        { _id: user._id },
        {
          $set: {
            password: hashedPassword,
            resetTokenHash: null,
            resetTokenExpiry: null,
            failedLoginAttempts: 0,
            lockedUntil: null,
            updatedAt: new Date(),
          },
        }
      );

      res.statusCode = 200;
      return res.end(JSON.stringify({ message: "Senha atualizada com sucesso." }));
    }

    if (action === "login") {
      const { username, password } = body;
      if (!username || !password) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Dados incompletos." }));
      }

      const usernameNormalized = String(username).trim().toLowerCase();
      const user = await users.findOne({ username: usernameNormalized });
      if (!user) {
        res.statusCode = 401;
        return res.end(
          JSON.stringify({ error: "Usuário ou senha inválidos." })
        );
      }

      const now = Date.now();
      const lockedUntil = Number(user.lockedUntil || 0);
      if (lockedUntil && lockedUntil > now) {
        res.statusCode = 423;
        return res.end(
          JSON.stringify({
            error:
              "Conta bloqueada temporariamente. Aguarde para tentar novamente.",
            lockedUntil,
          })
        );
      }

      if (lockedUntil && lockedUntil <= now) {
        await users.updateOne(
          { _id: user._id },
          {
            $set: {
              lockedUntil: null,
              failedLoginAttempts: 0,
              updatedAt: new Date(),
            },
          }
        );
        user.lockedUntil = null;
        user.failedLoginAttempts = 0;
      }

      const senhaCorreta = await verifyUserPassword(users, user, password);

      if (!senhaCorreta) {
        const novasTentativas = Number(user.failedLoginAttempts || 0) + 1;
        const updateDoc = {
          failedLoginAttempts: novasTentativas,
          updatedAt: new Date(),
        };

        let newLockedUntil = null;
        if (novasTentativas >= MAX_FAILED_ATTEMPTS) {
          newLockedUntil = Date.now() + LOCKOUT_DURATION_MS;
          updateDoc.lockedUntil = newLockedUntil;
          updateDoc.failedLoginAttempts = 0;
        }

        await users.updateOne({ _id: user._id }, { $set: updateDoc });

        res.statusCode = newLockedUntil ? 423 : 401;
        return res.end(
          JSON.stringify({
            error: newLockedUntil
              ? "Conta bloqueada temporariamente. Aguarde para tentar novamente."
              : "Usuário ou senha inválidos.",
            lockedUntil: newLockedUntil || null,
            remainingAttempts: newLockedUntil
              ? 0
              : Math.max(0, MAX_FAILED_ATTEMPTS - novasTentativas),
          })
        );
      }

      await users.updateOne(
        { _id: user._id },
        {
          $set: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            updatedAt: new Date(),
          },
        }
      );

      res.statusCode = 200;
      return res.end(JSON.stringify({ message: "OK" }));
    }

    res.statusCode = 400;
    return res.end(JSON.stringify({ error: "Action desconhecida." }));
  } catch (err) {
    res.statusCode = 500;
    const msg = err && err.message ? err.message : "Erro interno";
    return res.end(JSON.stringify({ error: "Erro interno", detail: msg }));
  }
};
