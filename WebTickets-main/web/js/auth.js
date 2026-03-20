/**
 * Ex. 1.1 — Login e registo com feedback
 * Ex. 1.2 — Indicador de força da password (regex) + bloqueio de submissão se fraca
 * Ex. 4.1 — Guarda o access token em memória (não em localStorage para evitar XSS)
 */

const API = 'http://localhost:3000';

/* ── Força da password (Ex. 1.2) ──────────────────────────── */

const RULES = [
  { id: 'req-length',  re: /.{8,}/,           label: 'Mínimo 8 caracteres' },
  { id: 'req-upper',   re: /[A-Z]/,            label: 'Pelo menos 1 letra maiúscula' },
  { id: 'req-number',  re: /[0-9]/,            label: 'Pelo menos 1 número' },
  { id: 'req-special', re: /[^A-Za-z0-9]/,     label: 'Pelo menos 1 caracter especial' }
];

const STRENGTH_LEVELS = [
  { label: '',          color: '#eee',    pct: 0   },
  { label: 'Muito fraca', color: '#e74c3c', pct: 25  },
  { label: 'Fraca',    color: '#e67e22', pct: 50  },
  { label: 'Razoável', color: '#f1c40f', pct: 75  },
  { label: 'Forte',    color: '#27ae60', pct: 100 }
];

function evaluatePassword(pwd) {
  const passed = RULES.filter(r => r.re.test(pwd));
  return { count: passed.length, passed: passed.map(r => r.id) };
}

function updateStrengthUI(pwd) {
  const fill  = document.getElementById('strengthFill');
  const label = document.getElementById('strengthLabel');
  if (!fill || !label) return;

  const { count, passed } = evaluatePassword(pwd);
  const level = STRENGTH_LEVELS[count];

  fill.style.width      = level.pct + '%';
  fill.style.background = level.color;
  label.textContent     = pwd.length ? level.label : '';
  label.style.color     = level.color;

  // Atualiza requisitos individuais (só na página de registo)
  RULES.forEach(r => {
    const el = document.getElementById(r.id);
    if (!el) return;
    el.className = passed.includes(r.id) ? 'req--ok' : 'req--fail';
  });

  return count;
}

/* ── Alert helper ─────────────────────────────────────────── */
function showAlert(message, type = 'error') {
  const box = document.getElementById('alertBox');
  if (!box) return;
  box.innerHTML = `<div class="alert alert--${type}" role="alert">${message}</div>`;
}

function clearAlert() {
  const box = document.getElementById('alertBox');
  if (box) box.innerHTML = '';
}

/* ── Página de registo ─────────────────────────────────────── */
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  const pwdInput  = document.getElementById('password');
  const submitBtn = document.getElementById('submitBtn');

  pwdInput.addEventListener('input', () => {
    const count = updateStrengthUI(pwdInput.value);
    // Ex. 1.2: bloqueia o botão se a password tiver menos de 4 regras
    submitBtn.disabled = count < 4;
  });

  registerForm.addEventListener('submit', async e => {
    e.preventDefault();
    clearAlert();

    const username = document.getElementById('username').value.trim();
    const email    = document.getElementById('email').value.trim();
    const password = pwdInput.value;
    const role     = document.getElementById('role')?.value ?? 'user';

    if (evaluatePassword(password).count < 4) {
      return showAlert('A password não cumpre todos os requisitos de segurança.');
    }

    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, role })
      });
      const data = await res.json();

      if (!res.ok) return showAlert(data.error || 'Erro ao registar.');

      showAlert('Conta criada com sucesso! A redirecionar…', 'success');
      setTimeout(() => { window.location.href = './login.html'; }, 1500);
    } catch {
      showAlert('Erro de ligação ao servidor.');
    }
  });
}

/* ── Página de login ────────────────────────────────────────── */
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  const pwdInput  = document.getElementById('password');
  const pwdToggle = document.getElementById('pwdToggle');

  // Toggle mostrar/ocultar password
  if (pwdToggle) {
    pwdToggle.addEventListener('click', () => {
      const isHidden = pwdInput.type === 'password';
      pwdInput.type = isHidden ? 'text' : 'password';
      pwdToggle.textContent = isHidden ? '🙈' : '👁';
      pwdToggle.setAttribute('aria-label', isHidden ? 'Ocultar password' : 'Mostrar password');
    });
  }

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    clearAlert();

    const email    = document.getElementById('email').value.trim();
    const password = pwdInput.value;

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        credentials: 'include',  // Ex. 4.1: inclui cookies HttpOnly
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (res.status === 429) {
        // Ex. 1.2: Rate limit atingido
        return showAlert('Demasiadas tentativas. Aguarde 15 minutos antes de tentar novamente.');
      }
      if (!res.ok) return showAlert(data.error || 'Credenciais inválidas.');

      // Ex. 4.1: guardar access token em sessionStorage (não localStorage)
      // Não é tão seguro como memória, mas sobrevive a reloads da página
      sessionStorage.setItem('accessToken', data.accessToken);
      sessionStorage.setItem('user', JSON.stringify(data.user));

      showAlert('Login efetuado com sucesso! A redirecionar…', 'success');
      setTimeout(() => { window.location.href = './index.html'; }, 1000);
    } catch {
      showAlert('Erro de ligação ao servidor.');
    }
  });
}
