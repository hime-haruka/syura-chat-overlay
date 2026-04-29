import 'dotenv/config';
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import io from 'socket.io-client';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8080);
const PUBLIC_BASE_URL = String(process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const INGEST_KEY = process.env.INGEST_KEY || 'dev-key';
const CHZZK_CLIENT_ID = process.env.CHZZK_CLIENT_ID || '';
const CHZZK_CLIENT_SECRET = process.env.CHZZK_CLIENT_SECRET || '';
const CHZZK_REDIRECT_URI = process.env.CHZZK_REDIRECT_URI || `${PUBLIC_BASE_URL}/auth/chzzk/callback`;
const CHZZK_API_BASE = 'https://openapi.chzzk.naver.com';
const CHZZK_AUTH_URL = 'https://chzzk.naver.com/account-interlock';
const chzzkRuntimeSessions = new Map();

const app = express();
const server = http.createServer(app);
app.use(express.json({ limit: '1mb' }));
app.use('/overlay', express.static(path.join(__dirname, 'public/overlay')));

const privateDir = path.join(__dirname, 'private');
const tokenFile = path.join(privateDir, 'tokens.json');
fs.mkdirSync(privateDir, { recursive: true });

app.get('/', (_req, res) => {
  res.type('html').send(`<h1>Syura CHZZK Chat Overlay OK</h1><p>OBS: <code>${PUBLIC_BASE_URL}/chat/pop</code></p><p>Auth: <a href="/auth/chzzk/start?clientId=pop">/auth/chzzk/start?clientId=pop</a></p>`);
});

app.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get('/api/style/:clientId', (req, res) => {
  const clientId = safeName(req.params.clientId || 'default-style');
  const clientFile = path.join(__dirname, 'config', `${clientId}.json`);
  const defaultFile = path.join(__dirname, 'config', 'default-style.json');
  const file = fs.existsSync(clientFile) ? clientFile : defaultFile;
  res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
});

app.get('/chat/:clientId', (req, res) => {
  const clientId = safeName(req.params.clientId || 'pop');
  res.redirect(`/overlay/index.html?client=${encodeURIComponent(clientId)}`);
});

app.get('/auth/chzzk/start', (req, res) => {
  if (!CHZZK_CLIENT_ID) return res.status(500).send('CHZZK_CLIENT_ID is missing.');
  const overlayClientId = safeName(req.query.clientId || 'pop');
  const state = `${overlayClientId}.${crypto.randomBytes(16).toString('hex')}`;
  const url = new URL(CHZZK_AUTH_URL);
  url.searchParams.set('clientId', CHZZK_CLIENT_ID);
  url.searchParams.set('redirectUri', CHZZK_REDIRECT_URI);
  url.searchParams.set('state', state);
  res.redirect(url.toString());
});

app.get('/auth/chzzk/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) return res.status(400).send('Missing code or state.');
  if (!CHZZK_CLIENT_ID || !CHZZK_CLIENT_SECRET) return res.status(500).send('CHZZK client env is missing.');

  const overlayClientId = safeName(String(state).split('.')[0] || 'pop');
  try {
    const token = await chzzkToken({ grantType: 'authorization_code', code: String(code), state: String(state) });
    const tokens = loadTokens();
    tokens[overlayClientId] = {
      ...token,
      savedAt: Date.now(),
      expiresAt: Date.now() + Number(token.expiresIn || 86400) * 1000,
      overlayClientId
    };
    saveTokens(tokens);
    res.type('html').send(`<h2>치지직 인증 저장 완료</h2><p>clientId: <b>${overlayClientId}</b></p><p>OBS URL: <code>${PUBLIC_BASE_URL}/chat/${overlayClientId}</code></p><p>이제 서버 콘솔에서 Receiver를 실행하거나, 로컬 Receiver에 token 정보를 넣어 연결하세요.</p>`);
  } catch (err) {
    console.error('[auth callback]', err);
    res.status(500).send(`Token exchange failed: ${escapeHtml(err.message)}`);
  }
});

