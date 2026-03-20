/**
 * Rotas de autenticação
 *
 * POST /auth/register       — Ex. 1.1
 * POST /auth/login          — Ex. 1.1 + 1.2 (rate limiter)
 * POST /auth/refresh        — Ex. 4.1
 * POST /auth/logout         — Ex. 4.1
 * POST /auth/change-password — Ex. 4.1 (invalida tokens)
 */

import { Router } from 'express';
import { register, login, refresh, logout, changePassword } from '../controllers/auth.controller.js';
import { loginLimiter } from '../middleware/rateLimiter.middleware.js';
import { verifyJWT } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', loginLimiter, login);   // Ex. 1.2: rate limiter aplicado
router.post('/refresh', refresh);
router.post('/logout', verifyJWT, logout);
router.post('/change-password', verifyJWT, changePassword);

export default router;
