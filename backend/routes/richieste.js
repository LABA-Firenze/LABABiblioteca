// backend/routes/richieste.js - PostgreSQL Version
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

// GET /api/richieste
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
      const role = (req.user.ruolo || '').toLowerCase();
      if (role !== 'admin' && role !== 'supervisor') {
        return res.status(403).json({ error: 'Solo admin o supervisori' });
      }
      result = await query(`
        SELECT r.*, 
               u.name as utente_nome, u.surname as utente_cognome, u.email as utente_email,
               u.penalty_strikes, u.is_blocked, u.blocked_reason,
               i.nome as oggetto_nome, i.nome as articolo_nome
        FROM richieste r
        LEFT JOIN users u ON r.utente_id = u.id
        LEFT JOIN inventario i ON r.inventario_id = i.id
        ${catalogType ? "WHERE COALESCE(i.tipo_catalogo, 'libri') = $1" : ''}
        ORDER BY r.created_at DESC
      `, catalogType ? [catalogType] : []);
    } else {
      const params = [req.user.id];
      let whereClause = 'WHERE r.utente_id = $1';
      if (catalogType) {
        params.push(catalogType);
        whereClause += ` AND COALESCE(i.tipo_catalogo, 'libri') = $${params.length}`;
      }
      result = await query(`
        SELECT r.*, i.nome as oggetto_nome, i.nome as articolo_nome
        FROM richieste r
        LEFT JOIN inventario i ON r.inventario_id = i.id
        ${whereClause}
        ORDER BY r.created_at DESC
      `, params);
    }
    
    res.json(result || []);
  } catch (error) {
    console.error('Errore GET richieste:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/richieste/mie
r.get('/mie', requireAuth, async (req, res) => {
  try {
    const rawCatalogType = String(req.query?.tipo_catalogo || '').toLowerCase().trim();
    const catalogType = resolveCatalogType(req);
    if (rawCatalogType && !catalogType) {
      return res.status(400).json({ error: 'tipo_catalogo non valido. Valori ammessi: libri, tesi, cataloghi, riviste' });
    }
    const params = [req.user.id];
    let whereClause = 'WHERE r.utente_id = $1';
    if (catalogType) {
      params.push(catalogType);
      whereClause += ` AND COALESCE(i.tipo_catalogo, 'libri') = $${params.length}`;
    }
    const result = await query(`
      SELECT r.*, i.nome as oggetto_nome, i.nome as articolo_nome
      FROM richieste r
      LEFT JOIN inventario i ON r.inventario_id = i.id
      ${whereClause}
      ORDER BY r.created_at DESC
    `, params);
    
    res.json(result || []);
  } catch (error) {
    console.error('Errore GET mie richieste:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// POST /api/richieste
r.post('/', requireAuth, async (req, res) => {
  try {
    // Check if user is blocked before allowing new requests
    const userCheck = await query(`
      SELECT penalty_strikes, is_blocked, blocked_reason
      FROM users WHERE id = $1
    `, [req.user.id]);
    
    if (userCheck.length > 0 && userCheck[0].is_blocked) {
      return res.status(403).json({
        error: 'Accesso negato',
        message: 'Non puoi effettuare nuove richieste perché hai accumulato 3 o più penalità per ritardi.',
        reason: userCheck[0].blocked_reason,
        strikes: userCheck[0].penalty_strikes,
        blocked: true,
        helpMessage: 'Recati di persona per sbloccare il tuo account.'
      });
    }
    
    const { unit_id, inventario_id, dal, al, motivo, note, tipo_utilizzo } = req.body || {};
    const rawCatalogType = String(req.body?.tipo_catalogo || '').toLowerCase().trim();
    const catalogType = resolveCatalogType(req);
    if (rawCatalogType && !catalogType) {
      return res.status(400).json({ error: 'tipo_catalogo non valido. Valori ammessi: libri, tesi, cataloghi, riviste' });
    }
    
    console.log(`🔍 Creating request - unit_id: ${unit_id}, inventario_id: ${inventario_id}`);
    
    // Support both unit_id (new) and inventario_id (legacy)
    let actualInventarioId = inventario_id;
    
    if (unit_id) {
      // Get inventario_id from unit
      const unitResult = await query('SELECT inventario_id FROM inventario_unita WHERE id = $1 AND stato = $2 AND prestito_corrente_id IS NULL', [unit_id, 'disponibile']);
      if (unitResult.length === 0) {
        return res.status(400).json({ error: 'Unità non disponibile o non trovata' });
      }
      actualInventarioId = unitResult[0].inventario_id;
    }
    
    if (!actualInventarioId || !dal || !al) {
      return res.status(400).json({ error: 'Campi mancanti' });
    }
    
    // Validazione date
    const dataInizio = new Date(dal);
    const dataFine = new Date(al);
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0); // Reset ore per confronto solo date
    
    if (dataInizio < oggi) {
      return res.status(400).json({ error: 'La data di inizio non può essere nel passato' });
    }
    
    if (dataFine < dataInizio) {
      return res.status(400).json({ error: 'La data di fine deve essere successiva alla data di inizio' });
    }
    
    // Verifica che l'oggetto esista e controlla il tipo
    const inventarioParams = [actualInventarioId];
    let inventarioWhere = 'id = $1';
    if (catalogType) {
      inventarioParams.push(catalogType);
      inventarioWhere += ` AND COALESCE(tipo_catalogo, 'libri') = $${inventarioParams.length}`;
    }
    const inventarioCheck = await query(`SELECT id, tipo_prestito FROM inventario WHERE ${inventarioWhere}`, inventarioParams);
    if (inventarioCheck.length === 0) {
      return res.status(400).json({ error: 'Oggetto non trovato' });
    }
    
    const item = inventarioCheck[0];
    
    // Validazione speciale per tipo di utilizzo
    if (item.tipo_prestito === 'solo_interno') {
      // Solo interno: data massima = stesso giorno
      const dataInizioDay = new Date(dataInizio).toDateString();
      const dataFineDay = new Date(dataFine).toDateString();
      
      if (dataInizioDay !== dataFineDay) {
        return res.status(400).json({ 
          error: 'Per oggetti ad uso interno all\'accademia, la data di fine deve essere lo stesso giorno della data di inizio' 
        });
      }
    } else if (item.tipo_prestito === 'entrambi') {
      // Entrambi: l'utente deve scegliere il tipo di utilizzo
      if (!tipo_utilizzo || !['interno', 'esterno'].includes(tipo_utilizzo)) {
        return res.status(400).json({ 
          error: 'Per oggetti utilizzabili sia internamente che esternamente, devi specificare il tipo di utilizzo (interno o esterno)' 
        });
      }
      
      // Se interno, valida stesso giorno
      if (tipo_utilizzo === 'interno') {
        const dataInizioDay = new Date(dataInizio).toDateString();
        const dataFineDay = new Date(dataFine).toDateString();
        
        if (dataInizioDay !== dataFineDay) {
          return res.status(400).json({ 
            error: 'Per utilizzo interno, la data di fine deve essere lo stesso giorno della data di inizio' 
          });
        }
      }
    }
    
    const result = await query(`
      INSERT INTO richieste (utente_id, inventario_id, dal, al, motivo, note, unit_id, tipo_utilizzo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [req.user.id, actualInventarioId, dal, al, motivo || null, note || null, unit_id || null, tipo_utilizzo || null]);
    
    // Se è stata specificata un'unità, riservala
    if (unit_id) {
      await query(`
        UPDATE inventario_unita 
        SET stato = 'riservato', richiesta_riservata_id = $1
        WHERE id = $2
      `, [result[0].id, unit_id]);
      
      console.log(`✅ Unità ${unit_id} riservata per richiesta ${result[0].id}`);
    }
    
    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Errore POST richiesta:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// PUT /api/richieste/:id
r.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { stato, motivo, note } = req.body || {};
    
    // Prima ottieni la richiesta esistente
    const existingRequest = await query(`
      SELECT * FROM richieste WHERE id = $1
    `, [id]);
    
    if (existingRequest.length === 0) {
      return res.status(404).json({ error: 'Richiesta non trovata' });
    }
    
    const request = existingRequest[0];
    
    // Aggiorna la richiesta
    const result = await query(`
      UPDATE richieste 
      SET stato = $1, motivo = $2, note = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [stato, motivo, note, id]);
    
    // Gestisci lo stato dell'unità riservata
    if (request.unit_id) {
      if (stato === 'rifiutata') {
        // Richiesta rifiutata: libera l'unità riservata
        await query(`
          UPDATE inventario_unita 
          SET stato = 'disponibile', richiesta_riservata_id = NULL
          WHERE id = $1 AND richiesta_riservata_id = $2
        `, [request.unit_id, id]);
        
        console.log(`✅ Unità ${request.unit_id} liberata (richiesta rifiutata)`);
        
      } else if (stato === 'approvata') {
        // Richiesta approvata: l'unità rimane riservata fino alla creazione del prestito
        // (la gestione del prestito sarà nell'endpoint /prestiti)
        console.log(`✅ Unità ${request.unit_id} rimane riservata (richiesta approvata)`);
      }
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error('Errore PUT richiesta:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// DELETE /api/richieste/:id
r.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user owns the request or is admin e ottieni i dettagli
    const checkResult = await query('SELECT utente_id, unit_id FROM richieste WHERE id = $1', [id]);
    if (checkResult.length === 0) {
      return res.status(404).json({ error: 'Richiesta non trovata' });
    }
    
    const request = checkResult[0];
    
    if (request.utente_id !== req.user.id && req.user.ruolo !== 'admin') {
      return res.status(403).json({ error: 'Non autorizzato' });
    }
    
    // Se c'è un'unità riservata, liberala prima di cancellare la richiesta
    if (request.unit_id) {
      await query(`
        UPDATE inventario_unita 
        SET stato = 'disponibile', richiesta_riservata_id = NULL
        WHERE id = $1 AND richiesta_riservata_id = $2
      `, [request.unit_id, id]);
      
      console.log(`✅ Unità ${request.unit_id} liberata (richiesta cancellata)`);
    }
    
    const result = await query('DELETE FROM richieste WHERE id = $1', [id]);
    res.json({ message: 'Richiesta eliminata' });
  } catch (error) {
    console.error('Errore DELETE richiesta:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default r;