app.get('/api/tokens/:clientId/status', (req, res) => {
  const clientId = safeName(req.params.clientId);
  const token = loadTokens()[clientId];
  res.json({ exists: Boolean(token), expiresAt: token?.expiresAt || null });
});

app.post('/admin/chzzk/start/:clientId', async (req, res) => {
  const key = req.query.key || req.headers['x-ingest-key'];
  if (key !== INGEST_KEY) return res.status(401).json({ ok: false, error: 'Invalid key' });
  const clientId = safeName(req.params.clientId || 'pop');
  try {
    await startChzzkRuntimeSession(clientId);
    res.json({ ok: true, clientId, message: 'CHZZK session started' });
  } catch (err) {
    console.error('[admin start session]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/admin/chzzk/stop/:clientId', (req, res) => {
  const key = req.query.key || req.headers['x-ingest-key'];
  if (key !== INGEST_KEY) return res.status(401).json({ ok: false, error: 'Invalid key' });
  const clientId = safeName(req.params.clientId || 'pop');
  const runtime = chzzkRuntimeSessions.get(clientId);
  runtime?.socket?.disconnect?.();
  chzzkRuntimeSessions.delete(clientId);
  res.json({ ok: true, clientId, message: 'CHZZK session stopped' });
});

app.get('/admin/chzzk/status/:clientId', (req, res) => {
  const key = req.query.key || req.headers['x-ingest-key'];
  if (key !== INGEST_KEY) return res.status(401).json({ ok: false, error: 'Invalid key' });
  const clientId = safeName(req.params.clientId || 'pop');
  res.json({ ok: true, clientId, running: chzzkRuntimeSessions.has(clientId), token: Boolean(loadTokens()[clientId]) });
});

async function chzzkToken(body) {
  const payload = { clientId: CHZZK_CLIENT_ID, clientSecret: CHZZK_CLIENT_SECRET, ...body };
  const r = await fetch(`${CHZZK_API_BASE}/auth/v1/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || json.code && json.code !== 200) throw new Error(JSON.stringify(json));
  return json.content || json;
}


async function startChzzkRuntimeSession(clientId) {
  const tokens = loadTokens();
  const saved = tokens[clientId];
  if (!saved?.accessToken) throw new Error(`No access token saved for ${clientId}. Open /auth/chzzk/start?clientId=${clientId} first.`);
  if (chzzkRuntimeSessions.has(clientId)) return chzzkRuntimeSessions.get(clientId);

  const sessionUrl = await createChzzkUserSessionUrl(saved.accessToken);
  const socket = io.connect(sessionUrl, {
    reconnection: true,
    'force new connection': true,
    'connect timeout': 3000,
    transports: ['websocket']
  });
  const runtime = { socket, startedAt: Date.now() };
  chzzkRuntimeSessions.set(clientId, runtime);

  socket.on('connect', () => console.log(`[chzzk:${clientId}] socket connected`));
  socket.on('disconnect', reason => {
    console.log(`[chzzk:${clientId}] socket disconnected:`, reason);
    chzzkRuntimeSessions.delete(clientId);
  });
  socket.on('connect_error', err => console.error(`[chzzk:${clientId}] connect error:`, err.message));
  socket.on('SYSTEM', payload => {
    const body = normalizeSocketPayload(payload);
    console.log(`[chzzk:${clientId}] SYSTEM`, body?.type || body);
    if (body?.type === 'connected' && body?.data?.sessionKey) {
      subscribeChzzkChat(saved.accessToken, body.data.sessionKey).catch(err => console.error(`[chzzk:${clientId}] subscribe`, err));
    }
  });
  socket.on('CHAT', payload => {
    const body = normalizeSocketPayload(payload);
    const normalized = normalizeChzzkChatEvent(body?.data || body);
    if (normalized.message) broadcast(clientId, { type: 'chat', data: normalized });
  });
  socket.on('message', payload => {
    const body = normalizeSocketPayload(payload);
    if (body?.type === 'connected' && body?.data?.sessionKey) {
      subscribeChzzkChat(saved.accessToken, body.data.sessionKey).catch(console.error);
      return;
    }
    if (body?.eventType === 'CHAT' || body?.profile || body?.content) {
      const normalized = normalizeChzzkChatEvent(body?.data || body);
      if (normalized.message) broadcast(clientId, { type: 'chat', data: normalized });
    }
  });
  return runtime;
}

async function createChzzkUserSessionUrl(accessToken) {
  const r = await fetch(`${CHZZK_API_BASE}/open/v1/sessions/auth`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || json.code && json.code !== 200) throw new Error(`session auth failed: ${JSON.stringify(json)}`);
  return (json.content || json).url;
}

async function subscribeChzzkChat(accessToken, sessionKey) {
  const r = await fetch(`${CHZZK_API_BASE}/open/v1/sessions/events/subscribe/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionKey })
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || json.code && json.code !== 200) throw new Error(`subscribe failed: ${JSON.stringify(json)}`);
  return json.content || json;
}

function normalizeSocketPayload(payload) {
  if (typeof payload === 'string') { try { return JSON.parse(payload); } catch { return payload; } }
  return payload;
}

function normalizeChzzkChatEvent(raw = {}) {
  const profile = raw.profile || {};
  const badges = Array.isArray(profile.badges || raw.badges) ? (profile.badges || raw.badges).map(b => ({
    type: b.type || b.name || b.badgeId || 'badge',
    url: b.imageUrl || b.url || b.badgeImageUrl
  })) : [];
  const roleCode = String(profile.userRoleCode || '').toLowerCase();
  const role = roleCode === 'streamer' ? 'broadcaster' : (roleCode.includes('manager') ? 'moderator' : 'default');
  return {
    id: String(raw.messageId || raw.messageTime || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    userId: String(raw.senderChannelId || profile.channelId || profile.userId || profile.nickname || 'unknown'),
    nickname: String(profile.nickname || raw.nickname || '익명'),
    message: String(raw.content || raw.message || ''),
    role,
    badges
  };
}

function loadTokens() { try { return JSON.parse(fs.readFileSync(tokenFile, 'utf8')); } catch { return {}; } }
function saveTokens(v) { fs.writeFileSync(tokenFile, JSON.stringify(v, null, 2)); }

const overlayClients = new Map();
const overlayWss = new WebSocketServer({ noServer: true });
const receiverWss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/overlay-ws') return overlayWss.handleUpgrade(req, socket, head, ws => overlayWss.emit('connection', ws, req));
  if (url.pathname === '/receiver') return receiverWss.handleUpgrade(req, socket, head, ws => receiverWss.emit('connection', ws, req));
  socket.destroy();
});

