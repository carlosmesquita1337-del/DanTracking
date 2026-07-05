// URL do Google Apps Script publicado (Web App) que expõe a planilha "RemessasUnilog" como JSON,
// agora atrás de login por token. Todas as chamadas são POST — nunca GET — para nunca colocar
// token/senha em query string.
const API_URL = 'https://script.google.com/macros/s/AKfycbzN0ONjn3ahen3PoFRA8tUGbBHtetpT1ciobBmQd1ZVg9qhV2r1RvesNI1E0GCXLnBJ/exec';

const VIEW_KEYS = ['dashboard', 'todos', 'atendidos', 'despachados', 'recebidos', 'atendidos7', 'despachados7', 'semremessa'];
const VIEW_LABELS = {
  dashboard: 'Indicadores',
  todos: 'Todos',
  atendidos: 'Atendidos',
  despachados: 'Despachados',
  recebidos: 'Recebidos',
  atendidos7: 'Atendidos +7d sem despacho',
  despachados7: 'Despachados +7d sem receber',
  semremessa: 'Saldo sem remessa',
};
const SESSION_KEY = 'ru_session_v1';

// Ícones (inline SVG, sem dependência externa) usados na navegação lateral e nos cards de estatística.
const ICONS = {
  dashboard: '<svg class="icon" viewBox="0 0 24 24"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>',
  todos: '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  atendidos: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="8 12 11 15 16 9"/></svg>',
  despachados: '<svg class="icon" viewBox="0 0 24 24"><rect x="1" y="7" width="13" height="10" rx="1.5"/><path d="M14 10h4l4 3.2V17h-4"/><circle cx="6" cy="19" r="1.6"/><circle cx="17" cy="19" r="1.6"/></svg>',
  recebidos: '<svg class="icon" viewBox="0 0 24 24"><path d="M21 12v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  atendidos7: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>',
  despachados7: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 2 21 20H3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="16.5" x2="12" y2="16.5"/></svg>',
  semremessa: '<svg class="icon" viewBox="0 0 24 24"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>',
};

// Cor de destaque de cada métrica nos cards do topo (classes definidas em style.css).
const STAT_META = {
  todos: { label: 'Itens no total', color: 'accent' },
  atendidos: { label: 'Atendidos, ainda não despachados', color: 'purple' },
  despachados: { label: 'Despachados', color: 'amber' },
  recebidos: { label: 'Recebidos (parcial + total)', color: 'green' },
  semremessa: { label: 'Com saldo 150, sem remessa', color: 'gray' },
  atendidos7: { label: 'Atendidos há +7 dias, sem despacho', color: 'red' },
  despachados7: { label: 'Despachados há +7 dias, sem receber', color: 'red' },
};
const STAT_COLOR_BG = { accent: 'var(--accent-bg)', purple: 'var(--purple-bg)', amber: 'var(--amber-bg)', green: 'var(--green-bg)', red: 'var(--red-bg)', gray: 'var(--gray-bg)' };
const STAT_COLOR_FG = { accent: 'var(--accent-dark)', purple: 'var(--purple)', amber: 'var(--amber)', green: 'var(--green)', red: 'var(--red)', gray: 'var(--gray)' };

let session = null; // { token, nome, role, permissoes }
let currentTab = null;
let currentSub = '';
let currentItems = [];
let currentSemRemessa = [];
let sortDir = 'asc'; // ordenação por Cobertura Instituto (dias): 'asc' ou 'desc'

// ---------- Elementos ----------
const loginScreen = document.getElementById('loginScreen');
const loginForm = document.getElementById('loginForm');
const loginUsername = document.getElementById('loginUsername');
const loginSenha = document.getElementById('loginSenha');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');

const appScreen = document.getElementById('appScreen');
const userInfo = document.getElementById('userInfo');
const userRoleLabel = document.getElementById('userRoleLabel');
const userAvatar = document.getElementById('userAvatar');
const adminBtn = document.getElementById('adminBtn');
const logoutBtn = document.getElementById('logoutBtn');
const refreshBtn = document.getElementById('refreshBtn');
const bannerDateEl = document.getElementById('bannerDate');
const bannerGreetingEl = document.getElementById('bannerGreeting');
const bannerStatsEl = document.getElementById('bannerStats');

