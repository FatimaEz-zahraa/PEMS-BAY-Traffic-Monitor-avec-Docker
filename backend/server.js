/**
 * ============================================================
 *  PEMS-BAY Traffic Service — Node.js + Express + MongoDB
 *  TP Génie Logiciel (sans Docker Compose)
 * ============================================================
 *  Fichiers attendus dans /app/data/ :
 *    1. metadata.csv  — coordonnées GPS réelles des capteurs
 *       Colonnes : Sensor ID, Freeway, Direction,
 *                  Postmile, Latitude, Longitude,
 *                  Length (km), Lanes
 *
 *    2. PEMS-BAY.csv  — vitesses mesurées toutes les 5 min
 *       Format : index, timestamp, 400001, 400017, ...
 * ============================================================
 */

const express    = require('express');
const cors       = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const fs         = require('fs');
const path       = require('path');
const { parse }  = require('csv-parse');
const readline   = require('readline');

// ── Configuration ────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI
  || 'mongodb://admin:admin123@pems_mongodb:27017/pems_bay?authSource=admin';
const MONGO_DB  = process.env.MONGO_DB  || 'pems_bay';
const DATA_DIR  = process.env.DATA_DIR  || '/app/data';
const PORT      = process.env.PORT      || 5000;

// ── Logging ───────────────────────────────────────────────────────────────────
const log = {
  info:  (msg) => console.log(`${new Date().toLocaleTimeString()} [INFO]  ${msg}`),
  warn:  (msg) => console.warn(`${new Date().toLocaleTimeString()} [WARN]  ${msg}`),
  error: (msg) => console.error(`${new Date().toLocaleTimeString()} [ERROR] ${msg}`),
};

// ── App Express ───────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// ── Client MongoDB ────────────────────────────────────────────────────────────
let db;

