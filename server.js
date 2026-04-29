import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import chzzkIo from 'socket.io-client';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 10000;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
const CHZZK_CLIENT_ID = process.env.CHZZK_CLIENT_ID;
const CHZZK_CLIENT_SECRET = process.env.CHZZK_CLIENT_SECRET;
const CHZZK_REDIRECT_URI = process.env.CHZZK_REDIRECT_URI || `${PUBLIC_BASE_URL}/auth/chzzk/callback`;
const OPEN_API = 'https://openapi.chzzk.naver.com';
const AUTH_PAGE = 'https://chzzk.naver.com/account-interlock';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/static', express.static(path.join(__dirname, 'public')));

const runtime = new Map();
const states = new Map();

function now() { return new Date().toISOString(); }
function safeClientId(id) { return String(id || '').replace(/[^a-zA-Z0-9_-]/g, ''); }
function tokenPath(clientId) { return path.join(__dirname, 'data', `${clientId}.token.json`); }
function configPath(clientId) { return path.join(__dirname, 'configs', `${clientId}.json`); }

function defaultConfig(id) {
  return {
    clientId: id,
    displayName: id,
    alignMessages: 'bottom',
    msgHideOpt: false,
    msgHide: 7,
    msgLimit: false,
    msgLimitAmount: 4,
    namesFont: 'Quicksand',
    msgFont: 'Quicksand',
    namesBold: '700',
    msgBold: '700',
    namesSize: 16,
    msgSize: 16,
    namescolor: '#ffffff',
    msgcolor: '#47843b',
    msgback: '#ffffff',
    textback: 'rgba(173, 143, 255, 0)',
    badgesContcolor: '#bce78e',
    badgescolor: '#ffffff',
    bordercol: '#97d561',
    frog1: '#bce78e',
    lily1: '#f592b4',
    lilypad: '#82c080'
  };
}

async function loadConfig(clientId) {
  const id = safeClientId(clientId || 'pop');
  const candidates = [
    path.join(__dirname, 'configs', `${id}.json`),
    path.join(process.cwd(), 'configs', `${id}.json`),
    path.join(__dirname, 'config', `${id}.json`),
    path.join(process.cwd(), 'config', `${id}.json`)
  ];

  for (const p of candidates) {
    try {
      const raw = await fs.readFile(p, 'utf8');
      return { ...defaultConfig(id), ...JSON.parse(raw), clientId: id };
    } catch (e) {
      // Try next path. If every path fails, fall back to a usable default.
    }
  }

  // Do not block client login/OBS because of a missing config file.
  // This keeps /connect/:clientId and /chat/:clientId usable immediately.
  return defaultConfig(id);
}

async function renderWidgetCss(config) {
  const template = await fs.readFile(path.join(__dirname, 'public', 'original-widget.css'), 'utf8');
  const fallback = {
    namesSize: 16, msgSize: 16, msgHide: 7, alertSize: 16,
    msgback: '#ffffff', nameback: '#97d561', textback: 'rgba(173,143,255,0)',
    namesFont: 'Quicksand', msgFont: 'Quicksand', namesBold: '700', msgBold: '700',
    namescolor: '#ffffff', msgcolor: '#47843b', accentcolor: '#dcbb96', alerttext: '#47843b',
    alertsboxcol: '#ffffff', badgesContcolor: '#bce78e', badgescolor: '#ffffff', bordercol: '#97d561',
    frog1: '#bce78e', frog2: config.frog2 || config.frog1 || '#bce78e', lily1: '#f592b4', lily2: '#f7b9cf', lily3: '#ffd4e3', lilypad: '#82c080',
    alertnames: '#47843b', alerticon: '', msgLimitAmount: 4
  };
  const valueOf = (key) => {
    const clean = String(key).trim();
    return config[clean] ?? config[clean.replace(/-([a-z])/g, (_,c)=>c.toUpperCase())] ?? fallback[clean] ?? '';
  };
  const css = template.replace(/\{([^}]+)\}/g, (_, key) => String(valueOf(key)));
  return `@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(config.namesFont || 'Quicksand')}:wght@400;500;600;700&display=swap');\nhtml,body{width:100%;height:100%;margin:0;background:transparent;overflow:hidden;}\n${css}`;
}
async function readJsonMaybe(p) {
  try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return null; }
}
async function writeJson(p, data) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(data, null, 2), 'utf8');
}
async function deleteFileMaybe(p) { try { await fs.unlink(p); } catch {} }