const tabsEl = document.getElementById('tabs');
const stateMsg = document.getElementById('stateMsg');
const searchInput = document.getElementById('searchInput');
const searchWrapEl = document.querySelector('.search-wrap');
const subfilterEl = document.getElementById('subfilter');
const resultCountEl = document.getElementById('resultCount');
const lastUpdatedEl = document.getElementById('lastUpdated');
const summaryEl = document.getElementById('summary');
const mainTableWrap = document.getElementById('mainTableWrap');
const semRemessaTableWrap = document.getElementById('semRemessaTableWrap');
const tableBody = document.getElementById('tableBody');
const semRemessaBody = document.getElementById('semRemessaBody');
const semRemessaStateMsg = document.getElementById('semRemessaStateMsg');
const thCobertura = document.getElementById('thCobertura');
const thCoberturaSemRemessa = document.getElementById('thCoberturaSemRemessa');
const sortArrowMain = document.getElementById('sortArrowMain');
const sortArrowSemRemessa = document.getElementById('sortArrowSemRemessa');

// Elementos da aba "Indicadores" (dashboard com gráfico de pizza + colunas)
const dashboardWrap = document.getElementById('dashboardWrap');
const dashboardStateMsg = document.getElementById('dashboardStateMsg');
const pieSvg = document.getElementById('pieSvg');
const pieSegGreen = document.getElementById('pieSegGreen');
const pieSegYellow = document.getElementById('pieSegYellow');
const pieSegRed = document.getElementById('pieSegRed');
const pieSegGray = document.getElementById('pieSegGray');
const pieTotalEl = document.getElementById('pieTotal');
const pieLegendEl = document.getElementById('pieLegend');
const barValAtendidos7El = document.getElementById('barValAtendidos7');
const barValDespachados7El = document.getElementById('barValDespachados7');
const barFillAtendidos7El = document.getElementById('barFillAtendidos7');
const barFillDespachados7El = document.getElementById('barFillDespachados7');
const kpiTotalEl = document.getElementById('kpiTotal');
const kpiCriticoEl = document.getElementById('kpiCritico');
const kpiParadosEl = document.getElementById('kpiParados');
const kpiSemRemessaEl = document.getElementById('kpiSemRemessa');

const adminOverlay = document.getElementById('adminOverlay');
const adminCloseBtn = document.getElementById('adminCloseBtn');
const createUserForm = document.getElementById('createUserForm');
const newPermissoesEl = document.getElementById('newPermissoes');
const createUserMsg = document.getElementById('createUserMsg');
const usersListWrap = document.getElementById('usersListWrap');

// ---------- API ----------
async function api(action, extra) {
  const body = Object.assign({ action: action }, extra || {});
  if (session && session.token) body.token = session.token;
  let res, data;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    });
    data = await res.json();
  } catch (err) {
    return { error: 'rede', mensagem: 'Falha de conexão com o servidor.' };
  }
  if (data && data.error === 'sessao_invalida') {
    clearSession();
    showLogin('Sua sessão expirou. Faça login novamente.');
  }
  return data;
}

// ---------- Sessão ----------
function saveSession(s) {
  session = s;
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {}
}
function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}
function clearSession() {
  session = null;
  try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
}

function showLogin(message) {
  appScreen.style.display = 'none';
  adminOverlay.style.display = 'none';
  loginScreen.style.display = '';
  if (message) {
    loginError.textContent = message;
    loginError.style.display = '';
  } else {
    loginError.style.display = 'none';
  }
  loginSenha.value = '';
}

function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function renderBanner() {
  const now = new Date();
  bannerDateEl.textContent = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const firstName = (session.nome || '').trim().split(/\s+/)[0] || '';
  bannerGreetingEl.textContent = 'Bem-vindo' + (firstName ? ', ' + firstName : '');
}

