// Encapsula funções utilitárias utilizadas nas telas do sistema.
(function (global) {
  // Verifica se um cabeçalho existe desconsiderando maiúsculas/minúsculas.
  function hasHeader(headers, name) {
    if (!headers) return false;
    const target = String(name).toLowerCase();
    return Object.keys(headers).some((key) => key.toLowerCase() === target);
  }

  // Preenche cabeçalhos obrigatórios (usuário e JSON) quando necessário.
  function ensureHeaders(options) {
    const opts = options || {};
    const headers = { ...(opts.headers || {}) };
  // Obtém o usuário salvo na sessão tratando erros de acesso ao storage.
  const username = (function () {
      try {
        return sessionStorage.getItem("km_username");
      } catch (err) {
        return null;
      }
    })();

    if (username && !hasHeader(headers, "X-Usuario")) {
      headers["X-Usuario"] = username;
    }

    const body = opts.body;
    const hasBody = body !== undefined && body !== null;
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
    if (hasBody && !isFormData && !hasHeader(headers, "Content-Type")) {
      headers["Content-Type"] = "application/json";
    }

    return { ...opts, headers };
  }

  // Encaminha requisições fetch garantindo cabeçalhos padrão do sistema.
  function fetchWithUser(url, options = {}) {
    const finalOptions = ensureHeaders(options);
    return fetch(url, finalOptions);
  }

  // Tenta converter uma resposta em JSON com fallback configurável.
  async function parseJson(response, config = {}) {
    const { fallback = {}, includeTextOnError = true } = config;
    const text = await response.text().catch(() => "");
    if (!text) return fallback;
    try {
      return JSON.parse(text);
    } catch (err) {
      return includeTextOnError ? { error: text } : fallback;
    }
  }

  // Valida e normaliza uma placa informada pelo usuário.
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

  // Sanitiza texto para busca por placa mantendo apenas caracteres válidos.
  function sanitizarPlacaBusca(valor) {
    if (valor == null) return "";
    const texto = String(valor).toUpperCase().replace(/[^A-Z0-9]/g, "");
    return texto.slice(0, 8);
  }

  global.KMUtils = {
    fetchWithUser,
    parseJson,
    normalizarPlacaEntrada,
    sanitizarPlacaBusca,
  };
})(window);
