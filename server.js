import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import chzzkIo from 'socket.io-client';
import crypto from 'crypto';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const DEFAULT_CLIENT_ID = process.env.DEFAULT_CLIENT_ID || 'pop';
const SESSION_CREATE_URL = process.env.CHZZK_SESSION_CREATE_URL || 'https://openapi.chzzk.naver.com/open/v1/sessions/auth';
const CHAT_SUBSCRIBE_URL = process.env.CHZZK_CHAT_SUBSCRIBE_URL || 'https://openapi.chzzk.naver.com/open/v1/sessions/events/subscribe/chat';
const DONATION_SUBSCRIBE_URL = process.env.CHZZK_DONATION_SUBSCRIBE_URL || 'https://openapi.chzzk.naver.com/open/v1/sessions/events/subscribe/donation';
const CHZZK_AUTH_URL = process.env.CHZZK_AUTH_URL || 'https://chzzk.naver.com/account-interlock';
const CHZZK_TOKEN_URL = process.env.CHZZK_TOKEN_URL || 'https://openapi.chzzk.naver.com/auth/v1/token';
const CHZZK_APP_CLIENT_ID = process.env.CHZZK_APP_CLIENT_ID || process.env.CHZZK_CLIENT_ID || '';
const CHZZK_APP_CLIENT_SECRET = process.env.CHZZK_APP_CLIENT_SECRET || process.env.CHZZK_CLIENT_SECRET || '';
const CHZZK_REDIRECT_URI = process.env.CHZZK_REDIRECT_URI || 'https://syura-chat-overlay.onrender.com/auth/chzzk/callback';
const TOKEN_STORE_FILE = process.env.TOKEN_STORE_FILE || path.join(__dirname, '.data', 'chzzk-tokens.json');
const MAX_BACKLOG = Number(process.env.MAX_BACKLOG || 20);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const clients = new Map();
const oauthStates = new Map();
let tokenStore = loadTokenStore();

function log(clientId, ...args) {
  console.log(`[${new Date().toISOString()}] [${clientId}]`, ...args);
}

