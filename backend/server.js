import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from 'fs';
import inventarioRouter from "./routes/inventario.js";
import prestitiRouter from "./routes/prestiti.js";
import categorieRouter from "./routes/categorie.js";
import categorieSempliciRouter from "./routes/categorie_semplici.js";
import corsiRouter from "./routes/corsi.js";
import riparazioniRouter from "./routes/riparazioni.js";
import authRouter from "./routes/auth.js";
import richiesteRouter from "./routes/richieste.js";
import segnalazioniRouter from "./routes/segnalazioni.js";
import avvisiRouter from "./routes/avvisi.js";
import statsRouter from "./routes/stats.js";
import usersRouter from "./routes/users.js";
import migrationRouter from "./routes/migration.js";
import debugRouter from "./routes/debug.js";
import penaltiesRouter from "./routes/penalties.js";
import excelRouter from "./routes/excel.js";
import { initDatabase, query } from './utils/postgres.js';
import supabase from './utils/supabaseStorage.js';

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";

// Inizializza il database PostgreSQL/Supabase
try {
  console.log('🔄 Inizializzazione database PostgreSQL/Supabase...');
  await initDatabase();
  console.log('✅ Database PostgreSQL/Supabase inizializzato con successo!');
} catch (error) {
  console.error('❌ Errore durante l\'inizializzazione del database:', error.message);
  if (error.message.includes('Circuit breaker')) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('⚠️  CIRCUIT BREAKER ATTIVO SU SUPABASE POOLER');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('');
    console.error('Il pooler di Supabase ha bloccato le connessioni a causa di');
    console.error('troppi tentativi falliti.');
    console.error('');
    console.error('✅ SOLUZIONE:');
    console.error('   1. Attendi 5-10 minuti senza fare deploy/riavvii');
    console.error('   2. Il circuit breaker si resetta automaticamente');
    console.error('   3. Poi riprova il deploy');
    console.error('');
    console.error('💡 Verifica anche che la password nel DATABASE_URL sia corretta');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('');
    console.error('');
    console.error('🛑 ⚠️  AZIONE RICHIESTA: DISABILITA IL SERVIZIO SU RAILWAY ⚠️');
    console.error('');
    console.error('   Il circuit breaker è attivo e il servizio continuerà a riavviarsi');
    console.error('   finché non lo disabiliti manualmente.');
    console.error('');
    console.error('   📋 ISTRUZIONI:');
    console.error('   1. Vai su Railway Dashboard');
    console.error('   2. Seleziona il servizio "LABABiblioteca"');
    console.error('   3. Vai su Settings');
    console.error('   4. Clicca "Disable Service" o "Pause Deployments"');
    console.error('   5. Attendi 15 minuti');
    console.error('   6. Riabilita il servizio');
    console.error('   7. Fai un nuovo deploy');
    console.error('');
    console.error('   ⏳ Il circuit breaker si resetta automaticamente dopo 10-15 minuti');
    console.error('   senza tentativi di connessione.');
    console.error('');
    // Exit con codice 0 per evitare restart automatico immediato
    // Ma Railway continuerà a riavviarlo finché non lo disabiliti manualmente
    process.exit(0);
  } else {
    console.error('Verifica la configurazione DATABASE_URL e la connessione a Supabase');
    process.exit(1);
  }
}

// CORS configuration
function withWwwVariant(originUrl) {
  try {
    const u = new URL(originUrl);
    const host = u.hostname;
    if (host.startsWith('www.')) {
      return [`${u.protocol}//${host.replace(/^www\./, '')}`];
    }
    return [`${u.protocol}//www.${host}`];
  } catch (_) {
    return [];
  }
}

const rawAllowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const allowAllOrigins = rawAllowedOrigins.includes('*');

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://attrezzatura.laba.biz',
  'https://www.attrezzatura.laba.biz',
];

const allowedOrigins = new Set(
  [...(rawAllowedOrigins.length ? rawAllowedOrigins : defaultAllowedOrigins)]
    .flatMap((o) => [o, ...withWwwVariant(o)])
);

