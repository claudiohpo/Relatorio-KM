# 🚗 Registro de KM Rodados

Aplicação completa para controle de quilometragem veicular com autenticação segura, exportação de relatórios e modo de manutenção controlado por variável de ambiente.

## ✨ Funcionalidades Principais
- Registro de deslocamentos com placa, chamado, local, quilometragens e observações
- Filtros avançados por intervalo de datas, local e placa, além de exportação CSV
- Gestão por usuário: cada colaborador consulta apenas seus próprios registros
- Portal de administração com tabela ordenável/filtrável e ações de edição/remoção
- Autenticação com cadastro, troca de senha autenticada e redefinição via e-mail Brevo
- Bloqueio temporário após tentativas de login falhas e contagem regressiva no frontend
- Modo manutenção ativado via `MAINTENANCE_MODE`, mantendo a página dedicada online

## 🔒 Segurança e Conformidade
- Senhas armazenadas com `bcrypt` e migração automática de hashes antigos
- Tokens de redefinição assinados com SHA-256 e expiração de 1 hora
- Conteúdo sensível enviado apenas por e-mail, nunca exibido em tela
- Rate limit por usuário com bloqueio automático após 5 tentativas inválidas
- Links de redefinição construídos com base em `APP_BASE_URL`, evitando URLs quebradas

