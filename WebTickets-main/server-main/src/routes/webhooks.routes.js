import { Router } from 'express';
import { register } from '../services/webhook.service.js';

const router = Router();

router.post('/', (req, res) => {
  try {
    const { url, event } = req.body;

    if (!url || !event) {
      return res.status(400).json({
        error: 'url and event are mandatory'
      });
    }

    register(url, event);
    res.status(201).json({ message: 'Webhook registered' });

  } catch (error) {
    console.error('Failed to register webhook:', error);
    res.status(500).json({ error: 'Failed to register webhook' });
  }
});

export default router;
