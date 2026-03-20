/**
 * Ex. 3.1 — SQL Injection: demonstração antes/depois
 *
 * Este script conecta-se diretamente à base de dados e mostra
 * a diferença entre uma query vulnerável e uma query parametrizada.
 *
 * Uso: node scripts/sqli-demo.js
 */

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const db = await open({ filename: './data/tickets.db', driver: sqlite3.Database });

const INJECTION = "' OR '1'='1";

console.log('\n═══════════════════════════════════════════════════════');
console.log('  Ex. 3.1 — Demonstração de SQL Injection');
console.log('═══════════════════════════════════════════════════════\n');

/* ── ⚠️  VERSÃO VULNERÁVEL ──────────────────────────────────── */
console.log('🔴  VULNERÁVEL — Concatenação direta de string');
console.log(`    Input do utilizador: ${JSON.stringify(INJECTION)}\n`);

const vulnerableQuery = `SELECT id, title, owner_id FROM secrets WHERE title LIKE '%${INJECTION}%'`;
console.log('    Query executada:');
console.log(`    ${vulnerableQuery}\n`);

try {
  const rows = await db.all(vulnerableQuery);
  console.log(`    Resultado: ${rows.length} linha(s) devolvida(s) — inclui dados de TODOS os utilizadores!`);
  if (rows.length > 0) {
    console.log('    Dados expostos:', JSON.stringify(rows.slice(0, 3)));
  }
} catch (err) {
  console.log('    Erro SQL (também um problema de segurança):', err.message);
}

console.log('\n───────────────────────────────────────────────────────\n');

/* ── ✅ VERSÃO CORRIGIDA ──────────────────────────────────── */
console.log('🟢  SEGURO — Query parametrizada (prepared statement)');
console.log(`    Input do utilizador: ${JSON.stringify(INJECTION)}\n`);

const safeQuery = "SELECT id, title, owner_id FROM secrets WHERE title LIKE ?";
console.log('    Query parametrizada:');
console.log(`    ${safeQuery}`);
console.log(`    Parâmetro: ["%${INJECTION}%"]\n`);

const safeRows = await db.all(safeQuery, [`%${INJECTION}%`]);
console.log(`    Resultado: ${safeRows.length} linha(s) — só retorna o que realmente contém o texto`);

console.log('\n═══════════════════════════════════════════════════════');
console.log('  Conclusão: a versão parametrizada trata o input como');
console.log('  dados literais, nunca como SQL a executar.');
console.log('═══════════════════════════════════════════════════════\n');

await db.close();
