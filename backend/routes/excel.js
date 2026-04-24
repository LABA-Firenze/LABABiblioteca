// backend/routes/excel.js - Gestione Import/Export Excel
import { Router } from 'express';
import { query } from '../utils/postgres.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { uploadFile, deleteFile } from '../utils/supabaseStorage.js';

const r = Router();
const ALLOWED_CATALOG_TYPES = new Set(['libri', 'tesi', 'cataloghi', 'riviste']);
const resolveCatalogType = (req) => {
  const rawType = String(req.query?.tipo_catalogo || req.body?.tipo_catalogo || 'libri').toLowerCase().trim();
  return ALLOWED_CATALOG_TYPES.has(rawType) ? rawType : null;
};
const getCatalogLabel = (tipoCatalogo) => {
  switch (tipoCatalogo) {
    case 'tesi':
      return 'tesi';
    case 'cataloghi':
      return 'cataloghi';
    case 'riviste':
      return 'riviste';
    default:
      return 'libri';
  }
};

// Configurazione multer per upload file - solo memoria per Railway
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

// GET /api/excel/inventario/export - Export inventario completo
r.get('/inventario/export', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const tipoCatalogo = resolveCatalogType(req);
    if (!tipoCatalogo) {
      return res.status(400).json({ error: 'tipo_catalogo non valido. Valori ammessi: libri, tesi, cataloghi, riviste' });
    }
    const result = await query(`
      SELECT 
        i.*,
        cs.nome as categoria_nome,
        STRING_AGG(ic.corso, ',') as corsi_assegnati,
        (SELECT COUNT(*) FROM inventario_unita iu 
         WHERE iu.inventario_id = i.id 
         AND iu.stato = 'disponibile' 
         AND iu.prestito_corrente_id IS NULL 
         AND iu.richiesta_riservata_id IS NULL) as unita_disponibili
      FROM inventario i
      LEFT JOIN categorie_semplici cs ON cs.id = i.categoria_id
      LEFT JOIN inventario_corsi ic ON ic.inventario_id = i.id
      WHERE COALESCE(i.tipo_catalogo, 'libri') = $1
      GROUP BY i.id, cs.nome
      ORDER BY i.nome
    `, [tipoCatalogo]);

    // Prepara dati per Excel
    const data = result.map(item => ({
      'ID': item.id,
      'Nome': item.nome,
      'Quantità Totale': item.quantita_totale || 0,
      'Corso Accademico': item.categoria_madre || '',
      'Categoria': item.categoria_nome || '',
      'Autore': item.autore || '',
      'Relatore': item.relatore || '',
      'Anno Accademico': item.anno_accademico || '',
      'Luogo': item.luogo_pubblicazione || '',
      'Data Pubblicazione': item.data_pubblicazione || '',
      'Casa Editrice': item.casa_editrice || '',
      'Fondo': item.fondo || '',
      'Posizione': item.posizione || '',
      'In Manutenzione': item.in_manutenzione ? 'Sì' : 'No',
      'Tipo Prestito': item.tipo_prestito || 'solo_esterno',
      'Unità Disponibili': item.unita_disponibili || 0,
      'Corsi Assegnati': item.corsi_assegnati || '',
      'Data Creazione': new Date(item.created_at).toLocaleDateString('it-IT'),
      'Data Aggiornamento': new Date(item.updated_at).toLocaleDateString('it-IT')
    }));

    // Crea workbook Excel
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    
    // Set column widths
    const colWidths = [
      { wch: 5 },   // ID
      { wch: 25 },  // Nome
      { wch: 12 },  // Quantità Totale
      { wch: 20 },  // Corso Accademico
      { wch: 20 },  // Categoria
      { wch: 20 },  // Autore
      { wch: 20 },  // Relatore
      { wch: 15 },  // Anno Accademico
      { wch: 15 },  // Luogo
      { wch: 15 },  // Data Pubblicazione
      { wch: 20 },  // Casa Editrice
      { wch: 15 },  // Fondo
      { wch: 15 },  // Posizione
      { wch: 12 },  // In Manutenzione
      { wch: 15 },  // Tipo Prestito
      { wch: 12 },  // Unità Disponibili
      { wch: 30 },  // Corsi Assegnati
      { wch: 15 },  // Data Creazione
      { wch: 15 }   // Data Aggiornamento
    ];
    ws['!cols'] = colWidths;

    const catalogLabel = getCatalogLabel(tipoCatalogo);
    XLSX.utils.book_append_sheet(wb, ws, `Inventario ${catalogLabel}`);
    
    // Genera buffer Excel
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // Imposta headers per download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="inventario_${catalogLabel}.xlsx"`);
    res.setHeader('Content-Length', excelBuffer.length);
    
    res.send(excelBuffer);
  } catch (error) {
    console.error('Errore export Excel inventario:', error);
    res.status(500).json({ error: 'Errore durante l\'export Excel' });
  }
});

