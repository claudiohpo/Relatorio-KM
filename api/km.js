const { MongoClient, ObjectId } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "km_db";
const GLOBAL_COLLECTION = process.env.COLLECTION || "km_registros";

let clientPromise = null;

// Função para obter a conexão com o banco de dados
async function getDb() {
  if (!MONGODB_URI) throw new Error("MONGODB_URI não definido");
  if (!clientPromise) {
    const client = new MongoClient(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
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

function normalizePlate(valor) {
  if (valor === undefined || valor === null) {
    return { value: null };
  }
  const texto = String(valor).trim();
  if (!texto) {
    return { value: null };
  }
  const limpo = texto.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (limpo.length !== 7) {
    return {
      error: "Placa inválida. Informe 7 caracteres no padrão Mercosul ou antigo.",
    };
  }
  const mercosulRegex = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
  const antigoRegex = /^[A-Z]{3}[0-9]{4}$/;
  if (!mercosulRegex.test(limpo) && !antigoRegex.test(limpo)) {
    return {
      error: "Placa inválida. Utilize formatos como AAA-1234 ou AAA1A23.",
    };
  }
  return { value: limpo };
}

// Função para obter a coleção correta com base no nome de usuário
async function getCollectionForRequest(req) {
  const db = await getDb();
  const headerUser = req.headers
    ? req.headers["x-usuario"] ||
      req.headers["x-user"] ||
      req.headers["usuario"]
    : null;
  const bodyUser = req.body ? req.body.username : null;
  const queryUser = req.query ? req.query.username : null;
  const candidate = headerUser || bodyUser || queryUser || null;
  const username = sanitizeUsername(candidate);

  // modo estrito: PROIBIR writes (POST/PUT/DELETE) se não houver username válido
  const method = req && req.method ? String(req.method).toUpperCase() : "GET";
  if (!username) {
    if (["POST", "PUT", "DELETE"].includes(method)) {
      const err = new Error(
        "Usuário não fornecido ou inválido; autenticação necessária"
      );
      err.code = "NO_USER";
      throw err;
    }
    // para leituras sem usuário, usa a coleção global (fallback)
    return db.collection(GLOBAL_COLLECTION);
  }

  const collName = `registros_${username}`;
  return db.collection(collName);
}

// ---- Converter data para YYYY-MM-DD
function toYMD(value) {
  if (!value) return null;
  // se já passou no frontend no formato YYYY-MM-DD, retorna
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // aceita DD-MM-YYYY ou D-M-YYYY
  const m = value.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    return `${m[3]}-${mo}-${d}`;
  }
  // tenta converter Date
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return null;
}

// função para ler body (p/ ambientes sem body parser)
function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) return resolve(req.body);
    let data = "";
    req.on && req.on("data", (chunk) => (data += chunk));
    req.on &&
      req.on("end", () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (e) {
          resolve({});
        }
      });
    req.on && req.on("error", () => resolve({}));
  });
}

