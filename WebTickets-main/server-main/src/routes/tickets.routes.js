import { Router } from 'express';
import * as controller from '../controllers/ticket.controller.js';
import { verifyJWT, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/stats', controller.statistics);   // público (deve vir antes de /:id)
router.get('/', controller.list);              // público — leitura

router.post('/', verifyJWT, controller.create);                              // qualquer utilizador autenticado
router.put('/:id', verifyJWT, controller.update);                            // qualquer utilizador autenticado
router.delete('/:id', verifyJWT, requireRole('admin'), controller.remove);  // só admins

export default router;
