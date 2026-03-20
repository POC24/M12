import {
  getTickets,
  createTicket,
  updateTicket,
  deleteTicket
} from './api.js';

import {
  setupNavbar,
  setYear,
  toast,
  alertDialog,
  confirmDialog,
  escapeHtml,
  priorityLabel,
  statusBadgeClass
} from './ui.js';

setupNavbar();
setYear();

/* ============ State ============ */
const state = {
  page: 1,
  limit: 9, // cards por página
  hasMore: false,
  total: 0,
  filters: {
    status: '',
    priority: '',
    category: ''
  },
  editingId: null
};

/* ============ Elements ============ */
const ticketsGrid = document.getElementById('ticketsGrid');
const emptyState = document.getElementById('emptyState');
const loadingInline = document.getElementById('loadingInline');

const ticketsCountPill = document.getElementById('ticketsCountPill');
const pagePill = document.getElementById('pagePill');

const firstPageBtn = document.getElementById('firstPageBtn');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const lastPageBtn = document.getElementById('lastPageBtn');
const pageNumbersTop = document.getElementById('pageNumbersTop');

const pageSelect = document.getElementById('pageSelect');
const totalPagesPill = document.getElementById('totalPagesPill');

// Paginação (Fundo)
const firstPageBtnBottom = document.getElementById('firstPageBtnBottom');
const prevPageBtnBottom = document.getElementById('prevPageBtnBottom');
const nextPageBtnBottom = document.getElementById('nextPageBtnBottom');
const lastPageBtnBottom = document.getElementById('lastPageBtnBottom');
const pageNumbersBottom = document.getElementById('pageNumbersBottom');
const pageSelectBottom = document.getElementById('pageSelectBottom');
const totalPagesPillBottom = document.getElementById('totalPagesPillBottom');

const refreshBtn = document.getElementById('refreshBtn');
const openCreateBtn = document.getElementById('openCreateBtn');

const filtersForm = document.getElementById('filtersForm');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');

const ticketModal = document.getElementById('ticketModal');
const closeModalBtn = document.getElementById('closeModalBtn');

const ticketForm = document.getElementById('ticketForm');
const formLoading = document.getElementById('formLoading');

const cancelEditBtn = document.getElementById('cancelEditBtn');
const modalTitle = document.getElementById('modalTitle');

const incidentId = document.getElementById('incidentId');
const ciCat = document.getElementById('ciCat');
const ciSubcat = document.getElementById('ciSubcat');
const category = document.getElementById('category');
const impact = document.getElementById('impact');
const urgency = document.getElementById('urgency');
const priority = document.getElementById('priority');
const status = document.getElementById('status');
const closureCode = document.getElementById('closureCode');
const description = document.getElementById('description'); // Ex. 3.2

/* ============ Helpers UI ============ */
function setLoading(isLoading) {
  loadingInline.classList.toggle('is-hidden', !isLoading);
  ticketsGrid.setAttribute('aria-busy', String(isLoading));
}