// POST /api/excel/inventario/import - Import inventario da Excel
r.post('/inventario/import', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const tipoCatalogo = resolveCatalogType(req);
    if (!tipoCatalogo) {
      return res.status(400).json({ error: 'tipo_catalogo non valido. Valori ammessi: libri, tesi, cataloghi, riviste' });
    }
    // Verifica che i dati del file siano presenti
    const { fileName, fileSize, fileType, fileData } = req.body;
    
    if (!fileName || !fileData) {
      console.log('ERRORE: Dati file mancanti');
      return res.status(400).json({ error: 'File Excel richiesto' });
    }

    console.log('File ricevuto:', fileName, fileSize, 'bytes');
    
    // Converti base64 in buffer
    const base64Data = fileData.split(',')[1]; // Rimuovi il prefisso data:application/...
    const fileBuffer = Buffer.from(base64Data, 'base64');
    
    console.log('File processato in memoria, dimensione buffer:', fileBuffer.length, 'bytes');

    // Leggi file Excel
    console.log('Tentativo di leggere file Excel...');
    console.log('File size:', fileSize, 'bytes');
    console.log('File mimetype:', fileType);
    console.log('File name:', fileName);
    
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    console.log('Workbook creato, sheet names:', workbook.SheetNames);
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    console.log('Worksheet caricato:', sheetName);
    
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    console.log('JSON data length:', jsonData.length);
    console.log('Prima riga:', jsonData[0]);
    
    if (jsonData.length === 0) {
      return res.status(400).json({ error: 'File Excel vuoto' });
    }

    const results = {
      success: 0,
      errors: [],
      total: jsonData.length
    };

    // Processa ogni riga
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNum = i + 2; // +2 perché Excel inizia da 1 e c'è l'header
      
      try {
        // Validazione campi obbligatori
        if (!row.Nome) {
          throw new Error('Nome è obbligatorio');
        }

        // Prepara dati per inserimento (solo campi modificabili dall'utente)
        const itemData = {
          nome: row.Nome.toString().trim(),
          quantita_totale: parseInt(row['Quantità Totale']) || 1,
          categoria_madre: row['Corso Accademico']?.toString().trim() || null,
          autore: row.Autore?.toString().trim() || null,
          relatore: row.Relatore?.toString().trim() || null,
          anno_accademico: row['Anno Accademico']?.toString().trim() || null,
          luogo_pubblicazione: row.Luogo?.toString().trim() || null,
          data_pubblicazione: row['Data Pubblicazione'] ? parseInt(row['Data Pubblicazione'], 10) || null : null,
          casa_editrice: row['Casa Editrice']?.toString().trim() || null,
          fondo: row.Fondo?.toString().trim() || null,
          posizione: row.Posizione?.toString().trim() || null,
          in_manutenzione: row['In Manutenzione']?.toString().toLowerCase() === 'sì' || 
                          row['In Manutenzione']?.toString().toLowerCase() === 'si' || 
                          row['In Manutenzione']?.toString().toLowerCase() === 'yes' || 
                          row['In Manutenzione'] === 1,
          tipo_prestito: row['Tipo Prestito']?.toString().trim() || 'solo_esterno'
        };

        // Ignora campi automatici se presenti nel file
        // ID, Unità Disponibili, Data Creazione, Data Aggiornamento sono gestiti dal sistema

        // Validazione tipo_prestito
        if (!['solo_esterno', 'solo_interno', 'entrambi'].includes(itemData.tipo_prestito)) {
          throw new Error('Tipo Prestito deve essere: solo_esterno, solo_interno o entrambi');
        }

        // Gestisci categoria
        let categoria_id = null;
        if (row.Categoria) {
          const categoriaNome = row.Categoria.toString().trim();
          // Cerca categoria esistente
          const categoria = await query('SELECT id FROM categorie_semplici WHERE nome = $1', [categoriaNome]);
          if (categoria.length > 0) {
            categoria_id = categoria[0].id;
          } else {
            // Crea nuova categoria
            const newCategoria = await query('INSERT INTO categorie_semplici (nome) VALUES ($1) RETURNING id', [categoriaNome]);
            categoria_id = newCategoria[0].id;
          }
        }

        // Verifica se elemento esiste già
        const existing = await query(`SELECT id FROM inventario WHERE nome = $1 AND COALESCE(tipo_catalogo, 'libri') = $2`, [itemData.nome, tipoCatalogo]);
        let inventarioId;
        
        if (existing.length > 0) {
          // Aggiorna elemento esistente
          inventarioId = existing[0].id;
          await query(`
            UPDATE inventario 
            SET quantita_totale = $2, categoria_madre = $3, categoria_id = $4, 
                autore = $5, relatore = $6, anno_accademico = $7, luogo_pubblicazione = $8, data_pubblicazione = $9,
                casa_editrice = $10, fondo = $11, posizione = $12, in_manutenzione = $13, tipo_prestito = $14, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
              AND COALESCE(tipo_catalogo, 'libri') = $15
          `, [
            inventarioId, itemData.quantita_totale, itemData.categoria_madre, categoria_id,
            itemData.autore, itemData.relatore, itemData.anno_accademico, itemData.luogo_pubblicazione, itemData.data_pubblicazione,
            itemData.casa_editrice, itemData.fondo, itemData.posizione,
            itemData.in_manutenzione, itemData.tipo_prestito, tipoCatalogo
          ]);
        } else {
          // Inserisci nuovo elemento
          const newItem = await query(`
            INSERT INTO inventario (nome, quantita_totale, categoria_madre, categoria_id, 
                                   autore, relatore, anno_accademico, luogo_pubblicazione, data_pubblicazione, casa_editrice, fondo, posizione, in_manutenzione, tipo_prestito, tipo_catalogo)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING id
          `, [
            itemData.nome, itemData.quantita_totale, itemData.categoria_madre, categoria_id,
            itemData.autore, itemData.relatore, itemData.anno_accademico, itemData.luogo_pubblicazione, itemData.data_pubblicazione,
            itemData.casa_editrice, itemData.fondo, itemData.posizione, itemData.in_manutenzione, itemData.tipo_prestito, tipoCatalogo
          ]);
          inventarioId = newItem[0].id;
        }

        // Gestisci unità individuali
        const unitaIds = [];
        for (let j = 1; j <= 5; j++) {
          const unitId = row[`ID Unità ${j}`];
          if (unitId && unitId.toString().trim()) {
            unitaIds.push(unitId.toString().trim());
          }
        }

        // Se non ci sono ID specifici, genera ID automatici
        if (unitaIds.length === 0) {
          for (let j = 1; j <= itemData.quantita_totale; j++) {
            unitaIds.push(`${itemData.nome.toUpperCase().replace(/\s+/g, '-')}-${j.toString().padStart(3, '0')}`);
          }
        }

        // Elimina unità esistenti per questo inventario
        await query('DELETE FROM inventario_unita WHERE inventario_id = $1', [inventarioId]);

                // Inserisci nuove unità
                for (const unitId of unitaIds) {
                  await query(`
                    INSERT INTO inventario_unita (inventario_id, codice_univoco, stato)
                    VALUES ($1, $2, 'disponibile')
                  `, [inventarioId, unitId]);
                }

        // Gestisci corsi assegnati
        if (row['Corsi Assegnati']) {
          const corsi = row['Corsi Assegnati'].toString().split(',').map(c => c.trim()).filter(c => c);
          for (const corso of corsi) {
            // Inserisci corso se non esiste
            await query('INSERT INTO corsi (corso) VALUES ($1) ON CONFLICT (corso) DO NOTHING', [corso]);
            // Assegna corso all'inventario
            await query('INSERT INTO inventario_corsi (inventario_id, corso) VALUES ($1, $2) ON CONFLICT DO NOTHING', 
                       [inventarioId, corso]);
          }
        }

        results.success++;
      } catch (error) {
        results.errors.push(`Riga ${rowNum}: ${error.message}`);
      }
    }

    console.log('Import completato, file processato completamente in memoria');

    res.json({
      message: `Import completato: ${results.success}/${results.total} elementi processati`,
      success: results.success,
      errors: results.errors,
      total: results.total
    });

  } catch (error) {
    console.error('Errore import Excel inventario:', error);
    res.status(500).json({ error: 'Errore durante l\'import Excel' });
  }
});

