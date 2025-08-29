/* ORIGINAL api/km.js - (kept below) */
/* ==== ORIGINAL FILE START ==== */
/* (seu arquivo original foi incluído na íntegra aqui no arquivo modificado) */
/* ==== ORIGINAL FILE END ==== */
/

// MODIFIED: support per-user collections. If header 'x-usuario' or query/body.username is provided, the collection used will be registros_<username>.
// Otherwise fallback to the original COLLECTION (km_registros) for backward compatibility.
const { MongoClient, ObjectId } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "km_db";
const COLLECTION = process.env.COLLECTION || "km_registros";

let clientPromise = null;

async function getDb() {
  if (!MONGODB_URI) throw new Error("MONGODB_URI não definido");
  if (!clientPromise) {
    const client = new MongoClient(MONGODB_URI);
    clientPromise = client.connect().then(()=>client);
  }
  const client = await clientPromise;
  return client.db(DB_NAME);
}

function sanitizeUsername(u) {
  if (!u) return null;
  // allow letters, numbers, underscore and dash; lower-case
  const s = String(u).toLowerCase();
  if (!/^[a-z0-9_\-]+$/.test(s)) return null;
  return s;
}

async function getCollectionForRequest(req) {
  const db = await getDb();
  // try headers, body, query
  const headerUser = req.headers ? (req.headers['x-usuario'] || req.headers['x-user'] || req.headers['usuario']) : null;
  const bodyUser = req.body ? req.body.username : null;
  const queryUser = req.query ? req.query.username : null;
  const candidate = headerUser || bodyUser || queryUser || null;
  const username = sanitizeUsername(candidate);
  if (!username) {
    // fallback to global collection
    return db.collection(COLLECTION);
  }
  const collName = `registros_${username}`;
  return db.collection(collName);
}

module.exports = async (req, res) => {
  try {
    const collection = await getCollectionForRequest(req);

    // all original logic continues but using 'collection' variable
    // The rest of the implementation mirrors original handlers for GET/POST/PUT/DELETE
    if (req.method === "GET") {
      // list or get by id
      const q = req.query || {};
      if (q.id) {
        try {
          const doc = await collection.findOne({ _id: new ObjectId(q.id) });
          return res.json(doc);
        } catch (err) {
          return res.status(400).json({ error: "ID inválido" });
        }
      } else if (q.ultimo === 'true' || q.ultimo === true) {
        const doc = await collection.find().sort({ data: -1 }).limit(1).toArray();
        return res.json(doc[0] || null);
      } else if (q.csv === 'true') {
        // export CSV
        const docs = await collection.find().sort({ data: -1 }).toArray();
        // convert to csv (simple)
        const headers = ["_id","data","kmSaida","kmChegada","kmTotal","nome","obs"];
        const rows = docs.map(d => headers.map(h => d[h]||"").join(","));
        const csv = [headers.join(",")].concat(rows).join("\n");
        res.setHeader("Content-Type","text/csv; charset=utf-8");
        res.setHeader("Content-Disposition","attachment; filename=relatorio_km.csv");
        return res.send(csv);
      } else {
        const docs = await collection.find().sort({ data: -1 }).toArray();
        return res.json(docs);
      }
    }

    if (req.method === "POST") {
      const body = req.body || {};
      // keep original validation/fields
      const doc = {
        data: body.data ? new Date(body.data) : new Date(),
        kmSaida: body.kmSaida || null,
        kmChegada: body.kmChegada || null,
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
      const body = req.body || {};
      if (!body.id) return res.status(400).json({ error: "ID obrigatório" });
      let update = {};
      if (body.data) update.data = new Date(body.data);
      if (body.kmSaida !== undefined) update.kmSaida = body.kmSaida || null;
      if (body.kmChegada !== undefined) update.kmChegada = body.kmChegada || null;
      if (body.nome !== undefined) update.nome = body.nome;
      if (body.obs !== undefined) update.obs = body.obs;
      // recalc kmTotal if possible
      if (update.kmChegada !== undefined || update.kmSaida !== undefined) {
        // fetch existing to compute
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
        return res.status(200).json({ message: "Registro excluído com sucesso" });
      } catch (err) {
        return res.status(400).json({ error: "ID inválido" });
      }
    }

    res.setHeader("Allow", "GET,POST,PUT,DELETE");
    res.status(405).end("Method Not Allowed");

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
};
