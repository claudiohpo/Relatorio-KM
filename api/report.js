const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "km_db";
const COLLECTION = process.env.COLLECTION || "km_registros";

let clientPromise = null;

async function getCollection() {
  if (!MONGODB_URI) throw new Error("MONGODB_URI não definido");
  if (!clientPromise) {
    const client = new MongoClient(MONGODB_URI);
    clientPromise = client.connect().then(() => client);
  }
  const client = await clientPromise;
  const db = client.db(DB_NAME);
  return db.collection(COLLECTION);
}

function toCsv(rows, headers) {
  const esc = (v) => `"${(v || "").toString().replace(/"/g, '""')}"`;
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => esc(r[h])).join(","));
  }
  return lines.join("\n");
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") return res.status(405).end("Method Not Allowed");

    const col = await getCollection();
    const { from, to, format } = req.query;
    const filter = {};
    if (from || to) {
      filter.data = {};
      if (from) filter.data.$gte = from;
      if (to) filter.data.$lte = to;
    }
    const docs = await col.find(filter).sort({ data: 1 }).toArray();

    if ((format || "csv").toLowerCase() === "csv") {
      const headers = [
        "data",
        "chamado",
        "local",
        "kmSaida",
        "kmChegada",
        "kmTotal",
        "observacoes",
        "criadoEm",
      ];
      const rows = docs.map((d) => ({
        data: d.data || "",
        chamado: d.chamado || "",
        local: d.local || "",
        kmSaida: d.kmSaida ?? "",
        kmChegada: d.kmChegada ?? "",
        kmTotal: d.kmTotal ?? d.kmChegada - d.kmSaida, // Calcular se não existir
        observacoes: d.observacoes || "",
        criadoEm: d.createdAt
          ? new Date(d.createdAt).toISOString()
          : d.criadoEm || "",
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
};