function loadTokenStore() {
  try {
    if (!fs.existsSync(TOKEN_STORE_FILE)) return {};
    return JSON.parse(fs.readFileSync(TOKEN_STORE_FILE, 'utf8')) || {};
  } catch {
    return {};
  }
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

function getState(clientId) {
  if (!clients.has(clientId)) {
    clients.set(clientId, {
      clientId,
      socket: null,
      reconnectTimer: null,
      sessionKey: null,
      status: 'idle',
      lastError: null,
      lastEventAt: null,
      lastRawEvent: null,
      subscribed: [],
      shouldReconnect: false,
      backlog: []
    });
  }
  return clients.get(clientId);
}

function publicStatus(clientId) {
  const s = getState(clientId);
  const saved = tokenStore[clientId];
  return {
    ok: true,
    clientId,
    hasToken: Boolean(saved?.accessToken || process.env[`CHZZK_ACCESS_TOKEN_${clientId}`] || process.env.CHZZK_ACCESS_TOKEN),
    tokenSavedAt: saved?.savedAt || null,
    status: s.status,
    sessionKey: s.sessionKey,
    subscribed: s.subscribed,
    lastError: s.lastError,
    lastEventAt: s.lastEventAt,
    lastRawEvent: s.lastRawEvent,
    obsUrl: `/chat/${clientId}`
  };
}

function emitStatus(clientId) {
  io.to(clientId).emit('chzzk:status', publicStatus(clientId));
}

async function getAccessTokenForClient(clientId) {
  const token = tokenStore[clientId]?.accessToken || process.env[`CHZZK_ACCESS_TOKEN_${clientId}`] || process.env.CHZZK_ACCESS_TOKEN;
  if (!token || token === 'PUT_YOUR_CHZZK_ACCESS_TOKEN_HERE') {
    throw new Error(`CHZZK access token is missing for clientId=${clientId}. Open /login/${clientId} and login first.`);
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

  if (!res.ok) throw new Error(`CHZZK API ${res.status}: ${text}`);
  return json;
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

function pickSessionUrl(response) {
  return response?.content?.url || response?.content?.socketUrl || response?.url || response?.socketUrl || null;
}

function unwrapPacket(input) {
  let packet = parseMaybeJson(input);
  if (typeof packet === 'string') return { type: 'RAW', data: packet };

  if (packet?.data && typeof packet.data === 'string') {
    packet = { ...packet, data: parseMaybeJson(packet.data) };
  }
  if (packet?.body && typeof packet.body === 'string') {
    packet = { ...packet, body: parseMaybeJson(packet.body) };
  }
  return packet || { type: 'EMPTY', data: null };
}

function pickSessionKey(packet) {
  const p = unwrapPacket(packet);
  const d = parseMaybeJson(p?.data);
  if (d?.sessionKey) return d.sessionKey;
  if (d?.data?.sessionKey) return d.data.sessionKey;
  if (p?.sessionKey) return p.sessionKey;
  return null;
}

async function subscribeEvent(clientId, sessionKey, token, endpoint, eventName) {
  const url = new URL(endpoint);
  url.searchParams.set('sessionKey', sessionKey);
  await chzzkFetch(url.toString(), token, { method: 'POST' });

  const s = getState(clientId);
  if (!s.subscribed.includes(eventName)) s.subscribed.push(eventName);
  s.status = `${eventName.toLowerCase()}_subscribed`;
  s.lastError = null;
  emitStatus(clientId);
}

async function subscribeAll(clientId, sessionKey, token) {
  await subscribeEvent(clientId, sessionKey, token, CHAT_SUBSCRIBE_URL, 'CHAT');
  try {
    await subscribeEvent(clientId, sessionKey, token, DONATION_SUBSCRIBE_URL, 'DONATION');
  } catch (error) {
    log(clientId, 'donation subscribe skipped:', error.message);
  }
  const s = getState(clientId);
  s.status = 'subscribed';
  emitStatus(clientId);
}

function normalizeRole(data = {}) {
  const profile = parseMaybeJson(data.profile) || {};
  const role = String(
    data.userRoleCode || profile.userRoleCode || data.role || data.userRole || data.badge || data.grade || ''
  ).toLowerCase();
  const badgeText = JSON.stringify(data.badges || profile.badges || data.badgeList || []).toLowerCase();

  if (role.includes('streamer') || role.includes('broadcaster') || role.includes('owner') || badgeText.includes('streamer')) return 'streamer';
  if (role.includes('manager') || role.includes('moderator') || role.includes('mod') || role.includes('streaming_channel_manager') || role.includes('streaming_chat_manager') || badgeText.includes('manager')) return 'manager';
  if (role.includes('subscriber') || role.includes('sub') || badgeText.includes('subscriber')) return 'subscriber';
  if (role.includes('follower') || role.includes('vip') || badgeText.includes('follower')) return 'follower';
  return 'common_user';
}

function normalizeEmojis(emojis) {
  const parsed = parseMaybeJson(emojis);
  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === 'object') return Object.entries(parsed).map(([code, url]) => ({ code, name: code, url }));
  return [];
}

function normalizeChat(packet) {
  const p = unwrapPacket(packet);
  const data = parseMaybeJson(p?.data || p?.body || p) || {};
  const profile = parseMaybeJson(data.profile) || parseMaybeJson(data.user) || parseMaybeJson(data.sender) || {};

  const nickname =
    data.nickname || data.nick || data.displayName || data.name ||
    profile.nickname || profile.nick || profile.displayName || profile.name || '익명';

  const message = data.content || data.message || data.msg || data.text || data.chat || '';
  const userId = data.senderChannelId || data.userId || data.memberNo || data.uid || profile.userId || profile.memberNo || nickname;

  return {
    type: 'chat',
    clientId: data.clientId || DEFAULT_CLIENT_ID,
    id: data.messageId || data.id || data.msgId || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: Number(data.messageTime || Date.now()),
    nickname,
    userId: String(userId),
    message: String(message),
    role: normalizeRole({ ...data, profile }),
    profileImage: profile.profileImageUrl || profile.profileImage || data.profileImageUrl || data.profileImage || '',
    emotes: normalizeEmojis(data.emojis || data.emotes || data.emoticons || data.extras?.emojis),
    raw: p
  };
}

function normalizeDonation(packet) {
  const p = unwrapPacket(packet);
  const data = parseMaybeJson(p?.data || p?.body || p) || {};
  return {
    type: 'donation',
    clientId: data.clientId || DEFAULT_CLIENT_ID,
    id: data.donationId || data.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: Date.now(),
    nickname: data.donatorNickname || data.nickname || data.nick || data.displayName || '익명',
    userId: String(data.donatorChannelId || data.userId || data.nickname || 'donator'),
    amount: Number(data.payAmount || data.amount || data.value || 0),
    currency: 'CHEEZE',
    message: String(data.donationText || data.message || data.msg || data.content || ''),
    emotes: normalizeEmojis(data.emojis),
    raw: p
  };
}

function rememberAndEmit(clientId, eventName, payload) {
  const s = getState(clientId);
  s.lastEventAt = Date.now();
  s.backlog.push({ eventName, payload, at: Date.now() });
  if (s.backlog.length > MAX_BACKLOG) s.backlog.splice(0, s.backlog.length - MAX_BACKLOG);

  // 1) 정상 room emit
  io.to(clientId).emit(eventName, payload);

  // 2) clientId 전용 이벤트명 emit: room join이 꼬여도 /chat/:clientId가 반드시 받을 수 있게 보강
  io.emit(`${eventName}:${clientId}`, payload);

  // 3) 디버그 페이지용
  io.to(`debug:${clientId}`).emit('debug:event', { eventName, clientEventName: `${eventName}:${clientId}`, payload, at: Date.now() });
}

function handleChzzkPacket(clientId, packet) {
  const p = unwrapPacket(packet);
  const s = getState(clientId);
  s.lastRawEvent = p;

  const sessionKey = pickSessionKey(p);
  if (sessionKey) {
    s.sessionKey = sessionKey;
    s.status = 'socket_connected_waiting_subscribe';
    s.lastError = null;
    emitStatus(clientId);
    getAccessTokenForClient(clientId)
      .then(token => subscribeAll(clientId, sessionKey, token))
      .catch(error => {
        s.status = 'subscribe_failed';
        s.lastError = error.message;
        emitStatus(clientId);
      });
    return;
  }

  const type = String(p?.type || p?.event || p?.listener || '').toUpperCase();
  if (type === 'CHAT' || type === 'MESSAGE') {
    const payload = normalizeChat(p);
    payload.clientId = clientId;
    rememberAndEmit(clientId, 'chzzk:chat', payload);
    log(clientId, 'CHAT', payload.nickname, payload.message);
    return;
  }

  if (type.includes('DONATION') || type.includes('DONATE') || type.includes('TIP') || type.includes('MISSION')) {
    const payload = normalizeDonation(p);
    payload.clientId = clientId;
    rememberAndEmit(clientId, 'chzzk:donation', payload);
    log(clientId, 'DONATION', payload.nickname, payload.amount, payload.message);
    return;
  }

  if (type === 'SYSTEM') {
    const d = parseMaybeJson(p.data) || {};
    if (d.type === 'subscribed') {
      if (!s.subscribed.includes(d.data?.eventType)) s.subscribed.push(d.data?.eventType);
      s.status = 'subscribed';
      emitStatus(clientId);
    }
  }
}

function connectSocketIoSession(clientId, socketUrl) {
  const socket = chzzkIo(socketUrl, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    timeout: 10000
  });

  const originalOnevent = socket.onevent;
  socket.onevent = function(packet) {
    const args = packet?.data || [];
    const eventName = args[0];
    const eventPayload = args.length > 1 ? args[1] : null;
    if (eventName) {
      handleChzzkPacket(clientId, { type: eventName, data: parseMaybeJson(eventPayload) });
    }
    return originalOnevent.call(this, packet);
  };

  socket.on('SYSTEM', data => handleChzzkPacket(clientId, { type: 'SYSTEM', data: parseMaybeJson(data) }));
  socket.on('CHAT', data => handleChzzkPacket(clientId, { type: 'CHAT', data: parseMaybeJson(data) }));
  socket.on('DONATION', data => handleChzzkPacket(clientId, { type: 'DONATION', data: parseMaybeJson(data) }));

  return socket;
}

async function connectChzzk(clientId = DEFAULT_CLIENT_ID) {
  const s = getState(clientId);
  s.shouldReconnect = true;

  if (s.socket?.connected) return;
  if (s.socket) {
    try { s.socket.close(); } catch {}
    try { s.socket.disconnect(); } catch {}
  }

  const token = await getAccessTokenForClient(clientId);
  s.status = 'creating_session';
  s.lastError = null;
  s.subscribed = [];
  emitStatus(clientId);

  const session = await chzzkFetch(SESSION_CREATE_URL, token, { method: 'GET' });
  const socketUrl = pickSessionUrl(session);
  if (!socketUrl) throw new Error(`Cannot find socket URL from CHZZK response: ${JSON.stringify(session)}`);

  log(clientId, 'session url issued');
  s.status = 'socket_connecting';
  emitStatus(clientId);

  const socket = connectSocketIoSession(clientId, socketUrl);
  s.socket = socket;

  socket.on('connect', () => {
    s.status = 'socket_connected_waiting_session_key';
    s.lastError = null;
    emitStatus(clientId);
    log(clientId, 'socket connected');
  });

  socket.on('connect_error', error => {
    s.status = 'socket_error';
    s.lastError = error?.message || String(error);
    emitStatus(clientId);
    log(clientId, 'connect_error', s.lastError);
  });

  socket.on('error', error => {
    s.status = 'socket_error';
    s.lastError = error?.message || String(error);
    emitStatus(clientId);
    log(clientId, 'socket error', s.lastError);
  });

  socket.on('disconnect', reason => {
    s.socket = null;
    s.sessionKey = null;
    s.status = `socket_closed:${reason || 'unknown'}`;
    emitStatus(clientId);
    log(clientId, 'socket closed', reason);

    if (s.shouldReconnect) {
      clearTimeout(s.reconnectTimer);
      s.reconnectTimer = setTimeout(() => {
        connectChzzk(clientId).catch(error => {
          s.status = 'reconnect_failed';
          s.lastError = error.message;
          emitStatus(clientId);
        });
      }, 3000);
    }
  });
}

function disconnectChzzk(clientId = DEFAULT_CLIENT_ID) {
  const s = getState(clientId);
  s.shouldReconnect = false;
  clearTimeout(s.reconnectTimer);
  if (s.socket) {
    try { s.socket.close(); } catch {}
    try { s.socket.disconnect(); } catch {}
  }
  s.socket = null;
  s.sessionKey = null;
  s.status = 'disconnected';
  emitStatus(clientId);
}

function pickClientIdFromSocket(socket) {
  const q = socket.handshake.query || {};
  const a = socket.handshake.auth || {};
  const referer = String(socket.handshake.headers?.referer || '');
  const match = referer.match(/\/(?:chat|login|debug)\/([^/?#]+)/);
  return String(q.clientId || a.clientId || (match ? decodeURIComponent(match[1]) : '') || DEFAULT_CLIENT_ID);
}

io.on('connection', socket => {
  const clientId = pickClientIdFromSocket(socket);
  socket.join(clientId);
  socket.join(`debug:${clientId}`);

  const roomSize = io.sockets.adapter.rooms.get(clientId)?.size || 0;
  log(clientId, 'overlay/admin socket connected', socket.id, 'roomSize=', roomSize);

  socket.emit('chzzk:status', publicStatus(clientId));
  io.to(`debug:${clientId}`).emit('debug:socket', { type: 'connected', socketId: socket.id, clientId, roomSize, at: Date.now() });

  const s = getState(clientId);
  for (const item of s.backlog.slice(-10)) {
    socket.emit(item.eventName, item.payload);
    socket.emit(`${item.eventName}:${clientId}`, item.payload);
  }

  socket.on('disconnect', reason => {
    const size = io.sockets.adapter.rooms.get(clientId)?.size || 0;
    log(clientId, 'socket disconnected', socket.id, reason, 'roomSize=', size);
    io.to(`debug:${clientId}`).emit('debug:socket', { type: 'disconnected', socketId: socket.id, clientId, reason, roomSize: size, at: Date.now() });
  });
});

app.get('/', (req, res) => res.redirect(`/login/${DEFAULT_CLIENT_ID}`));
app.get('/chat/:clientId', (req, res) => res.sendFile(path.join(__dirname, 'public', 'chat.html')));
app.get('/admin/:clientId?', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/login/:clientId?', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/debug/:clientId?', (req, res) => res.sendFile(path.join(__dirname, 'public', 'debug.html')));

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
      body: JSON.stringify({
        grantType: 'authorization_code',
        clientId: CHZZK_APP_CLIENT_ID,
        clientSecret: CHZZK_APP_CLIENT_SECRET,
        code,
        state
      })
    });

    saveClientToken(clientId, tokenResponse);
    connectChzzk(clientId).catch(error => {
      const s = getState(clientId);
      s.status = 'connect_after_login_failed';
      s.lastError = error.message;
      emitStatus(clientId);
    });

    res.redirect(`/login/${encodeURIComponent(clientId)}?login=success`);
  } catch (error) {
    const s = getState(clientId);
    s.status = 'login_failed';
    s.lastError = error.message;
    emitStatus(clientId);
    res.status(500).send(`CHZZK login failed: ${error.message}`);
  }
});

