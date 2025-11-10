const BACKEND_URL = ""; // deixar vazio para usar mesmo domínio (/api/*)

const form = document.getElementById("kmForm");
const msg = document.getElementById("msg");
const btnSalvar = document.getElementById("btnSalvar");
const btnTrocarSenha = document.getElementById("btnTrocarSenha");
const overlayChangePassword = document.getElementById("overlayChangePassword");
const changePasswordForm = document.getElementById("changePasswordForm");
const changePasswordMsg = document.getElementById("changePasswordMsg");
const changePwdCancel = document.getElementById("changePwdCancel");

// Função para chamar o backend com o cabeçalho X-Usuario
function fetchWithUser(url, opts = {}) {
  const username = sessionStorage.getItem("km_username");
  opts = opts || {};
  opts.headers = opts.headers || {};
  if (username) opts.headers["X-Usuario"] = username;
  return fetch(url, opts);
}

async function parseJsonResponse(res) {
  const text = await res.text().catch(() => "");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (err) {
    return { error: text };
  }
}

function normalizarPlacaEntrada(valor) {
  if (valor === undefined || valor === null) {
    return { placa: null };
  }
  const texto = String(valor).trim();
  if (!texto) {
    return { placa: null };
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
  return { placa: limpo };
}

// Função para carregar o último registro e preencher KM Saída
async function carregarUltimoRegistro() {
  try {
    const response = await fetchWithUser("/api/km?ultimo=true");
    if (!response.ok) {
      throw new Error("Falha ao carregar último registro");
    }
    const ultimoRegistro = await response.json();

    if (ultimoRegistro && ultimoRegistro.kmChegada) {
      document.getElementById("kmSaida").value = ultimoRegistro.kmChegada;
    }
    const placaInput = document.getElementById("placa");
    if (placaInput) {
      placaInput.value = ultimoRegistro && ultimoRegistro.placa
        ? ultimoRegistro.placa
        : "";
    }
  } catch (error) {
    console.error("Erro ao carregar último registro:", error);
  }
}

// Carregar último registro do kmChegada para o label kmSaida quando a página for carregada
document.addEventListener("DOMContentLoaded", carregarUltimoRegistro);

btnSalvar.addEventListener("click", async (e) => {
  e.preventDefault();
  msg.textContent = "";

  // //Ativa as validações do HTML5 (não vou usar por enquanto)
  // const form = document.getElementById("kmForm");
  // if (!form.checkValidity()) {
  //   form.reportValidity();
  //   return;
  // }

  // Preenche data atual (e define dataInput no escopo acessível)
  const dataInput = document.getElementById("data");
  if (dataInput) {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");
    dataInput.value = `${ano}-${mes}-${dia}`;
  }

  // const data = document.getElementById("data").value; //antigo
  const data = dataInput.value;
  const chamado = document.getElementById("chamado").value.trim();
  const local = document.getElementById("local").value.trim();
  const placaValor = document.getElementById("placa").value.trim();
  const kmSaida = Number(document.getElementById("kmSaida").value);
  const kmChegadaInput = document.getElementById("kmChegada").value;

  if (!data || !local || isNaN(kmSaida)) {
    msg.style.color = "red";
    msg.textContent = "Preencha os campos obrigatórios corretamente.";
    return;
  }

  // Verifica se kmChegada foi preenchido
  if (kmChegadaInput !== "") {
    const kmChegadaNum = Number(kmChegadaInput);

    // Só valida kmChegada se for um número válido
    if (!isNaN(kmChegadaNum) && kmChegadaNum < kmSaida) {
      msg.style.color = "red";
      msg.textContent = "KM chegada não pode ser menor que KM saída.";
      return;
    }
  }

  const observacoes = document.getElementById("observacoes").value.trim();
  const kmChegada = kmChegadaInput === "" ? null : Number(kmChegadaInput);
  const { placa: placaNormalizada, error: erroPlaca } = normalizarPlacaEntrada(
    placaValor
  );
  if (erroPlaca) {
    msg.style.color = "red";
    msg.textContent = erroPlaca;
    return;
  }

  // Construir payload para envio
  const payload = {
    data,
    chamado,
    local,
    observacoes,
    placa: placaNormalizada,
    kmSaida,
    kmChegada,
    criadoEm: new Date().toISOString(),
  };

  try {
    const res = await fetchWithUser("/api/km", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => null);
      throw new Error(`Erro ${res.status} ${text || ""}`);
    }

    msg.style.color = "green";
    msg.textContent = "Registro salvo com sucesso.";

    form.reset();

    dataInput.value = data; // Restaura o valor da data capturado

    // Recarregar o último KM para o próximo registro
    await carregarUltimoRegistro();
  } catch (err) {
    console.error("Erro ao salvar:", err);
    msg.style.color = "orange";
    msg.textContent =
      "Falha ao salvar. Registro salvo localmente no navegador.";
    const pending = JSON.parse(localStorage.getItem("km_pending") || "[]");
    pending.push(payload);
    localStorage.setItem("km_pending", JSON.stringify(pending));
  }
});