function showApp() {
  loginScreen.style.display = 'none';
  appScreen.style.display = '';
  userInfo.textContent = session.nome || '';
  userRoleLabel.textContent = session.role === 'admin' ? 'Administrador' : 'Usuário';
  userAvatar.textContent = initials(session.nome);
  adminBtn.style.display = session.role === 'admin' ? '' : 'none';
  renderBanner();
  buildTabs();
  updateSubfilterOptions();
  updateTopbarForTab();
  updateSortArrows();
  loadCounts();
  loadCurrentView();
}

// ---------- Login form ----------
loginForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  loginBtn.disabled = true;
  loginBtn.textContent = 'Entrando…';
  loginError.style.display = 'none';
  const username = loginUsername.value.trim();
  const senha = loginSenha.value;
  const data = await api('login', { username: username, senha: senha });
  loginBtn.disabled = false;
  loginBtn.textContent = 'Entrar';
  if (data.error) {
    loginError.textContent = data.mensagem || 'Usuário ou senha inválidos.';
    loginError.style.display = '';
    return;
  }
  saveSession({ token: data.token, username: username, nome: data.nome, role: data.role, permissoes: data.permissoes });
  showApp();
});

logoutBtn.addEventListener('click', async () => {
  await api('logout', {});
  clearSession();
  showLogin();
});

// ---------- Tabs ----------
function buildTabs() {
  const allowed = VIEW_KEYS.filter(v => session.role === 'admin' || session.permissoes.indexOf(v) !== -1);
  tabsEl.innerHTML = '';
  allowed.forEach((v, idx) => {
    const div = document.createElement('div');
    div.className = 'tab' + (idx === 0 ? ' active' : '');
    div.dataset.tab = v;
    div.innerHTML = `<span class="tab-icon">${ICONS[v] || ''}</span><span class="tab-label">${escapeHtml(VIEW_LABELS[v] || v)}</span>`;
    div.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      div.classList.add('active');
      currentTab = v;
      currentSub = '';
      updateSubfilterOptions();
      updateTopbarForTab();
      loadCurrentView();
    });
    tabsEl.appendChild(div);
  });
  currentTab = allowed[0] || null;
}

searchInput.addEventListener('input', render);
subfilterEl.addEventListener('change', () => { currentSub = subfilterEl.value; render(); });
refreshBtn.addEventListener('click', () => { loadCounts(); loadCurrentView(); });

function updateSubfilterOptions() {
  if (currentTab === 'atendidos' || currentTab === 'recebidos') {
    subfilterEl.style.display = '';
    subfilterEl.innerHTML = '<option value="">Parcial e total</option><option value="parcial">Só parcial</option><option value="total">Só total</option>';
  } else {
    subfilterEl.style.display = 'none';
  }
}

// A aba "Indicadores" não usa busca por texto — some com a barra de busca nela.
// Os cards de resumo (summaryEl) também somem nessa aba: os mesmos números já
// aparecem nos KPIs e nos gráficos da própria aba, então mostrar os dois é
// redundante e só rouba espaço da tela.
function updateTopbarForTab() {
  const isDashboard = currentTab === 'dashboard';
  if (searchWrapEl) searchWrapEl.style.display = isDashboard ? 'none' : '';
  resultCountEl.style.display = isDashboard ? 'none' : '';
  summaryEl.style.display = isDashboard ? 'none' : '';
}

