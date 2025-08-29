// js/auth.js - login and register (melhor tratamento de resposta)
// Atualizado: grava sessão em sessionStorage e respeita redirect param

const loginForm = document.getElementById("loginForm");
const loginMsg = document.getElementById("loginMsg");
const openRegister = document.getElementById("openRegister");
const openRecover = document.getElementById("openRecover");
const overlayRegister = document.getElementById("overlayRegister");
const registerForm = document.getElementById("registerForm");

function showOverlay(el){ el.classList.add("show"); el.setAttribute("aria-hidden","false"); }
function hideOverlay(el){ el.classList.remove("show"); el.setAttribute("aria-hidden","true"); }

openRegister.addEventListener("click", () => showOverlay(overlayRegister));
openRecover.addEventListener("click", () => { alert("Recuperação de senha será implementada em breve."); });

document.getElementById("regCancel").addEventListener("click", () => hideOverlay(overlayRegister));

async function parseResponse(res) {
  // tenta JSON; se falhar, retorna texto como { error: text }
  const text = await res.text().catch(() => "");
  try {
    return text ? JSON.parse(text) : {};
  } catch (e) {
    return { error: text || "Resposta inválida do servidor" };
  }
}

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
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ action: "register", username, email, password })
    });

    const body = await parseResponse(res);

    if (!res.ok) {
      msgEl.style.color = "red";
      msgEl.textContent = body.error || `Erro ${res.status}`;
      console.error("Cadastro falhou:", body);
      return;
    }

    msgEl.style.color = "green";
    msgEl.textContent = "Cadastro concluído. Faça login.";
    setTimeout(()=> hideOverlay(overlayRegister), 1000);
  } catch (err) {
    console.error("Erro fetch /api/users register:", err);
    msgEl.style.color = "red";
    msgEl.textContent = "Erro de conexão com o servidor.";
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
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ action: "login", username, password })
    });

    const body = await parseResponse(res);

    if (!res.ok) {
      loginMsg.style.color = "red";
      loginMsg.textContent = body.error || `Falha no login (${res.status})`;
      console.error("Login falhou:", body);
      return;
    }

    // grava sessão somente em sessionStorage (não persiste entre janelas)
    sessionStorage.setItem("km_username", username);

    // redireciona para página original se fornecida
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    if (redirect) {
      // decode caso o redirect tenha sido codificado
      try {
        const decoded = decodeURIComponent(redirect);
        window.location.href = decoded;
        return;
      } catch (err) {
        console.warn("Erro ao decodificar redirect, redirecionando para app.html", err);
      }
    }

    window.location.href = "app.html";
  } catch (err) {
    console.error("Erro fetch /api/users login:", err);
    loginMsg.style.color = "red";
    loginMsg.textContent = "Erro de conexão com o servidor.";
  }
});

// Password toggle: attach to any .password-toggle button that sits next to an input[data-password-toggle]
(function setupPasswordToggles(){
  const eyeSVG = '...';     // SVG do olho
  const eyeOffSVG = '...';  // SVG olho-off (usado quando a senha está visível)

  document.addEventListener('click', function(e){
    if (e.target && (e.target.classList.contains('password-toggle') || e.target.closest('.password-toggle'))) {
      const btn = e.target.classList.contains('password-toggle') ? e.target : e.target.closest('.password-toggle');
      const wrapper = btn.closest('.password-wrapper');
      if (!wrapper) return;
      const input = wrapper.querySelector('input[data-password-toggle]');
      if (!input) return;
      if (input.type === 'password') {
        input.type = 'text';
        btn.setAttribute('aria-pressed','true');
        btn.setAttribute('aria-label','Ocultar senha');
        btn.innerHTML = eyeOffSVG;
      } else {
        input.type = 'password';
        btn.setAttribute('aria-pressed','false');
        btn.setAttribute('aria-label','Mostrar senha');
        btn.innerHTML = eyeSVG;
      }
    }
  });

  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('.password-wrapper').forEach(wrapper=>{
      const btn = wrapper.querySelector('.password-toggle');
      const input = wrapper.querySelector('input[data-password-toggle]');
      if (btn && input) {
        btn.innerHTML = eyeSVG;
        btn.setAttribute('aria-pressed', 'false');
      }
    });
  });
})();

