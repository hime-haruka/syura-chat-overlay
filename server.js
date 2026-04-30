import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import WebSocket from 'ws';
import crypto from 'crypto';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const DEFAULT_CLIENT_ID = process.env.DEFAULT_CLIENT_ID || 'pop';
const SESSION_CREATE_URL = process.env.CHZZK_SESSION_CREATE_URL || 'https://openapi.chzzk.naver.com/open/v1/sessions/auth/client';
const CHAT_SUBSCRIBE_URL = process.env.CHZZK_CHAT_SUBSCRIBE_URL || 'https://openapi.chzzk.naver.com/open/v1/sessions/events/subscribe/chat';
const CHZZK_AUTH_URL = process.env.CHZZK_AUTH_URL || 'https://chzzk.naver.com/account-interlock';
const CHZZK_TOKEN_URL = process.env.CHZZK_TOKEN_URL || 'https://openapi.chzzk.naver.com/auth/v1/token';
const CHZZK_APP_CLIENT_ID = process.env.CHZZK_APP_CLIENT_ID || process.env.CHZZK_CLIENT_ID || '';
const CHZZK_APP_CLIENT_SECRET = process.env.CHZZK_APP_CLIENT_SECRET || process.env.CHZZK_CLIENT_SECRET || '';
const CHZZK_REDIRECT_URI = process.env.CHZZK_REDIRECT_URI || 'https://syura-chat-overlay.onrender.com/auth/chzzk/callback';
const TOKEN_STORE_FILE = process.env.TOKEN_STORE_FILE || path.join(__dirname, '.data', 'chzzk-tokens.json');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const clients = new Map();
const oauthStates = new Map();
let tokenStore = loadTokenStore();

function loadTokenStore() {
  try {
    if (!fs.existsSync(TOKEN_STORE_FILE)) return {};
    return JSON.parse(fs.readFileSync(TOKEN_STORE_FILE, 'utf8')) || {};
  } catch { return {}; }
}
function saveTokenStore() {
  fs.mkdirSync(path.dirname(TOKEN_STORE_FILE), { recursive: true });
  fs.writeFileSync(TOKEN_STORE_FILE, JSON.stringify(tokenStore, null, 2));
}
function saveClientToken(clientId, tokenResponse) {
  const content = tokenResponse?.content || tokenResponse || {};
  tokenStore[clientId] = {
    accessToken: content.accessToken,
    refreshToken: content.refreshToken,
    tokenType: content.tokenType || 'Bearer',
    expiresIn: Number(content.expiresIn || 86400),
    scope: content.scope || '',
    savedAt: Date.now(),
    raw: tokenResponse
  };
  saveTokenStore();
}
function getStoredClientToken(clientId) {
  return tokenStore[clientId]?.accessToken || null;
}

function getState(clientId) {
  if (!clients.has(clientId)) {
    clients.set(clientId, {
      clientId,
      ws: null,
      reconnectTimer: null,
      sessionKey: null,
      status: 'idle',
      lastError: null,
      lastEventAt: null,
      shouldReconnect: false
    });
  }
  return clients.get(clientId);
}

function emitStatus(clientId) {
  const state = getState(clientId);
  io.to(clientId).emit('chzzk:status', {
    clientId,
    status: state.status,
    sessionKey: state.sessionKey,
    lastError: state.lastError,
    lastEventAt: state.lastEventAt
  });
}

async function getAccessTokenForClient(clientId) {
  const token = getStoredClientToken(clientId) || process.env[`CHZZK_ACCESS_TOKEN_${clientId}`] || process.env.CHZZK_ACCESS_TOKEN;
  if (!token || token === 'PUT_YOUR_CHZZK_ACCESS_TOKEN_HERE') {
    throw new Error(`CHZZK access token is missing for clientId=${clientId}. Open /login/${clientId} and login with CHZZK first.`);
  }
  return token;
}

async function chzzkFetch(url, token, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }

  if (!res.ok) {
    throw new Error(`CHZZK API ${res.status}: ${text}`);
  }
  return json;
}

function pickSessionUrl(response) {
  return response?.content?.url || response?.content?.socketUrl || response?.url || response?.socketUrl || null;
}

