const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const nodemailer = require('nodemailer');
const { fetch } = require('undici');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));

// Custom timing logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = (Date.now() - start).toFixed(0);
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// Health check
app.get('/api/status', (_req, res) => {
  res.json({ ok: true, service: 'sanketa-backend', time: new Date().toISOString() });
});

// Sample in-memory intersections (demo data when no city specified)
const intersections = [
  { id: 'INT001', name: 'MG Road / Brigade Rd', lat: 12.9721, lng: 77.6070, phase: 'GREEN', remainingSeconds: 18 },
  { id: 'INT002', name: 'Richmond Rd / Residency Rd', lat: 12.9666, lng: 77.6043, phase: 'RED', remainingSeconds: 22 },
  { id: 'INT003', name: 'Airport Access / NH44', lat: 13.1989, lng: 77.7063, phase: 'AMBER', remainingSeconds: 4 }
];

// City-scoped cache { key -> { meta, intersections, ts } }
const cityCache = new Map();

function rotatePhases(list){
  list.forEach(int => {
    int.remainingSeconds -= 1;
    if (int.remainingSeconds <= 0) {
      if (int.phase === 'GREEN') { int.phase = 'AMBER'; int.remainingSeconds = 5; }
      else if (int.phase === 'AMBER') { int.phase = 'RED'; int.remainingSeconds = 30; }
      else if (int.phase === 'RED') { int.phase = 'GREEN'; int.remainingSeconds = 25; }
    }
  });
}

function jitterAround(lat, lng, radiusDeg){
  const r = (Math.random() * radiusDeg) - (radiusDeg/2);
  const r2 = (Math.random() * radiusDeg) - (radiusDeg/2);
  return [lat + r, lng + r2];
}

function generateIntersectionsForCity(centerLat, centerLng, count=10){
  const phases = ['GREEN','AMBER','RED'];
  const names = ['Central','Market','Station','College','Airport','Park','River','Hill','Temple','Mall'];
  const out = [];
  for(let i=0;i<count;i++){
    const [lat,lng] = jitterAround(centerLat, centerLng, 0.04);
    const phase = phases[Math.floor(Math.random()*phases.length)];
    const remainingSeconds = phase==='RED'? 20+Math.floor(Math.random()*25) : phase==='AMBER'? 4+Math.floor(Math.random()*3) : 15+Math.floor(Math.random()*20);
    out.push({
      id: `CINT${String(i+1).padStart(3,'0')}`,
      name: `${names[i%names.length]} Junction ${i+1}`,
      lat, lng, phase, remainingSeconds
    });
  }
  return out;
}

async function geocodeCity(query){
  const q = String(query||'').trim();
  if(!q) return null;
  // Nominatim usage policy: include a proper UA
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=1`;
  const resp = await fetch(url, { headers: { 'User-Agent': 'sanketa-demo/0.1 (+https://example.com)' } });
  if(!resp.ok) return null;
  const arr = await resp.json();
  if(!Array.isArray(arr) || !arr.length) return null;
  const it = arr[0];
  const centerLat = parseFloat(it.lat);
  const centerLng = parseFloat(it.lon);
  const bbox = it.boundingbox ? it.boundingbox.map(parseFloat) : null;
  const displayName = it.display_name || q;
  return { centerLat, centerLng, bbox, displayName };
}

async function getCityEntry(city){
  const key = city.toLowerCase();
  const cached = cityCache.get(key);
  if(cached && (Date.now() - cached.ts < 60_000)) return cached; // 60s cache
  const gc = await geocodeCity(city);
  if(!gc) return null;
  const ints = generateIntersectionsForCity(gc.centerLat, gc.centerLng, 12);
  const meta = {
    cityName: gc.displayName,
    centerLat: gc.centerLat,
    centerLng: gc.centerLng,
    bbox: gc.bbox,
    uptimePct: (95 + Math.random()*4).toFixed(2),
    solarOutputKw: (8 + Math.random()*2).toFixed(1),
    batteryChargePct: (65 + Math.random()*30).toFixed(0),
    co2SavedKg: (8 + Math.random()*4).toFixed(1),
    fuelSavedL: (2 + Math.random()*3).toFixed(1),
    idleReductionPct: (10 + Math.random()*6).toFixed(1),
    emergencyRequestsToday: Math.round(Math.random()*5),
    avgClearSeconds: (22 + Math.random()*18).toFixed(0),
    avgGreenUtilizationPct: (55 + Math.random()*25).toFixed(1),
    phasesOptimizedToday: 4 + Math.round(Math.random()*8)
  };
  const entry = { meta, intersections: ints, ts: Date.now() };
  cityCache.set(key, entry);
  return entry;
}

// Utility to simulate countdown changes for base and cached city sets
setInterval(() => {
  rotatePhases(intersections);
  for(const [key, entry] of cityCache.entries()){
    rotatePhases(entry.intersections);
  }
}, 1000);

// City suggestions (autocomplete)
app.get('/api/cities', async (req, res) => {
  const q = String(req.query.query||'').trim();
  if(!q) return res.json([]);
  try{
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=10&addressdetails=0`;
    const r = await fetch(url, { headers: { 'User-Agent': 'sanketa-demo/0.1 (+https://example.com)' } });
    const arr = await r.json();
    const names = Array.isArray(arr) ? arr.map(i => i.display_name).filter(Boolean) : [];
    res.json(names.slice(0,10));
  } catch(err){
    res.json([]);
  }
});

