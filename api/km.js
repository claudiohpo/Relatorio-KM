const { MongoClient, ObjectId } = require("mongodb");

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

module.exports = async (req, res) => {
  try {
    const col = await getCollection();

    if (req.method === "POST") {
      const doc = req.body;
      // validação básica
      if (!doc.data || !doc.local || typeof doc.kmSaida !== "number") {
        return res.status(400).json({
          error:
            "Campos inválidos. data, local e kmSaida (number) são obrigatórios.",
        });
      }

      // Se kmChegada não for número, define como null
      if (typeof doc.kmChegada !== "number") {
        doc.kmChegada = null;
      }

      // Calcular kmTotal apenas se kmChegada for fornecido
      if (doc.kmChegada !== null) {
        doc.kmTotal = doc.kmChegada - doc.kmSaida;
      } else {
        doc.kmTotal = null;
      }
      doc.createdAt = new Date();
      const r = await col.insertOne(doc);
      return res.status(200).json({ insertedId: r.insertedId });
    }

    if (req.method === "GET") {
      const { id, ultimo } = req.query;

      if (id) {
        // Buscar um registro específico por ID
        try {
          const doc = await col.findOne({ _id: new ObjectId(id) });
          if (!doc) {
            return res.status(404).json({ error: "Registro não encontrado" });
          }
          return res.status(200).json(doc);
        } catch (err) {
          return res.status(400).json({ error: "ID inválido" });
        }
      } else if (ultimo) {
        // Buscar o último registro baseado na data de criação
        try {
          const doc = await col.findOne({}, { sort: { createdAt: -1 } });
          return res.status(200).json(doc);
        } catch (err) {
          console.error(err);
          return res
            .status(500)
            .json({ error: "Erro ao buscar último registro" });
        }
      } else {
        // Buscar todos os registros com ordenação por data decrescente e createdAt decrescente
        const { from, to } = req.query;
        const filter = {};
        if (from || to) {
          filter.data = {};
          if (from) filter.data.$gte = from;
          if (to) filter.data.$lte = to;
        }

        // Ordenar por data decrescente e createdAt decrescente
        const docs = await col
          .find(filter)
          .sort({ data: -1, createdAt: -1 })
          .toArray();

        return res.status(200).json(docs);
      }
    }

    if (req.method === "PUT") {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: "ID não fornecido" });
      }

      const doc = req.body;
      // validação básica
      if (!doc.data || !doc.local || typeof doc.kmSaida !== "number") {
        return res.status(400).json({
          error:
            "Campos inválidos. data, local e kmSaida (number) são obrigatórios.",
        });
      }

      // Se kmChegada não for número, define como null
      if (typeof doc.kmChegada !== "number") {
        doc.kmChegada = null;
      }

      // Calcular kmTotal apenas se kmChegada for fornecido
      if (doc.kmChegada !== null) {
        doc.kmTotal = doc.kmChegada - doc.kmSaida;
      } else {
        doc.kmTotal = null;
      }
      doc.updatedAt = new Date();

      try {
        const result = await col.updateOne(
          { _id: new ObjectId(id) },
          { $set: doc }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ error: "Registro não encontrado" });
        }

        return res
          .status(200)
          .json({ message: "Registro atualizado com sucesso" });
      } catch (err) {
        return res.status(400).json({ error: "ID inválido" });
      }
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: "ID não fornecido" });
      }

      try {
        const result = await col.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
          return res.status(404).json({ error: "Registro não encontrado" });
        }

        return res
          .status(200)
          .json({ message: "Registro excluído com sucesso" });
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
