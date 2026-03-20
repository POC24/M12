// Configuração central da API (sem bibliotecas externas).
export const API_BASE_URL = 'http://localhost:3000';

// Ex. 4.1: lê o access token guardado após login
function getAccessToken() {
  return sessionStorage.getItem('accessToken') || null;
}

async function parseJsonSafe(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;

  // Ex. 4.1: injeta Authorization header se houver token disponível
  const token = getAccessToken();
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(url, {
    credentials: 'include',  // Ex. 4.1: inclui cookies HttpOnly (refresh token)
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...(options.headers || {})
    },
    ...options
  });

  if (!res.ok) {
    // Sessão expirada ou token inválido → forçar novo login
    if (res.status === 401) {
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('user');
      window.location.replace('./login.html');
      throw new Error('Sessão expirada. A redirecionar para o login…');
    }
    const body = await parseJsonSafe(res);
    const message =
      (body && body.error) ||
      `Erro HTTP ${res.status} (${res.statusText})`;
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  if (res.status === 204) return null;
  return parseJsonSafe(res);
}

/* Tickets */
export async function getTickets(params = {}) {
  const q = new URLSearchParams(params);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return apiFetch(`/tickets${suffix}`, { method: 'GET' });
}

export async function createTicket(payload) {
  return apiFetch('/tickets', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateTicket(id, payload) {
  return apiFetch(`/tickets/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export async function deleteTicket(id) {
  return apiFetch(`/tickets/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}

/* Stats + Health */
export async function getHealth() {
  return apiFetch('/health', { method: 'GET' });
}

export async function getStats(view, extraParams = {}) {
  const params = new URLSearchParams({ view, ...extraParams });
  return apiFetch(`/tickets/stats?${params.toString()}`, { method: 'GET' });
}