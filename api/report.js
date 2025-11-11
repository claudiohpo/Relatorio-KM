const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME;
const GLOBAL_COLLECTION = process.env.COLLECTION || "km_registros";

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

// Função para limpar o nome de usuário
function sanitizeUsername(u) {
  if (!u) return null;
  const s = String(u).toLowerCase().trim();
  if (!/^[a-z0-9_\-]+$/.test(s)) return null;
  return s;
}

async function getCollectionForRequest(req) {
  const db = await getDb();
  const headerUser = req.headers
    ? req.headers["x-usuario"] ||
      req.headers["x-user"] ||
      req.headers["usuario"]
    : null;
  const username = sanitizeUsername(headerUser);

  const method = req && req.method ? String(req.method).toUpperCase() : "GET";
  if (!username) {
    if (["POST", "PUT", "DELETE"].includes(method)) {
      const err = new Error(
        "Usuário não fornecido ou inválido; autenticação necessária"
      );
      err.code = "NO_USER";
      throw err;
    }
    return db.collection(GLOBAL_COLLECTION);
  }
  const collName = `registros_${username}`;
  return db.collection(collName);
}

function toCsv(rows, headers) {
  const esc = (v) => `"${(v || "").toString().replace(/"/g, '""')}"`;
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => esc(r[h])).join(","));
  }
  return lines.join("\r\n");
}

// endpoint de relatório
module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  try {
    let col;
    try {
      col = await getCollectionForRequest(req);
    } catch (err) {
      if (err && err.code === "NO_USER")
        return res.status(401).json({ error: err.message });
      throw err;
    }

    const q = req.query || {};
    try {
      // filtro básico
      const filter = {};
      if (q.dataInicio || q.dataFim) {
        const inicio =
          q.dataInicio && /^\d{4}-\d{2}-\d{2}$/.test(q.dataInicio)
            ? q.dataInicio
            : null;
        const fim =
          q.dataFim && /^\d{4}-\d{2}-\d{2}$/.test(q.dataFim) ? q.dataFim : null;
        if (inicio || fim) filter.data = {};
        if (inicio) filter.data.$gte = inicio;
        if (fim) filter.data.$lte = fim;
      }
      if (q.local) filter.local = { $regex: q.local, $options: "i" };

      const docs = await col.find(filter).sort({ data: 1 }).toArray();

      if (q.format && q.format.toLowerCase() === "csv") {
        const headers = [
          "data",
          "kmSaida",
          "kmChegada",
          "kmTotal",
          "local",
          "chamado",
          "observacoes",
          "createdAt",
        ];
        const rows = docs.map((d) => ({
          data: d.data,
          kmSaida: d.kmSaida,
          kmChegada: d.kmChegada,
          kmTotal: d.kmTotal,
          local: d.local,
          chamado: d.chamado || "",
          observacoes: d.observacoes || "",
          createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : "",
        }));
        const csv = toCsv(rows, headers);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=relatorio_km.csv"
        );
        return res.send(csv);
      } else {
        return res.json(docs);
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro interno" });
    }
  } catch (err) {
    console.error("api/report error:", err);
    return res
      .status(500)
      .json({
        error:
          "Erro interno: " + (err && err.message ? err.message : "unknown"),
      });
  }
};
