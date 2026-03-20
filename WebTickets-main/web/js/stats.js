import { getHealth, getStats } from './api.js';
import {
  setupNavbar,
  setYear,
  toast,
  escapeHtml,
  priorityLabel,
  statusBadgeClass
} from './ui.js';

setupNavbar();
setYear();

/* Elements */
const healthText = document.getElementById('healthText');
const healthDetail = document.getElementById('healthDetail');
const totalTickets = document.getElementById('totalTickets');

const statusCards = document.getElementById('statusCards');
const priorityCards = document.getElementById('priorityCards');
const recentGrid = document.getElementById('recentGrid');

const recentEmpty = document.getElementById('recentEmpty');
const loadingInline = document.getElementById('loadingInline');

const reloadBtn = document.getElementById('reloadBtn');

function setLoading(isLoading) {
  loadingInline.classList.toggle('is-hidden', !isLoading);
  recentGrid.setAttribute('aria-busy', String(isLoading));
}

function renderMiniCard(title, value, subtitle = '') {
  const el = document.createElement('article');
  el.className = 'card';
  el.innerHTML = `
    <h3>${escapeHtml(title)}</h3>
    <p class="big">${escapeHtml(value)}</p>
    <p class="muted">${escapeHtml(subtitle)}</p>
  `;
  return el;
}

function renderRecentTicket(t) {
  const el = document.createElement('article');
  el.className = 'card';
  el.innerHTML = `
    <h3>#${escapeHtml(t.incident_id)} — ${escapeHtml(t.ci_name ?? 'Sem título')}</h3>
    <div class="card__meta">
      <span class="badge ${statusBadgeClass(t.status)}"><strong>Status:</strong> ${escapeHtml(t.status ?? '—')}</span>
      <span class="badge"><strong>Prioridade:</strong> ${escapeHtml(priorityLabel(t.priority))}</span>
      <span class="badge"><strong>Criação:</strong> ${escapeHtml(t.open_time ?? '—')}</span>
    </div>
    <p class="muted" style="margin: 10px 0 0;">
      <strong>Categoria:</strong> ${escapeHtml(t.category ?? '—')}
    </p>
  `;
  return el;
}

async function loadAll() {
  try {
    setLoading(true);

    // 1) GET /health
    const health = await getHealth();
    healthText.textContent = 'OK';
    healthDetail.textContent = health?.message ? String(health.message) : 'Servidor operacional';

    // 2) GET /tickets/stats?view=status
    const status = await getStats('status');
    statusCards.innerHTML = '';
    totalTickets.textContent = String(status?.total ?? '—');

    statusCards.appendChild(renderMiniCard('Open', String(status?.open ?? 0), 'Tickets em aberto'));
    statusCards.appendChild(renderMiniCard('Work in progress', String(status?.inProgress ?? 0), 'Em progresso'));
    statusCards.appendChild(renderMiniCard('Closed', String(status?.closed ?? 0), 'Encerrados'));
    statusCards.appendChild(renderMiniCard('Total', String(status?.total ?? 0), 'Todos'));

    // 3) GET /tickets/stats?view=priority
    const pr = await getStats('priority');
    priorityCards.innerHTML = '';
    priorityCards.appendChild(renderMiniCard('1 - Baixa', String(pr?.low ?? 0), 'Prioridade 1'));
    priorityCards.appendChild(renderMiniCard('2 - Média', String(pr?.medium ?? 0), 'Prioridade 2'));
    priorityCards.appendChild(renderMiniCard('3 - Alta', String(pr?.high ?? 0), 'Prioridade 3'));
    priorityCards.appendChild(renderMiniCard('4 - Crítica', String(pr?.critical ?? 0), 'Prioridade 4'));

    // 4) GET /tickets/stats?view=recent&days=7
    const recent = await getStats('recent', { days: '7' });
    const list = Array.isArray(recent?.tickets) ? recent.tickets : [];

    recentGrid.innerHTML = '';
    recentEmpty.classList.toggle('is-hidden', list.length !== 0);

    for (const t of list) recentGrid.appendChild(renderRecentTicket(t));

  } catch (err) {
    toast('toasts', 'error', 'Erro', err.message || 'Falha ao carregar estatísticas.');
    healthText.textContent = '—';
    healthDetail.textContent = '—';
  } finally {
    setLoading(false);
  }
}

reloadBtn.addEventListener('click', loadAll);

loadAll();