function getState(clientId) {
  const id = safeClientId(clientId);
  if (!runtime.has(id)) {
    runtime.set(id, {
      clientId: id,
      status: 'idle',
      lastError: null,
      lastEventAt: null,
      startedAt: null,
      sessionKey: null,
      channelId: null,
      channelName: null,
      socket: null,
      debug: []
    });
  }
  return runtime.get(id);
}
function logState(clientId, message, extra = null) {
  const st = getState(clientId);
  const item = { at: now(), message, extra };
  st.debug.unshift(item);
  st.debug = st.debug.slice(0, 80);
  st.lastEventAt = item.at;
  console.log(`[${clientId}] ${message}`, extra ?? '');
}
function setStatus(clientId, status, extra = null) {
  const st = getState(clientId);
  st.status = status;
  st.lastError = null;
  logState(clientId, `status:${status}`, extra);
}
function setError(clientId, error) {
  const st = getState(clientId);
  st.status = 'error';
  st.lastError = error?.message || String(error);
  logState(clientId, 'error', st.lastError);
}

function emitChat(clientId, payload) {
  io.to(`chat:${clientId}`).emit('chat-message', payload);
}

function extractApiContent(json) {
  if (!json) return null;
  return json.content ?? json.data ?? json;
}

async function chzzkFetch(urlPath, options = {}, token = null) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${OPEN_API}${urlPath}`, { ...options, headers });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`CHZZK API ${res.status}: ${JSON.stringify(json)}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function exchangeCode(code, stateValue) {
  const body = {
    grantType: 'authorization_code',
    clientId: CHZZK_CLIENT_ID,
    clientSecret: CHZZK_CLIENT_SECRET,
    code,
    state: stateValue
  };
  const json = await chzzkFetch('/auth/v1/token', { method: 'POST', body: JSON.stringify(body) });
  return extractApiContent(json);
}
async function refreshTokenIfNeeded(clientId, tokenData) {
  // access token lifetime is short. This refreshes when expiresAt is within 5 min.
  if (!tokenData?.refreshToken) return tokenData;
  if (tokenData.expiresAt && Date.now() < tokenData.expiresAt - 5 * 60 * 1000) return tokenData;
  try {
    const body = {
      grantType: 'refresh_token',
      clientId: CHZZK_CLIENT_ID,
      clientSecret: CHZZK_CLIENT_SECRET,
      refreshToken: tokenData.refreshToken
    };
    const json = await chzzkFetch('/auth/v1/token', { method: 'POST', body: JSON.stringify(body) });
    const content = extractApiContent(json);
    const next = normalizeToken(content, tokenData);
    await writeJson(tokenPath(clientId), next);
    logState(clientId, 'token refreshed');
    return next;
  } catch (e) {
    logState(clientId, 'token refresh failed', e.message);
    return tokenData;
  }
}
function normalizeToken(content, prev = {}) {
  const expiresIn = Number(content?.expiresIn || content?.expires_in || 86400);
  return {
    ...prev,
    accessToken: content?.accessToken || content?.access_token || prev.accessToken,
    refreshToken: content?.refreshToken || content?.refresh_token || prev.refreshToken,
    tokenType: content?.tokenType || content?.token_type || 'Bearer',
    expiresAt: Date.now() + expiresIn * 1000,
    savedAt: now()
  };
}

async function getMe(clientId, accessToken) {
  try {
    const json = await chzzkFetch('/open/v1/users/me', { method: 'GET' }, accessToken);
    const me = extractApiContent(json) || {};
    const st = getState(clientId);
    st.channelId = me.channelId || me.userId || st.channelId;
    st.channelName = me.channelName || me.nickname || st.channelName;
    logState(clientId, 'loaded user info', { channelId: st.channelId, channelName: st.channelName });
    return me;
  } catch (e) {
    logState(clientId, 'users/me failed', e.message);
    return null;
  }
}

