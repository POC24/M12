/**
 * Ex. 1.1 — Hashing Lab
 * Ex. 4.1 — JWT + Token Refresh
 *
 * Serviço de autenticação: bcrypt para hashing de passwords,
 * JWT de curta duração (5 min) para acesso, refresh tokens (7 dias)
 * guardados como hash SHA-256 na base de dados.
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db/database.js';

const BCRYPT_ROUNDS = 12;
const ACCESS_EXPIRES = '5m';
const REFRESH_EXPIRES_DAYS = 7;

/* ── Hashing (Ex. 1.1) ──────────────────────────────────────── */

export async function hashPassword(plaintext) {
  // bcrypt gera automaticamente um sal único (16 bytes)
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

export async function verifyPassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

/* ── JWT (Ex. 4.1) ──────────────────────────────────────────── */

export function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, token_version: user.token_version },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

/* ── Refresh tokens (Ex. 4.1) ──────────────────────────────── */

export async function createRefreshToken(userId) {
  const rawToken = crypto.randomBytes(64).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 86400 * 1000).toISOString();

  await db.run(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, tokenHash, expiresAt]
  );

  return rawToken; // devolvido ao cliente via cookie HttpOnly
}

export async function rotateRefreshToken(rawToken) {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const stored = await db.get(
    'SELECT * FROM refresh_tokens WHERE token_hash = ?',
    [tokenHash]
  );

  if (!stored) return null;
  if (new Date(stored.expires_at) < new Date()) {
    await db.run('DELETE FROM refresh_tokens WHERE id = ?', [stored.id]);
    return null;
  }

  const user = await db.get('SELECT * FROM users WHERE id = ?', [stored.user_id]);
  if (!user) return null;

  // Rotate: apaga o token antigo, emite um novo
  await db.run('DELETE FROM refresh_tokens WHERE id = ?', [stored.id]);
  const newRawToken = await createRefreshToken(user.id);

  return { user, newRawToken };
}

export async function revokeRefreshToken(rawToken) {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await db.run('DELETE FROM refresh_tokens WHERE token_hash = ?', [tokenHash]);
}

/* ── Utilizadores ───────────────────────────────────────────── */

export async function findUserByEmail(email) {
  return db.get('SELECT * FROM users WHERE email = ?', [email]);
}

export async function findUserByUsername(username) {
  return db.get('SELECT * FROM users WHERE username = ?', [username]);
}

export async function createUser(username, email, passwordHash, role = 'user') {
  const result = await db.run(
    'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [username, email, passwordHash, role]
  );
  return db.get('SELECT * FROM users WHERE id = ?', [result.lastID]);
}

export async function incrementTokenVersion(userId) {
  await db.run('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [userId]);
}

export async function updatePasswordHash(userId, newHash) {
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);
}
