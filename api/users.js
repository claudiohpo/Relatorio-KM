const { MongoClient } = require("mongodb");
const nodemailer = require("nodemailer");

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "km_db";
const USERS_COLLECTION = process.env.USERS_COLLECTION || "USUARIOS";

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

async function sendRecoveryEmail(toEmail, username, password) {
  if (!process.env.SMTP_HOST) {
    console.warn("SMTP não configurado, pulando envio de e-mail");
    return;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587",10),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  const body = `Segue seus dados de acesso:\nUsuário: ${username}\nSenha: ${password}\n\n(Projeto acadêmico - senha em texto claro)`;
  await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: toEmail, subject: "Recuperação de senha - Registro KM", text: body });
}

module.exports = async (req, res) => {
  try {
    const db = await getDb();
    const users = db.collection(USERS_COLLECTION);

    if (req.method === 'POST' && req.url.endsWith('/register')) {
      const { username, email, password } = req.body || {};
      if (!username || !email || !password) return res.status(400).json({ error:'Dados incompletos' });
      const exists = await users.findOne({ username });
      if (exists) return res.status(409).json({ error:'Usuário já existe' });
      await users.insertOne({ username, email, password });
      return res.status(201).json({ message:'Usuário criado' });
    }

    if (req.method === 'POST' && req.url.endsWith('/login')) {
      const { username, password } = req.body || {};
      if (!username || !password) return res.status(400).json({ error:'Dados incompletos' });
      const user = await users.findOne({ username });
      if (!user || user.password !== password) return res.status(401).json({ error:'Usuário ou senha inválidos' });
      return res.status(200).json({ message:'OK' });
    }

    if (req.method === 'POST' && req.url.endsWith('/recover')) {
      const { email } = req.body || {};
      if (!email) return res.status(400).json({ error:'Email obrigatório' });
      const user = await users.findOne({ email });
      if (!user) return res.status(200).json({ message:'Se o e-mail estiver cadastrado, você receberá instruções.' });
      try {
        await sendRecoveryEmail(email, user.username, user.password);
      } catch(err) {
        console.error('Erro enviando email', err);
      }
      return res.status(200).json({ message:'Se o e-mail estiver cadastrado, você receberá instruções.' });
    }

    res.setHeader('Allow','POST');
    res.status(405).end('Method Not Allowed');
  } catch(err) {
    console.error(err);
    res.status(500).json({ error:'Erro interno' });
  }
};