// ---------- Formatação ----------
function fmtQty(n) {
  if (n === null || n === undefined) return '<span class="muted">—</span>';
  return n.toLocaleString('pt-BR');
}
function badge(kind, value) {
  if (kind === 'status') {
    const label = { total: 'Total', parcial: 'Parcial', nao: 'Não' }[value] || value;
    return `<span class="badge ${value}">${label}</span>`;
  }
  return '';
}
function fmtDespacho(it) {
  if (!it.despachado) return '<span class="badge desp-false">Pendente</span>';
  const partes = [
    it.cargaNumero ? 'N° ' + it.cargaNumero : '',
    it.cargaStatusTexto || '',
    it.dataDespacho || ''
  ].filter(Boolean);
  return `<span class="badge desp-true">${escapeHtml(partes.join(' - '))}</span>`;
}
function escapeHtml(v) {
  if (v === null || v === undefined) return '';
  return v.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function sortByCobertura(list, dir) {
  const mult = dir === 'desc' ? -1 : 1;
  list.sort((a, b) => {
    const av = a.coberturaInstitutoDias, bv = b.coberturaInstitutoDias;
    if (av === null || av === undefined) return (bv === null || bv === undefined) ? 0 : 1;
    if (bv === null || bv === undefined) return -1;
    return (av - bv) * mult;
  });
  return list;
}
function updateSortArrows() {
  const arrow = sortDir === 'desc' ? '▼' : '▲';
  if (sortArrowMain) sortArrowMain.textContent = arrow;
  if (sortArrowSemRemessa) sortArrowSemRemessa.textContent = arrow;
}
function toggleSort() {
  sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  updateSortArrows();
  render();
}
if (thCobertura) thCobertura.addEventListener('click', toggleSort);
if (thCoberturaSemRemessa) thCoberturaSemRemessa.addEventListener('click', toggleSort);

// ---------- Carregamento de dados ----------
async function loadCurrentView() {
  if (!currentTab) return;
  if (currentTab === 'dashboard') {
    await loadDashboardData();
    return;
  }
  stateMsg.style.display = '';
  stateMsg.className = 'state';
  stateMsg.textContent = 'Carregando…';
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Atualizando…';
  const data = await api('data', { view: currentTab });
  refreshBtn.disabled = false;
  refreshBtn.textContent = 'Atualizar';
  if (data.error) {
    stateMsg.className = 'state error';
    stateMsg.textContent = 'Não foi possível carregar os dados (' + data.error + ').';
    currentItems = [];
    currentSemRemessa = [];
    tableBody.innerHTML = '';
    semRemessaBody.innerHTML = '';
    return;
  }
  if (data.generatedAt) {
    lastUpdatedEl.textContent = 'Dados da planilha gerados em: ' + new Date(data.generatedAt).toLocaleString('pt-BR');
  }
  if (currentTab === 'semremessa') {
    currentSemRemessa = data.semRemessa || [];
  } else {
    currentItems = data.items || [];
  }
  render();
}

// ---------- Aba "Indicadores" (dashboard com gráfico de pizza + colunas) ----------
async function loadDashboardData() {
  mainTableWrap.style.display = 'none';
  semRemessaTableWrap.style.display = 'none';
  dashboardWrap.style.display = '';
  stateMsg.style.display = 'none';
  semRemessaStateMsg.style.display = 'none';
  dashboardStateMsg.style.display = 'none';
  dashboardStateMsg.textContent = '';
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Atualizando…';

  const [dataResp, countsResp] = await Promise.all([
    api('data', { view: 'todos' }),
    api('counts', {}),
  ]);

  refreshBtn.disabled = false;
  refreshBtn.textContent = 'Atualizar';

  if (dataResp.generatedAt) {
    lastUpdatedEl.textContent = 'Dados da planilha gerados em: ' + new Date(dataResp.generatedAt).toLocaleString('pt-BR');
  }

  if (dataResp.error) {
    pieTotalEl.textContent = '—';
    pieLegendEl.innerHTML = '';
    kpiTotalEl.textContent = '—';
    kpiCriticoEl.textContent = '—';
    dashboardStateMsg.style.display = '';
    dashboardStateMsg.className = 'dash-alert';
    dashboardStateMsg.textContent = 'Não foi possível carregar os indicadores (' + dataResp.error + ').';
  } else {
    renderCoveragePie(dataResp.items || []);
  }

  renderDelayBars((countsResp && countsResp.counts) || {});
}

function renderCoveragePie(items) {
  let green = 0, yellow = 0, red = 0, gray = 0;
  items.forEach((it) => {
    const c = it.coberturaInstitutoDias;
    if (c === null || c === undefined) gray++;
    else if (c > 30) green++;
    else if (c >= 10) yellow++;
    else red++;
  });
  const total = green + yellow + red + gray;
  pieTotalEl.textContent = total;
  kpiTotalEl.textContent = total;
  const criticoPct = total > 0 ? Math.round((red / total) * 100) : 0;
  kpiCriticoEl.textContent = total > 0 ? `${red} (${criticoPct}%)` : '0';

  const R = 80;
  const C = 2 * Math.PI * R;
  // Deslocamento fixo de 1/4 de volta para o primeiro segmento começar às 12h.
  const START_OFFSET = C / 4;

  const segs = [
    { el: pieSegGreen, val: green, colorVar: '--green', label: 'Cobertura > 30 dias' },
    { el: pieSegYellow, val: yellow, colorVar: '--amber', label: 'Cobertura de 10 a 30 dias' },
    { el: pieSegRed, val: red, colorVar: '--red', label: 'Cobertura < 10 dias' },
    { el: pieSegGray, val: gray, colorVar: '--gray', label: 'Sem informação de cobertura' },
  ];

  let cumulative = 0;
  segs.forEach((s) => {
    const frac = total > 0 ? s.val / total : 0;
    const len = frac * C;
    const color = getComputedStyle(document.documentElement).getPropertyValue(s.colorVar).trim();
    s.el.style.stroke = color || '';
    s.el.style.strokeDasharray = `${len} ${C - len}`;
    s.el.style.strokeDashoffset = String(START_OFFSET - cumulative);
    cumulative += len;
  });

  // Reinicia a animação de "girar e aparecer" toda vez que a aba é aberta/atualizada.
  pieSvg.classList.remove('spin-in');
  void pieSvg.offsetWidth; // força reflow para permitir reexecutar a animação
  pieSvg.classList.add('spin-in');

  pieLegendEl.innerHTML = segs.map((s) => {
    const pct = total > 0 ? Math.round((s.val / total) * 100) : 0;
    const color = getComputedStyle(document.documentElement).getPropertyValue(s.colorVar).trim();
    return `
      <div class="legend-row">
        <span class="legend-dot" style="background:${color}"></span>
        <span class="legend-label">${escapeHtml(s.label)}</span>
        <span class="legend-value">${s.val} (${pct}%)</span>
      </div>`;
  }).join('');
}

function renderDelayBars(counts) {
  const a7 = counts.atendidos7 || 0;
  const d7 = counts.despachados7 || 0;
  barValAtendidos7El.textContent = a7;
  barValDespachados7El.textContent = d7;
  kpiParadosEl.textContent = a7 + d7;
  kpiSemRemessaEl.textContent = counts.semremessa !== undefined ? counts.semremessa : '—';
  const maxVal = Math.max(a7, d7, 1);

  // Zera antes de animar, para o crescimento acontecer sempre que a aba é aberta.
  [barFillAtendidos7El, barFillDespachados7El].forEach((el) => {
    el.style.transition = 'none';
    el.style.height = '0%';
  });
  // Duplo requestAnimationFrame garante que o navegador aplique o "0%" antes de animar.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      barFillAtendidos7El.style.transition = 'height 1s cubic-bezier(.22,1,.36,1)';
      barFillDespachados7El.style.transition = 'height 1s cubic-bezier(.22,1,.36,1)';
      barFillAtendidos7El.style.height = (a7 / maxVal * 100) + '%';
      barFillDespachados7El.style.height = (d7 / maxVal * 100) + '%';
    });
  });
}

