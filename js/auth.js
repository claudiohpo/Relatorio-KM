// js/auth.js - handles login, register, recover
const loginForm = document.getElementById("loginForm");
const loginMsg = document.getElementById("loginMsg");
const openRegister = document.getElementById("openRegister");
const openRecover = document.getElementById("openRecover");
const overlayRegister = document.getElementById("overlayRegister");
const overlayRecover = document.getElementById("overlayRecover");
const registerForm = document.getElementById("registerForm");
const recoverForm = document.getElementById("recoverForm");

function showOverlay(el){ el.classList.add("show"); el.setAttribute("aria-hidden","false"); }
function hideOverlay(el){ el.classList.remove("show"); el.setAttribute("aria-hidden","true"); }

openRegister.addEventListener("click", ()=> showOverlay(overlayRegister));
openRecover.addEventListener("click", ()=> showOverlay(overlayRecover));
document.getElementById("regCancel").addEventListener("click", ()=> hideOverlay(overlayRegister));
document.getElementById("recCancel").addEventListener("click", ()=> hideOverlay(overlayRecover));

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("regUsername").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const password2 = document.getElementById("regPassword2").value;
  const msgEl = document.getElementById("regMsg");
  if (password !== password2) { msgEl.style.color='red'; msgEl.textContent='Senhas não conferem'; return; }
  try {
    const res = await fetch("/api/users/register", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ username, email, password })
    });
    const body = await res.json();
    if (!res.ok) { msgEl.style.color='red'; msgEl.textContent = body.error || 'Erro no cadastro'; }
    else { msgEl.style.color='green'; msgEl.textContent='Cadastro concluído. Faça login.'; setTimeout(()=>hideOverlay(overlayRegister),1000); }
  } catch(err){ msgEl.style.color='red'; msgEl.textContent='Erro de conexão'; }
});

recoverForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const email = document.getElementById("recEmail").value.trim();
  const msgEl = document.getElementById("recMsg");
  try {
    const res = await fetch("/api/users/recover", {
      method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ email })
    });
    const body = await res.json();
    if (!res.ok) { msgEl.style.color='red'; msgEl.textContent = body.error || 'Erro'; }
    else { msgEl.style.color='green'; msgEl.textContent='Se o e-mail estiver cadastrado, você receberá instruções.'; setTimeout(()=>hideOverlay(overlayRecover),1000); }
  } catch(err){ msgEl.style.color='red'; msgEl.textContent='Erro de conexão'; }
});

loginForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;
  loginMsg.style.color='black'; loginMsg.textContent='Validando...';
  try {
    const res = await fetch("/api/users/login", {
      method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ username, password })
    });
    const body = await res.json();
    if (!res.ok) { loginMsg.style.color='red'; loginMsg.textContent = body.error || 'Falha no login'; }
    else {
      localStorage.setItem("km_username", username);
      window.location.href = "app.html";
    }
  } catch(err){ loginMsg.style.color='red'; loginMsg.textContent='Erro de conexão'; }
});

document.getElementById("btnDemo").addEventListener("click", ()=>{
  document.getElementById("loginUsername").value = "demo";
  document.getElementById("loginPassword").value = "demo";
});
