// js/management.js - usa sessionStorage para sessão e fetchWithUser

// ----------------- HELPER FETCH -----------------
// Centraliza chamada ao backend, adicionando usuário logado e Content-Type
function fetchWithUser(url, opts = {}) {
  const username = sessionStorage.getItem('km_username');
  opts = opts || {};
  opts.headers = opts.headers || {};

  if (username) opts.headers['X-Usuario'] = username;
  if (opts.body && !opts.headers['Content-Type']) {
    opts.headers['Content-Type'] = 'application/json';
  }

  return fetch(url, opts);
}

// Verifica sessão ao iniciar (caso o guard inline falhe por algum motivo)
if (!sessionStorage.getItem('km_username')) {
  try { localStorage.removeItem('km_username'); } catch (e) {}
  const redirect = encodeURIComponent(location.pathname + location.search + location.hash);
  window.location.replace('/index.html?redirect=' + redirect);
}

// ----------------- VARIÁVEIS GLOBAIS -----------------
let registroSelecionado = null;
let registros = [];
let paginaAtual = 1;
const registrosPorPagina = 10;

// ----------------- INICIALIZAÇÃO -----------------
document.addEventListener("DOMContentLoaded", function () {
  carregarRegistros();

  // Botões principais
  document.getElementById("btnVoltar").addEventListener("click", () => {
    window.location.href = "app.html";
  });
  document.getElementById("btnBaixarRelatorioCSV").addEventListener("click", baixarRelatorioCompletoCSV);
  document.getElementById("btnBaixarRelatorioXLS").addEventListener("click", baixarRelatorioCompletoXLS);
  document.getElementById("btnAplicarFiltros").addEventListener("click", aplicarFiltros);
  document.getElementById("btnLimparFiltros").addEventListener("click", limparFiltros);

  // Paginação
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
  document.getElementById("btnCancelarExclusao").addEventListener("click", fecharModalExclusao);
  document.getElementById("btnConfirmarExclusao").addEventListener("click", confirmarExclusao);

  // Modal de edição
  document.getElementById("btnCancelarEdicao").addEventListener("click", fecharModalEdicao);
  document.getElementById("formEditar").addEventListener("submit", salvarEdicao);

  // Botões fora da tabela
  document.getElementById("btnEditar").addEventListener("click", () => {
    if (!registroSelecionado) {
      alert("Selecione um registro para editar!");
      return;
    }
    abrirModalEdicao(registroSelecionado);
  });

  document.getElementById("btnExcluir").addEventListener("click", () => {
    if (!registroSelecionado) {
      alert("Selecione um registro para excluir!");
      return;
    }
    abrirModalExclusao(registroSelecionado);
  });
});

// ----------------- FILTROS -----------------
function limparFiltros() {
  document.getElementById("filtroDataInicio").value = "";
  document.getElementById("filtroDataFim").value = "";
  document.getElementById("filtroLocal").value = "";

  paginaAtual = 1;
  exibirRegistros();
}