// List intersections, optionally for a city
app.get('/api/intersections', async (req, res) => {
  const city = req.query.city ? String(req.query.city).trim() : '';
  if(city){
    try{
      const entry = await getCityEntry(city);
      if(!entry) return res.json({ ok: false, error: 'City not found' });
      return res.json({ ok: true, meta: entry.meta, intersections: entry.intersections });
    } catch(err){
      return res.json({ ok: false, error: 'Lookup failed' });
    }
  }
  // default payload
  const meta = {
    cityName: 'Bengaluru, India',
    centerLat: 12.9716, centerLng: 77.5946,
    uptimePct: (96 + Math.random()*3).toFixed(2),
    solarOutputKw: (8 + Math.random()*2).toFixed(1),
    batteryChargePct: (70 + Math.random()*25).toFixed(0),
    co2SavedKg: (8 + Math.random()*4).toFixed(1),
    fuelSavedL: (2 + Math.random()*3).toFixed(1),
    idleReductionPct: (10 + Math.random()*6).toFixed(1),
    emergencyRequestsToday: Math.round(Math.random()*5),
    avgClearSeconds: (22 + Math.random()*18).toFixed(0),
    avgGreenUtilizationPct: (55 + Math.random()*25).toFixed(1),
    phasesOptimizedToday: 4 + Math.round(Math.random()*8)
  };
  res.json({ ok: true, meta, intersections });
});

