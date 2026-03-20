/**
 * Script para criar o utilizador admin inicial.
 * Uso: node scripts/create-admin.js
 */

import bcrypt from 'bcrypt';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const USERNAME = 'admin';
const EMAIL    = 'admin@webtickets.com';
const PASSWORD = 'Admin@Webtickets1';

const db = await open({ filename: './data/tickets.db', driver: sqlite3.Database });

const existing = await db.get('SELECT id FROM users WHERE email = ? OR username = ?', [EMAIL, USERNAME]);

if (existing) {
  // Atualiza para garantir que tem role admin
  await db.run("UPDATE users SET role = 'admin' WHERE id = ?", [existing.id]);
  console.log(`✅ Utilizador '${USERNAME}' já existe — role atualizado para admin (id: ${existing.id})`);
} else {
  const hash = await bcrypt.hash(PASSWORD, 12);
  const result = await db.run(
    "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
    [USERNAME, EMAIL, hash]
  );
  console.log(`✅ Admin criado com sucesso (id: ${result.lastID})`);
}

console.log(`\n  Username : ${USERNAME}`);
console.log(`  Email    : ${EMAIL}`);
console.log(`  Password : ${PASSWORD}`);
console.log(`  Role     : admin\n`);

await db.close();
