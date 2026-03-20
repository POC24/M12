import * as service from '../services/ticket.service.js';
import { getTicketById } from '../services/ticket.service.js';
import { notify } from '../services/webhook.service.js';

export async function list(req, res) {
  try {
    res.json(await service.listTickets(req.query));
  } catch (error) {
    console.error('Error listing tickets:', error);
    res.status(500).json({ error: 'Failed to list tickets' });
  }
}

export async function create(req, res) {
  try {
    const data = req.body;

    if (!data.ci_subcat) return res.status(400).json({ error: 'ci_subcat is required' });
    if (!data.ci_cat) return res.status(400).json({ error: 'ci_cat is required' });
    if (typeof data.impact !== 'number') return res.status(400).json({ error: 'impact must be a number' });
    if (typeof data.urgency !== 'number') return res.status(400).json({ error: 'urgency must be a number' });
    if (typeof data.priority !== 'number') return res.status(400).json({ error: 'priority must be a number' });
    if (!data.category) return res.status(400).json({ error: 'category is required' });

    // Validar intervalo para impact (0-5)
    if (data.impact < 0 || data.impact > 5 || !Number.isInteger(data.impact)) {
      return res.status(400).json({ error: 'impact must be an integer between 0 and 5' });
    }

    // Validar intervalo para urgency (0-5)
    if (data.urgency < 0 || data.urgency > 5 || !Number.isInteger(data.urgency)) {
      return res.status(400).json({ error: 'urgency must be an integer between 0 and 5' });
    }

    // Validar intervalo para priority (1-4)
    if (data.priority < 1 || data.priority > 4 || !Number.isInteger(data.priority)) {
      return res.status(400).json({ error: 'priority must be an integer between 1 and 4' });
    }

    // Associar ao utilizador autenticado
    data.created_by = req.user.id;

    // Gerar ci_name automaticamente com base no ci_subcat
    data.ci_name = await service.generateCiName(data.ci_subcat);

    const ticket = await service.createTicket(data);
    notify('ticket_created', ticket);
    res.status(201).json(ticket);
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
}

export async function update(req, res) {
  try {
    const data = req.body;

    // Validar impacto se fornecido
    if (data.impact !== undefined) {
      if (typeof data.impact !== 'number') {
        return res.status(400).json({ error: 'impact must be a number' });
      }
      if (data.impact < 0 || data.impact > 5 || !Number.isInteger(data.impact)) {
        return res.status(400).json({ error: 'impact must be an integer between 0 and 5' });
      }
    }

    // Validar urgência se fornecida
    if (data.urgency !== undefined) {
      if (typeof data.urgency !== 'number') {
        return res.status(400).json({ error: 'urgency must be a number' });
      }
      if (data.urgency < 0 || data.urgency > 5 || !Number.isInteger(data.urgency)) {
        return res.status(400).json({ error: 'urgency must be an integer between 0 and 5' });
      }
    }

    // Validar prioridade se fornecida
    if (data.priority !== undefined) {
      if (typeof data.priority !== 'number') {
        return res.status(400).json({ error: 'priority must be a number' });
      }
      if (data.priority < 1 || data.priority > 4 || !Number.isInteger(data.priority)) {
        return res.status(400).json({ error: 'priority must be an integer between 1 and 4' });
      }
    }

    // Tickets antigos (created_by = NULL) podem ser editados por qualquer user autenticado.
    // Tickets novos (created_by preenchido) só podem ser editados pelo criador ou por um admin.
    const existing = await getTicketById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    if (existing.created_by !== null &&
        req.user.role !== 'admin' &&
        req.user.id !== existing.created_by) {
      return res.status(403).json({ error: 'Não tens permissão para editar este ticket' });
    }

    const result = await service.updateTicket(req.params.id, req.body);

    if (!result) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    notify('ticket_updated', result);
    res.json(result.after);
  } catch (error) {
    console.error('Error updating ticket:', error);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
}

export async function remove(req, res) {
  try {
    await service.deleteTicket(req.params.id);
    notify('ticket_deleted', { incident_id: req.params.id });
    res.sendStatus(204);
  } catch (error) {
    console.error('Error deleting ticket:', error);
    res.status(500).json({ error: 'Failed to delete ticket' });
  }
}

export async function statistics(req, res) {
  try {
    const view = req.query.view; // status | priority | recent | undefined
    const days = Number(req.query.days || 7);
    res.json(await service.stats({ view, days }));
  } catch (error) {
    console.error('Error getting statistics:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
}