function openModal() {
  ticketModal.classList.remove('is-hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  ticketModal.classList.add('is-hidden');
  document.body.style.overflow = '';
}

function resetForm() {
  state.editingId = null;
  incidentId.value = '';
  ticketForm.reset();
  modalTitle.textContent = 'Criar Ticket';
  cancelEditBtn.textContent = 'Cancelar';
  // status é “apenas edição”, deixamos vazio por defeito
  status.value = '';
  // Limpar modo de visualização se estava ativo
  setViewMode(false);
}

function fillFormFromTicket(t) {
  state.editingId = t.incident_id;
  incidentId.value = String(t.incident_id);

  ciCat.value = t.ci_cat ?? '';
  ciSubcat.value = t.ci_subcat ?? '';
  category.value = t.category ?? '';

  impact.value = String(t.impact ?? 0);
  urgency.value = String(t.urgency ?? 0);
  priority.value = String(t.priority ?? 1);
  status.value = String(t.status ?? '');
  closureCode.value = t.closure_code ?? '';
  if (description) description.value = t.description ?? ''; // Ex. 3.2

  modalTitle.textContent = `Editar Ticket #${t.incident_id}`;
  cancelEditBtn.textContent = 'Cancelar edição';
}

function setViewMode(isView) {
  const allInputs = ticketForm.querySelectorAll('input, select, textarea');
  const submitBtn = document.getElementById('submitBtn');

  if (isView) {
    allInputs.forEach(el => el.setAttribute('readonly', true));
    // selects não suportam readonly nativamente, usar disabled visualmente
    ticketForm.querySelectorAll('select').forEach(el => {
      el.setAttribute('disabled', true);
      el.style.pointerEvents = 'none';
      el.style.opacity = '0.75';
    });
    submitBtn.classList.add('is-hidden');
    cancelEditBtn.textContent = 'Fechar';
    modalTitle.textContent = `Ver Ticket #${incidentId.value}`;
  } else {
    allInputs.forEach(el => el.removeAttribute('readonly'));
    ticketForm.querySelectorAll('select').forEach(el => {
      el.removeAttribute('disabled');
      el.style.pointerEvents = '';
      el.style.opacity = '';
    });
    submitBtn.classList.remove('is-hidden');
  }
}


function validateForm() {
  const errors = [];

  if (!ciCat.value.trim() || !ciSubcat.value || !category.value.trim()) {
    errors.push('CI Categoria, CI Subcategoria e Categoria são campos obrigatórios.');
  }

  const impactN = Number(impact.value);
  const urgencyN = Number(urgency.value);
  const priorityN = Number(priority.value) || 1;

  if (!Number.isFinite(impactN) || impactN < 0 || impactN > 5) errors.push('Impacto deve ser um número entre 0 e 5.');
  if (!Number.isFinite(urgencyN) || urgencyN < 0 || urgencyN > 5) errors.push('Urgência deve ser um número entre 0 e 5.');
  if (![1,2,3,4].includes(priorityN)) errors.push('Prioridade deve ser 1, 2, 3 ou 4.');

  // Se fechar ticket (status Closed), recomendamos closure_code
  if (state.editingId && status.value === 'Closed' && !closureCode.value.trim()) {
    errors.push('Se o status for "Closed", preenche o "Closure Code".');
  }

  return errors;
}

/* ============ Rendering ============ */
function renderTickets(tickets) {
  ticketsGrid.innerHTML = '';

  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');

  for (const t of tickets) {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <h3>#${escapeHtml(t.incident_id)} — ${escapeHtml(t.ci_name ?? 'Sem título')}</h3>

      <div class="card__meta">
        <span class="badge ${statusBadgeClass(t.status)}">
          <strong>Status:</strong> ${escapeHtml(t.status ?? '—')}
        </span>
        <span class="badge">
          <strong>Prioridade:</strong> ${escapeHtml(priorityLabel(t.priority))}
        </span>
        <span class="badge">
          <strong>Criação:</strong> ${escapeHtml(t.open_time ?? '—')}
        </span>
      </div>

      <p class="muted" style="margin: 10px 0 0;">
        <strong>CI:</strong> ${escapeHtml(t.ci_cat ?? '—')} / ${escapeHtml(t.ci_subcat ?? '—')}
        &nbsp;•&nbsp;
        <strong>Categoria:</strong> ${escapeHtml(t.category ?? '—')}
      </p>

      ${t.created_by !== null ? `
      <p class="card__creator">
        👤 Criado por <strong>${escapeHtml(t.created_by_username ?? String(t.created_by))}</strong>
      </p>` : ''}

      ${t.description != null ? `
      <div class="card__description">
        <strong>Descrição:</strong>
        <span class="card__desc-content"></span>
      </div>` : ''}

      <div class="card__actions">
        <button class="btn" data-action="view" data-id="${escapeHtml(t.incident_id)}">Ver</button>
        <button class="btn btn--primary" data-action="edit" data-id="${escapeHtml(t.incident_id)}">Editar</button>
        <button class="btn btn--danger" data-action="delete" data-id="${escapeHtml(t.incident_id)}">Apagar</button>
      </div>
    `;
    ticketsGrid.appendChild(card);

    // Ex. 3.2: DOMPurify sanitiza o conteúdo antes de inserir no DOM via innerHTML.
    // Se o utilizador escreveu <script>alert(1)</script>, é renderizado como texto, não executado.
    if (t.description != null) {
      const descEl = card.querySelector('.card__desc-content');
      if (descEl) descEl.innerHTML = DOMPurify.sanitize(t.description);
    }
  }
}

function getTotalPages() {
  return Math.ceil(state.total / state.limit) || 1;
}

function buildFivePages(current, total) {
  let start = Math.max(1, current - 2);
  let end = Math.min(total, start + 4);
  start = Math.max(1, end - 4);
  const pages = [];
  for (let p = start; p <= end; p++) pages.push(p);
  return pages;
}

function renderPageNumbers(container, current, total) {
  if (!container) return;
  container.innerHTML = '';
  const pages = buildFivePages(current, total);

  for (const p of pages) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `page-btn${p === current ? ' is-active' : ''}`;
    b.textContent = String(p);
    b.addEventListener('click', async () => {
      if (p === state.page) return;
      state.page = p;
      await loadTickets();
      // UX: manter foco no topo quando navega via paginação no fundo
      document.getElementById('ticketsPagerTop')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    container.appendChild(b);
  }
}

function updatePaginationUI() {
  const totalPages = getTotalPages();
  pagePill.textContent = `página ${state.page}`;
  const isFirst = state.page <= 1;
  const isLast = state.page >= totalPages;

  // Topo
  firstPageBtn.disabled = isFirst;
  prevPageBtn.disabled = isFirst;
  nextPageBtn.disabled = isLast || !state.hasMore;
  lastPageBtn.disabled = isLast;

  // Atualizar seletor de página (topo)
  pageSelect.value = state.page;
  pageSelect.max = totalPages;
  totalPagesPill.textContent = `de ${totalPages}`;

  // Fundo
  if (firstPageBtnBottom) firstPageBtnBottom.disabled = isFirst;
  if (prevPageBtnBottom) prevPageBtnBottom.disabled = isFirst;
  if (nextPageBtnBottom) nextPageBtnBottom.disabled = isLast || !state.hasMore;
  if (lastPageBtnBottom) lastPageBtnBottom.disabled = isLast;

  if (pageSelectBottom) {
    pageSelectBottom.value = state.page;
    pageSelectBottom.max = totalPages;
  }
  if (totalPagesPillBottom) totalPagesPillBottom.textContent = `de ${totalPages}`;

  // Números (5 páginas) topo + fundo
  renderPageNumbers(pageNumbersTop, state.page, totalPages);
  renderPageNumbers(pageNumbersBottom, state.page, totalPages);
}

function updateCountUI() {
  ticketsCountPill.textContent = `${state.total} tickets`;
}

function setEmptyUI(isEmpty) {
  emptyState.classList.toggle('is-hidden', !isEmpty);
}

/* ============ Data Load ============ */
async function loadTickets() {
  try {
    setLoading(true);
    setEmptyUI(false);

    const params = {
      page: String(state.page),
      limit: String(state.limit)
    };

    // filtros (API suporta: status, priority, category)
    if (state.filters.status) params.status = state.filters.status;
    if (state.filters.priority) params.priority = state.filters.priority;
    if (state.filters.category) params.category = state.filters.category;

    const data = await getTickets(params);

    state.total = data.total ?? 0;
    state.hasMore = Boolean(data.hasMore);

    updateCountUI();
    updatePaginationUI();

    const tickets = Array.isArray(data.tickets) ? data.tickets : [];
    if (tickets.length === 0) {
      ticketsGrid.innerHTML = '';
      setEmptyUI(true);
      return;
    }

    renderTickets(tickets);
  } catch (err) {
    toast('toasts', 'error', 'Erro', err.message || 'Falha ao carregar tickets.');
    ticketsGrid.innerHTML = '';
    setEmptyUI(true);
  } finally {
    setLoading(false);
  }
}

/* ============ CRUD Actions ============ */
async function handleCreate(payload) {
  try {
    formLoading.classList.remove('is-hidden');

    const newTicket = await createTicket(payload);

    closeModal();
    resetForm();

    // Feedback nativo (alert) em sucesso
    alertDialog(`Ticket #${newTicket.incident_id} criado com sucesso.`);

    state.page = 1;
    await loadTickets();
  } catch (err) {
    // Feedback nativo (alert) em erro
    alertDialog(`Erro ao criar o ticket: ${err.message || 'Falha ao criar ticket.'}`);
  } finally {
    formLoading.classList.add('is-hidden');
  }
}

async function handleUpdate(id, payload) {
  try {
    formLoading.classList.remove('is-hidden');

    const updated = await updateTicket(id, payload);
    const shownId = updated?.incident_id ?? id;
    // Feedback nativo (alert) em sucesso
    alertDialog(`Ticket #${shownId} atualizado com sucesso.`);

    closeModal();
    resetForm();

    await loadTickets();
  } catch (err) {
    // Feedback nativo (alert) em erro
    alertDialog(`Erro ao atualizar o ticket #${id}: ${err.message || 'Falha ao atualizar ticket.'}`);
  } finally {
    formLoading.classList.add('is-hidden');
  }
}

async function handleDelete(id) {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  if (user.role !== 'admin') {
    alertDialog('Não autorizado');
    return;
  }

  const ok = confirmDialog(`Tens a certeza que queres apagar o ticket #${id}?`);
  if (!ok) return;

  try {
    setLoading(true);
    await deleteTicket(id);
    // Feedback nativo (alert) em sucesso
    alertDialog(`Ticket #${id} apagado com sucesso.`);

    // Se ficou vazio nesta página, tenta recuar uma página
    if (state.page > 1) state.page -= 1;

    await loadTickets();
  } catch (err) {
    // Feedback nativo (alert) em erro
    alertDialog(err.status === 403 ? 'Não autorizado' : `Erro ao apagar o ticket #${id}: ${err.message || 'Falha ao apagar ticket.'}`);
  } finally {
    setLoading(false);
  }
}

/* ============ Events ============ */
document.addEventListener('click', async (e) => {
  // fechar modal ao clicar no backdrop
  const closeTarget = e.target.closest('[data-close="true"]');
  if (closeTarget) closeModal();

  const btn = e.target.closest('button[data-action]');
  if (!btn) return;

  const action = btn.getAttribute('data-action');
  const id = btn.getAttribute('data-id');

  if (action === 'delete') {
    await handleDelete(id);
    return;
  }

  if (action === 'view') {
    // Mostrar detalhes do ticket
    try {
      setLoading(true);
      const data = await getTickets({
        page: String(state.page),
        limit: String(state.limit),
        ...(state.filters.status ? { status: state.filters.status } : {}),
        ...(state.filters.priority ? { priority: state.filters.priority } : {}),
        ...(state.filters.category ? { category: state.filters.category } : {})
      });

      const ticket = (data.tickets || []).find(t => String(t.incident_id) === String(id));
      if (!ticket) {
        toast('toasts', 'error', 'Não encontrado', 'Ticket não encontrado.');
        return;
      }

      // Abrir modal em modo de visualização (campos readonly)
      resetForm();
      fillFormFromTicket(ticket);
      setViewMode(true);
      openModal();
    } catch (err) {
      toast('toasts', 'error', 'Erro', err.message || 'Falha ao carregar detalhes.');
    } finally {
      setLoading(false);
    }
    return;
  }

  if (action === 'edit') {
    // Precisamos obter o ticket atual (nesta página) para preencher o formulário.
    // Vamos procurar no DOM e recarregar a página atual via API para garantir dados frescos.
    try {
      setLoading(true);
      const data = await getTickets({
        page: String(state.page),
        limit: String(state.limit),
        ...(state.filters.status ? { status: state.filters.status } : {}),
        ...(state.filters.priority ? { priority: state.filters.priority } : {}),
        ...(state.filters.category ? { category: state.filters.category } : {})
      });

      const ticket = (data.tickets || []).find(t => String(t.incident_id) === String(id));
      if (!ticket) {
        toast('toasts', 'error', 'Não encontrado', 'Ticket não encontrado nesta página.');
        return;
      }

      resetForm();
      fillFormFromTicket(ticket);
      openModal();
    } catch (err) {
      toast('toasts', 'error', 'Erro', err.message || 'Falha ao preparar edição.');
    } finally {
      setLoading(false);
    }
  }
});

async function goToPage(newPage) {
  const totalPages = getTotalPages();
  const p = Math.max(1, Math.min(totalPages, newPage));
  if (p === state.page) return;
  state.page = p;
  await loadTickets();
}

firstPageBtn.addEventListener('click', async () => {
  await goToPage(1);
});

prevPageBtn.addEventListener('click', async () => {
  await goToPage(state.page - 1);
});

nextPageBtn.addEventListener('click', async () => {
  await goToPage(state.page + 1);
});

lastPageBtn.addEventListener('click', async () => {
  await goToPage(getTotalPages());
});

// Fundo
firstPageBtnBottom?.addEventListener('click', async () => {
  await goToPage(1);
});
prevPageBtnBottom?.addEventListener('click', async () => {
  await goToPage(state.page - 1);
});
nextPageBtnBottom?.addEventListener('click', async () => {
  await goToPage(state.page + 1);
});
lastPageBtnBottom?.addEventListener('click', async () => {
  await goToPage(getTotalPages());
});

// Seletor de página direto
pageSelect.addEventListener('change', async () => {
  const newPage = parseInt(pageSelect.value, 10);
  const totalPages = getTotalPages();

  if (newPage < 1 || newPage > totalPages || isNaN(newPage)) {
    toast('toasts', 'error', 'Página inválida', `O número da página deve estar entre 1 e ${totalPages}.`);
    pageSelect.value = state.page;
    return;
  }

  state.page = newPage;
  await loadTickets();
});

// Permitir navegar com Enter no campo de página
pageSelect.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    pageSelect.dispatchEvent(new Event('change'));
  }
});

