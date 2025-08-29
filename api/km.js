// api/km.js - usa coleção por usuário se header 'x-usuario' presente
const { MongoClient, ObjectId } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "km_db";
const GLOBAL_COLLECTION = process.env.COLLECTION || "km_registros";

let clientPromise = null;
async function getDb() {
  if (!MONGODB_URI) throw new Error("MONGODB_URI não definido");
  if (!clientPromise) {
    const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    clientPromise = client.connect().then(()=>client);
  }
  const client = await clientPromise;
  return client.db(DB_NAME);
}

function sanitizeUsername(u) {
  if (!u) return null;
  const s = String(u).toLowerCase().trim();
  if (!/^[a-z0-9_\-]+$/.test(s)) return null;
  return s;
}

async function getCollectionForRequest(req) {
  const db = await getDb();
  const headerUser = req.headers ? (req.headers['x-usuario'] || req.headers['x-user'] || req.headers['usuario']) : null;
  const bodyUser = req.body ? req.body.username : null;
  const queryUser = req.query ? req.query.username : null;
  const candidate = headerUser || bodyUser || queryUser || null;
  const username = sanitizeUsername(candidate);
  if (!username) {
    return db.collection(GLOBAL_COLLECTION);
  }
  const collName = `registros_${username}`;
  return db.collection(collName);
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  try {
    const collection = await getCollectionForRequest(req);

    if (req.method === "GET") {
      const q = req.query || {};
      if (q.id) {
        try {
          const doc = await collection.findOne({ _id: new ObjectId(q.id) });
          return res.json(doc || null);
        } catch (err) {
          return res.status(400).json({ error: "ID inválido" });
        }
      }
      if (q.ultimo === 'true' || q.ultimo === true) {
        const docs = await collection.find().sort({ data: -1 }).limit(1).toArray();
        return res.json(docs[0] || null);
      }
      // list all
      const docs = await collection.find().sort({ data: -1 }).toArray();
      return res.json(docs);
    }

    if (req.method === "POST") {
      const body = req.body || await parseBodyFallback(req);
      const doc = {
        data: body.data ? new Date(body.data) : new Date(),
        kmSaida: body.kmSaida !== undefined ? body.kmSaida : null,
        kmChegada: body.kmChegada !== undefined ? body.kmChegada : null,
        kmTotal: null,
        nome: body.nome || null,
        obs: body.obs || null
      };
      if (doc.kmChegada !== null && doc.kmSaida !== null) {
        doc.kmTotal = Number(doc.kmChegada) - Number(doc.kmSaida);
      }
      const result = await collection.insertOne(doc);
      return res.status(201).json({ insertedId: result.insertedId });
    }

    if (req.method === "PUT") {
      const body = req.body || await parseBodyFallback(req);
      if (!body.id) return res.status(400).json({ error: "ID obrigatório" });
      // build update object
      let update = {};
      if (body.data) update.data = new Date(body.data);
      if (body.kmSaida !== undefined) update.kmSaida = body.kmSaida || null;
      if (body.kmChegada !== undefined) update.kmChegada = body.kmChegada || null;
      if (body.nome !== undefined) update.nome = body.nome;
      if (body.obs !== undefined) update.obs = body.obs;

      // recalc kmTotal if possible
      if (update.kmChegada !== undefined || update.kmSaida !== undefined) {
        const existing = await collection.findOne({ _id: new ObjectId(body.id) });
        const kmSaida = (update.kmSaida !== undefined) ? update.kmSaida : existing.kmSaida;
        const kmChegada = (update.kmChegada !== undefined) ? update.kmChegada : existing.kmChegada;
        update.kmTotal = (kmChegada !== null && kmSaida !== null) ? Number(kmChegada) - Number(kmSaida) : null;
      }

      await collection.updateOne({ _id: new ObjectId(body.id) }, { $set: update });
      return res.json({ message: "Atualizado" });
    }

    if (req.method === "DELETE") {
      const q = req.query || {};
      if (!q.id) return res.status(400).json({ error: "ID obrigatório" });
      try {
        await collection.deleteOne({ _id: new ObjectId(q.id) });
        return res.json({ message: "Registro excluído com sucesso" });
      } catch (err) {
        return res.status(400).json({ error: "ID inválido" });
      }
    }

    res.setHeader("Allow", "GET,POST,PUT,DELETE");
    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (err) {
    console.error("api/km error:", err);
    return res.status(500).json({ error: "Erro interno: " + (err && err.message ? err.message : "unknown") });
  }
};

// fallback parser for environments that don't set req.body
async function parseBodyFallback(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on && req.on("data", chunk => data += chunk);
    req.on && req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({}); }
    });
    req.on && req.on("error", () => resolve({}));
  });
}
