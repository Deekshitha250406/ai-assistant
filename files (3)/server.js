/**
 * ╔══════════════════════════════════════════════════╗
 * ║   ARIA Voice Assistant — Backend Server          ║
 * ║   Stack: Node.js + Express + WebSocket + MongoDB ║
 * ╚══════════════════════════════════════════════════╝
 *
 * Run locally:  npm run dev
 * Run prod:     npm start
 * Deploy:       Render.com (free tier works)
 */

require('dotenv').config();

const express    = require('express');
const http       = require('http');
const WebSocket  = require('ws');
const cors       = require('cors');
const path       = require('path');
const multer     = require('multer');
const FormData   = require('form-data');
const axios      = require('axios');
const cron       = require('node-cron');
const Anthropic  = require('@anthropic-ai/sdk');
const { MongoClient, ObjectId } = require('mongodb');

// ─── Setup ────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));  // serve index.html

// ─── Database ─────────────────────────────────────────────────────
let db = null;

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    console.warn('[DB] MONGODB_URI not set — running in memory-only mode');
    return;
  }
  try {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db('aria');
    // Create indexes
    await db.collection('conversations').createIndex({ userId: 1, updatedAt: -1 });
    await db.collection('messages').createIndex({ conversationId: 1, ts: 1 });
    await db.collection('reminders').createIndex({ userId: 1, datetime: 1, status: 1 });
    console.log('[DB] ✓ MongoDB connected');
  } catch (e) {
    console.error('[DB] Connection failed:', e.message);
  }
}

const col = (name) => db?.collection(name);

// ─── Anthropic Client ──────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ARIA_SYSTEM = `You are ARIA (Adaptive Reasoning Intelligence Assistant), a helpful, warm, human-like AI voice assistant.
- Keep responses concise: 2–4 sentences unless the user clearly needs more detail
- Be proactive — suggest reminders or next steps when relevant
- Ask clarifying questions if the request is ambiguous
- When the user asks to set a reminder or schedule something, confirm it warmly and append EXACTLY this tag on a new line:
  REMINDER_SET:{"title":"<title>","datetime":"<ISO 8601 datetime>","display":"<human-friendly string>"}
