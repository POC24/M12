/**
 * Ex. 1.1 — Hashing Lab: register + login com bcrypt
 * Ex. 1.2 — Rate limiting aplicado na rota login
 * Ex. 4.1 — JWT + token refresh + change-password (invalida tokens)
 * Ex. 5.1 — Audit log em cada operação de auth
 */

import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  findUserByEmail,
  findUserByUsername,
  createUser,
  incrementTokenVersion,
  updatePasswordHash
} from '../services/auth.service.js';
import { logAudit } from '../services/audit.service.js';

const COOKIE_OPTS = {
  httpOnly: true,           // Ex. 4.1: não acessível por JS do cliente
  secure: false,            // true em produção com HTTPS
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
};

/* ── POST /auth/register ────────────────────────────────────── */
export async function register(req, res) {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email e password são obrigatórios' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'A password deve ter no mínimo 8 caracteres' });
  }

  try {
    if (await findUserByEmail(email)) {
      return res.status(409).json({ error: 'Email já registado' });
    }
    if (await findUserByUsername(username)) {
      return res.status(409).json({ error: 'Username já em uso' });
    }

    // Ex. 1.1: hash com bcrypt (fator de custo 12) e sal único automático
    const passwordHash = await hashPassword(password);
    const user = await createUser(username, email, passwordHash, 'user');

    await logAudit({
      userId: user.id, username: user.username,
      action: 'register', resource: 'users', result: 'success',
      ip: req.ip
    });

    return res.status(201).json({
      message: 'Utilizador criado com sucesso',
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('[auth] register error:', err.message);
    return res.status(500).json({ error: 'Erro ao criar utilizador' });
  }
}

/* ── POST /auth/login ───────────────────────────────────────── */
export async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email e password são obrigatórios' });
  }

  try {
    const user = await findUserByEmail(email);
    // Ex. 1.1: verifyPassword usa bcrypt.compare
    const valid = user && await verifyPassword(password, user.password_hash);

    if (!valid) {
      await logAudit({
        userId: user?.id ?? null, username: user?.username ?? email,
        action: 'login', resource: 'auth', result: 'fail',
        ip: req.ip
      });
      // Mensagem genérica — não revela se é o email ou a password que está errado
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Ex. 4.1: access token de curta duração (5 min)
    const accessToken = signAccessToken(user);
    // Ex. 4.1: refresh token em cookie HttpOnly
    const refreshToken = await createRefreshToken(user.id);

    res.cookie('refreshToken', refreshToken, COOKIE_OPTS);

    await logAudit({
      userId: user.id, username: user.username,
      action: 'login', resource: 'auth', result: 'success',
      ip: req.ip
    });

    return res.json({
      accessToken,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (err) {
    console.error('[auth] login error:', err.message);
    return res.status(500).json({ error: 'Erro ao fazer login' });
  }
}

/* ── POST /auth/refresh ─────────────────────────────────────── */
export async function refresh(req, res) {
  const rawToken = req.cookies?.refreshToken;
  if (!rawToken) {
    return res.status(401).json({ error: 'Refresh token em falta' });
  }

  try {
    const result = await rotateRefreshToken(rawToken);
    if (!result) {
      res.clearCookie('refreshToken');
      return res.status(401).json({ error: 'Refresh token inválido ou expirado' });
    }

    const { user, newRawToken } = result;
    const accessToken = signAccessToken(user);
    res.cookie('refreshToken', newRawToken, COOKIE_OPTS);

    return res.json({ accessToken });
  } catch (err) {
    console.error('[auth] refresh error:', err.message);
    return res.status(500).json({ error: 'Erro ao renovar token' });
  }
}

/* ── POST /auth/logout ──────────────────────────────────────── */
export async function logout(req, res) {
  const rawToken = req.cookies?.refreshToken;
  if (rawToken) {
    await revokeRefreshToken(rawToken);
  }
  res.clearCookie('refreshToken');

  await logAudit({
    userId: req.user?.id ?? null, username: req.user?.username ?? null,
    action: 'logout', resource: 'auth', result: 'success',
    ip: req.ip
  });

  return res.json({ message: 'Sessão terminada com sucesso' });
}

/* ── POST /auth/change-password ─────────────────────────────── */
export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword e newPassword são obrigatórios' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'A nova password deve ter no mínimo 8 caracteres' });
  }

  try {
    const { db } = await import('../db/database.js');
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);

    if (!await verifyPassword(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: 'Password atual incorreta' });
    }

    const newHash = await hashPassword(newPassword);
    await updatePasswordHash(user.id, newHash);
    // Ex. 4.1: incrementa token_version → todos os access tokens anteriores tornam-se inválidos
    await incrementTokenVersion(user.id);

    // Revogar refresh token atual
    const rawToken = req.cookies?.refreshToken;
    if (rawToken) await revokeRefreshToken(rawToken);
    res.clearCookie('refreshToken');

    await logAudit({
      userId: user.id, username: user.username,
      action: 'change-password', resource: 'users', result: 'success',
      ip: req.ip
    });

    return res.json({ message: 'Password alterada com sucesso. Por favor faça login novamente.' });
  } catch (err) {
    console.error('[auth] change-password error:', err.message);
    return res.status(500).json({ error: 'Erro ao alterar password' });
  }
}
