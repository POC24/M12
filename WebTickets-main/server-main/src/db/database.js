import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

let db;

try {
  db = await open({
    filename: './data/tickets.db',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      incident_id INTEGER PRIMARY KEY AUTOINCREMENT,
      ci_name TEXT,
      ci_cat TEXT,
      ci_subcat TEXT,
      status TEXT,
      impact INTEGER,
      urgency INTEGER,
      priority INTEGER,
      category TEXT,
      open_time TEXT,
      resolved_time TEXT,
      close_time TEXT,
      closure_code TEXT
    )
  `);

  /* ── Ex. 1.1 + 2.1 + 4.1 ── Utilizadores ───────────────────── */
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      username       TEXT    UNIQUE NOT NULL,
      email          TEXT    UNIQUE NOT NULL,
      password_hash  TEXT    NOT NULL,
      role           TEXT    NOT NULL DEFAULT 'user',
      token_version  INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  /* ── Ex. 4.1 ── Refresh tokens ──────────────────────────────── */
  await db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      token_hash  TEXT    NOT NULL,
      expires_at  TEXT    NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  /* ── Ex. 2.2 + 3.1 + 3.2 ── Segredos (cifrados) ───────────── */
  await db.exec(`
    CREATE TABLE IF NOT EXISTS secrets (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id   INTEGER NOT NULL,
      title      TEXT    NOT NULL,
      content    TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  /* ── Ex. 5.1 ── Audit log (imutável — só INSERT) ────────────── */
  await db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER,
      username   TEXT,
      action     TEXT NOT NULL,
      resource   TEXT,
      result     TEXT NOT NULL,
      ip_address TEXT,
      timestamp  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  /* ── Ex. 5.1 — Triggers de imutabilidade (proíbem UPDATE e DELETE na BD) ── */
  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS audit_log_no_update
      BEFORE UPDATE ON audit_log
    BEGIN
      SELECT RAISE(ABORT, 'audit_log é imutável: UPDATE não é permitido');
    END;
  `);
  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS audit_log_no_delete
      BEFORE DELETE ON audit_log
    BEGIN
      SELECT RAISE(ABORT, 'audit_log é imutável: DELETE não é permitido');
    END;
  `);

  /* ── Migração: created_by na tabela tickets ─────────────────── */
  try {
    await db.exec(`ALTER TABLE tickets ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL`);
  } catch { /* coluna já existe — ignorar */ }

  /* ── Ex. 3.2 — Migração: description (cifrada AES-256-GCM) ──── */
  try {
    await db.exec(`ALTER TABLE tickets ADD COLUMN description TEXT`);
  } catch { /* coluna já existe — ignorar */ }

} catch (error) {
  console.error('Database initialization failed:', error);
  throw error;
}

export { db };