## 🛠️ Tecnologias Utilizadas

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![bcryptjs](https://img.shields.io/badge/bcryptjs-00A95C?style=for-the-badge&logoColor=white)
![Nodemailer](https://img.shields.io/badge/Nodemailer-1B1B1F?style=for-the-badge&logo=nodemailer&logoColor=white)
![Brevo SMTP](https://img.shields.io/badge/Brevo%20SMTP-0A1F44?style=for-the-badge&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Vercel Edge](https://img.shields.io/badge/Vercel%20Edge-111111?style=for-the-badge&logo=vercel&logoColor=white)

## � Estrutura do Projeto

```
📁 Relatorio-KM/
├── api/
│   ├── km.js              # CRUD das viagens (placa normalizada, filtros, multiusuário)
│   ├── report.js          # Exportação CSV por usuário
│   └── users.js           # Cadastro, login, lockout e redefinição de senha
├── css/
│   ├── auth.css           # Layout de autenticação, modais e reset
│   ├── main.css           # Estilos do formulário principal (app.html)
│   ├── management.css     # Estilos da tabela de administração
│   └── maintenance.css    # Estilos dedicados à página de manutenção
├── images/                # Assets estáticos (manifest, ícones, manutenção)
├── js/
│   ├── auth.js            # Fluxo de login, cadastro, recuperação e lockout
│   ├── main.js            # Formulário de registro, mudança de senha in-app
│   ├── management.js      # Tabela de registros com busca por placa
│   └── reset.js           # Consumo do token e redefinição de senha
├── app.html               # Tela principal pós-login
├── index.html             # Portal de autenticação
├── management.html        # Administração de registros
├── maintenance.html       # Página estática exibida no modo manutenção
├── reset.html             # Página acessada via link do e-mail de reset
├── middleware.js          # Middleware Edge para chavear manutenção no deploy
├── vercel.json            # Configuração de funções e middleware para Vercel
├── package.json           # Dependências backend (MongoDB, bcrypt, nodemailer)
└── .env.example           # Exemplo de variáveis obrigatórias mínimas
```

## 🚀 Execução Local

### Pré-requisitos
- Node.js 20+
- Conta MongoDB (Atlas ou local)
- Conta Brevo (SMTP) para o fluxo de redefinição de senha

### Passo a passo
1. Clone o repositório e acesse a pasta:
  ```bash
  git clone <url-do-repositorio>
  cd Relatorio-KM
  ```
2. Instale as dependências (necessárias para as funções serverless):
  ```bash
  npm install
  ```
3. Configure um arquivo `.env` (veja a tabela abaixo). Em ambiente de desenvolvimento, você pode exportar as variáveis diretamente antes de rodar `vercel dev`.
4. Execute localmente com o CLI da Vercel para simular as serverless functions:
  ```bash
  npx vercel dev
  ```
  Abra `http://localhost:3000` para acessar a aplicação.

> Dica: se preferir apenas testar o frontend estático, sirva a pasta via `npx serve .`, mas o backend `/api` não estará disponível.

## 🔧 Variáveis de Ambiente

| Variável | Obrigatório | Descrição | Exemplo |
|----------|-------------|-----------|---------|
| `MONGODB_URI` | ✅ | URI de conexão MongoDB | `mongodb+srv://user:senha@cluster/...` |
| `DB_NAME` | ⛔️ (default `km_db`) | Banco utilizado para todas as coleções | `km_db` |
| `COLLECTION` | ⛔️ (default `km_registros`) | Coleção fallback para registros sem usuário | `km_registros` |
| `USERS_COLLECTION` | ⛔️ (default `usuarios`) | Coleção que armazena contas de acesso | `usuarios` |
| `BREVO_SMTP_HOST` | ✅ | Host SMTP da Brevo | `smtp-relay.brevo.com` |
| `BREVO_SMTP_PORT` | ✅ | Porta SMTP (use 587 ou 465) | `587` |
| `BREVO_SMTP_LOGIN` | ✅ | Usuário/API Key Brevo | `apikey` |
| `BREVO_SMTP_PASSWORD` | ✅ | Senha/API Key Brevo | `xkeysib-...` |
| `BREVO_MAIL_FROM` | ⛔️ | Remetente exibido no e-mail (fallback: login) | `suporte@empresa.com` |
| `APP_BASE_URL` | ⛔️ | URL base para montar links de reset | `https://relatorio-km.vercel.app` |
| `MAINTENANCE_MODE` | ⛔️ | Liga a página de manutenção no deploy | `on`, `true` ou `1` |

> **Importante:** após alterar variáveis na Vercel, é necessário realizar um novo deploy. O middleware lê `MAINTENANCE_MODE` em tempo de execução e redireciona todas as rotas para `maintenance.html`, liberando apenas os assets dessa página.

## 🖥️ Páginas e Fluxos
- `index.html`: login, cadastro e recuperação de acesso com feedback em tempo real
- `app.html`: formulário de lançamentos, mudança de senha e preenchimento automático
- `management.html`: visão administrativa com filtros (data, texto e placa) e ações em massa
- `reset.html`: formulário protegido por token para criação de nova senha
- `maintenance.html`: tela estática estilizada com CSS dedicado

## � API Endpoints

### `/api/users` (POST com `action`)
| Action | Descrição |
|--------|-----------|
| `register` | Cria um novo usuário (username único e e-mail verificado) |
| `login` | Autentica com bloqueio após 5 tentativas falhas e migra hash legado |
| `recover` | Gera token temporário, salva hash e dispara e-mail via Brevo |
| `verify-reset-token` | Valida token enviado por e-mail antes de mostrar `reset.html` |
| `reset-password` | Define nova senha (após e-mail) e limpa tentativas/locks |
| `change-password` | Troca senha autenticada dentro do app (header `x-usuario`) |

### `/api/km`
- GET: lista registros filtrados por data/local/placa ou retorna documento por `id`
- POST: insere lançamento normalizando a placa (formato antigo e Mercosul)
- PUT: atualiza campos individuais, recalculando o total e validando placa
- DELETE: remove por `id` ou limpa todos os lançamentos do usuário (`?all=true`)

### `/api/report`
- GET: exporta registros no formato JSON (default) ou `?format=csv`, respeitando o usuário autenticado via `x-usuario`

## 🌐 Deploy na Vercel
1. Conecte o repositório via painel da Vercel
2. Preencha todas as variáveis acima em *Project Settings › Environment Variables*
3. Faça o primeiro deploy (production ou preview)
4. Para ativar manutenção, defina `MAINTENANCE_MODE` como `on`, `true` ou `1` e redeploy. Para desligar, remova ou altere o valor e redeploy novamente.

## 👨‍💻 Contribuindo
1. Fork o projeto
2. Crie uma branch (`git checkout -b feat/minha-feature`)
3. Commit (`git commit -m "feat: nova feature"`)
4. Push (`git push origin feat/minha-feature`)
5. Abra um Pull Request

## 📄 Licença
Projeto licenciado sob MIT. Confira o arquivo [LICENSE](LICENSE).

## 🤝 Suporte
Abra uma issue para relatar bugs, sugerir melhorias ou tirar dúvidas.

---

⭐️ Gostou? Deixe uma estrela e compartilhe com o time!
