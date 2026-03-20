/**
 * Ex. 5.1 — Registo seguro e rastos para auditoria
 *
 * - logAudit(): insere uma entrada imutável na tabela audit_log
 * - sanitize(): mascara dados sensíveis antes de escrever para o log
 *
 * A tabela audit_log só aceita INSERT — nunca UPDATE/DELETE na app,
 * garantindo imutabilidade por convenção.
 */

import { db } from '../db/database.js';

/* ── Sanitizador de logs ────────────────────────────────────── */

const SENSITIVE_PATTERNS = [
  // Passwords em JSON: "password":"valor"
  { re: /("password"\s*:\s*)"[^"]*"/gi,       replace: '$1"[REDACTED]"' },
  // Tokens JWT (três partes separadas por ponto)
  { re: /Bearer\s+[\w-]+\.[\w-]+\.[\w-]+/gi,  replace: 'Bearer [TOKEN]' },
  // Tokens raw em parâmetros de query / headers
  { re: /token=[^&\s"]+/gi,                    replace: 'token=[REDACTED]' },
  // Endereços de e-mail
  { re: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, replace: '[EMAIL]' },
];

export function sanitize(message) {
  let safe = String(message);
  for (const { re, replace } of SENSITIVE_PATTERNS) {
    safe = safe.replace(re, replace);
  }
  return safe;
}

/* ── Logger de auditoria ─────────────────────────────────────── */

export async function logAudit({ userId = null, username = null, action, resource = null, result, ip = null }) {
  try {
    // Ex. 5.1: sanitizar ANTES de escrever — emails, tokens e passwords nunca ficam em claro na BD
    const safeUsername = username ? sanitize(String(username)) : null;
    const safeResource = resource ? sanitize(String(resource)) : null;
    const safeResult   = result   ? sanitize(String(result))   : null;

    await db.run(
      `INSERT INTO audit_log (user_id, username, action, resource, result, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, safeUsername, action, safeResource, safeResult, ip]
    );
  } catch (err) {
    // Falha silenciosa — não deve quebrar o fluxo principal
    console.error('[audit] Falha ao escrever registo de auditoria:', err.message);
  }
}

/* ── Wrapper de console.log com sanitização ─────────────────── */

export function safeLog(...args) {
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  console.log(sanitize(msg));
}