async function loadCounts() {
  const data = await api('counts', {});
  if (data.error || !data.counts) return;
  const c = data.counts;

  // Cards completos (um por métrica que o usuário tem permissão de ver).
  const order = ['todos', 'atendidos', 'despachados', 'recebidos', 'semremessa', 'atendidos7', 'despachados7'];
  const cards = order.filter(k => c[k] !== undefined).map(k => {
    const meta = STAT_META[k] || { label: k, color: 'accent' };
    return `
      <div class="stat">
        <span class="stat-icon" style="background:${STAT_COLOR_BG[meta.color]};color:${STAT_COLOR_FG[meta.color]}">${ICONS[k] || ''}</span>
        <div class="n">${c[k]}</div>
        <div class="l">${escapeHtml(meta.label)}</div>
      </div>`;
  });
  summaryEl.innerHTML = cards.join('');

  // Resumo rápido no banner (só as 4 métricas mais relevantes do dia a dia).
  const bannerOrder = ['todos', 'atendidos', 'despachados', 'recebidos'];
  const bannerShortLabels = { todos: 'No total', atendidos: 'Sem despacho', despachados: 'Despachados', recebidos: 'Recebidos' };
  const bannerCards = bannerOrder.filter(k => c[k] !== undefined).map(k => `
    <div class="banner-stat">
      <div class="n">${c[k]}</div>
      <div class="l">${escapeHtml(bannerShortLabels[k] || k)}</div>
    </div>`);
  bannerStatsEl.innerHTML = bannerCards.join('');
}

