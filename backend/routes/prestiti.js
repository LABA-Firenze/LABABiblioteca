// backend/routes/prestiti.js - PostgreSQL Version
import { Router } from 'express';
import { query } from '../utils/postgres.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const r = Router();
const ALLOWED_CATALOG_TYPES = new Set(['libri', 'tesi', 'cataloghi', 'riviste']);
const resolveCatalogType = (req) => {
  const raw = String(req.query?.tipo_catalogo || req.body?.tipo_catalogo || '').toLowerCase().trim();
  if (!raw) return null;
  return ALLOWED_CATALOG_TYPES.has(raw) ? raw : null;
};

function isAdminUser(u) {
  if (!u) return false;
  if (u.id === -1) return true;
  const role = (u.ruolo || '').toLowerCase();
  return role === 'admin' || role === 'supervisor';
}

// GET /api/prestiti
r.get('/', requireAuth, async (req, res) => {
  try {
    const rawCatalogType = String(req.query?.tipo_catalogo || '').toLowerCase().trim();
    const catalogType = resolveCatalogType(req);
    if (rawCatalogType && !catalogType) {
      return res.status(400).json({ error: 'tipo_catalogo non valido. Valori ammessi: libri, tesi, cataloghi, riviste' });
    }
    const wantAll = (req.query.all === '1' || req.query.all === 'true');
    let result;
    
    if (wantAll) {
      if (!isAdminUser(req.user)) return res.status(403).json({ error: 'Solo admin o supervisori' });
      result = await query(`
        SELECT p.*, i.nome AS articolo_nome, i.autore AS articolo_autore, i.casa_editrice AS articolo_casa_editrice,
               COALESCE(r.utente_id, u.id) AS utente_id,
               u.name AS utente_nome, u.surname AS utente_cognome, u.email AS utente_email,
               u.penalty_strikes, u.is_blocked, u.blocked_reason,
               r.dal, r.al, r.note AS richiesta_note
        FROM prestiti p
        LEFT JOIN inventario i ON i.id = p.inventario_id
        LEFT JOIN users u ON (p.chi = (u.name || ' ' || u.surname) OR p.chi LIKE '%' || u.email || '%' OR p.chi = u.email)
        LEFT JOIN richieste r ON r.id = p.richiesta_id
        ${catalogType ? "WHERE COALESCE(i.tipo_catalogo, 'libri') = $1" : ''}
        ORDER BY p.id DESC
      `, catalogType ? [catalogType] : []);
    } else {
      const params = [`%${req.user.email}%`, req.user.email];
      let whereClause = 'WHERE p.chi LIKE $1 OR p.chi = $2';
      if (catalogType) {
        params.push(catalogType);
        whereClause = `(${whereClause}) AND COALESCE(i.tipo_catalogo, 'libri') = $${params.length}`;
        whereClause = `WHERE ${whereClause}`;
      }
      result = await query(`
        SELECT p.*, i.nome AS articolo_nome, i.autore AS articolo_autore, i.casa_editrice AS articolo_casa_editrice,
               i.categoria_madre, cs.nome as categoria_figlia
        FROM prestiti p
        LEFT JOIN inventario i ON i.id = p.inventario_id
        LEFT JOIN categorie_semplici cs ON cs.id = i.categoria_id
        ${whereClause}
        ORDER BY p.id DESC
      `, params);
    }
    
    // Parse JSON fields before sending to frontend
    const processedResult = result.map(item => ({
      ...item,
      unita: typeof item.unita === 'string' ? JSON.parse(item.unita || '[]') : (item.unita || [])
    }));
    
    // Debug: mostra i dati processati
    if (processedResult && processedResult.length > 0) {
      console.log('Processed prestito data:', {
        id: processedResult[0].id,
        articolo_nome: processedResult[0].articolo_nome,
        unita: processedResult[0].unita,
        unita_type: typeof processedResult[0].unita,
        unita_length: processedResult[0].unita?.length
      });
    }
    
    res.json(processedResult || []);
  } catch (error) {
    console.error('Errore GET prestiti:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/prestiti/mie
r.get('/mie', requireAuth, async (req, res) => {
  try {
    const rawCatalogType = String(req.query?.tipo_catalogo || '').toLowerCase().trim();
    const catalogType = resolveCatalogType(req);
    if (rawCatalogType && !catalogType) {
      return res.status(400).json({ error: 'tipo_catalogo non valido. Valori ammessi: libri, tesi, cataloghi, riviste' });
    }
    console.log('User requesting loans:', {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      surname: req.user.surname
    });
    
    const params = [req.user.id, `%${req.user.email}%`, req.user.email, `%${req.user.name} ${req.user.surname}%`];
    let whereClause = 'WHERE r.utente_id = $1 OR p.chi LIKE $2 OR p.chi = $3 OR p.chi LIKE $4';
    if (catalogType) {
      params.push(catalogType);
      whereClause = `(${whereClause}) AND COALESCE(i.tipo_catalogo, 'libri') = $${params.length}`;
      whereClause = `WHERE ${whereClause}`;
    }
    const result = await query(`
      SELECT p.*, i.nome AS articolo_nome, i.autore AS articolo_autore, i.casa_editrice AS articolo_casa_editrice,
             i.categoria_madre, cs.nome as categoria_figlia,
             p.data_uscita AS data_inizio, p.data_rientro AS data_fine
      FROM prestiti p
      LEFT JOIN inventario i ON i.id = p.inventario_id
      LEFT JOIN categorie_semplici cs ON cs.id = i.categoria_id
      LEFT JOIN richieste r ON r.id = p.richiesta_id
      ${whereClause}
      ORDER BY p.id DESC
    `, params);
    
    console.log('Found loans for user:', result.length);
    
    // Parse JSON fields before sending to frontend
    const processedResult = result.map(item => ({
      ...item,
      unita: typeof item.unita === 'string' ? JSON.parse(item.unita || '[]') : (item.unita || [])
    }));
    
    res.json(processedResult || []);
  } catch (error) {
    console.error('Errore GET mie prestiti:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// POST /api/prestiti (create) — admin only
r.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { inventario_id, chi, data_uscita, data_rientro, note = null, unita_ids = [] } = req.body || {};
    const rawCatalogType = String(req.body?.tipo_catalogo || '').toLowerCase().trim();
    const catalogType = resolveCatalogType(req);
    if (rawCatalogType && !catalogType) {
      return res.status(400).json({ error: 'tipo_catalogo non valido. Valori ammessi: libri, tesi, cataloghi, riviste' });
    }
    
    if (!inventario_id || !chi || !data_uscita || !data_rientro) {
      return res.status(400).json({ error: 'campi mancanti' });
    }
    
    // Validazione date
    const dataUscita = new Date(data_uscita);
    const dataRientro = new Date(data_rientro);
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    
    if (dataUscita < oggi) {
      return res.status(400).json({ error: 'La data di uscita non può essere nel passato' });
    }
    
    if (dataRientro < dataUscita) {
      return res.status(400).json({ error: 'La data di rientro deve essere successiva alla data di uscita' });
    }
    
    // Verifica che l'oggetto esista
    const inventarioParams = [inventario_id];
    let inventarioWhere = 'id = $1';
    if (catalogType) {
      inventarioParams.push(catalogType);
      inventarioWhere += ` AND COALESCE(tipo_catalogo, 'libri') = $${inventarioParams.length}`;
    }
    const inventarioCheck = await query(`SELECT id FROM inventario WHERE ${inventarioWhere}`, inventarioParams);
    if (inventarioCheck.length === 0) {
      return res.status(400).json({ error: 'Oggetto non trovato' });
    }
    
    // Converti unita_ids in nomi delle unità se forniti
    let unitaNames = [];
    if (unita_ids && unita_ids.length > 0) {
      console.log('Received unita_ids:', unita_ids, 'for inventario_id:', inventario_id);
      
      const unitaResult = await query(`
        SELECT codice_univoco 
        FROM inventario_unita 
        WHERE id = ANY($1)
      `, [unita_ids]);
      
      console.log('Found units:', unitaResult);
      unitaNames = unitaResult.map(u => u.codice_univoco);
      
      // Verifica che tutte le unità richieste esistano
      if (unitaNames.length !== unita_ids.length) {
        return res.status(400).json({ error: `Una o più unità non trovate. Richieste: ${unita_ids.length}, Trovate: ${unitaNames.length}` });
      }
    }
    
    const result = await query(`
      INSERT INTO prestiti (inventario_id, chi, data_uscita, data_rientro, note, unita)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [inventario_id, chi, data_uscita, data_rientro, note, JSON.stringify(unitaNames)]);
    
    // Se sono state specificate unità, aggiornale da "riservato" a "in_prestito"
    if (unita_ids && unita_ids.length > 0) {
      await query(`
        UPDATE inventario_unita 
        SET stato = 'in_prestito', prestito_corrente_id = $1, richiesta_riservata_id = NULL
        WHERE id = ANY($2)
      `, [result[0].id, unita_ids]);
      
      console.log(`✅ ${unita_ids.length} unità aggiornate a "in_prestito" per prestito ${result[0].id}`);
    }
    
    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Errore POST prestito:', error);
    res.status(400).json({ error: error.message || 'Errore creazione prestito' });
  }
});

// PUT /api/prestiti/:id (update) — admin only
r.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { inventario_id, chi, data_uscita, data_rientro, note = null, stato } = req.body || {};
    const rawCatalogType = String(req.body?.tipo_catalogo || '').toLowerCase().trim();
    const catalogType = resolveCatalogType(req);
    if (rawCatalogType && !catalogType) {
      return res.status(400).json({ error: 'tipo_catalogo non valido. Valori ammessi: libri, tesi, cataloghi, riviste' });
    }
    
    if (!inventario_id || !chi || !data_uscita || !data_rientro || !stato) {
      return res.status(400).json({ error: 'campi mancanti' });
    }
    
    const inventarioParams = [inventario_id];
    let inventarioWhere = 'id = $1';
    if (catalogType) {
      inventarioParams.push(catalogType);
      inventarioWhere += ` AND COALESCE(tipo_catalogo, 'libri') = $${inventarioParams.length}`;
    }
    const inventarioCheck = await query(`SELECT id FROM inventario WHERE ${inventarioWhere}`, inventarioParams);
    if (inventarioCheck.length === 0) {
      return res.status(400).json({ error: 'Oggetto non trovato' });
    }

    const result = await query(`
      UPDATE prestiti 
      SET inventario_id = $1, chi = $2, data_uscita = $3, data_rientro = $4, note = $5, stato = $6, updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `, [inventario_id, chi, data_uscita, data_rientro, note, stato, id]);
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Prestito non trovato' });
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error('Errore PUT prestito:', error);
    res.status(400).json({ error: error.message || 'Errore aggiornamento prestito' });
  }
});

// DELETE /api/prestiti/:id (delete) — admin only
r.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM prestiti WHERE id = $1 RETURNING id', [id]);
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Prestito non trovato' });
    }
    
    res.json({ message: 'Prestito eliminato' });
  } catch (error) {
    console.error('Errore DELETE prestito:', error);
    res.status(400).json({ error: error.message || 'Errore eliminazione prestito' });
  }
});

// PUT /api/prestiti/:id/approva (approve request and create loan) — admin only
r.put('/:id/approva', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    // Update request status to approved
    const requestResult = await query('UPDATE richieste SET stato = $1 WHERE id = $2 RETURNING id', ['approvata', id]);
    if (requestResult.length === 0) {
      return res.status(404).json({ error: 'Richiesta non trovata' });
    }
    
    // Get request details with user info and penalty status
    const request = await query(`
      SELECT r.*, u.name, u.surname, u.email, u.penalty_strikes, u.is_blocked, u.blocked_reason
      FROM richieste r 
      LEFT JOIN users u ON r.utente_id = u.id 
      WHERE r.id = $1
    `, [id]);
    
    if (request.length === 0) {
      return res.status(404).json({ error: 'Richiesta non trovata' });
    }
    
    const requestData = request[0];
    const userFullName = `${requestData.name} ${requestData.surname}`.trim() || requestData.email;
    
    // Check if user is blocked due to penalties
    if (requestData.is_blocked) {
      return res.status(403).json({ 
        error: 'Utente bloccato',
        message: `L'utente ${userFullName} è attualmente bloccato per i noleggi.`,
        reason: requestData.blocked_reason || 'Motivo non specificato',
        penaltyStrikes: requestData.penalty_strikes || 0,
        userBlocked: true
      });
    }
    
    // Check if user has penalty strikes (warning for admin)
    const penaltyInfo = requestData.penalty_strikes > 0 ? {
      hasStrikes: true,
      strikes: requestData.penalty_strikes,
      warning: requestData.penalty_strikes >= 2 ? 
        `ATTENZIONE: L'utente ${userFullName} ha ${requestData.penalty_strikes} penalità per ritardi. Un altro ritardo comporterà il blocco automatico.` :
        `L'utente ${userFullName} ha ${requestData.penalty_strikes} penalità per ritardi.`
    } : { hasStrikes: false, strikes: 0 };
    
    // Create loan record
    const loanResult = await query(`
      INSERT INTO prestiti (inventario_id, chi, data_uscita, data_rientro, note, richiesta_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [requestData.inventario_id, userFullName, requestData.dal, requestData.al, requestData.note, id]);
    
    // Update inventory units status to 'prestato'
    if (requestData.unit_id) {
      // Se c'è un'unità specifica riservata, marcala come prestata
      await query(`
        UPDATE inventario_unita 
        SET stato = 'prestato', richiesta_riservata_id = NULL
        WHERE id = $1 AND richiesta_riservata_id = $2
      `, [requestData.unit_id, id]);
    } else {
      // Altrimenti marca le prime unità disponibili come prestate
      await query(`
        UPDATE inventario_unita 
        SET stato = 'prestato' 
        WHERE inventario_id = $1 
        AND stato = 'disponibile' 
        AND id IN (
          SELECT id FROM inventario_unita 
          WHERE inventario_id = $1 AND stato = 'disponibile' 
          LIMIT $2
        )
      `, [requestData.inventario_id, requestData.quantita || 1]);
    }
    
    res.json({ 
      message: 'Richiesta approvata e prestito creato',
      loanId: loanResult[0].id,
      penaltyInfo: penaltyInfo
    });
  } catch (error) {
    console.error('Errore PUT approva prestito:', error);
    res.status(400).json({ error: error.message || 'Errore nell\'approvazione' });
  }
});

// PUT /api/prestiti/:id/rifiuta (reject request) — admin only
r.put('/:id/rifiuta', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { motivazione } = req.body || {};
    
    if (!motivazione) {
      return res.status(400).json({ error: 'Motivazione del rifiuto richiesta' });
    }
    
    // Get request details to free reserved units
    const request = await query('SELECT unit_id FROM richieste WHERE id = $1', [id]);
    
    // Update request status to rejected with reason
    const requestResult = await query(`
      UPDATE richieste 
      SET stato = $1, note = $2 
      WHERE id = $3
      RETURNING id
    `, ['rifiutata', motivazione, id]);
    
    if (requestResult.length === 0) {
      return res.status(404).json({ error: 'Richiesta non trovata' });
    }
    
    // Free reserved unit if exists
    if (request.length > 0 && request[0].unit_id) {
      await query(`
        UPDATE inventario_unita 
        SET stato = 'disponibile', richiesta_riservata_id = NULL
        WHERE id = $1 AND richiesta_riservata_id = $2
      `, [request[0].unit_id, id]);
      
      console.log(`✅ Unità ${request[0].unit_id} liberata dopo rifiuto richiesta ${id}`);
    }
    
    res.json({ message: 'Richiesta rifiutata' });
  } catch (error) {
    console.error('Errore PUT rifiuta prestito:', error);
    res.status(400).json({ error: error.message || 'Errore nel rifiuto' });
  }
});

// PUT /api/prestiti/:id/restituisci (return loan) — admin only
r.put('/:id/restituisci', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    // Get loan details first
    const loanDetails = await query('SELECT inventario_id FROM prestiti WHERE id = $1', [id]);
    
    if (loanDetails.length === 0) {
      return res.status(404).json({ error: 'Prestito non trovato' });
    }
    
    // Update loan status to returned
    const result = await query(`
      UPDATE prestiti 
      SET stato = 'restituito', data_rientro = CURRENT_DATE 
      WHERE id = $1
      RETURNING id
    `, [id]);
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Prestito non trovato' });
    }
    
    // Set inventory units back to available
    await query(`
      UPDATE inventario_unita 
      SET stato = 'disponibile' 
      WHERE inventario_id = $1 AND stato = 'prestato'
    `, [loanDetails[0].inventario_id]);
    
    res.json({ message: 'Prestito terminato con successo' });
  } catch (error) {
    console.error('Errore PUT restituisci prestito:', error);
    res.status(400).json({ error: error.message || 'Errore nella restituzione' });
  }
});

// GET /api/prestiti/unit/:unitId (get loan details for specific unit) — admin only
r.get('/unit/:unitId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { unitId } = req.params;
    
    // Get loan details for the specific unit
    const result = await query(`
      SELECT p.*, u.name AS utente_nome, u.surname AS utente_cognome, u.email AS utente_email,
             i.nome AS articolo_nome, iu.codice_univoco
      FROM prestiti p
      LEFT JOIN users u ON (p.chi LIKE '%' || u.email || '%' OR p.chi = u.email)
      LEFT JOIN inventario i ON p.inventario_id = i.id
      LEFT JOIN inventario_unita iu ON iu.inventario_id = p.inventario_id
      WHERE iu.id = $1 AND iu.stato = 'prestato' AND p.stato = 'attivo'
      LIMIT 1
    `, [unitId]);
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Prestito non trovato per questa unità' });
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error('Errore GET unit loan details:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/prestiti/:loanId/units (get units for specific loan) — user only
r.get('/:loanId/units', requireAuth, async (req, res) => {
  try {
    const { loanId } = req.params;
    
    // Get loan details first to verify ownership
    const loan = await query(`
      SELECT p.*, u.email 
      FROM prestiti p
      LEFT JOIN users u ON (p.chi = (u.name || ' ' || u.surname) OR p.chi LIKE '%' || u.email || '%' OR p.chi = u.email)
      WHERE p.id = $1
    `, [loanId]);
    
    if (loan.length === 0) {
      return res.status(404).json({ error: 'Prestito non trovato' });
    }
    
    // Verify user owns this loan
    if (loan[0].email !== req.user.email) {
      return res.status(403).json({ error: 'Non autorizzato per questo prestito' });
    }
    
    // Get units that are currently loaned for this specific loan
    // For now, we'll get units that are 'prestato' for this inventory item
    const units = await query(`
      SELECT iu.*, i.nome as item_name
      FROM inventario_unita iu
      LEFT JOIN inventario i ON i.id = iu.inventario_id
      WHERE iu.inventario_id = $1 AND iu.stato = 'prestato'
      ORDER BY iu.codice_univoco
    `, [loan[0].inventario_id]);
    
    res.json(units);
  } catch (error) {
    console.error('Errore GET loan units:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint temporaneo per aggiornare prestiti esistenti con unità mancanti
r.get('/fix-units', async (req, res) => {
  try {
    // Trova prestiti senza unità specificate per FX3
    const prestiti = await query(`
      SELECT p.id, p.inventario_id, i.nome, p.chi
      FROM prestiti p
      LEFT JOIN inventario i ON i.id = p.inventario_id
      WHERE p.unita = '[]' OR p.unita IS NULL
      AND p.data_rientro IS NULL
      AND i.nome = 'FX3'
    `);
    
    console.log('Prestiti FX3 senza unità:', prestiti);
    
    if (prestiti.length > 0) {
      // Aggiorna il prestito con FX3_001 (che è quella in stato "prestato")
      await query(`
        UPDATE prestiti 
        SET unita = $1 
        WHERE id = $2
      `, [JSON.stringify(['FX3_001']), prestiti[0].id]);
      
      res.json({ message: 'Prestito aggiornato con unità FX3_001', prestito_id: prestiti[0].id });
    } else {
      res.json({ message: 'Nessun prestito da aggiornare' });
    }
  } catch (error) {
    console.error('Errore fix-units:', error);
    res.status(500).json({ error: error.message });
  }
});

export default r;