function findSessionKeyFromPayload(payload) {
  if (!payload) return null;
  const candidates = [
    payload.sessionKey,
    payload?.data?.sessionKey,
    payload?.body?.sessionKey,
    payload?.content?.sessionKey,
    payload?.data?.data?.sessionKey,
    payload?.content?.data?.sessionKey,
  ];
  for (const v of candidates) if (typeof v === 'string' && v.length > 5) return v;
  // deep fallback
  const seen = new Set();
  function walk(x) {
    if (!x || typeof x !== 'object' || seen.has(x)) return null;
    seen.add(x);
    if (typeof x.sessionKey === 'string') return x.sessionKey;
    for (const v of Object.values(x)) {
      const found = walk(v);
      if (found) return found;
    }
    return null;
  }
  return walk(payload);
}
function getEventType(payload) {
  return payload?.eventType || payload?.type || payload?.event || payload?.data?.eventType || payload?.content?.eventType;
}
function getSystemType(payload) {
  return payload?.type || payload?.data?.type || payload?.content?.type;
}
function normalizeChat(payload, clientId = null) {
  const body = payload?.data && payload.eventType ? payload.data : (payload?.data?.data || payload?.content || payload?.body || payload?.data || payload);
  const profileRaw = body?.profile || body?.sender || body?.user || {};
  let profile = profileRaw;
  if (typeof profileRaw === 'string') {
    try { profile = JSON.parse(profileRaw); } catch { profile = {}; }
  }
  const st = clientId ? getState(clientId) : {};
  const userId = profile?.userIdHash || profile?.userId || profile?.channelId || body?.userId || body?.channelId || body?.senderUserId;
  let role = profile?.userRoleCode || body?.userRoleCode || body?.role || 'common_user';
  if (st?.channelId && (userId === st.channelId || profile?.channelId === st.channelId)) role = 'streamer';
  const badges = [];
  for (const b of (Array.isArray(profile?.badges) ? profile.badges : [])) badges.push(b);
  for (const b of (Array.isArray(body?.badges) ? body.badges : [])) badges.push(b);
  const extras = body?.extras || body?.extra || {};
  const emotes = [];
  const emojiPayload = extras?.emojis || extras?.emoticons || body?.emojis || body?.emoticons || [];
  if (Array.isArray(emojiPayload)) {
    for (const e of emojiPayload) emotes.push(e);
  } else if (emojiPayload && typeof emojiPayload === 'object') {
    for (const [name, val] of Object.entries(emojiPayload)) {
      if (typeof val === 'string') emotes.push({ name, url: val });
      else emotes.push({ name, ...(val || {}) });
    }
  }
  return {
    id: body?.messageId || body?.id || body?.chatMessageId || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    userId,
    nickname: profile?.nickname || body?.nickname || body?.senderNickname || body?.userNickname || '익명',
    message: body?.content || body?.message || body?.text || '',
    role,
    badges,
    emotes,
    profileImage: profile?.profileImageUrl || profile?.profileImage || body?.profileImageUrl || '',
    raw: body
  };
}

async function subscribeChat(clientId, sessionKey, accessToken) {
  setStatus(clientId, 'subscribing', { sessionKey });
  await chzzkFetch(`/open/v1/sessions/events/subscribe/chat?sessionKey=${encodeURIComponent(sessionKey)}`, { method: 'POST' }, accessToken);
  setStatus(clientId, 'subscribe_requested', { sessionKey });
}