async function connectMongo() {
  const client = new MongoClient(MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  await client.connect();
  db = client.db(MONGO_DB);
  log.info(`MongoDB connecté → base : ${MONGO_DB}`);
  return db;
}


// ════════════════════════════════════════════════════════════════
//  LECTURE DES FICHIERS CSV
// ════════════════════════════════════════════════════════════════

/**
 * Lit metadata.csv et retourne un Map : sensor_id → { lat, lon, highway, direction, lanes }
 * Détection automatique du fichier : le CSV qui contient la colonne "Sensor ID"
 */
async function loadMetadata(dataDir) {
  const meta = new Map();

  const files = fs.readdirSync(dataDir).filter(f => f.toLowerCase().endsWith('.csv'));

  for (const fname of files) {
    const fpath = path.join(dataDir, fname);

    // Lire la première ligne pour détecter le header
    const firstLine = await readFirstLine(fpath);
    const cols = firstLine.split(',').map(c => c.trim().toLowerCase());

    if (!cols.includes('sensor id') && !cols.includes('sensor_id')) continue;

    log.info(`Fichier métadonnées détecté : ${fname}`);

    await new Promise((resolve, reject) => {
      fs.createReadStream(fpath)
        .pipe(parse({
          columns: true,          // 1ère ligne = noms des colonnes
          skip_empty_lines: true,
          trim: true,
        }))
        .on('data', (row) => {
          // Normaliser les clés (insensible à la casse)
          const r = normalizeKeys(row);

          const sid      = String(parseInt(r['sensor id'] || r['sensor_id']));
          const lat      = parseFloat(r['latitude']   || 0);
          const lon      = parseFloat(r['longitude']  || 0);
          const freeway  = r['freeway']   ? `SR-${parseInt(r['freeway'])}` : 'Unknown';
          const direction = r['direction'] || 'N/A';
          const lanes    = parseInt(r['lanes'] || 0);

          meta.set(sid, { lat, lon, highway: freeway, direction, lanes });
        })
        .on('end',   resolve)
        .on('error', reject);
    });

    log.info(`${meta.size} capteurs chargés depuis les métadonnées.`);
    return meta;
  }

  log.warn('Aucun fichier métadonnées trouvé — coordonnées auto-générées.');
  return meta;
}





// ════════════════════════════════════════════════════════════════
//  INGESTION DANS MONGODB
// ════════════════════════════════════════════════════════════════

async function ingest() {
  const sensorsCol = db.collection('sensors');

  // Vérifier si déjà peuplé
  const count = await sensorsCol.countDocuments();
  if (count > 0) {
    log.info(`Base déjà peuplée (${count} capteurs) — ingestion ignorée.`);
    return;
  }

  log.info('═══ Début ingestion metadata.csv ═══');

  if (!fs.existsSync(DATA_DIR)) {
    log.error(`Répertoire ${DATA_DIR} introuvable !`);
    return;
  }

  const files = fs.readdirSync(DATA_DIR);
  log.info(`Fichiers dans ${DATA_DIR} : ${files.join(', ')}`);

  // ── Index MongoDB ──
  await sensorsCol.createIndex({ sensor_id: 1 }, { unique: true });
  log.info('Index MongoDB créés.');

  // ── Charger les métadonnées ──
  const meta = await loadMetadata(DATA_DIR);

  // ── Insérer les capteurs depuis metadata.csv ──
  const sensorDocs = Array.from(meta.entries()).map(([sid, info]) => {
    return {
      sensor_id: sid,
      name:      `${info.highway} ${info.direction} — ${sid}`,
      lat:       info.lat,
      lon:       info.lon,
      highway:   info.highway,
      direction: info.direction,
      lanes:     info.lanes,
    };
  });

  await sensorsCol.insertMany(sensorDocs);
  log.info(`═══ Ingestion terminée : ${sensorDocs.length} capteurs insérés ═══`);
}


// ════════════════════════════════════════════════════════════════
//  ROUTES API
// ════════════════════════════════════════════════════════════════

/** GET /api/health */
app.get('/api/health', async (req, res) => {
  try {
    await db.command({ ping: 1 });
    res.json({
      status:  'ok',
      mongodb: 'connected',
      sensors: await db.collection('sensors').countDocuments(),
    });
  } catch (e) {
    res.status(500).json({ status: 'error', detail: e.message });
  }
});


/** GET /api/sensors — tous les capteurs */
app.get('/api/sensors', async (req, res) => {
  try {
    const sensors = await db.collection('sensors').find({}, { projection: { _id: 0 } }).toArray();
    res.json(sensors);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


/** GET /api/sensors/:id/history?hours=24 */
app.get('/api/sensors/:id/history', async (req, res) => {
  try {
    const sid   = req.params.id;
    const hours = parseInt(req.query.hours || '24');

    // Trouver la première mesure du capteur
    const first = await db.collection('traffic_records').findOne(
      { sensor_id: sid },
      { sort: { timestamp: 1 }, projection: { timestamp: 1 } }
    );
    if (!first) return res.json([]);

    const since = first.timestamp;
    const until = new Date(since.getTime() + hours * 3600 * 1000);

    const records = await db.col — retourne le capteur seul (pas d'historique de données) */
app.get('/api/sensors/:id/history', async (req, res) => {
  try {
    const sid = req.params.id;
    const sensor = await db.collection('sensors').findOne(
      { sensor_id: sid },
      { projection: { _id: 0 } }
    );
    if (!sensor) return res.status(404).json({ error: 'Capteur non trouvé' });
    res.json(sensor
    ];
    const breakdown = await db.collection('traffic_records').aggregate(pipeline).toArray();
    breakdown.forEach(b => {
      b.avg_speed = Math.round(b.avg_speed * 100) / 100;
      b.avg_flow  = Math.round(b.avg_flow  * 100) / 100;
    });

    res.json({
      total_records:        await db.collection('traffic_records').countDocuments(),
      total_sensors:        await db.collection('sensors').countDocuments(),
      congestion_breakdown: breakdown,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ════════════════════════════════════════════════════════════════
//  UTILITAIRES
// ════════════════════════════════════════════════════════════════

/** Lire la première ligne d'un fichier */
function readFirstLine(fpath) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: fs.createReadStream(fpath) });
    rl.once('line', (line) => { rl.close(); resolve(line); });
    rl.on('error', reject);
  });
}

/** Normaliser les clés d'un objet CSV en minuscules */
function normalizeKeys(obj) {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k.toLowerCase().trim()] = v;
  }
  return result;
}

/** Générer des coordonnées stables pour un capteur inconnu */
function autoCoords(sid) {
  const seed = parseInt(sid) % 100000;
  const rng  = seededRandom(seed);
  return {
    lat:       37.68  + (rng() - 0.5) * 0.7,
    lon:       -122.18 + (rng() - 0.5) * 0.9,
    highway:   'Bay Area',
    direction: 'N/A',
    lanes:     0,
  };
}

/** Générateur pseudo-aléatoire déterministe (LCG) */
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}


// ════════════════════════════════════════════════════════════════
//  DÉMARRAGE
// ════════════════════════════════════════════════════════════════
async function main() {
  console.log('╔═══════════════════════════════════╗');
  console.log('║  PEMS-BAY Traffic Service (Node)  ║');
  console.log('╚═══════════════════════════════════╝');
  log.info(`MONGO_URI = ${MONGO_URI}`);
  log.info(`DATA_DIR  = ${DATA_DIR}`);

  try {
    await connectMongo();
    await ingest();
  } catch (e) {
    log.error(`Erreur démarrage : ${e.message}`);
  }

  app.listen(PORT, '0.0.0.0', () => {
    log.info(`API démarrée → http://0.0.0.0:${PORT}`);
  });
}

main();