function pickSessionKey(packet) {
  if (packet?.type === 'SYSTEM' && packet?.data?.sessionKey) return packet.data.sessionKey;
  if (packet?.event === 'SYSTEM' && packet?.data?.sessionKey) return packet.data.sessionKey;
  if (packet?.data?.sessionKey) return packet.data.sessionKey;
  return null;
}

async function subscribeChatEvent(clientId, sessionKey, token) {
  const url = new URL(CHAT_SUBSCRIBE_URL);
  url.searchParams.set('sessionKey', sessionKey);
  await chzzkFetch(url.toString(), token, { method: 'POST' });
  const state = getState(clientId);
  state.status = 'chat_subscribed';
  state.lastError = null;
  emitStatus(clientId);
}

function normalizeRole(raw = {}) {
  const role = String(raw.role || raw.userRole || raw.badge || raw.grade || '').toLowerCase();
  const badges = raw.badges || raw.badgeList || [];
  const badgeText = JSON.stringify(badges).toLowerCase();

  if (role.includes('streamer') || role.includes('broadcaster') || role.includes('owner') || badgeText.includes('streamer')) return 'streamer';
  if (role.includes('manager') || role.includes('moderator') || role.includes('mod') || badgeText.includes('manager')) return 'manager';
  if (role.includes('subscriber') || role.includes('sub') || badgeText.includes('subscriber')) return 'subscriber';
  if (role.includes('follower') || role.includes('vip') || badgeText.includes('follower')) return 'follower';
  return 'common_user';
}

function normalizeChat(packet) {
  const data = packet?.data || packet?.body || packet || {};
  const profile = data.profile || data.user || data.sender || {};

  const nickname =
    data.nickname || data.nick || data.displayName || data.name ||
    profile.nickname || profile.nick || profile.displayName || profile.name || '익명';

  const message =
    data.message || data.msg || data.content || data.text || data.chat || '';

  const userId =
    data.userId || data.memberNo || data.uid || profile.userId || profile.memberNo || nickname;

  return {
    type: 'chat',
    clientId: data.clientId || DEFAULT_CLIENT_ID,
    id: data.id || data.msgId || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: Date.now(),
    nickname,
    userId: String(userId),
    message: String(message),
    role: normalizeRole({ ...data, ...profile }),
    profileImage: profile.profileImageUrl || profile.profileImage || data.profileImageUrl || data.profileImage || '',
    emotes: data.emotes || data.emoticons || data.extras?.emojis || [],
    raw: packet
  };
}

function normalizeDonation(packet) {
  const data = packet?.data || packet?.body || packet || {};
  const profile = data.profile || data.user || data.sender || {};
  const nickname = data.nickname || data.nick || data.displayName || profile.nickname || profile.name || '익명';

  return {
    type: 'donation',
    clientId: data.clientId || DEFAULT_CLIENT_ID,
    id: data.id || data.donationId || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: Date.now(),
    nickname,
    userId: String(data.userId || profile.userId || nickname),
    amount: Number(data.amount || data.payAmount || data.value || 0),
    currency: data.currency || 'KRW',
    message: String(data.message || data.msg || data.content || ''),
    raw: packet
  };
}

function isChatPacket(packet) {
  const t = String(packet?.type || packet?.event || packet?.listener || '').toUpperCase();
  return t === 'CHAT' || t === 'MESSAGE';
}

function isDonationPacket(packet) {
  const t = String(packet?.type || packet?.event || packet?.listener || '').toUpperCase();
  return t.includes('DONATION') || t.includes('DONATE') || t.includes('MISSION') || t.includes('TIP');
}

function handleChzzkPacket(clientId, packet) {
  const state = getState(clientId);
  const sessionKey = pickSessionKey(packet);

  if (sessionKey) {
    state.sessionKey = sessionKey;
    state.status = 'socket_connected_waiting_subscribe';
    state.lastError = null;
    emitStatus(clientId);

    getAccessTokenForClient(clientId)
      .then((token) => subscribeChatEvent(clientId, sessionKey, token))
      .catch((error) => {
        state.status = 'subscribe_failed';
        state.lastError = error.message;
        emitStatus(clientId);
      });
    return;
  }

  if (isChatPacket(packet)) {
    const payload = normalizeChat(packet);
    payload.clientId = clientId;
    state.lastEventAt = Date.now();
    io.to(clientId).emit('chzzk:chat', payload);
    return;
  }

  if (isDonationPacket(packet)) {
    const payload = normalizeDonation(packet);
    payload.clientId = clientId;
    state.lastEventAt = Date.now();
    io.to(clientId).emit('chzzk:donation', payload);
  }
}