// função para processar a solicitação
module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  try {
    let collection;
    try {
      collection = await getCollectionForRequest(req);
    } catch (err) {
      if (err && err.code === "NO_USER")
        return res.status(401).json({ error: err.message });
      throw err;
    }

    if (req.method === "GET") {
      const q = req.query || {};
      if (q.id) {
        try {
          const doc = await collection.findOne({ _id: new ObjectId(q.id) });
          return res.json(doc || null);
        } catch {
          return res.status(400).json({ error: "ID inválido" });
        }
      }
      if (q.ultimo === "true" || q.ultimo === true) {
        const docs = await collection
          .find()
          .sort({ data: -1, createdAt: -1 })
          .limit(1)
          .toArray();
        return res.json(docs[0] || null);
      }
      // parâmetros de filtro (intervalo de datas, local, etc.)
      const filter = {};
      if (q.dataInicio || q.dataFim) {
        const inicio = toYMD(q.dataInicio) || "1970-01-01";
        const fim = toYMD(q.dataFim) || "2999-12-31";
        filter.data = { $gte: inicio, $lte: fim };
      }
      if (q.local) filter.local = { $regex: q.local, $options: "i" };
      const docs = await collection
        .find(filter)
        .sort({ data: -1, createdAt: -1 })
        .toArray();
      return res.json(docs);
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      const dataStr = toYMD(body.data) || toYMD(new Date());
      const kmSaida =
        body.kmSaida !== undefined && body.kmSaida !== null
          ? Number(body.kmSaida)
          : null;
      const kmChegada =
        body.kmChegada !== undefined && body.kmChegada !== null
          ? Number(body.kmChegada)
          : null;
      const placaResultado = normalizePlate(body.placa);
      if (placaResultado.error) {
        return res.status(400).json({ error: placaResultado.error });
      }

      const now = new Date();
      const doc = {
        data: dataStr,
        kmSaida,
        kmChegada,
        kmTotal:
          kmChegada !== null && kmSaida !== null
            ? Number(kmChegada) - Number(kmSaida)
            : null,
        local: body.local || null, // sempre "local"
        chamado: body.chamado || null, // <-- novo campo "chamado"
        observacoes: body.observacoes || null,
        placa: placaResultado.value,
        createdAt: now,
        updatedAt: now,
      };

      const result = await collection.insertOne(doc);
      return res.json({ message: "Inserido", id: result.insertedId });
    }

    if (req.method === "PUT") {
      const body = await readBody(req);
      if (!body.id) return res.status(400).json({ error: "ID obrigatório" });
      const existing = await collection.findOne({ _id: new ObjectId(body.id) });
      if (!existing)
        return res.status(404).json({ error: "Registro não encontrado" });

      const update = {};
      if (body.data) update.data = toYMD(body.data);
      if (body.kmSaida !== undefined)
        update.kmSaida = body.kmSaida === null ? null : Number(body.kmSaida);
      if (body.kmChegada !== undefined)
        update.kmChegada =
          body.kmChegada === null ? null : Number(body.kmChegada);
      if (body.local !== undefined) update.local = body.local;
      if (body.chamado !== undefined) update.chamado = body.chamado;
      if (body.observacoes !== undefined) update.observacoes = body.observacoes;
      if (body.placa !== undefined) {
        const placaResultado = normalizePlate(body.placa);
        if (placaResultado.error) {
          return res.status(400).json({ error: placaResultado.error });
        }
        update.placa = placaResultado.value;
      }
      update.updatedAt = new Date();

      await collection.updateOne(
        { _id: new ObjectId(body.id) },
        { $set: update }
      );
      return res.json({ message: "Atualizado" });
    }

    // if (req.method === "DELETE") {
    //   const q = req.query || {};
    //   if (!q.id) return res.status(400).json({ error: "ID obrigatório" });
    //   try {
    //     await collection.deleteOne({ _id: new ObjectId(q.id) });
    //     return res.json({ message: "Registro excluído com sucesso" });
    //   } catch {
    //     return res.status(400).json({ error: "ID inválido" });
    //   }
    // }

    if (req.method === "DELETE") {
      const q = req.query || {};
      // aceita id via query ou body; aceita flag all (query ?all=true ou body { all: true })
      const id = q.id || (req.body && req.body.id);
      const allFlag = q.all === "true" || (req.body && req.body.all === true);

      if (!id && !allFlag) {
        return res
          .status(400)
          .json({ error: "ID obrigatório ou use ?all=true" });
      }

      try {
        if (id) {
          try {
            await collection.deleteOne({ _id: new ObjectId(id) });
            return res.json({ message: "Registro excluído com sucesso" });
          } catch (err) {
            return res.status(400).json({ error: "ID inválido" });
          }
        }

        if (allFlag) {
          // deleta todos os documentos desta collection (apenas da collection do usuário)
          const result = await collection.deleteMany({});
          return res.json({
            message: "Todos os registros foram excluídos com sucesso",
            deletedCount: result.deletedCount,
          });
        }
      } catch (err) {
        console.error("Erro em DELETE /api/km:", err);
        return res
          .status(500)
          .json({
            error:
              "Erro ao excluir registros: " +
              (err && err.message ? err.message : "unknown"),
          });
      }
    }

    res.setHeader("Allow", "GET,POST,PUT,DELETE");
    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (err) {
    console.error("api/km error:", err);
    return res
      .status(500)
      .json({
        error:
          "Erro interno: " + (err && err.message ? err.message : "unknown"),
      });
  }
};
