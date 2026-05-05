// backend/routes/users.js - Gestione utenti
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../utils/postgres.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { normalizeUser, normalizeRole } from '../utils/roles.js';

const r = Router();

// POST /api/users - Crea utente (solo admin)
r.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { email, password, name, surname, phone, matricola, corso_accademico, ruolo } = req.body || {};

    if (!email || !password || !name || !surname) {
      return res.status(400).json({ error: 'Email, password, nome e cognome richiesti' });
    }

    const existing = await query('SELECT id FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Utente già esistente' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const userRole = normalizeRole(ruolo, null, email);
    const storedRole = userRole === 'admin' ? 'supervisor' : userRole;

    const result = await query(`
      INSERT INTO users (email, password_hash, name, surname, phone, matricola, corso_accademico, ruolo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, email, name, surname, phone, matricola, ruolo, corso_accademico, created_at, updated_at
    `, [email, hashedPassword, name, surname, phone || null, matricola || null, corso_accademico || null, storedRole]);

    res.status(201).json(normalizeUser(result[0]));
  } catch (error) {
    console.error('Errore POST user:', error);
    res.status(500).json({ error: 'Errore nella creazione utente' });
  }
});

// GET /api/users - Lista utenti (solo admin)
r.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        id, email, name, surname, phone, matricola, 
        ruolo, corso_accademico, created_at, updated_at
      FROM users 
      ORDER BY created_at DESC
    `);
    
    const normalized = (result || []).map(normalizeUser);
    res.json(normalized);
  } catch (error) {
    console.error('Errore GET users:', error);
    res.status(500).json({ error: 'Errore nel caricamento utenti' });
  }
});

// GET /api/users/:id - Dettaglio utente (solo admin)
r.get('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT 
        id, email, name, surname, phone, matricola, 
        ruolo, corso_accademico, created_at, updated_at
      FROM users 
      WHERE id = $1
    `, [id]);
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    res.json(normalizeUser(result[0]));
  } catch (error) {
    console.error('Errore GET user:', error);
    res.status(500).json({ error: 'Errore nel caricamento utente' });
  }
});

// PUT /api/users/:id - Aggiorna utente (solo admin)
r.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, surname, phone, matricola, ruolo, corso_accademico } = req.body || {};
    
    const result = await query(`
      UPDATE users 
      SET name = $1, surname = $2, phone = $3, matricola = $4, 
          ruolo = $5, corso_accademico = $6, updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING id, email, name, surname, phone, matricola, ruolo, corso_accademico
    `, [name, surname, phone, matricola, ruolo, corso_accademico, id]);
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    res.json(normalizeUser(result[0]));
  } catch (error) {
    console.error('Errore PUT user:', error);
    res.status(500).json({ error: 'Errore nell\'aggiornamento utente' });
  }
});

// DELETE /api/users/:id - Elimina utente (solo admin)
r.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Non permettere eliminazione dell'admin speciale
    if (id === '-1' || id === -1) {
      return res.status(400).json({ error: 'Non è possibile eliminare l\'admin principale' });
    }
    
    // Prima ottengo l'email dell'utente
    const userResult = await query('SELECT email, ruolo FROM users WHERE id = $1', [id]);
    if (userResult.length === 0) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    const { email: userEmail, ruolo: targetRole } = userResult[0];

    const requesterRole = (req.user?.ruolo || '').toLowerCase();
    const isSupervisor = requesterRole === 'supervisor';
    const targetIsAdmin = (targetRole || '').toLowerCase() === 'admin';

    if (isSupervisor && targetIsAdmin) {
      return res.status(403).json({ error: 'I supervisori non possono eliminare l\'admin di sistema' });
    }

    // Controlla se l'utente ha prestiti attivi
    const activeLoans = await query(`
      SELECT COUNT(*) as count 
      FROM prestiti p 
      WHERE (p.chi LIKE $1 OR p.chi = $2) AND p.stato = 'attivo'
    `, [`%${userEmail}%`, userEmail]);
    
    if (activeLoans[0]?.count > 0) {
      return res.status(400).json({ 
        error: 'Impossibile eliminare: utente ha prestiti attivi. Termina prima i prestiti.' 
      });
    }
    
    // Controlla se l'utente ha richieste in attesa
    const pendingRequests = await query(`
      SELECT COUNT(*) as count 
      FROM richieste r 
      WHERE r.utente_id = $1 AND r.stato = 'in_attesa'
    `, [id]);
    
    if (pendingRequests[0]?.count > 0) {
      return res.status(400).json({ 
        error: 'Impossibile eliminare: utente ha richieste in attesa. Gestisci prima le richieste.' 
      });
    }
    
    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    res.json({ message: 'Utente eliminato con successo' });
  } catch (error) {
    console.error('Errore DELETE user:', error);
    res.status(500).json({ error: 'Errore nell\'eliminazione utente' });
  }
});

export default r;
