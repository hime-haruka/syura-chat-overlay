require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const io = require('socket.io-client');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

const PORT = Number(process.env.PORT || 10000);
const BASE_URL = (process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const CHZZK_CLIENT_ID = process.env.CHZZK_CLIENT_ID || '';
const CHZZK_CLIENT_SECRET = process.env.CHZZK_CLIENT_SECRET || '';
const CHZZK_REDIRECT_URI = process.env.CHZZK_REDIRECT_URI || `${BASE_URL}/auth/chzzk/callback`;
const INGEST_KEY = process.env.INGEST_KEY || '';
const OPENAPI_BASE = 'https://openapi.chzzk.naver.com';

const ROOT = __dirname;
const CONFIG_DIR = path.join(ROOT, 'configs');
const TOKEN_DIR = path.join(ROOT, 'data', 'tokens');
const SESSION_DIR = path.join(ROOT, 'data', 'sessions');
fs.mkdirSync(TOKEN_DIR, { recursive: true });
fs.mkdirSync(SESSION_DIR, { recursive: true });

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(ROOT, 'public')));

const overlayClients = new Map();
const runtime = new Map();

function safeClientId(clientId) {
  return String(clientId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
}

function configPath(clientId) {
  return path.join(CONFIG_DIR, `${clientId}.json`);
}

function tokenPath(clientId) {
  return path.join(TOKEN_DIR, `${clientId}.json`);
}

function loadConfig(clientId) {
  const id = safeClientId(clientId);
  const p = configPath(id);
  if (!id || !fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadToken(clientId) {
  const p = tokenPath(clientId);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveToken(clientId, token) {
  fs.writeFileSync(tokenPath(clientId), JSON.stringify({ ...token, savedAt: Date.now() }, null, 2));
}

function removeToken(clientId) {
  const p = tokenPath(clientId);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

function getRuntime(clientId) {
  if (!runtime.has(clientId)) {
    runtime.set(clientId, {
      clientId,
      status: 'stopped',
      channelId: null,
      channelName: null,
      sessionKey: null,
      socketUrl: null,
      socket: null,
      lastError: null,
      lastEventAt: null,
      startedAt: null,
      logs: []
    });
  }
  return runtime.get(clientId);
}

function log(clientId, msg, extra = null) {
  const rt = getRuntime(clientId);
  const line = { at: new Date().toISOString(), msg, extra };
  rt.logs.unshift(line);
  rt.logs = rt.logs.slice(0, 30);
  console.log(`[${clientId}] ${msg}`, extra || '');
}

function getWsSet(clientId) {
  if (!overlayClients.has(clientId)) overlayClients.set(clientId, new Set());
  return overlayClients.get(clientId);
}

function broadcast(clientId, payload) {
  const raw = JSON.stringify(payload);
  for (const ws of getWsSet(clientId)) {
    if (ws.readyState === WebSocket.OPEN) ws.send(raw);
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[ch]));
}

function htmlPage(title, body) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="/public/connect.css" />
</head><body>${body}</body></html>`;
}

async function chzzkRequest(pathname, { method = 'GET', accessToken, body, clientAuth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (clientAuth) {
    headers['Client-Id'] = CHZZK_CLIENT_ID;
    headers['Client-Secret'] = CHZZK_CLIENT_SECRET;
  }
  const res = await fetch(`${OPENAPI_BASE}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`CHZZK API ${method} ${pathname} failed: ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json.content ?? json;
}

async function exchangeCode({ code, state }) {
  const body = {
    grantType: 'authorization_code',
    clientId: CHZZK_CLIENT_ID,
    clientSecret: CHZZK_CLIENT_SECRET,
    code,
    state
  };
  return chzzkRequest('/auth/v1/token', { method: 'POST', body });
}

async function refreshToken(clientId, token) {
  const body = {
    grantType: 'refresh_token',
    refreshToken: token.refreshToken,
    clientId: CHZZK_CLIENT_ID,
    clientSecret: CHZZK_CLIENT_SECRET
  };
  const next = await chzzkRequest('/auth/v1/token', { method: 'POST', body });
  saveToken(clientId, next);
  return next;
}

async function getValidToken(clientId) {
  let token = loadToken(clientId);
  if (!token) return null;
  const expiresInMs = Number(token.expiresIn || 86400) * 1000;
  if (token.savedAt && Date.now() - token.savedAt > expiresInMs - 120000) {
    token = await refreshToken(clientId, token);
  }
  return token;
}

async function getMe(clientId) {
  const token = await getValidToken(clientId);
  if (!token) return null;
  return chzzkRequest('/open/v1/users/me', { accessToken: token.accessToken });
}

async function subscribeEvent(clientId, eventPath, sessionKey, accessToken) {
  return chzzkRequest(eventPath, {
    method: 'POST',
    accessToken,
    body: { sessionKey }
  }).catch(err => {
    log(clientId, `subscribe failed: ${eventPath}`, err.body || err.message);
    throw err;
  });
}

function normalizeChat(raw) {
  const d = raw && raw.data ? raw.data : raw;
  const profile = d.profile || {};
  return {
    type: 'chat',
    id: `${d.channelId || ''}-${d.senderChannelId || ''}-${d.messageTime || Date.now()}`,
    channelId: d.channelId,
    userId: d.senderChannelId,
    nickname: profile.nickname || d.nickname || '익명',
    role: profile.userRoleCode || 'common_user',
    verified: !!profile.verifiedMark,
    badges: Array.isArray(profile.badges) ? profile.badges : [],
    message: d.content || '',
    emojis: d.emojis || {},
    timestamp: d.messageTime || Date.now(),
    raw: d
  };
}

function normalizeDonation(raw) {
  const d = raw && raw.data ? raw.data : raw;
  return {
    type: 'donation',
    id: `donation-${d.donatorChannelId || ''}-${Date.now()}`,
    nickname: d.donatorNickname || '익명',
    amount: d.payAmount || '',
    message: d.donationText || '',
    emojis: d.emojis || {},
    raw: d
  };
}

function normalizeSubscription(raw) {
  const d = raw && raw.data ? raw.data : raw;
  return {
    type: 'subscription',
    id: `sub-${d.subscriberChannelId || ''}-${Date.now()}`,
    nickname: d.subscriberNickname || '구독자',
    tierNo: d.tierNo,
    tierName: d.tierName,
    month: d.month,
    raw: d
  };
}

async function startChzzkSession(clientId) {
  const config = loadConfig(clientId);
  if (!config) throw new Error(`configs/${clientId}.json not found`);
  const token = await getValidToken(clientId);
  if (!token) throw new Error('NOT_LOGGED_IN');

  const rt = getRuntime(clientId);
  if (rt.socket) {
    try { rt.socket.disconnect(); } catch {}
    rt.socket = null;
  }
  rt.status = 'starting';
  rt.lastError = null;
  rt.startedAt = new Date().toISOString();

  const me = await getMe(clientId);
  rt.channelId = me && (me.channelId || me.channelID || me.id);
  rt.channelName = me && (me.channelName || me.nickname || me.name);
  log(clientId, 'user loaded', { channelId: rt.channelId, channelName: rt.channelName });

  const sessionAuth = await chzzkRequest('/open/v1/sessions/auth', { accessToken: token.accessToken });
  const socketUrl = sessionAuth.url;
  if (!socketUrl) throw new Error('Session URL missing from CHZZK response');
  rt.socketUrl = socketUrl;
  log(clientId, 'session socket url issued');

  const socket = io.connect(socketUrl, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 3000,
    forceNew: true,
    timeout: 3000,
    transports: ['websocket']
  });

  rt.socket = socket;

  socket.on('connect', () => {
    rt.status = 'socket_connected_waiting_session_key';
    rt.lastError = null;
    log(clientId, 'socket connected');
  });

  socket.on('SYSTEM', async (msg) => {
    rt.lastEventAt = new Date().toISOString();
    log(clientId, 'SYSTEM', msg);
    const data = msg && msg.data ? msg.data : {};
    if (msg && msg.type === 'connected' && data.sessionKey) {
      rt.sessionKey = data.sessionKey;
      rt.status = 'subscribing';
      try {
        await subscribeEvent(clientId, '/open/v1/sessions/events/subscribe/chat', data.sessionKey, token.accessToken);
        await subscribeEvent(clientId, '/open/v1/sessions/events/subscribe/donation', data.sessionKey, token.accessToken).catch(() => null);
        await subscribeEvent(clientId, '/open/v1/sessions/events/subscribe/subscription', data.sessionKey, token.accessToken).catch(() => null);
        rt.status = 'running';
        broadcast(clientId, { type: 'system', message: 'connected' });
      } catch (err) {
        rt.status = 'error';
        rt.lastError = err.body || err.message;
      }
    }
    if (msg && msg.type === 'revoked') {
      rt.status = 'revoked';
      rt.lastError = '권한이 회수되었습니다. 다시 로그인해주세요.';
    }
  });

  socket.on('CHAT', (msg) => {
    rt.lastEventAt = new Date().toISOString();
    broadcast(clientId, normalizeChat(msg));
  });

  socket.on('DONATION', (msg) => {
    rt.lastEventAt = new Date().toISOString();
    broadcast(clientId, normalizeDonation(msg));
  });

  socket.on('SUBSCRIPTION', (msg) => {
    rt.lastEventAt = new Date().toISOString();
    broadcast(clientId, normalizeSubscription(msg));
  });

  socket.on('disconnect', (reason) => {
    rt.status = 'disconnected';
    rt.lastError = reason;
    log(clientId, 'socket disconnected', reason);
  });

  socket.on('connect_error', (err) => {
    rt.status = 'error';
    rt.lastError = err.message;
    log(clientId, 'socket connect_error', err.message);
  });

  return statusFor(clientId);
}

function stopChzzkSession(clientId) {
  const rt = getRuntime(clientId);
  if (rt.socket) {
    try { rt.socket.disconnect(); } catch {}
  }
  rt.socket = null;
  rt.status = 'stopped';
  rt.sessionKey = null;
  rt.socketUrl = null;
  log(clientId, 'session stopped');
  return statusFor(clientId);
}

function statusFor(clientId, includeLogs = false) {
  const config = loadConfig(clientId);
  const rt = getRuntime(clientId);
  const token = loadToken(clientId);
  const visible = {
    clientId,
    exists: !!config,
    hasToken: !!token,
    status: rt.status,
    channelId: rt.channelId,
    channelName: rt.channelName,
    lastError: rt.lastError,
    lastEventAt: rt.lastEventAt,
    startedAt: rt.startedAt,
    obsUrl: `${BASE_URL}/chat/${clientId}`,
    connectUrl: `${BASE_URL}/connect/${clientId}`
  };
  if (includeLogs) visible.logs = rt.logs;
  return visible;
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, BASE_URL);
  const clientId = safeClientId(url.searchParams.get('clientId'));
  if (!clientId || !loadConfig(clientId)) {
    ws.close(1008, 'invalid clientId');
    return;
  }
  const set = getWsSet(clientId);
  set.add(ws);
  ws.send(JSON.stringify({ type: 'system', message: 'overlay connected', status: statusFor(clientId) }));
  ws.on('close', () => set.delete(ws));
});

app.get('/', (req, res) => res.redirect('/connect/pop'));

app.get('/connect/:clientId', (req, res) => {
  const clientId = safeClientId(req.params.clientId);
  const config = loadConfig(clientId);
  if (!config) return res.status(404).send('client config not found');
  const status = statusFor(clientId);
  res.send(htmlPage(`CHZZK Connect - ${clientId}`, `
    <main class="shell">
      <section class="card hero">
        <div>
          <p class="eyebrow">CHZZK Chat Overlay</p>
          <h1>${escapeHtml(config.displayName || clientId)} 연결</h1>
          <p class="muted">이 페이지에서 본인 치지직 계정으로 로그인하면 OBS 채팅 오버레이가 연결됩니다. 비밀번호는 이 서비스에 저장되지 않습니다.</p>
        </div>
        <div class="status ${status.status}">${escapeHtml(status.status)}</div>
      </section>
      <section class="card steps">
        <h2>1. 치지직 로그인</h2>
        <p>처음 1회 또는 토큰이 만료되었을 때 다시 로그인해주세요.</p>
        <a class="button primary" href="/auth/chzzk/start?clientId=${encodeURIComponent(clientId)}">치지직 로그인/인증</a>
      </section>
      <section class="card steps">
        <h2>2. 연결 시작</h2>
        <p>로그인 후 아래 버튼을 누르면 서버가 치지직 채팅 세션을 시작합니다.</p>
        <button class="button" data-action="start">세션 시작</button>
        <button class="button ghost" data-action="test">테스트 메시지</button>
        <button class="button danger" data-action="logout">연결 해제</button>
      </section>
      <section class="card">
        <h2>OBS 주소</h2>
        <p class="muted">OBS 브라우저 소스 URL에 아래 주소를 넣어주세요.</p>
        <code>${BASE_URL}/chat/${escapeHtml(clientId)}</code>
      </section>
      <section class="card">
        <h2>현재 상태</h2>
        <pre id="status">${escapeHtml(JSON.stringify(status, null, 2))}</pre>
      </section>
    </main>
    <script>window.CLIENT_ID=${JSON.stringify(clientId)};</script>
    <script src="/public/connect.js"></script>
  `));
});

app.get('/auth/chzzk/start', (req, res) => {
  const clientId = safeClientId(req.query.clientId || '');
  if (!clientId || !loadConfig(clientId)) return res.status(404).send('client config not found');
  if (!CHZZK_CLIENT_ID || !CHZZK_CLIENT_SECRET) return res.status(500).send('CHZZK env missing');
  const statePayload = JSON.stringify({ clientId, nonce: crypto.randomBytes(10).toString('hex'), ts: Date.now() });
  const state = Buffer.from(statePayload).toString('base64url');
  const u = new URL('https://chzzk.naver.com/account-interlock');
  u.searchParams.set('clientId', CHZZK_CLIENT_ID);
  u.searchParams.set('redirectUri', CHZZK_REDIRECT_URI);
  u.searchParams.set('state', state);
  res.redirect(u.toString());
});

app.get('/auth/chzzk/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).send('code/state missing');
    let parsed;
    try { parsed = JSON.parse(Buffer.from(String(state), 'base64url').toString('utf8')); } catch { return res.status(400).send('invalid state'); }
    const clientId = safeClientId(parsed.clientId);
    if (!clientId || !loadConfig(clientId)) return res.status(404).send('client config not found');
    const token = await exchangeCode({ code: String(code), state: String(state) });
    saveToken(clientId, token);
    log(clientId, 'oauth token saved');
    try { await startChzzkSession(clientId); } catch (err) { log(clientId, 'auto start failed after login', err.body || err.message); }
    res.redirect(`/connect/${clientId}?login=success`);
  } catch (err) {
    res.status(500).send(`<pre>${escapeHtml(err.stack || err.message)}</pre>`);
  }
});

app.post('/api/connect/:clientId/start', async (req, res) => {
  const clientId = safeClientId(req.params.clientId);
  if (!loadConfig(clientId)) return res.status(404).json({ error: 'client config not found' });
  try {
    const result = await startChzzkSession(clientId);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.body || err.message });
  }
});

app.post('/api/connect/:clientId/stop', (req, res) => {
  const clientId = safeClientId(req.params.clientId);
  if (!loadConfig(clientId)) return res.status(404).json({ error: 'client config not found' });
  res.json({ ok: true, result: stopChzzkSession(clientId) });
});

app.post('/api/connect/:clientId/logout', async (req, res) => {
  const clientId = safeClientId(req.params.clientId);
  stopChzzkSession(clientId);
  removeToken(clientId);
  res.json({ ok: true, result: statusFor(clientId) });
});

app.post('/api/connect/:clientId/test', (req, res) => {
  const clientId = safeClientId(req.params.clientId);
  const message = {
    type: 'chat',
    id: `test-${Date.now()}`,
    nickname: '테스트유저',
    role: 'streamer',
    message: '채팅 오버레이 테스트 메시지입니다 🌱',
    badges: [{ type: 'test', imageUrl: '' }],
    timestamp: Date.now()
  };
  broadcast(clientId, message);
  res.json({ ok: true, message });
});

app.get('/api/connect/:clientId/status', (req, res) => {
  const clientId = safeClientId(req.params.clientId);
  res.json(statusFor(clientId));
});

app.get('/owner/:clientId', (req, res) => {
  const key = req.query.key || req.headers['x-admin-key'];
  const adminKey = process.env.ADMIN_KEY || INGEST_KEY;
  if (!adminKey || key !== adminKey) return res.status(401).send('owner key required');
  const clientId = safeClientId(req.params.clientId);
  res.json(statusFor(clientId, true));
});

app.get('/chat/:clientId', (req, res) => {
  const clientId = safeClientId(req.params.clientId);
  const config = loadConfig(clientId);
  if (!config) return res.status(404).send('client config not found');
  const html = fs.readFileSync(path.join(ROOT, 'public', 'chat.html'), 'utf8')
    .replace(/__CLIENT_ID__/g, clientId)
    .replace(/__CONFIG_JSON__/g, JSON.stringify(config).replace(/</g, '\\u003c'))
    .replace(/__WS_URL__/g, `${BASE_URL.replace(/^http/, 'ws')}/ws?clientId=${encodeURIComponent(clientId)}`);
  res.type('html').send(html);
});

server.listen(PORT, () => {
  console.log(`Server running on ${BASE_URL}`);
  console.log(`Connect: ${BASE_URL}/connect/pop`);
  console.log(`Overlay: ${BASE_URL}/chat/pop`);
});