// Seletor de página direto (fundo)
pageSelectBottom?.addEventListener('change', async () => {
  const newPage = parseInt(pageSelectBottom.value, 10);
  const totalPages = getTotalPages();

  if (newPage < 1 || newPage > totalPages || isNaN(newPage)) {
    toast('toasts', 'error', 'Página inválida', `O número da página deve estar entre 1 e ${totalPages}.`);
    pageSelectBottom.value = state.page;
    return;
  }

  state.page = newPage;
  await loadTickets();
  document.getElementById('ticketsPagerTop')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

pageSelectBottom?.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    pageSelectBottom.dispatchEvent(new Event('change'));
  }
});

refreshBtn.addEventListener('click', async () => {
  await loadTickets();
});

openCreateBtn.addEventListener('click', () => {
  resetForm();
  openModal();
});

closeModalBtn.addEventListener('click', () => {
  closeModal();
});

cancelEditBtn.addEventListener('click', () => {
  closeModal();
  resetForm();
});

filtersForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const statusVal = document.getElementById('filterStatus').value;
  const priorityVal = document.getElementById('filterPriority').value;
  const categoryVal = document.getElementById('filterCategory').value.trim();

  state.filters.status = statusVal;
  state.filters.priority = priorityVal;
  state.filters.category = categoryVal;

  state.page = 1;
  await loadTickets();
});

clearFiltersBtn.addEventListener('click', async () => {
  state.filters.status = '';
  state.filters.priority = '';
  state.filters.category = '';
  state.page = 1;

  document.getElementById('filterStatus').value = '';
  document.getElementById('filterPriority').value = '';
  document.getElementById('filterCategory').value = '';

  await loadTickets();
});

ticketForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const errors = validateForm();
  if (errors.length) {
    toast('toasts', 'error', 'Validação', errors[0]);
    return;
  }

  const payloadBase = {
    ci_cat: ciCat.value.trim(),
    ci_subcat: ciSubcat.value,
    category: category.value.trim(),
    impact: Number(impact.value),
    urgency: Number(urgency.value),
    priority: Number(priority.value) || 1,
    description: description?.value.trim() || null  // Ex. 3.2: cifrado no servidor
  };

  // Se estiver em edição, enviamos campos opcionais
  if (state.editingId) {
    const payload = { ...payloadBase };

    if (status.value) payload.status = status.value;
    if (closureCode.value.trim()) payload.closure_code = closureCode.value.trim();

    await handleUpdate(state.editingId, payload);
  } else {
    await handleCreate(payloadBase);
  }
});

/* ============ Initial Load ============ */
loadTickets();