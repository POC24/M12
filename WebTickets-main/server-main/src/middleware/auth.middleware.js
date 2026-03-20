/**
 * Ex. 2.1 — RBAC
 * Ex. 4.1 — Verificação JWT
 *
 * verifyJWT    — extrai e valida o access token do header Authorization
 * requireRole  — verifica se o utilizador tem o papel necessário (ex: 'admin')
 */

import { verifyAccessToken } from '../services/auth.service.js';
import { db } from '../db/database.js';

export function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de acesso em falta' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);

    // Verificar token_version para invalidar tokens após mudança de password
    db.get('SELECT token_version FROM users WHERE id = ?', [payload.id])
      .then(user => {
        if (!user || user.token_version !== payload.token_version) {
          return res.status(401).json({ error: 'Token inválido ou revogado' });
        }
        req.user = payload;
        next();
      })
      .catch(() => res.status(500).json({ error: 'Erro interno de autenticação' }));

  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    if (req.user.role !== role) {
      // Ex. 2.1: utilizador sem permissão recebe 403 Forbidden
      return res.status(403).json({ error: 'Acesso negado — papel insuficiente' });
    }
    next();
  };
}
