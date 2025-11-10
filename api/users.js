const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "km_db";
const USERS_COLLECTION = process.env.USERS_COLLECTION || "usuarios";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 1 minuto

let clientPromise = null;

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

      const storedEmail = (user.email || "").trim().toLowerCase();
      if (storedEmail !== String(email).trim().toLowerCase()) {
        res.statusCode = 404;
        return res.end(
          JSON.stringify({ error: "Usuário ou email informado está errado." })
        );
      }

      res.statusCode = 200;
      return res.end(
        JSON.stringify({
          message:
            "Solicitação registrada. Por segurança, contate o administrador para redefinir a senha.",
        })
      );
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

      let senhaCorreta = false;
      const storedPassword = String(user.password || "");
      const isHash = /^\$2[aby]\$/.test(storedPassword);

      if (isHash) {
        senhaCorreta = bcrypt.compareSync(String(password), storedPassword);
      } else {
        senhaCorreta = storedPassword === String(password);
        if (senhaCorreta) {
          const novoHash = bcrypt.hashSync(String(password), 12);
          await users.updateOne(
            { _id: user._id },
            {
              $set: {
                password: novoHash,
                updatedAt: new Date(),
              },
            }
          );
        }
      }

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