// Real-time stream (Server-Sent Events)
app.get('/api/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  const city = req.query.city ? String(req.query.city).trim() : '';
  let meta = null;
  let listRef = intersections;
  if(city){
    try{
      const entry = await getCityEntry(city);
      if(entry){ meta = entry.meta; listRef = entry.intersections; }
    } catch(_) { /* ignore -> fall back */ }
  }

  const sendSnapshot = () => {
    const payload = JSON.stringify({
      time: new Date().toISOString(),
      meta,
      intersections: listRef.map(i => ({
        id: i.id,
        name: i.name,
        lat: i.lat,
        lng: i.lng,
        phase: i.phase,
        remainingSeconds: i.remainingSeconds
      }))
    });
    res.write(`event:update\n`);
    res.write(`data:${payload}\n\n`);
  };

  // Send initial snapshot quickly
  sendSnapshot();
  const interval = setInterval(sendSnapshot, 1000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// Single intersection SPaT
app.get('/api/spat/:id', (req, res) => {
  const found = intersections.find(i => i.id === req.params.id);
  if (!found) return res.status(404).json({ ok: false, error: 'Intersection not found' });
  res.json({ ok: true, data: found });
});

// Metrics demo endpoint
app.get('/api/metrics', (_req, res) => {
  const metrics = {
    score: 63, // composite efficiency score
    health: [
      { name: 'Edge Controllers', status: 'Nominal', level: 'good' },
      { name: 'Solar Arrays', status: 'Peak', level: 'good' },
      { name: 'Battery Backup', status: 'Charge 78%', level: 'warn' },
      { name: 'Network Links', status: '2 degraded', level: 'warn' },
      { name: 'Sensor Streams', status: '1 offline', level: 'bad' }
    ],
      alerts: [], // Metrics endpoint removed as dashboard deprecated
      reports: []
  };
  res.json({ ok: true, data: metrics });
});

// Dashboard health (simulated scores & sensor status)
app.get('/api/health', (_req, res) => {
  const score = 72 + Math.round(Math.random() * 6); // Sanketa Score
  const sensors = [
    { id: 'cam-mg-road', label: 'Camera MG Road', status: 'OK' },
    { id: 'radar-airport', label: 'Radar Airport Junction', status: 'OK' },
    { id: 'loop-richmond', label: 'Loop Richmond Rd', status: 'WARN' },
    { id: 'cam-residency', label: 'Camera Residency Rd', status: 'OK' }
  ];
  res.json({ ok: true, data: { score, sensors } });
});

// Alerts (rotating demo)
const baseAlerts = [
  { id: 'al-1', type: 'CONGESTION', intersection: 'INT002', message: 'High queue length northbound', severity: 'MED' },
  { id: 'al-2', type: 'SENSOR', intersection: 'INT001', message: 'Loop occupancy flatline', severity: 'LOW' },
  { id: 'al-3', type: 'EMERGENCY', intersection: 'INT003', message: 'Ambulance priority active', severity: 'HIGH' }
];
app.get('/api/alerts', (_req, res) => {
  // Randomly toggle one alert severity for demo
  const clone = baseAlerts.map(a => ({ ...a }));
  const pick = clone[Math.floor(Math.random() * clone.length)];
  if (pick.type === 'CONGESTION') pick.severity = ['MED','HIGH'][Math.floor(Math.random()*2)];
  res.json({ ok: true, data: clone });
});

// Reports (recent events / changes)
let reportCounter = 0;
app.get('/api/reports', (_req, res) => {
  reportCounter++;
  const now = new Date();
  const iso = now.toISOString();
  const reports = [
    { id: 'rp-'+reportCounter+'a', time: iso, text: 'Adaptive phase update applied (MG Rd)' },
    { id: 'rp-'+reportCounter+'b', time: iso, text: 'Priority window closed (Airport Access)' },
    { id: 'rp-'+reportCounter+'c', time: iso, text: 'Sensor calibration scheduled (Loop Richmond)' }
  ];
  res.json({ ok: true, data: reports });
});

// Contact endpoint (demo: logs + optional SMTP if env vars set)
app.post('/api/contact', async (req, res, next) => {
  const { name, email, subject, message } = req.body || {};
  if (!name || !email || !message) {
    return res.status(400).json({ ok: false, error: 'Missing required fields (name, email, message).' });
  }
  // Log payload (could persist to DB here)
  console.log('Contact submission:', { name, email, subject, message });

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  let mailResult = 'skipped';
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: false,
        auth: { user: smtpUser, pass: smtpPass }
      });
      await transporter.sendMail({
        from: smtpUser,
        to: process.env.CONTACT_TO || smtpUser,
        subject: `[Sanketa] ${subject || 'Contact Form'}`,
        text: `Name: ${name}\nEmail: ${email}\n\n${message}`
      });
      mailResult = 'sent';
    } catch (err) {
      console.error('Email send failed:', err.message);
      mailResult = 'error';
    }
  }
  try {
    return res.json({ ok: true, mail: mailResult });
  } catch (e) {
    next(e);
  }
});

// Fallback 404 for API
app.use('/api', (_req, res) => {
  res.status(404).json({ ok: false, error: 'Not found' });
});

// Central error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.stack || err.message);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});

// Crash guards to surface errors instead of silent exit
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.stack || err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
