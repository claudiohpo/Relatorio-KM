if (!window.KMUtils) {
  throw new Error("KMUtils not loaded. Ensure js/utils.js runs before reset.js");
}

const { parseJson } = window.KMUtils;

const resetForm = document.getElementById("resetForm");
const resetMsg = document.getElementById("resetMsg");
const resetStatus = document.getElementById("resetStatus");

function updateStatus(message, color = "#333") {
  if (!resetStatus) return;
  resetStatus.style.color = color;
  resetStatus.textContent = message;
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

  const body = await parseJson(res);

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
        if (window.PasswordToggle) {
          resetForm
            .querySelectorAll("input[data-password-toggle]")
            .forEach((input) => PasswordToggle.reset(input));
        }
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

  const body = await parseJson(res);

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

// Inicializa o Password Toggle
if (window.PasswordToggle) {
  PasswordToggle.setup(document);
}