- Only append REMINDER_SET when actually creating a reminder
- Handle errors gracefully and guide users to solutions`;

// ─── Helpers ──────────────────────────────────────────────────────
function parseReminder(text) {
  const m = text.match(/REMINDER_SET:(\{[^}]+\})/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function cleanResponse(text) {
  return text.replace(/REMINDER_SET:\{[^}]+\}/g, '').trim();
}

// ─── WebSocket Hub ────────────────────────────────────────────────
// Map: userId → WebSocket
const clients = new Map();

wss.on('connection', (ws, req) => {
  const url   = new URL(req.url, 'http://localhost');
  const userId = url.searchParams.get('userId') || 'anon_' + Date.now();
  clients.set(userId, ws);
  console.log(`[WS] + ${userId} (${clients.size} connected)`);

  // Heartbeat ping/pong
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw);
      switch (msg.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        case 'chat':
          await handleStreamChat(ws, userId, msg);
          break;
        default:
          console.warn('[WS] Unknown message type:', msg.type);
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: e.message }));
    }
  });

  ws.on('close', () => {
    clients.delete(userId);
    console.log(`[WS] - ${userId} (${clients.size} connected)`);
  });

  ws.on('error', (e) => console.error('[WS] Error:', e.message));
});

// Keep connections alive
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) { ws.terminate(); return; }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

async function handleStreamChat(ws, userId, msg) {
  const { messages, userMessage, conversationId, speaker } = msg;
  ws.send(JSON.stringify({ type: 'stream_start' }));

  let fullText = '';
  try {
    const history = [...(messages || []), { role: 'user', content: userMessage }];

    const stream = await anthropic.messages.stream({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system:     ARIA_SYSTEM,
      messages:   history.slice(-20),
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        fullText += chunk.delta.text;
        ws.send(JSON.stringify({ type: 'stream_chunk', text: chunk.delta.text }));
      }
    }

    const reminder = parseReminder(fullText);
    const display  = cleanResponse(fullText);

    ws.send(JSON.stringify({ type: 'stream_end', fullText: display, reminder }));

    // Persist to DB
    if (db && conversationId) {
      const ts = new Date();
      await col('messages').insertMany([
        { conversationId, role: 'user',      content: userMessage, ts, speaker },
        { conversationId, role: 'assistant', content: display, ts: new Date(ts.getTime() + 1), reminder },
      ]);
      await col('conversations').updateOne(
        { _id: new ObjectId(conversationId) },
        { $set: { updatedAt: ts }, $inc: { messageCount: 2 } }
      );
      if (reminder) {
        await col('reminders').insertOne({
          userId,
          conversationId,
          ...reminder,
          datetime:  new Date(reminder.datetime),
          status:    'pending',
          createdAt: ts,
        });
      }
    }
  } catch (e) {
    ws.send(JSON.stringify({ type: 'stream_error', message: e.message }));
  }
}

// ─── REST API ─────────────────────────────────────────────────────

// Health
app.get('/health', (_, res) => res.json({
  status:  'ok',
  ts:      new Date().toISOString(),
  db:      !!db,
  clients: clients.size,
}));

// ── Chat (non-streaming fallback) ─────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { messages, userMessage } = req.body;
  if (!userMessage) return res.status(400).json({ error: 'userMessage required' });

  try {
    const history = [...(messages || []), { role: 'user', content: userMessage }];
    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system:     ARIA_SYSTEM,
      messages:   history.slice(-20),
    });

    const raw      = response.content[0]?.text || '';
    const reminder = parseReminder(raw);
    const display  = cleanResponse(raw);

    res.json({ response: display, reminder, usage: response.usage });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Conversations ─────────────────────────────────────────────────
app.get('/api/conversations', async (req, res) => {
  const { userId } = req.query;
  if (!db) return res.json([]);
  const list = await col('conversations')
    .find({ userId })
    .sort({ updatedAt: -1 })
    .limit(100)
    .toArray();
  res.json(list);
});

app.post('/api/conversations', async (req, res) => {
  const { userId, title } = req.body;
  if (!db) return res.json({ id: 'local_' + Date.now(), title: title || 'New Conversation' });
  const r = await col('conversations').insertOne({
    userId,
    title:        title || 'New Conversation',
    messageCount: 0,
    createdAt:    new Date(),
    updatedAt:    new Date(),
  });
  res.json({ id: r.insertedId, title: title || 'New Conversation' });
});

app.patch('/api/conversations/:id/title', async (req, res) => {
  if (!db) return res.json({ ok: true });
  await col('conversations').updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { title: req.body.title, updatedAt: new Date() } }
  );
  res.json({ ok: true });
});

app.get('/api/conversations/:id/messages', async (req, res) => {
  if (!db) return res.json([]);
  const msgs = await col('messages')
    .find({ conversationId: req.params.id })
    .sort({ ts: 1 })
    .toArray();
  res.json(msgs);
});

app.delete('/api/conversations/:id', async (req, res) => {
  if (!db) return res.json({ ok: true });
  await col('conversations').deleteOne({ _id: new ObjectId(req.params.id) });
  await col('messages').deleteMany({ conversationId: req.params.id });
  res.json({ ok: true });
});

// ── Reminders ─────────────────────────────────────────────────────
app.get('/api/reminders', async (req, res) => {
  const { userId } = req.query;
  if (!db) return res.json([]);
  const list = await col('reminders')
    .find({ userId, status: { $ne: 'deleted' } })
    .sort({ datetime: 1 })
    .toArray();
  res.json(list);
});

app.post('/api/reminders', async (req, res) => {
  const { userId, title, datetime, display } = req.body;
  if (!title || !datetime) return res.status(400).json({ error: 'title and datetime required' });
  const doc = {
    userId,
    title,
    datetime:  new Date(datetime),
    display,
    status:    'pending',
    createdAt: new Date(),
  };
  if (db) {
    const r = await col('reminders').insertOne(doc);
    return res.json({ id: r.insertedId, ...doc });
  }
  res.json({ id: 'local_' + Date.now(), ...doc });
});

app.patch('/api/reminders/:id', async (req, res) => {
  if (!db) return res.json({ ok: true });
  await col('reminders').updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { status: req.body.status, updatedAt: new Date() } }
  );
  res.json({ ok: true });
});

app.delete('/api/reminders/:id', async (req, res) => {
  if (!db) return res.json({ ok: true });
  await col('reminders').updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { status: 'deleted' } }
  );
  res.json({ ok: true });
});

// ── Speech-to-Text (Deepgram or OpenAI Whisper) ───────────────────
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file provided' });

  // Deepgram (preferred — real-time capable)
  if (process.env.DEEPGRAM_API_KEY) {
    try {
      const r = await axios.post(
        'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en-US',
        req.file.buffer,
        {
          headers: {
            'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
            'Content-Type':  req.file.mimetype,
          },
        }
      );
      const transcript = r.data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      return res.json({ transcript, provider: 'deepgram' });
    } catch (e) {
      console.error('[STT] Deepgram error:', e.message);
    }
  }

  // OpenAI Whisper (fallback)
  if (process.env.OPENAI_API_KEY) {
    try {
      const form = new FormData();
      form.append('file', req.file.buffer, { filename: 'audio.webm', contentType: req.file.mimetype });
      form.append('model', 'whisper-1');
      const r = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
        headers: { ...form.getHeaders(), Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      });
      return res.json({ transcript: r.data.text, provider: 'whisper' });
    } catch (e) {
      console.error('[STT] Whisper error:', e.message);
    }
  }

  res.status(503).json({ error: 'No STT provider configured. Set DEEPGRAM_API_KEY or OPENAI_API_KEY in .env' });
});

// ── Text-to-Speech (ElevenLabs) ───────────────────────────────────
app.post('/api/speak', async (req, res) => {
  const { text, voiceId } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  if (!process.env.ELEVENLABS_API_KEY) return res.status(503).json({ error: 'ElevenLabs not configured' });

  try {
    const vid = voiceId || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
    const r = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${vid}`,
      {
        text,
        model_id:      'eleven_turbo_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3 },
      },
      {
        headers:      { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
        responseType: 'arraybuffer',
      }
    );
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(r.data));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Reminder Cron (fires every minute) ──────────────────────────
cron.schedule('* * * * *', async () => {
  if (!db) return;
  const now   = new Date();
  const start = new Date(now.getTime() - 60000);
  const end   = new Date(now.getTime() + 60000);

  const due = await col('reminders')
    .find({ status: 'pending', datetime: { $gte: start, $lte: end } })
    .toArray();

  for (const r of due) {
    console.log(`[CRON] Firing reminder "${r.title}" for ${r.userId}`);
    const ws = clients.get(r.userId);
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'reminder_due', reminder: r }));
    }
    await col('reminders').updateOne(
      { _id: r._id },
      { $set: { status: 'triggered', triggeredAt: now } }
    );
  }
});

// ─── 404 fallback → serve frontend ───────────────────────────────
app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ─── Start ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`\n🤖 ARIA Server running at http://localhost:${PORT}`);
    console.log(`   WebSocket: ws://localhost:${PORT}`);
    console.log(`   DB:        ${db ? 'MongoDB ✓' : 'Memory only'}`);
    console.log(`   Claude:    ${process.env.ANTHROPIC_API_KEY ? '✓' : '✗ (set ANTHROPIC_API_KEY)'}\n`);
  });
});

module.exports = app;