async function carregarRegistros() {
  try {
    const response = await fetchWithUser("/api/km");
    if (!response.ok) throw new Error("Erro ao carregar registros");

    registros = await response.json();

    // Calcula KM total
    registros.forEach((registro) => {
      registro.kmTotal = (registro.kmChegada || 0) - (registro.kmSaida || 0);
    });

    // Ordena por data (desc) e depois por createdAt
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

// ----------------- EXIBIÇÃO -----------------
function exibirRegistros() {
  const tbody = document.querySelector("#tabelaRegistros tbody");
  tbody.innerHTML = "";

  let registrosFiltrados = aplicarFiltrosInterno(registros);

  const inicio = (paginaAtual - 1) * registrosPorPagina;
  const fim = inicio + registrosPorPagina;
  const registrosPagina = registrosFiltrados.slice(inicio, fim);

  const totalPaginas = Math.max(1, Math.ceil(registrosFiltrados.length / registrosPorPagina));
  document.getElementById("infoPagina").textContent = `Página ${paginaAtual} de ${totalPaginas}`;
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
      <td><input type="radio" name="registroSelecionado" value="${registro._id}"></td>
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
  document.querySelectorAll("input[name='registroSelecionado']").forEach((radio) => {
    radio.addEventListener("change", () => {
      registroSelecionado = radio.value;
    });
  });
}

function aplicarFiltros() {
  paginaAtual = 1;
  exibirRegistros();
}

function aplicarFiltrosInterno(registros) {
  const dataInicio = document.getElementById("filtroDataInicio").value;
  const dataFim = document.getElementById("filtroDataFim").value;
  const local = (document.getElementById("filtroLocal").value || "").toLowerCase();

  return registros.filter((registro) => {
    if (dataInicio && registro.data < dataInicio) return false;
    if (dataFim && registro.data > dataFim) return false;
    const campoLocal = (registro.local || "").toLowerCase();
    if (local && !campoLocal.includes(local)) return false;
    return true;
  });
}

function formatarData(data) {
  if (!data) return "";
  const partes = (typeof data === "string" ? data : "").split("-");
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return data;
}

// ----------------- EXCLUSÃO -----------------
function abrirModalExclusao(id) {
  registroSelecionado = id;
  document.getElementById("modalExcluir").style.display = "flex";
}

function fecharModalExclusao() {
  registroSelecionado = null;
  document.getElementById("modalExcluir").style.display = "none";
}

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

// ----------------- EDIÇÃO -----------------
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

function fecharModalEdicao() {
  document.getElementById("modalEditar").style.display = "none";
}

async function salvarEdicao(e) {
  e.preventDefault();

  const id = document.getElementById("editId").value;
  const data = document.getElementById("editData").value;
  const chamado = document.getElementById("editChamado").value;
  const local = document.getElementById("editLocal").value;
  const kmSaida = parseInt(document.getElementById("editKmSaida").value);
  const kmChegada = parseInt(document.getElementById("editKmChegada").value);
  const observacoes = document.getElementById("editObservacoes").value;

  if (!id) {
    alert("ID do registro ausente.");
    return;
  }

  if (!isNaN(kmChegada) && !isNaN(kmSaida) && kmChegada < kmSaida) {
    alert("KM de chegada não pode ser menor que KM de saída!");
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
    kmTotal: (!isNaN(kmChegada) && !isNaN(kmSaida)) ? (kmChegada - kmSaida) : undefined,
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

// ----------------- RELATÓRIOS -----------------
async function baixarRelatorioCompletoCSV() {
  try {
    const dataInicio = document.getElementById("filtroDataInicio").value;
    const dataFim = document.getElementById("filtroDataFim").value;
    const local = document.getElementById("filtroLocal").value;
    const username = sessionStorage.getItem('km_username'); // ✅ usuário logado

    let query = `?format=csv${username ? `&username=${username}` : ""}`;
    if (dataInicio) query += `&from=${dataInicio}`;
    if (dataFim) query += `&to=${dataFim}`;
    if (local) query += `&local=${encodeURIComponent(local)}`;

    const response = await fetchWithUser(`/api/report${query}`);
    if (!response.ok) throw new Error("Erro ao baixar relatório");

    const csv = await response.text();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio_km_completo.csv";
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Erro:", error);
    alert("Erro ao baixar relatório.");
  }
}


async function baixarRelatorioCompletoXLS() {
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
      wch: Math.max(
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

// //<!-- Guard: exige sessão (sessionStorage). Se não existir, redireciona para index.html -->
  
//     (function () {
//       try {
//         const username = sessionStorage.getItem('km_username');
//         if (!username) {
//           try { localStorage.removeItem('km_username'); } catch (e) {}
//           const redirect = encodeURIComponent(location.pathname + location.search + location.hash);
//           window.location.replace('/index.html?redirect=' + redirect);
//         }
//       } catch (e) {
//         window.location.replace('/index.html?redirect=' + encodeURIComponent(location.pathname));
//       }
//     })();
 