function attachSocketHandlers(clientId, socket, accessToken) {
  const st = getState(clientId);

  const handlePayload = async (label, payload) => {
    // CHZZK Socket.IO sometimes sends JSON as a string.
    // Parse it first so sessionKey can be detected.
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {}
    }

    logState(clientId, `socket event:${label}`, payload);

    const eventType = getEventType(payload);
    const systemType = getSystemType(payload);
    const sessionKey = findSessionKeyFromPayload(payload);

    if (sessionKey) {
      st.sessionKey = sessionKey;
      logState(clientId, 'sessionKey received', { sessionKey });

      try {
        logState(clientId, 'chat subscribe request start', { sessionKey });

        await chzzkFetch(
          `/open/v1/sessions/events/subscribe/chat?sessionKey=${encodeURIComponent(sessionKey)}`,
          { method: 'POST' },
          accessToken
        );

        setStatus(clientId, 'chat_subscribed', { sessionKey });
        logState(clientId, 'chat subscribe success', { sessionKey });
      } catch (e) {
        logState(clientId, 'chat subscribe failed', {
          message: e.message,
          status: e.status,
          body: e.body
        });
        setError(clientId, e);
      }

      return;
    }

    if (systemType === 'subscribed') {
      setStatus(clientId, 'subscribed', payload?.data || payload);
      return;
    }

    if (systemType === 'revoked') {
      setStatus(clientId, 'revoked', payload?.data || payload);
      return;
    }

    if (eventType === 'CHAT' || label === 'CHAT' || payload?.eventType === 'CHAT') {
      const chat = normalizeChat(payload, clientId);
      emitChat(clientId, chat);
      setStatus(clientId, 'receiving_chat', {
        nickname: chat.nickname,
        message: chat.message
      });
    }
  };

  socket.on('connect', () => {
    setStatus(clientId, 'socket_connected_waiting_session_key', { socketId: socket.id });
  });

  socket.on('connect_error', (err) => setError(clientId, err));
  socket.on('disconnect', (reason) => setStatus(clientId, 'socket_disconnected', { reason }));

  // CHZZK Session API uses Socket.IO and may emit SYSTEM/CHAT event names or generic message.
  ['SYSTEM', 'CHAT', 'DONATION', 'SUBSCRIPTION', 'message', 'event'].forEach((name) => {
    socket.on(name, (payload) => handlePayload(name, payload));
  });

  // socket.io v2 exposes packet data through onevent; this lets us log unknown event names too.
  const originalOnevent = socket.onevent;
  socket.onevent = function(packet) {
    const args = packet.data || [];

    if (args.length) {
      const [eventName, payload] = args;

      if (!['SYSTEM', 'CHAT', 'DONATION', 'SUBSCRIPTION', 'message', 'event'].includes(eventName)) {
        handlePayload(String(eventName), payload ?? args.slice(1));
      }
    }

    originalOnevent.call(this, packet);
  };
}

async function startSession(clientId) {
  const id = safeClientId(clientId);
  const st = getState(id);
  if (st.socket) {
    try { st.socket.disconnect(); } catch {}
    st.socket = null;
  }
  st.sessionKey = null;
  st.startedAt = now();
  setStatus(id, 'starting');

  let tokenData = await readJsonMaybe(tokenPath(id));
  if (!tokenData?.accessToken) throw new Error('로그인이 필요합니다. /connect/' + id + ' 에서 로그인해주세요.');
  tokenData = await refreshTokenIfNeeded(id, tokenData);
  await getMe(id, tokenData.accessToken);

  const authJson = await chzzkFetch('/open/v1/sessions/auth', { method: 'GET' }, tokenData.accessToken);
  const content = extractApiContent(authJson);
  const url = content?.url || authJson?.url;
  if (!url) throw new Error('세션 URL을 받지 못했습니다: ' + JSON.stringify(authJson));
  logState(id, 'session auth url received');

  const socket = chzzkIo(url, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    forceNew: true
  });
  st.socket = socket;
  attachSocketHandlers(id, socket, tokenData.accessToken);
  return publicStatus(id);
}
async function stopSession(clientId) {
  const id = safeClientId(clientId);
  const st = getState(id);
  if (st.socket) {
    try { st.socket.disconnect(); } catch {}
    st.socket = null;
  }
  st.sessionKey = null;
  setStatus(id, 'stopped');
}
async function logoutClient(clientId) {
  const id = safeClientId(clientId);
  await stopSession(id);
  await deleteFileMaybe(tokenPath(id));
  const st = getState(id);
  st.channelId = null;
  st.channelName = null;
  st.lastError = null;
  setStatus(id, 'logged_out');
}
async function hasToken(clientId) {
  const data = await readJsonMaybe(tokenPath(clientId));
  return !!data?.accessToken;
}
async function publicStatus(clientId) {
  const id = safeClientId(clientId);
  const st = getState(id);
  let exists = true;
  try { await loadConfig(id); } catch { exists = false; }
  return {
    clientId: id,
    exists,
    hasToken: await hasToken(id),
    status: st.status,
    channelId: st.channelId,
    channelName: st.channelName,
    sessionKey: st.sessionKey ? `${st.sessionKey.slice(0, 6)}...` : null,
    lastError: st.lastError,
    lastEventAt: st.lastEventAt,
    startedAt: st.startedAt,
    obsUrl: `${PUBLIC_BASE_URL}/chat/${id}`,
    connectUrl: `${PUBLIC_BASE_URL}/connect/${id}`,
    debug: st.debug.slice(0, 30)
  };
}

app.get('/', (_, res) => res.redirect('/connect/pop'));

