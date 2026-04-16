import pkg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pkg;

// Configurazione Supabase
// Validazione lazy: controlla solo quando necessario, non all'import
function getDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ Variabile d\'ambiente DATABASE_URL mancante. Impostala per avviare il servizio.');
    throw new Error('DATABASE_URL non configurata');
  }
  return process.env.DATABASE_URL;
}

// Lazy initialization: crea pool solo quando necessario
let poolInstance = null;
function getPool() {
  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString: getDatabaseUrl(),
      ssl: {
        rejectUnauthorized: false
      },
      max: 2, // Ridotto per evitare troppe connessioni simultanee
      idleTimeoutMillis: 30000, // Chiudi client inattivi dopo 30 secondi
      connectionTimeoutMillis: 20000, // Timeout connessione aumentato a 20 secondi
      statement_timeout: 30000, // Timeout per le query
      query_timeout: 30000
    });
    
    // Test connessione
    poolInstance.on('connect', () => {
      console.log('✅ Connesso a PostgreSQL/Supabase');
    });

    poolInstance.on('error', (err) => {
      console.error('❌ Errore pool PostgreSQL:', err);
    });
  }
  return poolInstance;
}

// Funzione per inizializzare il database con retry logic
async function connectWithRetry(maxRetries = 2, initialDelay = 10000) {
  const pool = getPool(); // Lazy initialization
  for (let i = 0; i < maxRetries; i++) {
    try {
      const client = await pool.connect();
      return client;
    } catch (error) {
      if (error.message.includes('Circuit breaker')) {
        console.error('❌ Circuit breaker attivo su Supabase Pooler.');
        console.error('⏳ Il circuit breaker si resetta automaticamente dopo 5-10 minuti.');
        console.error('💡 Soluzione: Attendi 5-10 minuti senza fare deploy, poi riprova.');
        // Non fare più tentativi se il circuit breaker è attivo
        throw new Error('Circuit breaker attivo. Attendi 5-10 minuti prima di riprovare.');
      }
      if (i === maxRetries - 1) {
        console.error('❌ Tutti i tentativi di connessione sono falliti.');
        throw error;
      }
      const delay = initialDelay * Math.pow(2, i); // Backoff esponenziale: 10s, 20s
      console.log(`⚠️ Tentativo connessione ${i + 1}/${maxRetries} fallito, riprovo tra ${delay/1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Funzione per inizializzare il database
export async function initDatabase() {
  console.log('🔄 Inizializzazione database PostgreSQL...');
  
  try {
    // Test connessione con retry
    const client = await connectWithRetry();
    console.log('✅ Connessione PostgreSQL verificata');
    
    // Crea schema unificato completo
    await client.query(`
      -- Tabella users
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        surname VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        matricola VARCHAR(50),
        ruolo VARCHAR(50) DEFAULT 'user',
        corso_accademico VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabella categorie_semplici
      CREATE TABLE IF NOT EXISTS categorie_semplici (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL UNIQUE
      );

      -- Tabella collane (raggruppa 2+ libri in inventario)
      CREATE TABLE IF NOT EXISTS collane (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL UNIQUE
      );

      -- Tabella inventario
      CREATE TABLE IF NOT EXISTS inventario (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        quantita_totale INTEGER NOT NULL DEFAULT 0,
        categoria_madre VARCHAR(255) NOT NULL,
        categoria_id INTEGER REFERENCES categorie_semplici(id),
        posizione VARCHAR(255),
        autore VARCHAR(255),
        relatore VARCHAR(255),
        anno_accademico VARCHAR(20),
        luogo_pubblicazione VARCHAR(255),
        data_pubblicazione INTEGER,
        casa_editrice VARCHAR(255),
        fondo VARCHAR(255),
        settore VARCHAR(255),
        in_manutenzione BOOLEAN NOT NULL DEFAULT FALSE,
        unita JSONB DEFAULT '[]',
        quantita INTEGER DEFAULT 0,
        soglia_minima INTEGER DEFAULT 1,
        tipo_prestito VARCHAR(20) DEFAULT 'solo_esterno',
        tipo_catalogo VARCHAR(20) DEFAULT 'libri',
        location VARCHAR(255),
        collana_id INTEGER REFERENCES collane(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabella prestiti
      CREATE TABLE IF NOT EXISTS prestiti (
        id SERIAL PRIMARY KEY,
        inventario_id INTEGER NOT NULL REFERENCES inventario(id) ON DELETE CASCADE,
        quantita INTEGER NOT NULL DEFAULT 1,
        chi VARCHAR(255),
        data_uscita DATE NOT NULL,
        data_rientro DATE,
        note TEXT,
        unita JSONB DEFAULT '[]',
        unit_ids_json JSONB DEFAULT '[]',
        stato VARCHAR(50) DEFAULT 'attivo',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_prestiti_inv ON prestiti(inventario_id);

      -- Tabella riparazioni
      CREATE TABLE IF NOT EXISTS riparazioni (
        id SERIAL PRIMARY KEY,
        inventario_id INTEGER NOT NULL REFERENCES inventario(id) ON DELETE CASCADE,
        quantita INTEGER NOT NULL DEFAULT 0,
        stato VARCHAR(50),
        note TEXT,
        unit_ids_json JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_riparazioni_inv ON riparazioni(inventario_id);

      -- Tabella richieste
      CREATE TABLE IF NOT EXISTS richieste (
        id SERIAL PRIMARY KEY,
        utente_id INTEGER NOT NULL,
        inventario_id INTEGER NOT NULL,
        dal DATE NOT NULL,
        al DATE NOT NULL,
        stato VARCHAR(50) DEFAULT 'in_attesa',
        motivo TEXT,
        note TEXT,
        tipo_utilizzo VARCHAR(20) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(utente_id) REFERENCES users(id),
        FOREIGN KEY(inventario_id) REFERENCES inventario(id)
      );
      CREATE INDEX IF NOT EXISTS idx_rich_user ON richieste (utente_id);
      CREATE INDEX IF NOT EXISTS idx_rich_inv ON richieste (inventario_id);
      CREATE INDEX IF NOT EXISTS idx_rich_state ON richieste (stato);

      -- Tabella inventario_unita (creata prima perché referenziata da altre tabelle)
      CREATE TABLE IF NOT EXISTS inventario_unita (
        id SERIAL PRIMARY KEY,
        inventario_id INTEGER NOT NULL,
        codice_univoco VARCHAR(255) UNIQUE NOT NULL,
        stato VARCHAR(50) DEFAULT 'disponibile',
        prestito_corrente_id INTEGER,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inventario_id) REFERENCES inventario(id),
        FOREIGN KEY (prestito_corrente_id) REFERENCES prestiti(id)
      );
      CREATE INDEX IF NOT EXISTS idx_inv_unita_inv ON inventario_unita (inventario_id);
      CREATE INDEX IF NOT EXISTS idx_inv_unita_codice ON inventario_unita (codice_univoco);

      -- Tabella segnalazioni
      CREATE TABLE IF NOT EXISTS segnalazioni (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        prestito_id INTEGER,
        inventario_id INTEGER,
        unit_id INTEGER,
        tipo VARCHAR(100) NOT NULL,
        urgenza VARCHAR(50) DEFAULT 'media',
        messaggio TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        handled_by INTEGER,
        handled_at TIMESTAMP,
        stato VARCHAR(50) DEFAULT 'aperta',
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(prestito_id) REFERENCES prestiti(id),
        FOREIGN KEY(inventario_id) REFERENCES inventario(id),
        FOREIGN KEY(unit_id) REFERENCES inventario_unita(id)
      );

      -- Aggiungi colonne se non esistono (per database esistenti)
      ALTER TABLE segnalazioni ADD COLUMN IF NOT EXISTS unit_id INTEGER;
      ALTER TABLE segnalazioni ADD COLUMN IF NOT EXISTS urgenza VARCHAR(50) DEFAULT 'media';
      ALTER TABLE prestiti ADD COLUMN IF NOT EXISTS richiesta_id INTEGER REFERENCES richieste(id);
      ALTER TABLE inventario_unita ADD COLUMN IF NOT EXISTS richiesta_riservata_id INTEGER REFERENCES richieste(id);
      ALTER TABLE richieste ADD COLUMN IF NOT EXISTS unit_id INTEGER REFERENCES inventario_unita(id);
      ALTER TABLE riparazioni ADD COLUMN IF NOT EXISTS tipo VARCHAR(100) DEFAULT 'segnalazione';
      ALTER TABLE riparazioni ADD COLUMN IF NOT EXISTS priorita VARCHAR(50) DEFAULT 'media';
      ALTER TABLE inventario ADD COLUMN IF NOT EXISTS tipo_prestito VARCHAR(20) DEFAULT 'solo_esterno';
      ALTER TABLE inventario ADD COLUMN IF NOT EXISTS tipo_catalogo VARCHAR(20) DEFAULT 'libri';
      ALTER TABLE inventario ADD COLUMN IF NOT EXISTS location VARCHAR(255);
      ALTER TABLE inventario ADD COLUMN IF NOT EXISTS collana_id INTEGER REFERENCES collane(id);
      -- Migrazione campi inventario: fornitore -> autore, aggiungi nuovi campi pubblicazione
      ALTER TABLE inventario ADD COLUMN IF NOT EXISTS autore VARCHAR(255);
      ALTER TABLE inventario ADD COLUMN IF NOT EXISTS relatore VARCHAR(255);
      ALTER TABLE inventario ADD COLUMN IF NOT EXISTS anno_accademico VARCHAR(20);
      ALTER TABLE inventario ADD COLUMN IF NOT EXISTS luogo_pubblicazione VARCHAR(255);
      ALTER TABLE inventario ADD COLUMN IF NOT EXISTS data_pubblicazione INTEGER;
      ALTER TABLE inventario ADD COLUMN IF NOT EXISTS casa_editrice VARCHAR(255);
      ALTER TABLE inventario ADD COLUMN IF NOT EXISTS fondo VARCHAR(255);
      ALTER TABLE inventario ADD COLUMN IF NOT EXISTS settore VARCHAR(255);
      -- Migra dati esistenti: fornitore -> autore (se fornitore esiste e autore no)
      UPDATE inventario SET autore = fornitore WHERE fornitore IS NOT NULL AND autore IS NULL;
      -- Rimuovi colonne obsolete (commentato per sicurezza, decommentare dopo migrazione)
      -- ALTER TABLE inventario DROP COLUMN IF EXISTS fornitore;
      -- ALTER TABLE inventario DROP COLUMN IF EXISTS note;
      -- ALTER TABLE inventario DROP COLUMN IF EXISTS immagine_url;
      UPDATE inventario SET tipo_catalogo = 'libri' WHERE tipo_catalogo IS NULL OR tipo_catalogo = '';

      ALTER TABLE richieste ADD COLUMN IF NOT EXISTS tipo_utilizzo VARCHAR(20) DEFAULT NULL;
      
      -- Sistema di penalità per ritardi
      ALTER TABLE users ADD COLUMN IF NOT EXISTS penalty_strikes INTEGER DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_by INTEGER REFERENCES users(id);
      
      -- Tabella penalità dettagliate
      CREATE TABLE IF NOT EXISTS user_penalties (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        prestito_id INTEGER NOT NULL REFERENCES prestiti(id) ON DELETE CASCADE,
        tipo VARCHAR(50) DEFAULT 'ritardo',
        giorni_ritardo INTEGER DEFAULT 0,
        strike_assegnati INTEGER DEFAULT 1,
        motivo TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_penalties_user ON user_penalties (user_id);
      CREATE INDEX IF NOT EXISTS idx_penalties_prestito ON user_penalties (prestito_id);
      CREATE INDEX IF NOT EXISTS idx_segn_user ON segnalazioni (user_id);
      CREATE INDEX IF NOT EXISTS idx_segn_tipo ON segnalazioni (tipo);
      CREATE INDEX IF NOT EXISTS idx_segn_state ON segnalazioni (stato);

      -- Tabella corsi
      CREATE TABLE IF NOT EXISTS corsi (
        corso VARCHAR(255) PRIMARY KEY
      );

      -- Tabella inventario_corsi
      CREATE TABLE IF NOT EXISTS inventario_corsi (
        inventario_id INTEGER NOT NULL,
        corso VARCHAR(255) NOT NULL,
        PRIMARY KEY (inventario_id, corso),
        FOREIGN KEY (inventario_id) REFERENCES inventario(id) ON DELETE CASCADE
      );

      -- Tabella password_reset_requests
      CREATE TABLE IF NOT EXISTS password_reset_requests (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      );

      -- Tabella keepalive_log (per tracciare attività REST API in Supabase)
      CREATE TABLE IF NOT EXISTS keepalive_log (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'ok'
      );
    `);

    // Aggiungi colonna immagine_url se non esiste
    try {
      await client.query(`
        ALTER TABLE inventario 
        ADD COLUMN IF NOT EXISTS immagine_url TEXT
      `);
      console.log('✅ Colonna immagine_url aggiunta alla tabella inventario');
    } catch (error) {
      console.log('ℹ️ Colonna immagine_url già esistente');
    }

    // Aggiungi colonna tipo_prestito se non esiste
    try {
      await client.query(`
        ALTER TABLE inventario 
        ADD COLUMN IF NOT EXISTS tipo_prestito VARCHAR(20) DEFAULT 'solo_esterno'
      `);
      console.log('✅ Colonna tipo_prestito aggiunta alla tabella inventario');
    } catch (error) {
      console.log('ℹ️ Colonna tipo_prestito già esistente');
    }

    // Aggiungi colonna fornitore se non esiste
    try {
      await client.query(`
        ALTER TABLE inventario 
        ADD COLUMN IF NOT EXISTS fornitore VARCHAR(255)
      `);
      console.log('✅ Colonna fornitore aggiunta alla tabella inventario');
    } catch (error) {
      console.log('ℹ️ Colonna fornitore già esistente');
    }

    // Aggiungi colonna tipo_utilizzo se non esiste
    try {
      await client.query(`
        ALTER TABLE richieste 
        ADD COLUMN IF NOT EXISTS tipo_utilizzo VARCHAR(20) DEFAULT NULL
      `);
      console.log('✅ Colonna tipo_utilizzo aggiunta alla tabella richieste');
    } catch (error) {
      console.log('ℹ️ Colonna tipo_utilizzo già esistente');
    }

    // Inserisci admin user se non esiste
    // IMPORTANTE: La password admin deve essere configurata come variabile d'ambiente
    const adminPassword = process.env.SPECIAL_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.warn('⚠️  ADMIN_PASSWORD o SPECIAL_ADMIN_PASSWORD non configurata. Admin user non creato.');
      console.warn('⚠️  Configura SPECIAL_ADMIN_PASSWORD come variabile d\'ambiente per creare l\'utente admin.');
    } else {
      const adminExists = await client.query('SELECT id FROM users WHERE email = $1', ['admin']);
      if (adminExists.rows.length === 0) {
        const hashedPassword = bcrypt.hashSync(adminPassword, 10);
        
        await client.query(`
          INSERT INTO users (email, password_hash, name, surname, ruolo, corso_accademico)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, ['admin', hashedPassword, 'Admin', 'Sistema', 'admin', 'Tutti']);
        
        console.log('✅ Admin user creato: admin / [password da SPECIAL_ADMIN_PASSWORD]');
      }
    }

    // Inserisci corsi accademici LABA solo se la tabella è vuota
    const corsiLABA = [
      'Regia e Videomaking',
      'Graphic Design & Multimedia',
      'Fashion Design',
      'Pittura',
      'Fotografia',
      'Interior Design',
      'Cinema e Audiovisivi',
      'Design'
    ];

    const { rows: courseCountRows } = await client.query('SELECT COUNT(*)::int AS count FROM corsi');
    if (Number(courseCountRows[0]?.count || 0) === 0) {
      for (const nome of corsiLABA) {
        await client.query('INSERT INTO corsi (corso) VALUES ($1) ON CONFLICT (corso) DO NOTHING', [nome]);
      }
      console.log(`✅ Corsi inseriti: ${corsiLABA.length}`);
    } else {
      console.log('ℹ️ Corsi già presenti, nessun inserimento di default');
    }

    // NON inserire categorie hardcoded - le categorie devono essere gestite manualmente
    // Il seeding automatico è stato rimosso per preservare le categorie custom
    console.log('ℹ️ Categorie: nessun seeding automatico - usa le categorie custom esistenti');

    // Abilita RLS sulla tabella keepalive_log e crea policy permissiva
    try {
      await client.query('ALTER TABLE keepalive_log ENABLE ROW LEVEL SECURITY');
      // Elimina la policy se esiste già, poi la ricrea (PostgreSQL non supporta IF NOT EXISTS per POLICY)
      await client.query('DROP POLICY IF EXISTS "Allow anonymous access for keepalive" ON keepalive_log');
      await client.query(`
        CREATE POLICY "Allow anonymous access for keepalive"
        ON keepalive_log
        FOR ALL
        TO anon
        USING (true)
        WITH CHECK (true)
      `);
      console.log('✅ RLS abilitato e policy creata su keepalive_log');
    } catch (error) {
      console.log('ℹ️ RLS già configurato su keepalive_log:', error.message);
    }

    // Inserisci record iniziale in keepalive_log se non esiste
    try {
      const keepaliveExists = await client.query('SELECT id FROM keepalive_log LIMIT 1');
      if (keepaliveExists.rows.length === 0) {
        await client.query('INSERT INTO keepalive_log (status) VALUES ($1)', ['initialized']);
        console.log('✅ Record iniziale inserito in keepalive_log');
      }
    } catch (error) {
      console.log('ℹ️ keepalive_log già inizializzato');
    }

    client.release();
    
    console.log('✅ Database PostgreSQL inizializzato con successo!');
    console.log('✅ Schema unificato creato con tutte le tabelle');
      console.log('✅ Admin user: admin / [password da SPECIAL_ADMIN_PASSWORD]');
    
  } catch (error) {
    console.error('❌ Errore durante l\'inizializzazione del database:', error);
    throw error;
  }
}

// Wrapper per query con gestione errori
export async function query(text, params = []) {
  const pool = getPool(); // Lazy initialization
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } catch (error) {
    console.error('❌ Errore query PostgreSQL:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Wrapper per transazioni
export async function transaction(callback) {
  const pool = getPool(); // Lazy initialization
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Export getter per compatibilità (lazy initialization)
export default {
  get pool() {
    return getPool();
  }
};