// ---------- Render ----------
function matchesSearch(item, q) {
  if (!q) return true;
  q = q.toLowerCase();
  return [item.nReq, item.produtoCodigo, item.produtoDescricao].some(v => (v || '').toString().toLowerCase().includes(q));
}
function matchesSemRemessaSearch(item, q) {
  if (!q) return true;
  q = q.toLowerCase();
  return [item.produtoCodigo, item.produtoDescricao].some(v => (v || '').toString().toLowerCase().includes(q));
}
function matchesSub(item) {
  if (!currentSub) return true;
  if (currentTab === 'atendidos') return item.statusAtendimento === currentSub;
  if (currentTab === 'recebidos') return item.statusRecebimento === currentSub;
  return true;
}

function render() {
  if (currentTab === 'dashboard') return; // a aba Indicadores é renderizada por loadDashboardData()
  dashboardWrap.style.display = 'none'; // some com o dashboard ao trocar para qualquer outra aba
  if (currentTab === 'semremessa') {
    mainTableWrap.style.display = 'none';
    semRemessaTableWrap.style.display = '';
    renderSemRemessa();
    return;
  }
  mainTableWrap.style.display = '';
  semRemessaTableWrap.style.display = 'none';

  const q = searchInput.value.trim();
  const filtered = currentItems.filter(it => matchesSub(it) && matchesSearch(it, q));
  sortByCobertura(filtered, sortDir);

  resultCountEl.textContent = `${filtered.length} de ${currentItems.length} itens`;

  if (filtered.length === 0) {
    tableBody.innerHTML = '';
    stateMsg.style.display = '';
    stateMsg.className = 'state';
    stateMsg.textContent = 'Nenhum item encontrado com esse filtro.';
    return;
  }
  stateMsg.style.display = 'none';

  tableBody.innerHTML = filtered.map(it => `
    <tr>
      <td>${escapeHtml(it.nReq)}</td>
      <td class="prod-code">${escapeHtml(it.produtoCodigo)}</td>
      <td>${escapeHtml((it.produtoDescricao || '').replace(/^\S+\s*-\s*/, ''))}</td>
      <td class="qty">${fmtQty(it.qtdeSolicitada)}</td>
      <td>
        <span class="qty">${fmtQty(it.qtdeAtendida)}</span>
        ${badge('status', it.statusAtendimento)}
        ${it.dataAtendimento ? `<div class="subdate">${escapeHtml(it.dataAtendimento)}</div>` : ''}
      </td>
      <td>${fmtDespacho(it)}</td>
      <td>
        <span class="qty">${fmtQty(it.qtdeRecebida)}</span>
        ${badge('status', it.statusRecebimento)}
      </td>
      <td class="qty">${fmtQty(it.coberturaInstitutoDias)}</td>
    </tr>
  `).join('');
}

