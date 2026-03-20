import { db } from '../db/database.js';
import { encrypt, decrypt } from './encryption.service.js';

/* ── Ex. 3.2: desencripta a descrição de um ticket antes de o devolver ── */
function decryptTicket(t) {
  if (t && t.description) {
    try { t.description = decrypt(t.description); }
    catch { t.description = null; }
  }
  return t;
}

const formatDate = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

function parseOpenTime(str) {
  // esperado: "dd-mm-yyyy hh:mm"
  if (!str || typeof str !== 'string') return null;
  const [datePart, timePart] = str.split(' ');
  if (!datePart || !timePart) return null;

  const [dd, mm, yyyy] = datePart.split('-').map(Number);
  const [hh, min] = timePart.split(':').map(Number);

  if (![dd, mm, yyyy, hh, min].every(Number.isFinite)) return null;

  return new Date(yyyy, mm - 1, dd, hh, min, 0, 0);
}

export async function listTickets(filters) {
  try {
    let sql = 'FROM tickets LEFT JOIN users ON users.id = tickets.created_by WHERE 1=1';
    const params = [];

    if (filters.incident_id) {
      sql += ' AND incident_id = ?';
      params.push(filters.incident_id);
    }

    if (filters.priority) {
      sql += ' AND priority = ?';
      params.push(filters.priority);
    }

    if (filters.category) {
      sql += ' AND LOWER(category) = LOWER(?)';
      params.push(filters.category);
    }

    if (filters.ci_cat) {
      sql += ' AND LOWER(ci_cat) = LOWER(?)';
      params.push(filters.ci_cat);
    }

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    const limit = Math.min(Number(filters.limit) || 10, 50);
    const page = Math.max(Number(filters.page) || 1, 1);
    const offset = (page - 1) * limit;

    const total = await db.get(`SELECT COUNT(*) c ${sql}`, params);
    const tickets = await db.all(
      `SELECT tickets.*, users.username AS created_by_username ${sql} LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      total: total.c,
      page,
      limit,
      hasMore: offset + tickets.length < total.c,
      tickets: tickets.map(decryptTicket)
    };
  } catch (error) {
    console.error('Error listing tickets:', error);
    throw error;
  }
}

const SUBCAT_PREFIX = {
  "Application Server": "ACS",
  "Automation Software": "ASW",
  "Banking Device": "CBD",
  "Citrix": "SUB",
  "Client Based Application": "CBA",
  "Controller": "CNT",
  "DataCenterEquipment": "DCE",
  "Database": "ADB",
  "Database Software": "DSW",
  "Desktop": "DSK",
  "Desktop Application": "DTA",
  "ESX Cluster": "ESC",
  "ESX Server": "ESS",
  "Encryption": "ENC",
  "Exchange": "EXC",
  "Firewall": "FRW",
  "IPtelephony": "NET",
  "Instance": "DBI",
  "KVM Switches": "KVM",
  "Keyboard": "KYB",
  "Laptop": "LAP",
  "Linux Server": "LSR",
  "MQ Queue Manager": "MQM",
  "Monitor": "MON",
  "Neoview Server": "NSR",
  "NonStop Harddisk": "NSH",
  "NonStop Server": "NSS",
  "NonStop Storage": "STR",
  "Number": "PHN",
  "Oracle Server": "OES",
  "Printer": "PRN",
  "RAC Service": "DBR",
  "Router": "RTR",
  "SAN": "SAN",
  "SAP": "SAP",
  "Scanner": "SCN",
  "Security Software": "DSW",
  "Server Based Application": "SBA",
  "SharePoint Farm": "SPF",
  "Standard Application": "STA",
  "Switch": "SWT",
  "System Software": "SSW",
  "Tape Library": "TAP",
  "Thin Client": "TCL",
  "UPS": "UPS",
  "Unix Server": "UIX",
  "VDI": "VDI",
  "VMWare": "VMW",
  "Virtual Tape Server": "VTS",
  "Web Based Application": "SUB",
  "Windows Server": "WSR",
  "X86 Server": "XSR",
  "zOS Cluster": "ZOC",
  "zOS Server": "ZOS",
  "zOS Systeem": "SYS"
};

export async function generateCiName(ci_subcat) {
  const prefix = SUBCAT_PREFIX[ci_subcat] ?? ci_subcat.substring(0, 3).toUpperCase();

  const row = await db.get(
    `SELECT MAX(CAST(SUBSTR(ci_name, 4) AS INTEGER)) as maxNum
     FROM tickets
     WHERE ci_name LIKE ?`,
    [`${prefix}%`]
  );

  const nextNum = (row?.maxNum ?? 0) + 1;
  return `${prefix}${String(nextNum).padStart(6, '0')}`;
}

export async function createTicket(data) {
  try {
    // Ex. 3.2: cifrar descrição antes de guardar na BD
    const encryptedDescription = data.description ? encrypt(data.description) : null;

    const ticket = {
      ci_name: data.ci_name,
      ci_cat: data.ci_cat,
      ci_subcat: data.ci_subcat,
      status: 'Open',
      impact: data.impact,
      urgency: data.urgency,
      priority: data.priority,
      category: data.category,
      open_time: formatDate(),
      resolved_time: null,
      close_time: null,
      closure_code: null,
      description: encryptedDescription
    };

    const result = await db.run(
      `INSERT INTO tickets (ci_name, ci_cat, ci_subcat, status, impact, urgency, priority, category, open_time, resolved_time, close_time, closure_code, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...Object.values(ticket), data.created_by ?? null]
    );

    return {
      incident_id: result.lastID,
      ...ticket,
      description: data.description ?? null  // devolver plaintext
    };
  } catch (error) {
    console.error('Error creating ticket:', error);
    throw error;
  }
}