app.get('/_debug/configs', async (req, res) => {
  const dirs = [
    path.join(__dirname, 'configs'),
    path.join(process.cwd(), 'configs'),
    path.join(__dirname, 'config'),
    path.join(process.cwd(), 'config')
  ];
  const result = { __dirname, cwd: process.cwd(), dirs: [] };
  for (const dir of dirs) {
    try {
      result.dirs.push({ dir, files: await fs.readdir(dir) });
    } catch (e) {
      result.dirs.push({ dir, error: e.message });
    }
  }
  res.json(result);
});

app.get('/chat/:clientId', async (req, res) => {
  const clientId = safeClientId(req.params.clientId);
  let config;
  try { config = await loadConfig(clientId); }
  catch { return res.status(404).send('Unknown clientId'); }
  const css = await renderWidgetCss(config);
  res.send(`<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Chat ${clientId}</title><style>${css}</style></head><body><div class="main-container" data-client-id="${clientId}"></div><script src="/socket.io/socket.io.js"></script><script>window.CHAT_CONFIG=${JSON.stringify(config)};</script><script src="/static/original-fragments.js"></script><script src="/static/chat.js"></script></body></html>`);
});

app.get('/connect/:clientId', async (req, res) => {
  const clientId = safeClientId(req.params.clientId);
  try { await loadConfig(clientId); } catch { return res.status(404).send('Unknown clientId'); }
  res.sendFile(path.join(__dirname, 'public', 'connect.html'));
});

app.get('/api/status/:clientId', async (req, res) => res.json(await publicStatus(req.params.clientId)));
app.post('/api/start/:clientId', async (req, res) => {
  try { res.json(await startSession(req.params.clientId)); } catch (e) { setError(req.params.clientId, e); res.status(500).json(await publicStatus(req.params.clientId)); }
});
app.post('/api/stop/:clientId', async (req, res) => { await stopSession(req.params.clientId); res.json(await publicStatus(req.params.clientId)); });
app.post('/api/logout/:clientId', async (req, res) => { await logoutClient(req.params.clientId); res.json(await publicStatus(req.params.clientId)); });
app.post('/api/test/:clientId', async (req, res) => {
  const id = safeClientId(req.params.clientId);
  const type = req.body?.type || 'chat';
  if (type === 'donation') {
    emitChat(id, {
      id: crypto.randomUUID(),
      type: 'donation',
      nickname: req.body?.nickname || '후원테스트',
      amount: req.body?.amount || 12000,
      amountText: req.body?.amountText || '₩12,000',
      verb: req.body?.verb || '후원',
      message: req.body?.message || '',
      role: req.body?.role || 'common_user',
      badges: []
    });
  } else {
    emitChat(id, {
      id: crypto.randomUUID(),
      nickname: req.body?.nickname || '테스트유저',
      message: req.body?.message || '테스트 채팅입니다!',
      role: req.body?.role || 'common_user',
      badges: []
    });
  }
  res.json({ ok: true });
});

app.get('/auth/chzzk/start/:clientId', async (req, res) => {
  const clientId = safeClientId(req.params.clientId);
  try { await loadConfig(clientId); } catch { return res.status(404).send('Unknown clientId'); }
  const state = `${clientId}.${crypto.randomBytes(16).toString('hex')}`;
  states.set(state, { clientId, createdAt: Date.now() });
  const url = new URL(AUTH_PAGE);
  url.searchParams.set('clientId', CHZZK_CLIENT_ID);
  url.searchParams.set('redirectUri', CHZZK_REDIRECT_URI);
  url.searchParams.set('state', state);
  res.redirect(url.toString());
});

app.get('/auth/chzzk/callback', async (req, res) => {
  const { code, state } = req.query;
  const saved = states.get(String(state));
  if (!saved) return res.status(400).send('Invalid or expired state. 다시 로그인해주세요.');
  states.delete(String(state));
  try {
    const tokenContent = await exchangeCode(String(code), String(state));
    const tokenData = normalizeToken(tokenContent);
    await writeJson(tokenPath(saved.clientId), tokenData);
    logState(saved.clientId, 'login success');
    await getMe(saved.clientId, tokenData.accessToken);
    res.redirect(`/connect/${saved.clientId}?login=success`);
  } catch (e) {
    setError(saved.clientId, e);
    res.status(500).send(`<pre>Login failed\n${String(e.stack || e.message || e)}</pre>`);
  }
});

io.on('connection', (socket) => {
  socket.on('join-chat', ({ clientId }) => socket.join(`chat:${safeClientId(clientId)}`));
});

server.listen(PORT, () => console.log(`Server running on :${PORT}`));