window.addEventListener("DOMContentLoaded", () => {
  const username =
    sessionStorage.getItem("km_username") ||
    localStorage.getItem("km_username");
  if (username) {
    const footer = document.getElementById("user-footer");
    if (footer) {
      footer.textContent = `${username}`;
    }
  }

  const dataInput = document.getElementById("data"); //Preenche com a data atual automaticamente
  if (dataInput) {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");
    dataInput.value = `${ano}-${mes}-${dia}`;
  }
});

// Botão de Manutenção
const btnManutencao = document.getElementById("btnManutencao");
if (btnManutencao) {
  btnManutencao.addEventListener("click", () => {
    window.location.href = "/management.html";
  });
}

function showChangePasswordModal() {
  if (!overlayChangePassword) return;
  if (changePasswordForm) {
    changePasswordForm.reset();
  }
  if (changePasswordMsg) {
    changePasswordMsg.textContent = "";
    changePasswordMsg.style.color = "#333";
  }
  overlayChangePassword.classList.add("show");
  overlayChangePassword.setAttribute("aria-hidden", "false");
  const currentInput = document.getElementById("changePwdCurrent");
  if (currentInput) {
    currentInput.focus();
  }
}

function hideChangePasswordModal() {
  if (!overlayChangePassword) return;
  overlayChangePassword.classList.remove("show");
  overlayChangePassword.setAttribute("aria-hidden", "true");
  if (changePasswordForm) {
    changePasswordForm.reset();
  }
  if (changePasswordMsg) {
    changePasswordMsg.textContent = "";
  }
}

if (btnTrocarSenha && overlayChangePassword) {
  btnTrocarSenha.addEventListener("click", () => {
    showChangePasswordModal();
  });
}

if (changePwdCancel) {
  changePwdCancel.addEventListener("click", (event) => {
    event.preventDefault();
    hideChangePasswordModal();
  });
}

if (overlayChangePassword) {
  overlayChangePassword.addEventListener("click", (event) => {
    if (event.target === overlayChangePassword) {
      hideChangePasswordModal();
    }
  });
}

