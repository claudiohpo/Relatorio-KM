// Variáveis globais
let registroSelecionado = null;
let registros = [];
let paginaAtual = 1;
const registrosPorPagina = 10;

// Centraliza chamada ao backend, adicionando usuário logado e Content-Type
function fetchWithUser(url, opts = {}) {
  const username = sessionStorage.getItem("km_username");
  opts = opts || {};
  opts.headers = opts.headers || {};

  if (username) opts.headers["X-Usuario"] = username;
  if (opts.body && !opts.headers["Content-Type"]) {
    opts.headers["Content-Type"] = "application/json";
  }

  return fetch(url, opts);
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

function sanitizarPlacaBusca(valor) {
  if (valor == null) return "";
  const texto = String(valor).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return texto.slice(0, 8);
}

// Verifica sessão ao iniciar (caso o guard inline falhe)
if (!sessionStorage.getItem("km_username")) {
  try {
    localStorage.removeItem("km_username");
  } catch (e) {}
  const redirect = encodeURIComponent(
    location.pathname + location.search + location.hash
  );
  window.location.replace("/index.html?redirect=" + redirect);
}

// Inicialização
document.addEventListener("DOMContentLoaded", function () {
  carregarRegistros();

  // Botões de navegação
  document.getElementById("btnVoltar").addEventListener("click", () => {
    window.location.href = "app.html";
  });
  document
    .getElementById("btnBaixarRelatorioCSV")
    .addEventListener("click", baixarRelatorioCSV);
  document
    .getElementById("btnBaixarRelatorioXLS")
    .addEventListener("click", baixarRelatorioXLS);

  // Abre modal "Apagar Tabela" (limpeza total)
  document.getElementById("btnApagarTudo").addEventListener("click", () => {
    abrirModalLimpeza(); // sem id
  });

  document
    .getElementById("btnAplicarFiltros")
    .addEventListener("click", aplicarFiltros);
  document
    .getElementById("btnLimparFiltros")
    .addEventListener("click", limparFiltros);
  const filtroPlacaEl = document.getElementById("filtroPlaca");
  if (filtroPlacaEl) {
    filtroPlacaEl.addEventListener("input", () => {
      const limpo = sanitizarPlacaBusca(filtroPlacaEl.value);
      if (filtroPlacaEl.value !== limpo) filtroPlacaEl.value = limpo;
    });
  }
  document.getElementById("btnAnterior").addEventListener("click", () => {
    if (paginaAtual > 1) {
      paginaAtual--;
      exibirRegistros();
    }
  });
  document.getElementById("btnProximo").addEventListener("click", () => {
    const totalPaginas = Math.ceil(registros.length / registrosPorPagina);
    if (paginaAtual < totalPaginas) {
      paginaAtual++;
      exibirRegistros();
    }
  });

  // Modal de exclusão
  document
    .getElementById("btnCancelarExclusao")
    .addEventListener("click", fecharModalExclusao);
  document
    .getElementById("btnConfirmarExclusao")
    .addEventListener("click", confirmarExclusao);

  // Modal de Limpeza da tabela toda
  document
    .getElementById("btnCancelarLimpeza")
    .addEventListener("click", fecharModalLimpeza);
  document
    .getElementById("btnConfirmarLimpeza")
    .addEventListener("click", confirmarLimpeza);

  // Modal de edição
  document
    .getElementById("btnCancelarEdicao")
    .addEventListener("click", fecharModalEdicao);
  document
    .getElementById("formEditar")
    .addEventListener("submit", salvarEdicao);

  // Botão de Edição
  document.getElementById("btnEditar").addEventListener("click", () => {
    if (!registroSelecionado) {
      alert("Selecione um registro para editar!");
      return;
    }
    abrirModalEdicao(registroSelecionado);
  });

  // Botão de Exclusão
  document.getElementById("btnExcluir").addEventListener("click", () => {
    if (!registroSelecionado) {
      alert("Selecione um registro para excluir!");
      return;
    }
    abrirModalExclusao(registroSelecionado);
  });
});

// Limpar filtros
function limparFiltros() {
  document.getElementById("filtroDataInicio").value = "";
  document.getElementById("filtroDataFim").value = "";
  document.getElementById("filtroLocal").value = "";
  const filtroPlaca = document.getElementById("filtroPlaca");
  if (filtroPlaca) filtroPlaca.value = "";

  paginaAtual = 1;
  exibirRegistros();
}

// Carrega registros do backend
async function carregarRegistros() {
  try {
    const response = await fetchWithUser("/api/km");
    if (!response.ok) throw new Error("Erro ao carregar registros");

    registros = await response.json();

    // Calcula KM total
    registros.forEach((registro) => {
      registro.kmTotal = (registro.kmChegada || 0) - (registro.kmSaida || 0);
    });

    // Ordena registros por data (ordem decrescente) e por createdAt (ordem decrescente)
    registros.sort((a, b) => {
      const dateComparison = new Date(b.data) - new Date(a.data);
      if (dateComparison !== 0) return dateComparison;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    exibirRegistros();
  } catch (error) {
    console.error("Erro:", error);
    alert("Erro ao carregar registros. Veja o console para detalhes.");
  }
}

// Exibe os registros na tabela
function exibirRegistros() {
  const tbody = document.querySelector("#tabelaRegistros tbody");
  tbody.innerHTML = "";

  let registrosFiltrados = aplicarFiltrosInterno(registros);

  const inicio = (paginaAtual - 1) * registrosPorPagina;
  const fim = inicio + registrosPorPagina;
  const registrosPagina = registrosFiltrados.slice(inicio, fim);

  const totalPaginas = Math.max(
    1,
    Math.ceil(registrosFiltrados.length / registrosPorPagina)
  );
  document.getElementById(
    "infoPagina"
  ).textContent = `Página ${paginaAtual} de ${totalPaginas}`;
  document.getElementById("btnAnterior").disabled = paginaAtual <= 1;
  document.getElementById("btnProximo").disabled = paginaAtual >= totalPaginas;

  if (registrosPagina.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="9" style="text-align: center;">Nenhum registro encontrado</td>`;
    tbody.appendChild(tr);
    return;
  }

  registrosPagina.forEach((registro) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="radio" name="registroSelecionado" value="${
        registro._id
      }"></td>
      <td>${formatarData(registro.data)}</td>
      <td>${registro.chamado || ""}</td>
      <td>${registro.local || ""}</td>
      <td>${registro.kmSaida || ""}</td>
      <td>${registro.kmChegada || ""}</td>
      <td>${registro.kmTotal || 0}</td>
      <td>${registro.placa || ""}</td>
      <td>${registro.observacoes || ""}</td>
    `;
    tbody.appendChild(tr);
  });

  // Captura seleção
  document
    .querySelectorAll("input[name='registroSelecionado']")
    .forEach((radio) => {
      radio.addEventListener("change", () => {
        registroSelecionado = radio.value;
      });
    });
}

// Aplica filtros
function aplicarFiltros() {
  paginaAtual = 1;
  exibirRegistros();
}

// Aplica filtros internos
function aplicarFiltrosInterno(registros) {
  const dataInicio = document.getElementById("filtroDataInicio").value;
  const dataFim = document.getElementById("filtroDataFim").value;
  const local = (
    document.getElementById("filtroLocal").value || ""
  ).toLowerCase();
  const placaInput = document.getElementById("filtroPlaca");
  const placaFiltro = sanitizarPlacaBusca(placaInput ? placaInput.value : "");

  return registros.filter((registro) => {
    if (dataInicio && registro.data < dataInicio) return false;
    if (dataFim && registro.data > dataFim) return false;
    const campoLocal = (registro.local || "").toLowerCase();
    if (local && !campoLocal.includes(local)) return false;
    if (placaFiltro) {
      const placaRegistro = sanitizarPlacaBusca(registro.placa || "");
      if (placaRegistro !== placaFiltro) return false;
    }
    return true;
  });
}

// Formata a data no formato DD/MM/YYYY
function formatarData(data) {
  if (!data) return "";
  const partes = (typeof data === "string" ? data : "").split("-");
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return data;
}

// Abre o modal de exclusão
function abrirModalExclusao(id) {
  registroSelecionado = id;
  document.getElementById("modalExcluir").style.display = "flex";
}

// Fecha o modal de exclusão
function fecharModalExclusao() {
  registroSelecionado = null;
  document.getElementById("modalExcluir").style.display = "none";
}

// Abre o modal de Limpeza (limpar toda a tabela do usuário)
function abrirModalLimpeza() {
  // limpeza total não precisa de registroSelecionado
  registroSelecionado = null;
  document.getElementById("modalApagarTudo").style.display = "flex";
}

// Fecha o modal de limpeza
function fecharModalLimpeza() {
  registroSelecionado = null;
  document.getElementById("modalApagarTudo").style.display = "none";
}

// Confirma a exclusão do registro
async function confirmarExclusao() {
  if (!registroSelecionado) return;

  try {
    const response = await fetchWithUser(`/api/km?id=${registroSelecionado}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Erro ao excluir registro");

    alert("Registro excluído com sucesso!");
    fecharModalExclusao();
    carregarRegistros();
  } catch (error) {
    console.error("Erro:", error);
    alert("Erro ao excluir registro.");
  }
}

async function confirmarLimpeza() {
  try {
    const response = await fetchWithUser("/api/km?all=true", {
      method: "DELETE",
    });
    if (!response.ok) {
      const txt = await response.text().catch(() => null);
      throw new Error(`Status ${response.status} - ${txt || "sem corpo"}`);
    }
    alert("Todos os seus registros foram excluídos com sucesso!");
    fecharModalLimpeza();
    carregarRegistros();
  } catch (error) {
    console.error("Erro:", error);
    alert("Erro ao excluir os registros. Detalhe: " + (error.message || error));
  }
}

// Abre o modal de edição
function abrirModalEdicao(id) {
  const registro = registros.find((r) => String(r._id) === String(id));
  if (!registro) return;

  document.getElementById("editId").value = registro._id;
  document.getElementById("editData").value = registro.data;
  document.getElementById("editChamado").value = registro.chamado || "";
  document.getElementById("editLocal").value = registro.local || "";
  document.getElementById("editKmSaida").value = registro.kmSaida || "";
  document.getElementById("editKmChegada").value = registro.kmChegada || "";
  document.getElementById("editPlaca").value = registro.placa || "";
  document.getElementById("editObservacoes").value = registro.observacoes || "";

  document.getElementById("modalEditar").style.display = "flex";
}

// Fecha o modal de edição
function fecharModalEdicao() {
  document.getElementById("modalEditar").style.display = "none";
}

// Salva as edições feitas no registro
async function salvarEdicao(e) {
  e.preventDefault();

  const id = document.getElementById("editId").value;
  const data = document.getElementById("editData").value;
  const chamado = document.getElementById("editChamado").value;
  const local = document.getElementById("editLocal").value;
  const kmSaida = Number(document.getElementById("editKmSaida").value);
  const kmChegadaStr = document.getElementById("editKmChegada").value;
  const kmChegadaInformado = kmChegadaStr.trim();
  const kmChegada = kmChegadaInformado === "" ? null : Number(kmChegadaStr);
  const placaValor = document.getElementById("editPlaca").value.trim();
  const observacoes = document.getElementById("editObservacoes").value;
  const msgEl = document.querySelector("#formEditar #msg");
  if (msgEl) {
    msgEl.textContent = "";
  }

  if (!id) {
    alert("ID do registro ausente.");
    return;
  }

  // Verifica se kmChegada foi preenchido
  if (kmChegadaInformado !== "") {
    if (!isNaN(kmChegada) && !isNaN(kmSaida) && kmChegada < kmSaida) {
      if (msgEl) {
        msgEl.style.color = "red";
        msgEl.textContent = "KM chegada não pode ser menor que KM saída.";
      }
      return;
    }
  }

  const { placa: placaNormalizada, error: erroPlaca } = normalizarPlacaEntrada(
    placaValor
  );
  if (erroPlaca) {
    if (msgEl) {
      msgEl.style.color = "red";
      msgEl.textContent = erroPlaca;
    } else {
      alert(erroPlaca);
    }
    return;
  }

  const dadosAtualizados = {
    id,
    data,
    chamado,
    local,
    observacoes,
    kmSaida,
    kmChegada,
    placa: placaNormalizada,
    kmTotal:
      !isNaN(kmChegada) && !isNaN(kmSaida) ? kmChegada - kmSaida : undefined,
  };

  try {
    const response = await fetchWithUser("/api/km", {
      method: "PUT",
      body: JSON.stringify(dadosAtualizados),
    });
    if (!response.ok) throw new Error("Erro ao atualizar registro");

    alert("Registro atualizado com sucesso!");
    fecharModalEdicao();
    carregarRegistros();
  } catch (error) {
    console.error("Erro:", error);
    alert("Erro ao atualizar registro.");
  }
}

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
});

// Baixa o relatório em CSV
async function baixarRelatorioCSV() {
  try {
    // 1. Filtra e ordena registros como antes
    const dadosFiltrados = aplicarFiltrosInterno(registros)
      .sort((a, b) => {
        const c = new Date(a.createdAt) - new Date(b.createdAt);
        if (c !== 0) return c;
        const d = new Date(a.data) - new Date(b.data);
        if (d !== 0) return d;
        const ka = a.kminicial != null ? a.kminicial : a.kmSaida;
        const kb = b.kminicial != null ? b.kminicial : b.kmSaida;
        return ka - kb;
      })
      .map((r) => ({
        Data: formatarData(r.data),
        Chamado: r.chamado || "",
        Local: r.local || "",
        "KM Saída": r.kmSaida != null ? r.kmSaida : "",
        "KM Chegada": r.kmChegada != null ? r.kmChegada : "",
        "KM Total": r.kmTotal != null ? r.kmTotal : "",
        Observações: r.observacoes || "",
      }));

    if (!dadosFiltrados.length) {
      alert("Nenhum registro disponível para exportar.");
      return;
    }

    // 2. Monta CSV usando ponto e vírgula
    const headers = Object.keys(dadosFiltrados[0]);
    const esc = (v) =>
      '"' + (v == null ? "" : String(v).replace(/"/g, '""')) + '"';
    const sep = ";";
    const lines = [headers.join(sep)];
    for (const row of dadosFiltrados) {
      lines.push(headers.map((h) => esc(row[h])).join(sep));
    }
    const csv = lines.join("\r\n");

    // 3. Adiciona BOM para Excel reconhecer UTF-8
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });

    // 4. Gatilho de download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio_km.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Erro:", error);
    alert("Erro ao baixar relatório.");
  }
}

// Baixa o relatório em XLS
async function baixarRelatorioXLS() {
  try {
    // //Ordem do mais novo para o mais antigo - Conforme inserção no banco - Preservar para uso futuro
    // let dados = aplicarFiltrosInterno(registros).map((r) => ({
    //   Data: formatarData(r.data),
    //   Chamado: r.chamado || "",
    //   Local: r.local || "",
    //   "KM Saída": r.kmSaida,
    //   "KM Chegada": r.kmChegada,
    //   "KM Total": r.kmTotal,
    //   Observações: r.observacoes || "",
    // }));

    //Traz os dados por ordem do mais velho para o mais novo
    let dados = aplicarFiltrosInterno(registros)
      .sort((a, b) => {
        // 1. Ordena por createdAt (do mais antigo para o mais novo)
        const c = new Date(a.createdAt) - new Date(b.createdAt);
        if (c !== 0) return c;

        // 2. Ordena por data do evento (do mais antigo para o mais novo)
        const d = new Date(a.data) - new Date(b.data);
        if (d !== 0) return d;

        // 3. Ordena pela continuidade (kminicial ou kmSaida)
        const ka = a.kminicial != null ? a.kminicial : a.kmSaida;
        const kb = b.kminicial != null ? b.kminicial : b.kmSaida;
        return ka - kb;
      })
      .map((r) => ({
        Data: formatarData(r.data),
        Chamado: r.chamado || "",
        Local: r.local || "",
        "KM Saída": r.kmSaida,
        "KM Chegada": r.kmChegada,
        "KM Total": r.kmTotal,
        Observações: r.observacoes || "",
      }));

    if (dados.length === 0) {
      alert("Nenhum registro disponível para exportar.");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(dados);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório KM");

    const colWidths = Object.keys(dados[0]).map((key) => ({
      wch:
        Math.max(
          key.length,
          ...dados.map((r) => (r[key] ? r[key].toString().length : 0))
        ) + 2,
    }));
    worksheet["!cols"] = colWidths;

    XLSX.writeFile(workbook, "relatorio_km.xlsx");
  } catch (error) {
    console.error("Erro:", error);
    alert("Erro ao gerar relatório em XLSX.");
  }
}