overlayWss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const clientId = safeName(url.searchParams.get('client') || 'pop');
  if (!overlayClients.has(clientId)) overlayClients.set(clientId, new Set());
  overlayClients.get(clientId).add(ws);
  ws.send(JSON.stringify({ type: 'system', status: 'connected', clientId }));
  ws.on('close', () => overlayClients.get(clientId)?.delete(ws));
});

receiverWss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const key = url.searchParams.get('key');
  const clientId = safeName(url.searchParams.get('client') || 'pop');
  if (key !== INGEST_KEY) return ws.close(1008, 'Invalid ingest key');
  console.log(`[receiver] connected: ${clientId}`);
  ws.on('message', buf => {
    try {
      const data = JSON.parse(buf.toString());
      if (['chat', 'deleteMessage', 'deleteUser', 'system'].includes(data.type)) broadcast(clientId, data);
    } catch (e) { console.error('Receiver message parse error:', e); }
  });
});

function broadcast(clientId, payload) {
  const targets = overlayClients.get(clientId);
  if (!targets) return;
  const msg = JSON.stringify(payload);
  for (const ws of targets) if (ws.readyState === ws.OPEN) ws.send(msg);
}
function safeName(value) { return String(value).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'pop'; }
function escapeHtml(v) { return String(v).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch])); }

server.listen(PORT, () => {
  console.log(`Overlay server: ${PUBLIC_BASE_URL}/chat/pop`);
  console.log(`CHZZK callback: ${CHZZK_REDIRECT_URI}`);
});