app.get('/api/auth/status/:clientId', (req, res) => res.json(publicStatus(req.params.clientId || DEFAULT_CLIENT_ID)));
app.get('/api/status/:clientId', (req, res) => res.json(publicStatus(req.params.clientId || DEFAULT_CLIENT_ID)));

app.get('/api/debug/:clientId', (req, res) => {
  const clientId = req.params.clientId || DEFAULT_CLIENT_ID;
  const room = io.sockets.adapter.rooms.get(clientId);
  const debugRoom = io.sockets.adapter.rooms.get(`debug:${clientId}`);
  res.json({
    ...publicStatus(clientId),
    roomSize: room?.size || 0,
    debugRoomSize: debugRoom?.size || 0,
    backlog: getState(clientId).backlog.slice(-10)
  });
});

app.post('/api/connect/:clientId', async (req, res) => {
  const clientId = req.params.clientId || DEFAULT_CLIENT_ID;
  try {
    await connectChzzk(clientId);
    res.json(publicStatus(clientId));
  } catch (error) {
    const s = getState(clientId);
    s.status = 'connect_failed';
    s.lastError = error.message;
    emitStatus(clientId);
    res.status(500).json(publicStatus(clientId));
  }
});

app.post('/api/disconnect/:clientId', (req, res) => {
  const clientId = req.params.clientId || DEFAULT_CLIENT_ID;
  disconnectChzzk(clientId);
  res.json(publicStatus(clientId));
});

