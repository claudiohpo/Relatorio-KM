if (!window.KMUtils) {
  throw new Error("KMUtils not loaded. Ensure js/utils.js runs before auth.js");
}

const { parseJson } = window.KMUtils;

const loginForm = document.getElementById("loginForm");
const loginMsg = document.getElementById("loginMsg");
const btnLogin = document.getElementById("btnLogin");
const openRegister = document.getElementById("openRegister");
const openRecover = document.getElementById("openRecover");
const overlayRegister = document.getElementById("overlayRegister");
const registerForm = document.getElementById("registerForm");

// novos elementos (recuperação)
const overlayRecover = document.getElementById("overlayRecover");
const recoverForm = document.getElementById("recoverForm");
const overlayRecoverResult = document.getElementById("overlayRecoverResult");

let loginLockTimer = null;
let loginLockedUntil = null;

// Exibe um overlay modal e reconfigura toggles de senha embutidos.
function showOverlay(el) {
  el.classList.add("show");
  el.setAttribute("aria-hidden", "false");
  if (window.PasswordToggle) {
    PasswordToggle.setup(el);
    el
      .querySelectorAll("input[data-password-toggle]")
      .forEach((input) => PasswordToggle.reset(input));
  }
}
// Oculta um overlay modal e reseta toggles de senha associados.
function hideOverlay(el) {
  el.classList.remove("show");
  el.setAttribute("aria-hidden", "true");
  if (window.PasswordToggle) {
    el
      .querySelectorAll("input[data-password-toggle]")
      .forEach((input) => PasswordToggle.reset(input));
  }
}

// --- contador regressivo para bloqueio de login ---
// Cancela o contador de bloqueio de login e libera o botão de acesso.
function stopLockCountdown() {
  if (loginLockTimer) {
    clearInterval(loginLockTimer);
    loginLockTimer = null;
  }
  loginLockedUntil = null;
  if (btnLogin) btnLogin.disabled = false;
}

// Inicia o contador regressivo informando quanto falta para novo login.
function startLockCountdown(lockedUntilMs) {
  if (!loginMsg) return;

  if (loginLockTimer) {
    clearInterval(loginLockTimer);
    loginLockTimer = null;
  }

  const lockedUntil = Number(lockedUntilMs) || 0;
  loginLockedUntil = lockedUntil;

  if (!lockedUntil || lockedUntil <= Date.now()) {
    stopLockCountdown();
    loginMsg.style.color = "green";
    loginMsg.textContent = "Pronto — você já pode tentar novamente.";
    return;
  }

  if (btnLogin) btnLogin.disabled = true;

  // Atualiza a mensagem do usuário com o tempo restante de bloqueio.
  const updateCountdown = () => {
    const remainingMs = lockedUntil - Date.now();
    if (remainingMs <= 0) {
      stopLockCountdown();
      loginMsg.style.color = "green";
      loginMsg.textContent = "Pronto — você já pode tentar novamente.";
      return;
    }

    const remainingSec = Math.ceil(remainingMs / 1000);
    const min = Math.floor(remainingSec / 60);
    const sec = remainingSec % 60;

    loginMsg.style.color = "red";
    loginMsg.textContent =
      min > 0
        ? `Conta bloqueada. Tente novamente em ${min}m ${sec}s.`
        : `Conta bloqueada. Tente novamente em ${sec}s.`;
  };

  updateCountdown();
  loginLockTimer = setInterval(updateCountdown, 1000);
}

openRegister.addEventListener("click", () => showOverlay(overlayRegister));
// openRecover.addEventListener("click", () => { alert("Recuperação de senha será implementada em breve."); });
openRecover.addEventListener("click", () => showOverlay(overlayRecover));

document
  .getElementById("regCancel")
  .addEventListener("click", () => hideOverlay(overlayRegister));

// Função para registrar um novo usuário
// Processa o fluxo de cadastro de um novo usuário.
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
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ action: "register", username, email, password }),
    });

  const body = await parseJson(res);

    if (!res.ok) {
      msgEl.style.color = "red";
      msgEl.textContent = body.error || `Erro ${res.status}`;
      console.error("Cadastro falhou:", body);
      return;
    }

    msgEl.style.color = "green";
    msgEl.textContent = "Cadastro concluído. Faça login.";
    setTimeout(() => hideOverlay(overlayRegister), 1000);
  } catch (err) {
    console.error("Erro fetch /api/users register:", err);
    msgEl.style.color = "red";
    msgEl.textContent = "Erro de conexão com o servidor.";
  }
});

