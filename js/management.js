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
  document
    .getElementById("btnAplicarFiltros")
    .addEventListener("click", aplicarFiltros);
  document
    .getElementById("btnLimparFiltros")
    .addEventListener("click", limparFiltros);
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

  return registros.filter((registro) => {
    if (dataInicio && registro.data < dataInicio) return false;
    if (dataFim && registro.data > dataFim) return false;
    const campoLocal = (registro.local || "").toLowerCase();
    if (local && !campoLocal.includes(local)) return false;
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
  const kmSaida = parseInt(document.getElementById("editKmSaida").value);
  const kmChegadaInput = parseInt(document.getElementById("editKmChegada").value);
  const observacoes = document.getElementById("editObservacoes").value;

  if (!id) {
    alert("ID do registro ausente.");
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

  const kmChegada = kmChegadaInput === "" ? null : Number(kmChegadaInput);

  const dadosAtualizados = {
    id,
    data,
    chamado,
    local,
    observacoes,
    kmSaida,
    kmChegada,
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
    // Aplica os mesmos filtros do XLS (cliente) para garantir consistência
    const dadosFiltrados = aplicarFiltrosInterno(registros).map((r) => ({
      Data: formatarData(r.data),
      Chamado: r.chamado || "",
      Local: r.local || "",
      "KM Saída": r.kmSaida != null ? r.kmSaida : "",
      "KM Chegada": r.kmChegada != null ? r.kmChegada : "",
      "KM Total": r.kmTotal != null ? r.kmTotal : "",
      Observações: r.observacoes || "",
    }));

    if (!dadosFiltrados || dadosFiltrados.length === 0) {
      alert("Nenhum registro disponível para exportar.");
      return;
    }

    const headers = Object.keys(dadosFiltrados[0]);
    const esc = (v) => '"' + (v == null ? "" : String(v).replace(/"/g, '""')) + '"';
    const lines = [headers.join(",")];
    for (const row of dadosFiltrados) {
      lines.push(headers.map((h) => esc(row[h])).join(","));
    }
    const csv = lines.join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio_km_completo.csv";
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
    let dados = aplicarFiltrosInterno(registros).map((r) => ({
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

    XLSX.writeFile(workbook, "relatorio_km_completo.xlsx");
  } catch (error) {
    console.error("Erro:", error);
    alert("Erro ao gerar relatório em XLSX.");
  }
}