app.post('/api/test/chat/:clientId', (req, res) => {
  const clientId = req.params.clientId || DEFAULT_CLIENT_ID;
  const payload = {
    type: 'chat',
    clientId,
    id: `test-${Date.now()}`,
    createdAt: Date.now(),
    nickname: req.body.nickname || '치지직테스트',
    userId: 'test-user',
    role: req.body.role || 'streamer',
    message: req.body.message || '치지직 채팅 테스트입니다 {:d_51:}',
    emotes: req.body.emotes || [{ code: '{:d_51:}', name: '{:d_51:}', url: 'https://ssl.pstatic.net/static/nng/glive/icon/d_51.png' }]
  };
  rememberAndEmit(clientId, 'chzzk:chat', payload);
  res.json({ ok: true, payload, status: publicStatus(clientId) });
});

app.post('/api/test/donation/:clientId', (req, res) => {
  const clientId = req.params.clientId || DEFAULT_CLIENT_ID;
  const payload = {
    type: 'donation',
    clientId,
    id: `donation-test-${Date.now()}`,
    createdAt: Date.now(),
    nickname: req.body.nickname || '치즈테스트',
    userId: 'test-donor',
    amount: Number(req.body.amount || 1000),
    currency: 'CHEEZE',
    message: req.body.message || '방송 전 치즈 알림 테스트입니다'
  };
  rememberAndEmit(clientId, 'chzzk:donation', payload);
  res.json({ ok: true, payload, status: publicStatus(clientId) });
});

app.post('/api/test/original/:clientId/:button', (req, res) => {
  const clientId = req.params.clientId || DEFAULT_CLIENT_ID;
  const button = req.params.button || 'testtestMessage';
  const detail = { listener: 'widget-button', event: { field: button } };
  rememberAndEmit(clientId, 'se:event', detail);
  res.json({ ok: true, detail, status: publicStatus(clientId) });
});

server.listen(PORT, () => {
  console.log(`CHZZK StreamElements overlay server listening on ${PORT}`);
  if (process.env.CHZZK_AUTOCONNECT === 'true') {
    connectChzzk(DEFAULT_CLIENT_ID).catch(console.error);
  }
});