// Função para login
// Gerencia a tentativa de login aplicando bloqueio quando necessário.
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

  if (loginLockedUntil && loginLockedUntil > Date.now()) {
    startLockCountdown(loginLockedUntil);
    return;
  }

  try {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ action: "login", username, password }),
    });

  const body = await parseJson(res);

    if (!res.ok) {
      console.error("Login falhou:", body);

      if (body && body.lockedUntil) {
        startLockCountdown(body.lockedUntil);
        return;
      }

      stopLockCountdown();

      let message = body.error || `Falha no login (${res.status})`;
      if (
        body &&
        typeof body.remainingAttempts === "number" &&
        body.remainingAttempts > 0
      ) {
        const plural =
          body.remainingAttempts === 1 ? "tentativa" : "tentativas";
        message += ` Restam ${body.remainingAttempts} ${plural}.`;
      }

      loginMsg.style.color = "red";
      loginMsg.textContent = message;
      return;
    }

    // grava sessão somente em sessionStorage (não persiste entre janelas)
    sessionStorage.setItem("km_username", username);

    stopLockCountdown();

    // redireciona para página original se fornecida
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect");
    if (redirect) {
      try {
        const decoded = decodeURIComponent(redirect);
        window.location.href = decoded;
        return;
      } catch (err) {
        console.warn(
          "Erro ao decodificar redirect, redirecionando para app.html",
          err
        );
      }
    }

    window.location.href = "app.html";
  } catch (err) {
    console.error("Erro fetch /api/users login:", err);
    loginMsg.style.color = "red";
    loginMsg.textContent = "Erro de conexão com o servidor.";
  }
});

// ---- Recuperação de senha ----
document.getElementById("recCancel").addEventListener("click", () => {
  // Limpa os campos de recuperação e fecha o overlay correspondente.
  // limpar campos e mensagem
  document.getElementById("recUsername").value = "";
  document.getElementById("recEmail").value = "";
  document.getElementById("recMsg").textContent = "";
  hideOverlay(overlayRecover);
});

// Dispara o processo de recuperação de senha via API.
recoverForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("recUsername").value.trim();
  const email = document.getElementById("recEmail").value.trim();
  const msgEl = document.getElementById("recMsg");

  msgEl.style.color = "#333";
  msgEl.textContent = "Consultando...";

  if (!username || !email) {
    msgEl.style.color = "red";
    msgEl.textContent = "Preencha usuário e email.";
    return;
  }

  try {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ action: "recover", username, email }),
    });

  const body = await parseJson(res);

    if (!res.ok) {
      msgEl.style.color = "red";
      // mensagem amigável definida pelo servidor ou genérica
      msgEl.textContent = body.error || `Erro ${res.status}`;
      console.error("Recuperação falhou:", body);
      return;
    }

    // // Fluxo antigo (senha retornada) removido por razões de segurança

    msgEl.textContent = "";
    hideOverlay(overlayRecover);

    const resultUserEl = document.getElementById("recResultUser");
    if (resultUserEl) resultUserEl.textContent = username;
    const resultMsgEl = document.getElementById("recResultMessage");
    if (resultMsgEl) {
      resultMsgEl.textContent =
        body.message ||
        "Se os dados estiverem corretos, você receberá um email com o link para redefinir sua senha.";
    }

    showOverlay(overlayRecoverResult);
  } catch (err) {
    console.error("Erro fetch /api/users recover:", err);
    msgEl.style.color = "red";
    msgEl.textContent = "Erro de conexão com o servidor.";
  }
});

// document.getElementById("recResultOk").addEventListener("click", () => {
//   // fecha pop-up de resultado e limpa campos
//   hideOverlay(overlayRecoverResult);
//   document.getElementById("recUsername").value = "";
//   document.getElementById("recEmail").value = "";
//   document.getElementById("recMsg").textContent = "";
// });

document.getElementById("recResultOk").addEventListener("click", () => {
  // Esconde o resultado da recuperação e restaura campos para novo uso.
  hideOverlay(overlayRecoverResult);

  // limpa campos de recuperação e o campo de resultado
  document.getElementById("recUsername").value = "";
  document.getElementById("recEmail").value = "";
  document.getElementById("recMsg").textContent = "";
  const resultUserEl = document.getElementById("recResultUser");
  if (resultUserEl) resultUserEl.textContent = "";
  const resultMsgEl = document.getElementById("recResultMessage");
  if (resultMsgEl) resultMsgEl.textContent = "";
});

// Inicializa o Password Toggle
if (window.PasswordToggle) {
  PasswordToggle.setup(document);
}
