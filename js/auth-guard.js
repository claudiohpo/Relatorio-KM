(function () {
  const LOGIN_PAGE = "/index.html";

  function buildRedirectUrl() {
    const current = location.pathname + location.search + location.hash;
    try {
      return `${LOGIN_PAGE}?redirect=${encodeURIComponent(current)}`;
    } catch (err) {
      return LOGIN_PAGE;
    }
  }

  function purgeStoredUser() {
    try {
      localStorage.removeItem("km_username");
    } catch (err) {
      /* ignore storage errors */
    }
  }

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

  enforceAuthenticatedSession();
})();