export async function getTicketById(id) {
  const t = await db.get('SELECT * FROM tickets WHERE incident_id = ?', [id]);
  return t ? decryptTicket(t) : t;
}

export async function updateTicket(id, data) {
  try {
    const before = await db.get(
      `SELECT * FROM tickets WHERE incident_id = ?`,
      [id]
    );

    if (!before) return null;

    const allowedFields = [
      'ci_name',
      'ci_cat',
      'ci_subcat',
      'status',
      'impact',
      'urgency',
      'priority',
      'category',
      'closure_code',
      'description'  // Ex. 3.2: cifrada antes de guardar
    ];

    const fields = [];
    const values = [];

    let hasNonClosure = false;
    let hasClosure = false;

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        // Ex. 3.2: cifrar descrição antes de guardar na BD
        let value = data[field];
        if (field === 'description') {
          value = value ? encrypt(value) : null;
        }
        fields.push(`${field} = ?`);
        values.push(value);

        field === 'closure_code'
          ? hasClosure = true
          : hasNonClosure = true;
      }
    }

    if (hasNonClosure && !hasClosure) {
      fields.push('resolved_time = ?');
      values.push(formatDate());
    }

    if (hasClosure) {
      fields.push('close_time = ?');
      values.push(formatDate());
    }

    if (fields.length) {
      values.push(id);
      await db.run(
        `UPDATE tickets SET ${fields.join(', ')} WHERE incident_id = ?`,
        values
      );
    }

    const after = await db.get(
      `SELECT * FROM tickets WHERE incident_id = ?`,
      [id]
    );

    return { before: decryptTicket(before), after: decryptTicket(after) };
  } catch (error) {
    console.error('Error updating ticket:', error);
    throw error;
  }
}

export async function deleteTicket(id) {
  try {
    return db.run(`DELETE FROM tickets WHERE incident_id = ?`, [id]);
  } catch (error) {
    console.error('Error deleting ticket:', error);
    throw error;
  }
}

export async function stats({ view, days } = {}) {
  try {
    // views suportadas para permitir 3 GET "diferentes" no stats.html
    if (view === 'status') {
      return {
        total: (await db.get('SELECT COUNT(*) c FROM tickets')).c,
        open: (await db.get(`SELECT COUNT(*) c FROM tickets WHERE status='Open'`)).c,
        closed: (await db.get(`SELECT COUNT(*) c FROM tickets WHERE status='Closed'`)).c,
        inProgress: (await db.get(`SELECT COUNT(*) c FROM tickets WHERE status='Work in progress'`)).c
      };
    }

    if (view === 'priority') {
      // prioridade no CSV/API é numérica (1..4)
      return {
        low: (await db.get(`SELECT COUNT(*) c FROM tickets WHERE priority=1`)).c,
        medium: (await db.get(`SELECT COUNT(*) c FROM tickets WHERE priority=2`)).c,
        high: (await db.get(`SELECT COUNT(*) c FROM tickets WHERE priority=3`)).c,
        critical: (await db.get(`SELECT COUNT(*) c FROM tickets WHERE priority=4`)).c
      };
    }

    if (view === 'recent') {
      const d = Number.isFinite(days) ? Math.max(1, Math.min(days, 60)) : 7;
      const all = await db.all(`SELECT incident_id, ci_name, status, priority, category, open_time FROM tickets`);

      const now = new Date();
      const cutoff = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

      const recent = all
        .map(t => ({ ...t, _openDate: parseOpenTime(t.open_time) }))
        .filter(t => t._openDate && t._openDate >= cutoff)
        .sort((a, b) => b._openDate - a._openDate)
        .slice(0, 12)
        .map(({ _openDate, ...t }) => t);

      return {
        days: d,
        count: recent.length,
        tickets: recent
      };
    }

    // default (se alguém chamar /tickets/stats sem view)
    return {
      status: await stats({ view: 'status' }),
      priority: await stats({ view: 'priority' }),
      recent: await stats({ view: 'recent', days: days || 7 })
    };
  } catch (error) {
    console.error('Error getting statistics:', error);
    throw error;
  }
}