/**
 * Rotas de segredos
 *
 * GET    /secrets/search    — Ex. 3.1 (demo SQLi — requer auth)
 * GET    /secrets           — listar os meus segredos
 * POST   /secrets           — criar segredo (cifrado)
 * GET    /secrets/:id       — obter segredo (verifica owner)
 * DELETE /secrets/:id       — apagar segredo (verifica owner)
 *
 * Todas as rotas requerem autenticação JWT.
 */

import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware.js';
import {
  listSecrets,
  createSecret,
  getSecret,
  deleteSecret,
  searchSecrets
} from '../controllers/secrets.controller.js';

const router = Router();

router.use(verifyJWT);

router.get('/search', searchSecrets);   // Ex. 3.1 — deve vir antes de /:id
router.get('/', listSecrets);
router.post('/', createSecret);
router.get('/:id', getSecret);          // Ex. 2.2 — verifica owner_id
router.delete('/:id', deleteSecret);   // Ex. 2.2 — verifica owner_id

export default router;
