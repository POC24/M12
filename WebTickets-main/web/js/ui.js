const API_BASE = 'http://localhost:3000';

export function setupNavbar({ requireAuth = true } = {}) {
  const toggle = document.getElementById('navToggle');
  const menu = document.getElementById('navMenu');
  if (!toggle || !menu) return;

  // ── Auth guard ───────────────────────────────────────────────
  const token = sessionStorage.getItem('accessToken');
  if (requireAuth && !token) {
    window.location.replace('./login.html');
    return;
  }

  // ── Utilizador autenticado: mostrar nome + botão Sair ────────
  if (token) {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');

    // Mostrar link de Logs apenas para admins
    if (user.role === 'admin') {
      const logsItem = document.getElementById('logsNavItem');
      if (logsItem) logsItem.style.display = '';
    }

    const userItem = document.createElement('li');
    userItem.innerHTML = `<span class="nav__link muted" style="cursor:default">
      ${escapeHtml(user.username || 'Utilizador')}
      ${user.role === 'admin' ? '<span style="font-size:.75rem;color:#e67e22"> (admin)</span>' : ''}
    </span>`;

    const logoutItem = document.createElement('li');
    const logoutBtn = document.createElement('button');
    logoutBtn.type = 'button';
    logoutBtn.className = 'btn';
    logoutBtn.textContent = 'Sair';
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        });
      } catch { /* ignora erros de rede */ }
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('user');
      window.location.replace('./login.html');
    });
    logoutItem.appendChild(logoutBtn);

    menu.appendChild(userItem);
    menu.appendChild(logoutItem);
  }

  // ── Toggle mobile ────────────────────────────────────────────
  const close = () => {
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  };

  toggle.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  // Fechar ao clicar num link (mobile)
  menu.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (a) close();
  });

  // Fechar com ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}

export function setYear() {
  const el = document.getElementById('year');
  if (el) el.textContent = String(new Date().getFullYear());
}

export function toast(containerId, type, title, message, timeoutMs = 3500) {
  const host = document.getElementById(containerId) || document.getElementById('toasts');
  if (!host) return;

  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `
    <div class="toast__title">${escapeHtml(title)}</div>
    <div class="toast__msg">${escapeHtml(message)}</div>
  `;

  host.appendChild(el);

  window.setTimeout(() => {
    el.remove();
  }, timeoutMs);
}

export function alertDialog(message) {
  // Mensagem simples do browser (tipo a da imagem).
  window.alert(message);
}

export function confirmDialog(message) {
  // Simples (sem bibliotecas). Cumpre “confirmação” no DELETE.
  return window.confirm(message);
}

export function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function priorityLabel(priority) {
  const n = Number(priority);
  if (n === 1) return '1 - Baixa';
  if (n === 2) return '2 - Média';
  if (n === 3) return '3 - Alta';
  if (n === 4) return '4 - Crítica';
  return String(priority ?? '—');
}

export function statusBadgeClass(status) {
  if (status === 'Open') return 'badge--open';
  if (status === 'Work in progress') return 'badge--wip';
  if (status === 'Closed') return 'badge--closed';
  return '';
}