function renderSemRemessa() {
  const q = searchInput.value.trim();
  const filtered = currentSemRemessa.filter(it => matchesSemRemessaSearch(it, q));
  sortByCobertura(filtered, sortDir);

  resultCountEl.textContent = `${filtered.length} de ${currentSemRemessa.length} itens`;

  if (filtered.length === 0) {
    semRemessaBody.innerHTML = '';
    semRemessaStateMsg.style.display = '';
    semRemessaStateMsg.className = 'state';
    semRemessaStateMsg.textContent = 'Nenhum item encontrado com esse filtro.';
    return;
  }
  semRemessaStateMsg.style.display = 'none';

  semRemessaBody.innerHTML = filtered.map(it => `
    <tr>
      <td class="prod-code">${escapeHtml(it.produtoCodigo)}</td>
      <td>${escapeHtml(it.produtoDescricao)}</td>
      <td class="qty">${fmtQty(it.saldo150)}</td>
      <td class="qty">${fmtQty(it.coberturaInstitutoDias)}</td>
    </tr>
  `).join('');
}

// ---------- Painel de administração ----------
adminBtn.addEventListener('click', () => {
  adminOverlay.style.display = '';
  buildPermCheckboxes(newPermissoesEl, []);
  loadUsersList();
});
adminCloseBtn.addEventListener('click', () => { adminOverlay.style.display = 'none'; });

function buildPermCheckboxes(container, checkedList) {
  container.innerHTML = VIEW_KEYS.map(v => `
    <label class="perm-check">
      <input type="checkbox" value="${v}" ${checkedList.indexOf(v) !== -1 ? 'checked' : ''} />
      ${escapeHtml(VIEW_LABELS[v] || v)}
    </label>
  `).join('');
}

createUserForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  createUserMsg.textContent = '';
  const username = document.getElementById('newUsername').value.trim();
  const nome = document.getElementById('newNome').value.trim();
  const senha = document.getElementById('newSenha').value;
  const role = document.getElementById('newRole').value;
  const permissoes = Array.from(newPermissoesEl.querySelectorAll('input[type=checkbox]:checked')).map(c => c.value);
  const data = await api('adminCreateUser', { username, nome, senha, role, permissoes });
  if (data.error) {
    createUserMsg.className = 'admin-msg error';
    createUserMsg.textContent = mapAdminError(data.error);
    return;
  }
  createUserMsg.className = 'admin-msg ok';
  createUserMsg.textContent = 'Usuário criado com sucesso.';
  createUserForm.reset();
  buildPermCheckboxes(newPermissoesEl, []);
  loadUsersList();
});

function mapAdminError(err) {
  return {
    nao_autorizado: 'Você não tem permissão de administrador.',
    dados_invalidos: 'Dados inválidos (verifique usuário, nome, senha e abas selecionadas).',
    usuario_ja_existe: 'Já existe um usuário com esse login.',
    usuario_nao_encontrado: 'Usuário não encontrado.',
  }[err] || ('Erro: ' + err);
}

