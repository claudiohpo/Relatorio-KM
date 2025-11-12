(function (global) {
  // Encapsula utilitários de alternância de senha em um namespace global.
  const svgEyeOpen = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
  <circle cx="12" cy="12" r="3.2" fill="currentColor" />
</svg>`;

  const svgEyeClosed = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M17.94 17.94A10.95 10.95 0 0 1 12 19c-7 0-11-7-11-7 1.38-3.73 4.58-6.35 8.45-6.85" />
  <path d="M22.54 16.88A20.22 20.22 0 0 0 23 12s-4-7-11-7c-1.97 0-3.84.45-5.53 1.24" />
  <path d="M1 1l22 22" stroke="currentColor" />
</svg>`;

  // Garante a existência do container visual de um campo de senha.
  function ensureWrapper(input) {
    let wrapper = input.closest(".password-wrapper");
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.className = "password-wrapper";
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);
    }
    return wrapper;
  }

  // Cria ou reaproveita o botão de alternância atrelado ao wrapper.
  function ensureButton(wrapper) {
    let btn = wrapper.querySelector(".password-toggle");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "password-toggle";
      wrapper.appendChild(btn);
    }
    return btn;
  }

  // Configura o estado oculto padrão do campo de senha.
  function applyHiddenState(input, btn) {
    input.type = "password";
    btn.innerHTML = svgEyeOpen;
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("aria-label", "Mostrar senha");
  }

  // Vincula eventos ao botão para alternar visibilidade da senha.
  function bindToggle(btn, input) {
    if (btn.dataset.passwordToggleBound === "true") return;

    btn.addEventListener("click", function () {
      const isPassword = input.type === "password";
      if (isPassword) {
        input.type = "text";
        btn.innerHTML = svgEyeClosed;
        btn.setAttribute("aria-pressed", "true");
        btn.setAttribute("aria-label", "Ocultar senha");
      } else {
        applyHiddenState(input, btn);
      }
    });

    btn.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        btn.click();
      }
    });

    btn.dataset.passwordToggleBound = "true";
  }

  // Inicializa toggles de senha dentro do escopo informado.
  function setup(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const inputs = scope.querySelectorAll("input[data-password-toggle]");

    inputs.forEach((input) => {
      const wrapper = ensureWrapper(input);
      const btn = ensureButton(wrapper);
      applyHiddenState(input, btn);
      bindToggle(btn, input);
      input.dataset.passwordToggleInit = "true";
    });
  }

  // Restaura um campo de senha ao estado oculto inicial.
  function reset(input) {
    if (!input) return;
    const wrapper = input.closest(".password-wrapper");
    const btn = wrapper ? wrapper.querySelector(".password-toggle") : null;
    if (!btn) return;
    applyHiddenState(input, btn);
  }

  const api = {
    setup,
    reset,
    icons: {
      open: svgEyeOpen,
      closed: svgEyeClosed,
    },
  };

  global.PasswordToggle = api;

  // Ativa o comportamento assim que o DOM estiver pronto.
  document.addEventListener("DOMContentLoaded", () => {
    setup(document);
  });
})(window);
