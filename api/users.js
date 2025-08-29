// api/users.js - handler robusto para register/login
const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "km_db";
const USERS_COLLECTION = process.env.USERS_COLLECTION || "USUARIOS";

let clientPromise = null;

async function getDb() {
  if (!MONGODB_URI) throw new Error("MONGODB_URI não definido");
  if (!clientPromise) {
    const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    clientPromise = client.connect().then(() => client);
  }
  const client = await clientPromise;
  return client.db(DB_NAME);
}

// fallback to read raw body when req.body is not set (serverless environments)
async function readRawBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on && req.on("data", (chunk) => (data += chunk));
    req.on && req.on("end", () => resolve(data || null));
    req.on && req.on("error", () => resolve(null));
    // If no streaming methods (some envs), return null
    setTimeout(() => resolve(null), 50);
  });
}

module.exports = async (req, res) => {
  // garantir JSON em todas as respostas
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end(JSON.stringify({ error: "Method Not Allowed. Use POST com action." }));
    }

    // body: prefira req.body se disponível; senão leia raw e parse
    let body = req.body && Object.keys(req.body).length ? req.body : null;
    if (!body) {
      const raw = await readRawBody(req);
      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch (e) {
          // não é JSON válido - retornar erro
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: "Corpo inválido. Envie JSON válido." }));
        }
      } else {
        body = {};
      }
    }

    // Log minimal para debug (sem expor senhas nos logs em produção; aqui é útil enquanto debugamos)
    console.log("api/users - recebido body:", JSON.stringify(Object.assign({}, body, { password: body.password ? "[REDACTED]" : undefined })));

    const action = body.action;
    if (!action) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Campo 'action' obrigatório (register | login)." }));
    }

    const db = await getDb();
    const users = db.collection(USERS_COLLECTION);

    if (action === "register") {
      const { username, email, password } = body;
      if (!username || !email || !password) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Dados incompletos." }));
      }

      const usernameNormalized = String(username).trim().toLowerCase();
      if (!/^[a-z0-9_\-]+$/.test(usernameNormalized)) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Nome de usuário inválido. Use letras, números, '_' ou '-'." }));
      }

      const existing = await users.findOne({ username: usernameNormalized });
      if (existing) {
        res.statusCode = 409;
        return res.end(JSON.stringify({ error: "Usuário já existe." }));
      }

      await users.insertOne({ username: usernameNormalized, email, password });
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
      if (!user || user.password !== password) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ error: "Usuário ou senha inválidos." }));
      }
      res.statusCode = 200;
      return res.end(JSON.stringify({ message: "OK" }));
    }

    res.statusCode = 400;
    return res.end(JSON.stringify({ error: "Action desconhecida." }));
  } catch (err) {
    // Log detalhado para debugging (você pode remover stack em produção)
    console.error("api/users error:", err && err.stack ? err.stack : err);

    // retorna JSON com mensagem curta + detalhe para debugging
    res.statusCode = 500;
    const msg = (err && err.message) ? err.message : "Erro interno";
    return res.end(JSON.stringify({ error: "Erro interno", detail: msg }));
  }
};