async function loadUsersList() {
  usersListWrap.textContent = 'Carregando…';
  const data = await api('adminListUsers', {});
  if (data.error) {
    usersListWrap.textContent = mapAdminError(data.error);
    return;
  }
  const users = data.users || [];
  usersListWrap.innerHTML = `
    <table class="admin-users-table">
      <thead><tr><th>Usuário</th><th>Nome</th><th>Papel</th><th>Abas permitidas</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${users.map(u => `
          <tr data-username="${escapeHtml(u.username)}">
            <td>${escapeHtml(u.username)}</td>
            <td>${escapeHtml(u.nome)}</td>
            <td>${u.role === 'admin' ? 'Administrador' : 'Usuário'}</td>
            <td class="perm-summary">${u.permissoes.map(p => VIEW_LABELS[p] || p).join(', ') || '—'}</td>
            <td>${u.ativo ? '<span class="badge total">Ativo</span>' : '<span class="badge nao">Inativo</span>'}</td>
            <td>
              <button class="link-btn edit-user-btn">Editar</button>
              ${u.username === session.username ? '' : (u.ativo
                ? '<button class="link-btn deactivate-user-btn">Desativar</button>'
                : '<button class="link-btn activate-user-btn">Ativar</button>')}
            </td>
          </tr>
          <tr class="edit-row" style="display:none;">
            <td colspan="6">
              <div class="admin-form-row edit-form">
                <div>
                  <label>Nome</label>
                  <input type="text" class="edit-nome" value="${escapeHtml(u.nome)}" />
                </div>
                <div>
                  <label>Nova senha (deixe em branco para não alterar)</label>
                  <input type="password" class="edit-senha" />
                </div>
                <div>
                  <label>Papel</label>
                  <select class="edit-role">
                    <option value="user" ${u.role !== 'admin' ? 'selected' : ''}>Usuário</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrador</option>
                  </select>
                </div>
              </div>
              <div>
                <label>Abas que este usuário pode ver</label>
                <div class="perm-checks edit-permissoes">${VIEW_KEYS.map(v => `
                  <label class="perm-check">
                    <input type="checkbox" value="${v}" ${u.permissoes.indexOf(v) !== -1 ? 'checked' : ''} />
                    ${escapeHtml(VIEW_LABELS[v] || v)}
                  </label>
                `).join('')}</div>
              </div>
              <button class="save-user-btn">Salvar alterações</button>
              <span class="admin-msg edit-msg"></span>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  usersListWrap.querySelectorAll('tr[data-username]').forEach(row => {
    const username = row.dataset.username;
    const editRow = row.nextElementSibling;
    const editBtn = row.querySelector('.edit-user-btn');
    if (editBtn) editBtn.addEventListener('click', () => {
      editRow.style.display = editRow.style.display === 'none' ? '' : 'none';
    });
    const deactivateBtn = row.querySelector('.deactivate-user-btn');
    if (deactivateBtn) deactivateBtn.addEventListener('click', async () => {
      const data = await api('adminDeactivateUser', { username });
      if (data.error) { alert(mapAdminError(data.error)); return; }
      loadUsersList();
    });
    const activateBtn = row.querySelector('.activate-user-btn');
    if (activateBtn) activateBtn.addEventListener('click', async () => {
      const data = await api('adminUpdateUser', { username, ativo: true });
      if (data.error) { alert(mapAdminError(data.error)); return; }
      loadUsersList();
    });
    const saveBtn = editRow ? editRow.querySelector('.save-user-btn') : null;
    if (saveBtn) saveBtn.addEventListener('click', async () => {
      const nome = editRow.querySelector('.edit-nome').value.trim();
      const senha = editRow.querySelector('.edit-senha').value;
      const role = editRow.querySelector('.edit-role').value;
      const permissoes = Array.from(editRow.querySelectorAll('.edit-permissoes input:checked')).map(c => c.value);
      const payload = { username, nome, role, permissoes };
      if (senha) payload.senha = senha;
      const msgEl = editRow.querySelector('.edit-msg');
      const data = await api('adminUpdateUser', payload);
      if (data.error) {
        msgEl.className = 'admin-msg error edit-msg';
        msgEl.textContent = mapAdminError(data.error);
        return;
      }
      msgEl.className = 'admin-msg ok edit-msg';
      msgEl.textContent = 'Salvo.';
      loadUsersList();
    });
  });
}

// ---------- Inicialização ----------
(function init() {
  const saved = loadSession();
  if (saved && saved.token) {
    session = saved;
    // Confirma que o token ainda é válido no servidor antes de mostrar o app.
    api('me', {}).then(data => {
      if (data.error) {
        clearSession();
        showLogin();
      } else {
        session.username = data.username;
        session.permissoes = data.permissoes;
        session.role = data.role;
        session.nome = data.nome;
        showApp();
      }
    });
  } else {
    showLogin();
  }
})();
