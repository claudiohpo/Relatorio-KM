// js/auth.js - login and register
const loginForm = document.getElementById("loginForm");
const loginMsg = document.getElementById("loginMsg");
const openRegister = document.getElementById("openRegister");
const openRecover = document.getElementById("openRecover");
const overlayRegister = document.getElementById("overlayRegister");
const registerForm = document.getElementById("registerForm");

function showOverlay(el){ el.classList.add("show"); el.setAttribute("aria-hidden","false"); }
function hideOverlay(el){ el.classList.remove("show"); el.setAttribute("aria-hidden","true"); }

openRegister.addEventListener("click", () => showOverlay(overlayRegister));
// recovery link is inert for now (feature postponed)
openRecover.addEventListener("click", () => {
  // optional: show a friendly message
  alert("Recuperação de senha será implementada em breve.");
});

document.getElementById("regCancel").addEventListener("click", () => hideOverlay(overlayRegister));

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("regUsername").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const password2 = document.getElementById("regPassword2").value;
  const msgEl = document.getElementById("regMsg");

  msgEl.style.color = "#333";
  msgEl.textContent = "Enviando...";

  if (!username || !email || !password) {
    msgEl.style.color = "red";
    msgEl.textContent = "Preencha todos os campos.";
    return;
  }

  if (password !== password2) {
    msgEl.style.color = "red";
    msgEl.textContent = "Senhas não conferem.";
    return;
  }

  try {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "register", username, email, password })
    });
    const body = await res.json().catch(()=>({ error: "Resposta inválida do servidor" }));
    if (!res.ok) {
      msgEl.style.color = "red";
      msgEl.textContent = body.error || "Erro no cadastro.";
      console.error("Cadastro falhou:", body);
    } else {
      msgEl.style.color = "green";
      msgEl.textContent = "Cadastro concluído. Faça login.";
      setTimeout(()=> hideOverlay(overlayRegister), 1000);
    }
  } catch (err) {
    msgEl.style.color = "red";
    msgEl.textContent = "Erro de conexão com o servidor.";
    console.error("Erro fetch /api/users register:", err);
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;
  loginMsg.style.color = "#333";
  loginMsg.textContent = "Validando...";

  if (!username || !password) {
    loginMsg.style.color = "red";
    loginMsg.textContent = "Preencha usuário e senha.";
    return;
  }

  try {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", username, password })
    });
    const body = await res.json().catch(()=>({ error: "Resposta inválida do servidor" }));
    if (!res.ok) {
      loginMsg.style.color = "red";
      loginMsg.textContent = body.error || "Falha no login.";
      console.error("Login falhou:", body);
    } else {
      // success: store username and redirect to app page (your old index)
      localStorage.setItem("km_username", username);
      // ajuste o destino se você renomeou sua página de KM (ex.: app.html)
      window.location.href = "app.html";
    }
  } catch (err) {
    loginMsg.style.color = "red";
    loginMsg.textContent = "Erro de conexão com o servidor.";
    console.error("Erro fetch /api/users login:", err);
  }
});

document.getElementById("btnDemo").addEventListener("click", () => {
  document.getElementById("loginUsername").value = "demo";
  document.getElementById("loginPassword").value = "demo";
});
