const resetForm = document.getElementById("resetForm");
const resetMsg = document.getElementById("resetMsg");
const resetStatus = document.getElementById("resetStatus");

function updateStatus(message, color = "#333") {
  if (!resetStatus) return;
  resetStatus.style.color = color;
  resetStatus.textContent = message;
}

async function parseResponse(res) {
  const text = await res.text().catch(() => "");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (err) {
    return { error: text };
  }
}

const params = new URLSearchParams(window.location.search);
const token = params.get("token");
const username = params.get("u");

if (!token || !username) {
  updateStatus("Link de redefinição inválido.", "red");
  if (resetForm) {
    resetForm.style.display = "none";
  }
} else {
  (async () => {
    updateStatus("Validando link de redefinição...");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          action: "verify-reset-token",
          username,
          token,
        }),
      });

      const body = await parseResponse(res);

      if (!res.ok) {
        updateStatus(body.error || "Link inválido ou expirado.", "red");
        if (resetForm) {
          resetForm.style.display = "none";
        }
        return;
      }

      updateStatus("Crie uma nova senha para sua conta.");
      if (resetForm) {
        resetForm.style.display = "block";
      }
    } catch (error) {
      console.error("Erro ao validar token de redefinição:", error);
      updateStatus(
        "Erro ao validar o link. Tente novamente mais tarde.",
        "red"
      );
      if (resetForm) {
        resetForm.style.display = "none";
      }
    }
  })();
}

if (resetForm) {
  resetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!resetMsg) return;

    const passwordInput = document.getElementById("resetPassword");
    const confirmInput = document.getElementById("resetPasswordConfirm");

    const newPassword = passwordInput ? passwordInput.value : "";
    const confirmPassword = confirmInput ? confirmInput.value : "";

    resetMsg.style.color = "#333";
    resetMsg.textContent = "Validando...";

    if (!newPassword || !confirmPassword) {
      resetMsg.style.color = "red";
      resetMsg.textContent = "Preencha os dois campos.";
      return;
    }

    if (newPassword !== confirmPassword) {
      resetMsg.style.color = "red";
      resetMsg.textContent = "Nova senha e confirmação não conferem.";
      return;
    }

    if (newPassword.length < 6) {
      resetMsg.style.color = "red";
      resetMsg.textContent = "A nova senha deve ter pelo menos 6 caracteres.";
      return;
    }

    resetMsg.style.color = "#333";
    resetMsg.textContent = "Atualizando senha...";

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          action: "reset-password",
          username,
          token,
          newPassword,
        }),
      });

      const body = await parseResponse(res);

      if (!res.ok) {
        resetMsg.style.color = "red";
        resetMsg.textContent = body.error || `Erro ${res.status}`;
        return;
      }

      resetMsg.style.color = "green";
      resetMsg.textContent = body.message || "Senha redefinida com sucesso.";
      updateStatus("Senha atualizada. Você já pode fazer login novamente.");
      resetForm.reset();
      const submitBtn = resetForm.querySelector("button[type='submit']");
      if (submitBtn) {
        submitBtn.disabled = true;
      }

      setTimeout(() => {
        window.location.href = "index.html";
      }, 3000);
    } catch (error) {
      console.error("Erro ao redefinir senha:", error);
      resetMsg.style.color = "red";
      resetMsg.textContent = "Erro de conexão com o servidor.";
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