async function connectChzzk(clientId = DEFAULT_CLIENT_ID) {
  const state = getState(clientId);
  state.shouldReconnect = true;

  if (state.ws && state.ws.readyState === WebSocket.OPEN) return;
  if (state.ws) {
    try { state.ws.close(); } catch {}
  }

  const token = await getAccessTokenForClient(clientId);

  state.status = 'creating_session';
  state.lastError = null;
  emitStatus(clientId);

  const session = await chzzkFetch(SESSION_CREATE_URL, token, { method: 'GET' });
  const socketUrl = pickSessionUrl(session);
  if (!socketUrl) throw new Error(`Cannot find socket URL from CHZZK response: ${JSON.stringify(session)}`);

  state.status = 'socket_connecting';
  emitStatus(clientId);

  const ws = new WebSocket(socketUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  state.ws = ws;

  ws.on('open', () => {
    state.status = 'socket_connected_waiting_session_key';
    state.lastError = null;
    emitStatus(clientId);
  });

  ws.on('message', (buf) => {
    const text = buf.toString('utf8');
    let packet;
    try { packet = JSON.parse(text); } catch { packet = { type: 'RAW', data: text }; }
    io.to(clientId).emit('chzzk:raw', packet);
    handleChzzkPacket(clientId, packet);
  });

  ws.on('error', (error) => {
    state.status = 'socket_error';
    state.lastError = error.message;
    emitStatus(clientId);
  });

  ws.on('close', () => {
    state.ws = null;
    state.sessionKey = null;
    state.status = 'socket_closed';
    emitStatus(clientId);

    if (state.shouldReconnect) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = setTimeout(() => {
        connectChzzk(clientId).catch((error) => {
          state.status = 'reconnect_failed';
          state.lastError = error.message;
          emitStatus(clientId);
        });
      }, 3000);
    }
  });
}

function disconnectChzzk(clientId = DEFAULT_CLIENT_ID) {
  const state = getState(clientId);
  state.shouldReconnect = false;
  clearTimeout(state.reconnectTimer);
  if (state.ws) {
    try { state.ws.close(); } catch {}
  }
  state.ws = null;
  state.sessionKey = null;
  state.status = 'disconnected';
  emitStatus(clientId);
}

io.on('connection', (socket) => {
  const clientId = String(socket.handshake.query.clientId || DEFAULT_CLIENT_ID);
  socket.join(clientId);
  emitStatus(clientId);
});