const corsOptions = {
  origin(origin, callback) {
    if (allowAllOrigins) return callback(null, true);
    // Consenti richieste server-to-server/postman senza Origin.
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error(`Origin non consentita da CORS: ${origin}`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (_, res) => res.json({ ok: true, version: "1.0.1-alpha" }));

// Keepalive endpoint per mantenere attivo il database Supabase
app.get("/api/keepalive", async (_, res) => {
  try {
    // 1. Query dirette PostgreSQL (mantengono attivo il database)
    const [usersCount, inventarioCount, prestitiCount] = await Promise.all([
      query('SELECT COUNT(*) as count FROM users'),
      query('SELECT COUNT(*) as count FROM inventario'),
      query('SELECT COUNT(*) as count FROM prestiti WHERE stato = $1', ['attivo'])
    ]);
    
    // 2. Chiamata API REST Supabase (appare nelle statistiche "REST Requests")
    // Usa una tabella dedicata 'keepalive_log' che non contiene dati sensibili
    // RLS è abilitato con policy permissiva (vedi migrations/rls_keepalive_policies.sql)
    let restActivity = null;
    try {
      // Prova a usare Supabase client se disponibile (lazy initialization)
      const supabaseUrl = process.env.SUPABASE_URL || 'https://blqoxovrrldfedgzwufa.supabase.co';
      console.log('🔄 Chiamata REST Supabase su tabella keepalive_log...', {
        url: supabaseUrl,
        hasAnonKey: !!process.env.SUPABASE_ANON_KEY
      });
      // Query su tabella dedicata (senza dati sensibili, RLS con policy permissiva)
      const supabaseClient = supabase.client; // Lazy initialization
      const result = await supabaseClient
        .from('keepalive_log')
        .select('id', { count: 'exact', head: true });
        
        console.log('📊 Risultato completo Supabase:', {
          hasError: !!result.error,
          count: result.count,
          error: result.error ? {
            message: result.error.message,
            code: result.error.code,
            details: result.error.details,
            hint: result.error.hint
          } : null
        });
        
        if (result.error) {
          console.warn('⚠️ Errore chiamata REST Supabase:', JSON.stringify(result.error, null, 2));
          restActivity = { 
            error: result.error.message || 'Unknown error',
            code: result.error.code,
            details: result.error.details,
            hint: result.error.hint,
            rest_request: false
          };
        } else {
          restActivity = { 
            count: result.count || 0, 
            rest_request: true 
          };
          console.log('✅ Chiamata REST Supabase riuscita, count:', result.count);
        }
    } catch (supabaseError) {
      // Se Supabase non è configurato o c'è un errore, continua senza fallire
      if (supabaseError.message.includes('devono essere configurate')) {
        console.warn('⚠️ Client Supabase non configurato (variabili d\'ambiente mancanti)');
        restActivity = { error: 'Client Supabase non configurato', rest_request: false };
      } else {
        console.error('❌ Eccezione chiamata REST Supabase:', {
          message: supabaseError.message,
          stack: supabaseError.stack
        });
        restActivity = { 
          error: supabaseError.message, 
          rest_request: false 
        };
      }
    }
    
    res.json({ 
      ok: true, 
      message: 'Database keepalive successful', 
      timestamp: new Date().toISOString(),
      stats: {
        users: usersCount[0]?.count || 0,
        inventario: inventarioCount[0]?.count || 0,
        prestiti_attivi: prestitiCount[0]?.count || 0,
        rest_api: restActivity
      }
    });
  } catch (error) {
    console.error('❌ Errore keepalive database:', error.message);
    res.status(500).json({ ok: false, error: 'Database keepalive failed' });
  }
});

app.use("/api/inventario", inventarioRouter);
app.use("/api/prestiti", prestitiRouter);
app.use("/api/categorie", categorieRouter);
app.use("/api/categorie-semplici", categorieSempliciRouter);
app.use("/api/corsi", corsiRouter);
app.use("/api/riparazioni", riparazioniRouter);
app.use("/api/auth", authRouter);
app.use("/api/richieste", richiesteRouter);
app.use("/api/segnalazioni", segnalazioniRouter);
app.use("/api/avvisi", avvisiRouter);
app.use("/api/stats", statsRouter);
app.use("/api/users", usersRouter);
app.use("/api/penalties", penaltiesRouter);
app.use("/api/migration", migrationRouter);
app.use("/api/excel", excelRouter);

// serve frontend build if built
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const staticDir = path.join(__dirname, "..", "frontend", "dist");

// Check if frontend dist exists
const frontendExists = existsSync(staticDir);
if (frontendExists) {
  console.log('✅ Frontend build trovato, servendo file statici da:', staticDir);
  app.use(express.static(staticDir, { maxAge: "1h", index: false }));
} else {
  console.warn('⚠️ Frontend build non trovato in:', staticDir);
  console.warn('⚠️ Solo API disponibile. Esegui "npm run build" nella cartella frontend.');
}

// Health check endpoint - Railway lo usa per verificare che il servizio sia attivo
app.get("/health", (_, res) => {
  res.status(200).type("text").send("ok");
});

// Health check JSON endpoint per debug
app.get("/api/health", (_, res) => {
  res.json({ 
    ok: true, 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    frontend: frontendExists,
    port: PORT,
    host: HOST
  });
});

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/"))
    return res.status(404).json({ error: "Not found" });
  if (!frontendExists) {
    return res.status(503).send("Frontend non disponibile. Build in corso o mancante.");
  }
  try {
    res.sendFile(path.join(staticDir, "index.html"));
  } catch (error) {
    console.error('Errore servendo index.html:', error);
    res.status(404).send("API running. Build frontend to serve UI.");
  }
});

const server = app.listen(PORT, HOST, () => {
  console.log(`✅ Server avviato con successo!`);
  console.log(`🌐 API + Web disponibile su http://${HOST}:${PORT}`);
  console.log(`📊 Health check: http://${HOST}:${PORT}/health`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📦 Frontend build: ${frontendExists ? '✅ Disponibile' : '❌ Non trovato'}`);
  console.log(`🔌 Porta utilizzata: ${PORT} (da variabile PORT)`);
  
  // Log per debug Railway custom domain
  if (process.env.RAILWAY_ENVIRONMENT) {
    console.log(`🚂 Railway Environment: ${process.env.RAILWAY_ENVIRONMENT}`);
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    console.log(`🌍 Railway Public Domain: ${process.env.RAILWAY_PUBLIC_DOMAIN}`);
  }
  console.log(`🔌 Porta utilizzata: ${PORT} (da ${process.env.PORT ? 'variabile PORT' : 'default 3001'})`);
});

// Gestione errori non gestiti
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Non uscire immediatamente, lascia che Railway gestisca il restart
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Non uscire immediatamente, lascia che Railway gestisca il restart
});

// Gestione errori del server
server.on('error', (error) => {
  console.error('❌ Errore server:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`⚠️ Porta ${PORT} già in uso`);
  }
});

// Gestione chiusura graceful
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM ricevuto, chiudo il server...');
  server.close(() => {
    console.log('✅ Server chiuso correttamente');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT ricevuto, chiudo il server...');
  server.close(() => {
    console.log('✅ Server chiuso correttamente');
    process.exit(0);
  });
});