// GET /api/excel/inventario/template - Genera template Excel
r.get('/inventario/template', requireAuth, requireRole('admin'), async (req, res) => {
  try {
        const tipoCatalogo = resolveCatalogType(req);
        if (!tipoCatalogo) {
          return res.status(400).json({ error: 'tipo_catalogo non valido. Valori ammessi: libri, tesi, cataloghi, riviste' });
        }
        const templateData = [
          {
            'Nome': 'Esempio: Storia del Cinema Italiano',
            'Quantità Totale': '5',
            'Corso Accademico': 'Cinema e Audiovisivi',
            'Categoria': 'Libri',
            'Autore': 'Mario Rossi',
            'Relatore': tipoCatalogo === 'tesi' ? 'Prof. Verdi' : '',
            'Anno Accademico': tipoCatalogo === 'tesi' ? '2024/2025' : '',
            'Luogo': 'Firenze',
            'Data Pubblicazione': '2022',
            'Casa Editrice': 'Einaudi',
            'Fondo': 'Ciulli',
            'Posizione': 'Scaffale A - Ripiano 1',
            'In Manutenzione': 'No (Sì/No)',
            'Tipo Prestito': 'solo_esterno (solo_esterno/solo_interno/entrambi)',
            'ID Unità 1': 'CANON-001',
            'ID Unità 2': 'CANON-002',
            'ID Unità 3': 'CANON-003',
            'ID Unità 4': 'CANON-004',
            'ID Unità 5': 'CANON-005'
          }
        ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    
    const colWidths = [
      { wch: 25 },  // Nome
      { wch: 12 },  // Quantità Totale
      { wch: 20 },  // Corso Accademico
      { wch: 20 },  // Categoria
      { wch: 20 },  // Autore
      { wch: 20 },  // Relatore
      { wch: 15 },  // Anno Accademico
      { wch: 15 },  // Luogo
      { wch: 15 },  // Data pubblicazione
      { wch: 20 },  // Casa editrice
      { wch: 15 },  // Fondo
      { wch: 15 },  // Posizione
      { wch: 12 },  // In Manutenzione
      { wch: 25 },  // Tipo Prestito
      { wch: 12 },  // ID Unità 1
      { wch: 12 },  // ID Unità 2
      { wch: 12 },  // ID Unità 3
      { wch: 12 },  // ID Unità 4
      { wch: 12 }   // ID Unità 5
    ];
    ws['!cols'] = colWidths;

    const catalogLabel = getCatalogLabel(tipoCatalogo);
    XLSX.utils.book_append_sheet(wb, ws, `Template ${catalogLabel}`);
    
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="template_inventario_${catalogLabel}.xlsx"`);
    res.setHeader('Content-Length', excelBuffer.length);
    
    res.send(excelBuffer);
  } catch (error) {
    console.error('Errore generazione template Excel:', error);
    res.status(500).json({ error: 'Errore durante la generazione del template' });
  }
});

export default r;