app.get('/', (req, res) => res.redirect(`/chat/${DEFAULT_CLIENT_ID}`));
app.get('/chat/:clientId', (req, res) => res.sendFile(path.join(__dirname, 'public', 'chat.html')));
app.get('/admin/:clientId?', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/login/:clientId?', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

app.get('/auth/chzzk', (req, res) => {
  const clientId = String(req.query.clientId || DEFAULT_CLIENT_ID).trim() || DEFAULT_CLIENT_ID;
  if (!CHZZK_APP_CLIENT_ID) return res.status(500).send('Missing CHZZK_APP_CLIENT_ID env');
  const state = `${clientId}.${crypto.randomBytes(18).toString('base64url')}`;
  oauthStates.set(state, { clientId, createdAt: Date.now() });
  const url = new URL(CHZZK_AUTH_URL);
  url.searchParams.set('clientId', CHZZK_APP_CLIENT_ID);
  url.searchParams.set('redirectUri', CHZZK_REDIRECT_URI);
  url.searchParams.set('state', state);
  res.redirect(url.toString());
});

app.get('/auth/chzzk/callback', async (req, res) => {
  const code = String(req.query.code || '');
  const state = String(req.query.state || '');
  const stateData = oauthStates.get(state);
  if (!code || !state || !stateData) return res.status(400).send('Invalid CHZZK callback. code/state is missing or expired.');
  oauthStates.delete(state);
  const clientId = stateData.clientId;
  try {
    if (!CHZZK_APP_CLIENT_ID || !CHZZK_APP_CLIENT_SECRET) throw new Error('Missing CHZZK_APP_CLIENT_ID or CHZZK_APP_CLIENT_SECRET env');
    const tokenResponse = await chzzkFetch(CHZZK_TOKEN_URL, '', {
      method: 'POST',
      body: JSON.stringify({ grantType: 'authorization_code', clientId: CHZZK_APP_CLIENT_ID, clientSecret: CHZZK_APP_CLIENT_SECRET, code, state })
    });
    saveClientToken(clientId, tokenResponse);
    connectChzzk(clientId).catch((error) => {
      const st = getState(clientId); st.status = 'connect_after_login_failed'; st.lastError = error.message; emitStatus(clientId);
    });
    res.redirect(`/login/${encodeURIComponent(clientId)}?login=success`);
  } catch (error) {
    const st = getState(clientId); st.status = 'login_failed'; st.lastError = error.message; emitStatus(clientId);
    res.status(500).send(`CHZZK login failed: ${error.message}`);
  }
});

app.get('/api/auth/status/:clientId', (req, res) => {
  const clientId = req.params.clientId || DEFAULT_CLIENT_ID;
  const s = getState(clientId);
  const saved = tokenStore[clientId];
  res.json({ ok: true, clientId, hasToken: Boolean(saved?.accessToken || process.env[`CHZZK_ACCESS_TOKEN_${clientId}`] || process.env.CHZZK_ACCESS_TOKEN), tokenSavedAt: saved?.savedAt || null, status: s.status, sessionKey: s.sessionKey, lastError: s.lastError, obsUrl: `/chat/${clientId}` });
});

app.get('/api/status/:clientId', (req, res) => {
  const s = getState(req.params.clientId);
  res.json({ clientId: s.clientId, status: s.status, sessionKey: s.sessionKey, lastError: s.lastError, lastEventAt: s.lastEventAt });
});

app.post('/api/connect/:clientId', async (req, res) => {
  const clientId = req.params.clientId || DEFAULT_CLIENT_ID;
  try {
    await connectChzzk(clientId);
    res.json({ ok: true, clientId, status: getState(clientId).status });
  } catch (error) {
    const state = getState(clientId);
    state.status = 'connect_failed';
    state.lastError = error.message;
    emitStatus(clientId);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/disconnect/:clientId', (req, res) => {
  const clientId = req.params.clientId || DEFAULT_CLIENT_ID;
  disconnectChzzk(clientId);
  res.json({ ok: true, clientId });
});

app.post('/api/test/chat/:clientId', (req, res) => {
  const clientId = req.params.clientId || DEFAULT_CLIENT_ID;
  const payload = {
    type: 'chat', clientId, id: `test-${Date.now()}`, createdAt: Date.now(),
    nickname: req.body.nickname || '치지직테스트', userId: 'test-user', role: req.body.role || 'streamer',
    message: req.body.message || '치지직 채팅 테스트입니다 {:d_51:}',
    emotes: req.body.emotes || []
  };
  io.to(clientId).emit('chzzk:chat', payload);
  res.json({ ok: true, payload });
});

app.post('/api/test/donation/:clientId', (req, res) => {
  const clientId = req.params.clientId || DEFAULT_CLIENT_ID;
  const payload = {
    type: 'donation', clientId, id: `donation-test-${Date.now()}`, createdAt: Date.now(),
    nickname: req.body.nickname || '후원테스트', userId: 'test-donor',
    amount: Number(req.body.amount || 1000), currency: 'KRW',
    message: req.body.message || '후원 메시지 테스트입니다'
  };
  io.to(clientId).emit('chzzk:donation', payload);
  res.json({ ok: true, payload });
});

server.listen(PORT, () => {
  console.log(`CHZZK StreamElements overlay server listening on ${PORT}`);
  if (process.env.CHZZK_AUTOCONNECT === 'true') {
    connectChzzk(DEFAULT_CLIENT_ID).catch((error) => console.error(error));
  }
});
