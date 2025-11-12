(function () {
  // Encapsula a lógica de proteção de rota em escopo isolado.
  const LOGIN_PAGE = "/index.html";

  // Monta a URL de redirecionamento preservando o destino original.
  function buildRedirectUrl() {
    const current = location.pathname + location.search + location.hash;
    try {
      return `${LOGIN_PAGE}?redirect=${encodeURIComponent(current)}`;
    } catch (err) {
      return LOGIN_PAGE;
    }
  }

  // Remove credenciais remanescentes no armazenamento local.
  function purgeStoredUser() {
    try {
      localStorage.removeItem("km_username");
    } catch (err) {
      /* ignore storage errors */
    }
  }

  // Garante que a página só carregue para sessões autenticadas.
  function enforceAuthenticatedSession() {
    try {
      const username = sessionStorage.getItem("km_username");
      if (username) return;
      purgeStoredUser();
      window.location.replace(buildRedirectUrl());
    } catch (err) {
      window.location.replace(buildRedirectUrl());
    }
  }

  // Executa a validação assim que o script é carregado.
  enforceAuthenticatedSession();
})();
