/**
 * Ex. 2.2 — Evitar IDOR (referências diretas a objetos)
 * Ex. 3.1 — SQL Injection e queries parametrizadas (demo)
 * Ex. 3.2 — XSS e cifra em repouso (AES-256-GCM)
 * Ex. 5.1 — Audit log
 */

import { db } from '../db/database.js';
import { encrypt, decrypt } from '../services/encryption.service.js';
import { logAudit } from '../services/audit.service.js';

/* ── GET /secrets ── listar segredos do utilizador autenticado ─ */
export async function listSecrets(req, res) {
  try {
    const secrets = await db.all(
      'SELECT id, title, created_at FROM secrets WHERE owner_id = ?',
      [req.user.id]
    );
    return res.json(secrets);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar segredos' });
  }
}

/* ── POST /secrets ── criar segredo (conteúdo cifrado) ─────── */
export async function createSecret(req, res) {
  const { title, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'title e content são obrigatórios' });
  }

  try {
    // Ex. 3.2: cifrar o conteúdo antes de guardar na BD
    const encryptedContent = encrypt(content);

    const result = await db.run(
      'INSERT INTO secrets (owner_id, title, content) VALUES (?, ?, ?)',
      [req.user.id, title, encryptedContent]
    );

    await logAudit({
      userId: req.user.id, username: req.user.username ?? null,
      action: 'create-secret', resource: `secrets/${result.lastID}`, result: 'success',
      ip: req.ip
    });

    return res.status(201).json({ id: result.lastID, title });
  } catch (err) {
    console.error('[secrets] create error:', err.message);
    return res.status(500).json({ error: 'Erro ao criar segredo' });
  }
}

/* ── GET /secrets/:id ── obter segredo (verifica proprietário) ─ */
export async function getSecret(req, res) {
  const { id } = req.params;

  try {
    const secret = await db.get(
      // Ex. 2.2: query parametrizada — usa owner_id para evitar IDOR
      'SELECT * FROM secrets WHERE id = ? AND owner_id = ?',
      [id, req.user.id]
    );

    if (!secret) {
      // Ex. 2.2: 404 em vez de 403 — não revela que o recurso existe
      return res.status(404).json({ error: 'Segredo não encontrado' });
    }

    // Ex. 3.2: decifrar apenas ao enviar para o utilizador autorizado
    const plainContent = decrypt(secret.content);

    return res.json({
      id: secret.id,
      title: secret.title,
      content: plainContent,
      created_at: secret.created_at
    });
  } catch (err) {
    console.error('[secrets] get error:', err.message);
    return res.status(500).json({ error: 'Erro ao obter segredo' });
  }
}

/* ── DELETE /secrets/:id ── apagar segredo (verifica proprietário) ─ */
export async function deleteSecret(req, res) {
  const { id } = req.params;

  try {
    const secret = await db.get(
      'SELECT * FROM secrets WHERE id = ? AND owner_id = ?',
      [id, req.user.id]
    );

    if (!secret) {
      return res.status(404).json({ error: 'Segredo não encontrado' });
    }

    await db.run('DELETE FROM secrets WHERE id = ?', [id]);

    await logAudit({
      userId: req.user.id, username: req.user.username ?? null,
      action: 'delete-secret', resource: `secrets/${id}`, result: 'success',
      ip: req.ip
    });

    return res.status(204).send();
  } catch (err) {
    console.error('[secrets] delete error:', err.message);
    return res.status(500).json({ error: 'Erro ao apagar segredo' });
  }
}

/* ────────────────────────────────────────────────────────────────
 * Ex. 3.1 — DEMO: SQL Injection
 *
 * GET /secrets/search?q=<termo>          ← VULNERÁVEL (concatenação)
 * GET /secrets/search?q=<termo>&safe=1   ← CORRIGIDO (parametrizado)
 * ─────────────────────────────────────────────────────────────── */
export async function searchSecrets(req, res) {
  const { q = '', safe } = req.query;

  try {
    let rows;

    if (safe === '1' || safe === 'true') {
      // ✅ VERSÃO SEGURA — query parametrizada (prepared statement)
      rows = await db.all(
        "SELECT id, title, owner_id FROM secrets WHERE title LIKE ?",
        [`%${q}%`]
      );
      return res.json({ mode: 'safe (parametrizado)', results: rows });

    } else {
      // ⚠️ VERSÃO VULNERÁVEL — concatenação direta de string
      // Exemplo de injeção: q = ' OR '1'='1
      const vulnerable = `SELECT id, title, owner_id FROM secrets WHERE title LIKE '%${q}%'`;
      rows = await db.all(vulnerable);
      return res.json({ mode: 'VULNERABLE (concatenação)', query: vulnerable, results: rows });
    }

  } catch (err) {
    // Erro de sintaxe SQL exposto — outro sinal de vulnerabilidade
    return res.status(500).json({ error: err.message, mode: 'VULNERABLE — erro SQL exposto' });
  }
}
