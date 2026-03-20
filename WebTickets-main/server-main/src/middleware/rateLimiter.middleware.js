/**
 * Ex. 1.2 — Limitação de tentativas de login
 *
 * Bloqueia um IP após 5 logins falhados durante 15 minutos.
 * Responde com 429 Too Many Requests.
 */

import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,                    // máximo de 5 tentativas por janela
  standardHeaders: true,     // inclui headers RateLimit-* na resposta
  legacyHeaders: false,
  skipSuccessfulRequests: true, // só conta pedidos falhados
  message: {
    error: 'Demasiadas tentativas de login. Tente novamente em 15 minutos.'
  },
  handler(req, res, next, options) {
    console.log(`[rate-limit] IP bloqueado: ${req.ip} — demasiadas tentativas de login`);
    res.status(429).json(options.message);
  }
});
