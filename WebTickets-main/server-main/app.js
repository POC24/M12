import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import healthRoutes  from './src/routes/health.routes.js';
import ticketRoutes  from './src/routes/tickets.routes.js';
import webhookRoutes from './src/routes/webhooks.routes.js';
import authRoutes    from './src/routes/auth.routes.js';
import secretsRoutes from './src/routes/secrets.routes.js';
import { importCSV } from './src/utils/csvImporter.js';
import { verifyJWT, requireRole } from './src/middleware/auth.middleware.js';
import { db } from './src/db/database.js';
import { sanitize } from './src/services/audit.service.js';

dotenv.config();

const app = express();

/* ── Ex. 4.2 — Cabeçalhos de segurança (Helmet) ────────────── */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:'],
      connectSrc: ["'self'"],
      frameSrc:   ["'none'"],
      objectSrc:  ["'none'"]
    }
  },
  frameguard: { action: 'deny' },           // X-Frame-Options: DENY
  hsts: { maxAge: 31536000, includeSubDomains: true }, // Strict-Transport-Security
  xContentTypeOptions: true,
  referrerPolicy: { policy: 'no-referrer' }
}));

/* ── Ex. 4.2 — CORS restrito ─────────────────────────────────── */
const ALLOWED_ORIGINS = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5501',
  'http://127.0.0.1:5501'
];

app.use(cors({
  origin(origin, callback) {
    // Permite ferramentas sem origin (Postman, curl) — remover em produção
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origem não autorizada: ${origin}`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true   // necessário para cookies HttpOnly
}));

app.use(express.json());
app.use(cookieParser());

const receivers = [];

try {
  await importCSV();

  /* ── Rotas de negócio ──────────────────────────────────────── */
  app.use('/health',   healthRoutes);
  app.use('/tickets',  ticketRoutes);
  app.use('/webhooks', webhookRoutes);

  /* ── Ex. 1.1 + 1.2 + 4.1 — Auth ──────────────────────────── */
  app.use('/auth', authRoutes);

  /* ── Ex. 2.2 + 3.1 + 3.2 — Segredos ──────────────────────── */
  app.use('/secrets', secretsRoutes);

  /* ── Ex. 2.1 — RBAC: GET /system/logs (só admins) ─────────── */
  app.get('/system/logs', verifyJWT, requireRole('admin'), async (req, res) => {
    try {
      const logs = await db.all(
        `SELECT id, user_id, username, action, resource, result, ip_address, timestamp
         FROM audit_log
         ORDER BY timestamp DESC
         LIMIT 100`
      );
      // Ex. 5.1: sanitizar antes de enviar (mascara PII residual)
      const sanitized = logs.map(l => ({
        ...l,
        username: l.username ? sanitize(l.username) : null,
        ip_address: l.ip_address ? sanitize(l.ip_address) : null
      }));
      return res.json(sanitized);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao obter logs' });
    }
  });

  /* ── Registo de receivers (webhook) ────────────────────────── */
  app.post('/register', (req, res) => {
    const { name, port } = req.body;
    if (!name || !port) {
      return res.status(400).json({ error: 'name e port são obrigatórios' });
    }
    if (!receivers.find(r => r.name === name)) {
      receivers.push({ name, port: Number(port) });
    }
    res.json({ message: 'Receiver registado com sucesso' });
  });

  app.get('/receivers', (req, res) => res.json(receivers));

  app.listen(process.env.PORT, () => {
    console.log(`✅ Main server running on port ${process.env.PORT}`);
  });

} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}