if (changePasswordForm) {
  changePasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!changePasswordMsg) return;

    const currentInput = document.getElementById("changePwdCurrent");
    const newInput = document.getElementById("changePwdNew");
    const confirmInput = document.getElementById("changePwdConfirm");

    const currentPassword = currentInput ? currentInput.value : "";
    const newPassword = newInput ? newInput.value : "";
    const confirmPassword = confirmInput ? confirmInput.value : "";

    changePasswordMsg.style.color = "#333";
    changePasswordMsg.textContent = "Validando...";

    if (!currentPassword || !newPassword || !confirmPassword) {
      changePasswordMsg.style.color = "red";
      changePasswordMsg.textContent = "Preencha todos os campos.";
      return;
    }

    if (newPassword !== confirmPassword) {
      changePasswordMsg.style.color = "red";
      changePasswordMsg.textContent = "Nova senha e confirmação não conferem.";
      return;
    }

    if (newPassword.length < 6) {
      changePasswordMsg.style.color = "red";
      changePasswordMsg.textContent = "A nova senha deve ter pelo menos 6 caracteres.";
      return;
    }

    if (newPassword === currentPassword) {
      changePasswordMsg.style.color = "red";
      changePasswordMsg.textContent = "A nova senha deve ser diferente da atual.";
      return;
    }

    const username = sessionStorage.getItem("km_username");
    if (!username) {
      changePasswordMsg.style.color = "red";
      changePasswordMsg.textContent = "Sessão expirada. Faça login novamente.";
      return;
    }

    changePasswordMsg.style.color = "#333";
    changePasswordMsg.textContent = "Atualizando senha...";

    try {
      const res = await fetchWithUser("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change-password",
          username,
          currentPassword,
          newPassword,
        }),
      });

      const body = await parseJsonResponse(res);

      if (!res.ok) {
        changePasswordMsg.style.color = "red";
        changePasswordMsg.textContent = body.error || `Erro ${res.status}`;
        return;
      }

      changePasswordMsg.style.color = "green";
      changePasswordMsg.textContent = body.message || "Senha atualizada com sucesso.";
      changePasswordForm.reset();

      setTimeout(() => {
        hideChangePasswordModal();
      }, 1500);
    } catch (error) {
      console.error("Falha ao trocar senha:", error);
      changePasswordMsg.style.color = "red";
      changePasswordMsg.textContent = "Erro de conexão com o servidor.";
    }
  });
}

const svgEyeOpen = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/>
  <circle cx="12" cy="12" r="3.2" fill="currentColor" />
</svg>`;

const svgEyeClosed = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M17.94 17.94A10.95 10.95 0 0 1 12 19c-7 0-11-7-11-7 1.38-3.73 4.58-6.35 8.45-6.85" />
  <path d="M22.54 16.88A20.22 20.22 0 0 0 23 12s-4-7-11-7c-1.97 0-3.84.45-5.53 1.24" />
  <path d="M1 1l22 22" stroke="currentColor" />
</svg>`;

(function setupPasswordToggles() {
  const inputs = document.querySelectorAll("input[data-password-toggle]");

  inputs.forEach((input) => {
    let wrapper = input.closest(".password-wrapper");
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.className = "password-wrapper";
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);
    }

    let btn = wrapper.querySelector(".password-toggle");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "password-toggle";
      btn.setAttribute("aria-label", "Mostrar senha");
      btn.setAttribute("aria-pressed", "false");
      wrapper.appendChild(btn);
    }

    btn.innerHTML = svgEyeOpen;
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("aria-label", "Mostrar senha");

    btn.addEventListener("click", function () {
      const isPassword = input.type === "password";
      if (isPassword) {
        input.type = "text";
        btn.innerHTML = svgEyeClosed;
        btn.setAttribute("aria-pressed", "true");
        btn.setAttribute("aria-label", "Ocultar senha");
      } else {
        input.type = "password";
        btn.innerHTML = svgEyeOpen;
        btn.setAttribute("aria-pressed", "false");
        btn.setAttribute("aria-label", "Mostrar senha");
      }
    });

    btn.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        btn.click();
      }
    });
  });
})();

// Botão de Sair
const btnSair = document.getElementById("btnSair");
btnSair.addEventListener("click", () => {
  // Remove sessão e qualquer vestígio em localStorage
  try {
    sessionStorage.removeItem("km_username");
  } catch (e) {}
  try {
    localStorage.removeItem("km_username");
  } catch (e) {}
  window.location.href = "/index.html";
});
