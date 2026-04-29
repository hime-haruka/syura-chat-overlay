import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { WebSocketServer } from 'ws';
import io from 'socket.io-client';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8080);
const PUBLIC_BASE_URL = String(process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const ADMIN_KEY = process.env.ADMIN_KEY || 'dev-admin-key';
const CHZZK_CLIENT_ID = process.env.CHZZK_CLIENT_ID || '';
const CHZZK_CLIENT_SECRET = process.env.CHZZK_CLIENT_SECRET || '';
const CHZZK_REDIRECT_URI = process.env.CHZZK_REDIRECT_URI || `${PUBLIC_BASE_URL}/auth/chzzk/callback`;
const CHZZK_API_BASE = 'https://openapi.chzzk.naver.com';
const CHZZK_AUTH_URL = 'https://chzzk.naver.com/account-interlock';

const privateDir = path.join(__dirname, 'private');
const tokenFile = path.join(privateDir, 'tokens.json');
fs.mkdirSync(privateDir, { recursive: true });

const app = express();
const server = http.createServer(app);
const overlayWss = new WebSocketServer({ noServer: true });

const overlayClients = new Map(); // clientId -> Set(ws)
const runtimeSessions = new Map(); // clientId -> { socket, sessionKey, startedAt, status, lastError }

app.use(express.json({ limit: '1mb' }));
app.use('/overlay', express.static(path.join(__dirname, 'public/overlay')));

app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>Syura CHZZK Overlay</title><style>body{font-family:system-ui,sans-serif;padding:32px;line-height:1.6}code{background:#f3f3f3;padding:2px 6px;border-radius:6px}</style></head><body><h1>Syura CHZZK Chat Overlay</h1><p>OBS URL: <code>${PUBLIC_BASE_URL}/chat/pop</code></p><p>Admin: <a href="/admin/pop">/admin/pop</a></p><p>Health: <a href="/health">/health</a></p></body></html>`);
});

app.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get('/chat/:clientId', (req, res) => {
  const clientId = safeName(req.params.clientId || 'pop');
  res.redirect(`/overlay/index.html?client=${encodeURIComponent(clientId)}`);
});

app.get('/admin/:clientId', (req, res) => {
  const clientId = safeName(req.params.clientId || 'pop');
  res.type('html').send(adminHtml(clientId));
});

app.get('/api/style/:clientId', (req, res) => {
  const clientId = safeName(req.params.clientId || 'default-style');
  const style = loadStyle(clientId);
  res.json(style);
});

app.get('/api/admin/:clientId/status', requireAdmin, (req, res) => {
  const clientId = safeName(req.params.clientId || 'pop');
  res.json(getStatus(clientId));
});

app.post('/api/admin/:clientId/start', requireAdmin, async (req, res) => {
  const clientId = safeName(req.params.clientId || 'pop');
  try {
    await startChzzkSession(clientId);
    res.json({ ok: true, status: getStatus(clientId) });
  } catch (err) {
    setSessionStatus(clientId, 'error', err.message);
    res.status(500).json({ ok: false, error: err.message, status: getStatus(clientId) });
  }
});

app.post('/api/admin/:clientId/stop', requireAdmin, async (req, res) => {
  const clientId = safeName(req.params.clientId || 'pop');
  stopChzzkSession(clientId);
  res.json({ ok: true, status: getStatus(clientId) });
});

app.post('/api/admin/:clientId/test', requireAdmin, async (req, res) => {
  const clientId = safeName(req.params.clientId || 'pop');
  const message = req.body?.message || '관리자 테스트 메시지입니다 🌿';
  broadcastChat(clientId, {
    id: crypto.randomUUID(),
    type: 'chat',
    nickname: '테스트유저',
    message,
    role: 'streamer',
    badges: [{ type: 'streamer' }],
    createdAt: Date.now()
  });
  res.json({ ok: true });
});

app.get('/auth/chzzk/start', (req, res) => {
  if (!CHZZK_CLIENT_ID) return res.status(500).send('CHZZK_CLIENT_ID 환경변수가 없습니다.');
  const clientId = safeName(req.query.clientId || 'pop');
  const state = `${clientId}.${crypto.randomBytes(16).toString('hex')}`;
  const url = new URL(CHZZK_AUTH_URL);
  url.searchParams.set('clientId', CHZZK_CLIENT_ID);
  url.searchParams.set('redirectUri', CHZZK_REDIRECT_URI);
  url.searchParams.set('state', state);
  res.redirect(url.toString());
});

app.get('/auth/chzzk/callback', async (req, res) => {
  const code = String(req.query.code || '');
  const state = String(req.query.state || '');
  if (!code || !state) return res.status(400).send('code 또는 state가 없습니다.');
  if (!CHZZK_CLIENT_ID || !CHZZK_CLIENT_SECRET) return res.status(500).send('CHZZK_CLIENT_ID 또는 CHZZK_CLIENT_SECRET 환경변수가 없습니다.');

  const clientId = safeName(state.split('.')[0] || 'pop');
  try {
    const token = await requestToken({ grantType: 'authorization_code', code, state });
    const tokens = loadTokens();
    tokens[clientId] = {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      tokenType: token.tokenType || 'Bearer',
      scope: token.scope || '',
      expiresIn: Number(token.expiresIn || 86400),
      savedAt: Date.now(),
      expiresAt: Date.now() + Number(token.expiresIn || 86400) * 1000
    };
    saveTokens(tokens);
    res.type('html').send(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>인증 완료</title><style>body{font-family:system-ui,sans-serif;padding:32px;line-height:1.7}code{background:#f3f3f3;padding:2px 6px;border-radius:6px}</style></head><body><h2>치지직 인증 저장 완료</h2><p>clientId: <b>${escapeHtml(clientId)}</b></p><p>이제 관리자 페이지에서 <b>세션 시작</b>을 눌러주세요.</p><p><a href="/admin/${encodeURIComponent(clientId)}">관리자 페이지로 이동</a></p><p>OBS URL: <code>${PUBLIC_BASE_URL}/chat/${escapeHtml(clientId)}</code></p></body></html>`);
  } catch (err) {
    res.status(500).type('html').send(`<h2>인증 실패</h2><pre>${escapeHtml(err.message)}</pre>`);
  }
});

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== '/ws/overlay') return socket.destroy();
  overlayWss.handleUpgrade(req, socket, head, (ws) => {
    overlayWss.emit('connection', ws, req, url);
  });
});

overlayWss.on('connection', (ws, _req, url) => {
  const clientId = safeName(url.searchParams.get('client') || 'pop');
  if (!overlayClients.has(clientId)) overlayClients.set(clientId, new Set());
  overlayClients.get(clientId).add(ws);
  ws.send(JSON.stringify({ type: 'system', message: `overlay connected: ${clientId}`, clientId }));
  ws.on('close', () => overlayClients.get(clientId)?.delete(ws));
});

server.listen(PORT, () => {
  console.log(`[server] listening on ${PORT}`);
  console.log(`[server] public base: ${PUBLIC_BASE_URL}`);
});

function safeName(v) {
  return String(v || 'pop').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'pop';
}

function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (ADMIN_KEY === 'dev-admin-key') return next();
  if (key !== ADMIN_KEY) return res.status(401).json({ ok: false, error: 'ADMIN_KEY가 필요합니다.' });
  next();
}

function adminHtml(clientId) {
  const authUrl = `/auth/chzzk/start?clientId=${encodeURIComponent(clientId)}`;
  const obsUrl = `${PUBLIC_BASE_URL}/chat/${clientId}`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CHZZK Admin - ${escapeHtml(clientId)}</title><style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;background:#f7f5fb;color:#2b2636}.wrap{max-width:880px;margin:0 auto;padding:32px}.card{background:#fff;border:1px solid #e7e0f4;border-radius:18px;padding:22px;margin:16px 0;box-shadow:0 10px 24px rgba(71,55,110,.08)}button,a.btn{border:0;background:#7559d9;color:#fff;border-radius:12px;padding:11px 16px;font-weight:700;text-decoration:none;display:inline-block;cursor:pointer;margin:4px}button.secondary{background:#3d8b68}button.danger{background:#d95050}input{width:420px;max-width:100%;padding:10px 12px;border:1px solid #ccc;border-radius:10px}code,pre{background:#f0ecf8;border-radius:8px;padding:3px 6px}pre{padding:12px;white-space:pre-wrap}.muted{color:#766d86;font-size:14px}.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}</style></head><body><div class="wrap"><h1>치지직 채팅 오버레이 관리자</h1><div class="card"><p><b>clientId</b>: <code>${escapeHtml(clientId)}</code></p><p><b>OBS URL</b>: <code>${escapeHtml(obsUrl)}</code></p><p class="muted">OBS 브라우저 소스에는 위 URL만 넣으면 됩니다. EXE/Receiver는 사용하지 않습니다.</p></div><div class="card"><h2>1. 치지직 로그인</h2><p>처음 1회 또는 토큰 만료 시 다시 로그인합니다.</p><a class="btn" href="${authUrl}">치지직 로그인/인증</a></div><div class="card"><h2>2. 세션 제어</h2><div class="row"><input id="adminKey" placeholder="ADMIN_KEY (Render에 설정한 값)"><button onclick="saveKey()">키 저장</button></div><p class="muted">ADMIN_KEY를 dev-admin-key로 둔 로컬 테스트에서는 비워도 됩니다.</p><div class="row"><button onclick="startSession()">세션 시작</button><button class="danger" onclick="stopSession()">세션 중지</button><button class="secondary" onclick="sendTest()">테스트 메시지</button><button onclick="loadStatus()">상태 새로고침</button></div></div><div class="card"><h2>상태</h2><pre id="status">loading...</pre></div></div><script>const clientId=${JSON.stringify(clientId)};const statusEl=document.getElementById('status');const keyEl=document.getElementById('adminKey');keyEl.value=localStorage.getItem('adminKey')||'';function saveKey(){localStorage.setItem('adminKey',keyEl.value);alert('저장했어요.')}function headers(){return {'Content-Type':'application/json','x-admin-key':keyEl.value||''}}async function api(path,opt={}){const r=await fetch(path,{...opt,headers:{...headers(),...(opt.headers||{})}});const j=await r.json().catch(()=>({ok:false,error:'JSON 응답 아님'}));if(!r.ok) throw new Error(j.error||JSON.stringify(j));return j}async function loadStatus(){try{statusEl.textContent=JSON.stringify(await api('/api/admin/'+clientId+'/status'),null,2)}catch(e){statusEl.textContent='ERROR: '+e.message}}async function startSession(){try{statusEl.textContent='starting...';await api('/api/admin/'+clientId+'/start',{method:'POST'});await loadStatus()}catch(e){statusEl.textContent='ERROR: '+e.message}}async function stopSession(){try{await api('/api/admin/'+clientId+'/stop',{method:'POST'});await loadStatus()}catch(e){statusEl.textContent='ERROR: '+e.message}}async function sendTest(){try{await api('/api/admin/'+clientId+'/test',{method:'POST',body:JSON.stringify({message:'관리자 페이지 테스트 메시지입니다 🌿'})});await loadStatus()}catch(e){statusEl.textContent='ERROR: '+e.message}}loadStatus();</script></body></html>`;
}

function loadStyle(clientId) {
  const clientFile = path.join(__dirname, 'config', `${safeName(clientId)}.json`);
  const defaultFile = path.join(__dirname, 'config', 'default-style.json');
  const file = fs.existsSync(clientFile) ? clientFile : defaultFile;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadTokens() {
  if (!fs.existsSync(tokenFile)) return {};
  try { return JSON.parse(fs.readFileSync(tokenFile, 'utf8')); } catch { return {}; }
}

function saveTokens(tokens) {
  fs.writeFileSync(tokenFile, JSON.stringify(tokens, null, 2));
}

async function requestToken(payload) {
  const body = {
    grantType: payload.grantType,
    clientId: CHZZK_CLIENT_ID,
    clientSecret: CHZZK_CLIENT_SECRET
  };
  if (payload.code) body.code = payload.code;
  if (payload.state) body.state = payload.state;
  if (payload.refreshToken) body.refreshToken = payload.refreshToken;

  const r = await fetch(`${CHZZK_API_BASE}/auth/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || json.code && json.code !== 200) throw new Error(`token request failed: ${JSON.stringify(json)}`);
  return json.content || json;
}

async function getValidToken(clientId) {
  const tokens = loadTokens();
  let token = tokens[clientId];
  if (!token?.accessToken) throw new Error(`${clientId} 인증 토큰이 없습니다. 먼저 /admin/${clientId}에서 치지직 로그인하세요.`);
  const expireSoon = Date.now() > Number(token.expiresAt || 0) - 5 * 60 * 1000;
  if (expireSoon) {
    if (!token.refreshToken) throw new Error('refreshToken이 없어 재로그인이 필요합니다.');
    const refreshed = await requestToken({ grantType: 'refresh_token', refreshToken: token.refreshToken });
    token = {
      ...token,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken || token.refreshToken,
      tokenType: refreshed.tokenType || 'Bearer',
      scope: refreshed.scope || token.scope || '',
      expiresIn: Number(refreshed.expiresIn || 86400),
      savedAt: Date.now(),
      expiresAt: Date.now() + Number(refreshed.expiresIn || 86400) * 1000
    };
    tokens[clientId] = token;
    saveTokens(tokens);
  }
  return token.accessToken;
}

async function startChzzkSession(clientId) {
  if (runtimeSessions.has(clientId)) stopChzzkSession(clientId);
  const accessToken = await getValidToken(clientId);
  setSessionStatus(clientId, 'creating');
  const sessionUrl = await createUserSessionUrl(accessToken);
  setSessionStatus(clientId, 'connecting');

  const socket = io.connect(sessionUrl, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1500,
    timeout: 5000,
    transports: ['websocket'],
    forceNew: true
  });

  runtimeSessions.set(clientId, { socket, sessionKey: null, startedAt: Date.now(), status: 'connecting', lastError: null });

  socket.on('connect', () => setSessionStatus(clientId, 'socket_connected'));
  socket.on('connect_error', (err) => setSessionStatus(clientId, 'error', `connect_error: ${err.message}`));
  socket.on('disconnect', (reason) => setSessionStatus(clientId, 'disconnected', reason));

  socket.on('SYSTEM', async (payload) => handleSystem(clientId, accessToken, payload));
  socket.on('CHAT', (payload) => handleChat(clientId, payload));
  socket.on('DONATION', (payload) => handleDonation(clientId, payload));
  socket.on('SUBSCRIPTION', (payload) => handleSubscription(clientId, payload));

  socket.on('message', async (payload) => {
    const body = normalizePayload(payload);
    if (body?.type === 'connected' || body?.eventType === 'SYSTEM') await handleSystem(clientId, accessToken, body);
    else if (body?.eventType === 'CHAT' || body?.profile || body?.content) handleChat(clientId, body);
    else if (body?.eventType === 'DONATION' || body?.donatorNickname) handleDonation(clientId, body);
    else if (body?.eventType === 'SUBSCRIPTION') handleSubscription(clientId, body);
  });
}

function stopChzzkSession(clientId) {
  const current = runtimeSessions.get(clientId);
  if (current?.socket) current.socket.disconnect();
  runtimeSessions.delete(clientId);
}

async function createUserSessionUrl(accessToken) {
  const r = await fetch(`${CHZZK_API_BASE}/open/v1/sessions/auth`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || json.code && json.code !== 200) throw new Error(`session auth failed: ${JSON.stringify(json)}`);
  const url = (json.content || json).url;
  if (!url) throw new Error(`session url missing: ${JSON.stringify(json)}`);
  return url;
}

async function subscribeEvent(accessToken, endpoint, sessionKey) {
  const r = await fetch(`${CHZZK_API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionKey })
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || json.code && json.code !== 200) throw new Error(`subscribe failed ${endpoint}: ${JSON.stringify(json)}`);
  return json;
}

async function handleSystem(clientId, accessToken, payload) {
  const body = normalizePayload(payload);
  const type = body?.type || body?.data?.type;
  const sessionKey = body?.data?.sessionKey || body?.sessionKey;
  if (type === 'connected' && sessionKey) {
    const current = runtimeSessions.get(clientId) || {};
    current.sessionKey = sessionKey;
    current.status = 'subscribing';
    runtimeSessions.set(clientId, current);
    await subscribeEvent(accessToken, '/open/v1/sessions/events/subscribe/chat', sessionKey);
    setSessionStatus(clientId, 'subscribed_chat');
    broadcastSystem(clientId, '치지직 채팅 세션이 연결되었습니다.');
  } else if (type === 'subscribed') {
    setSessionStatus(clientId, `subscribed_${body?.data?.eventType || 'event'}`);
  } else if (type === 'revoked') {
    setSessionStatus(clientId, 'revoked', '권한이 회수되었습니다. 다시 로그인하세요.');
  }
}

function handleChat(clientId, payload) {
  const body = normalizePayload(payload);
  const profile = body.profile || body.data?.profile || {};
  const content = body.content || body.data?.content || '';
  if (!content) return;
  broadcastChat(clientId, {
    id: `${body.messageTime || Date.now()}-${body.senderChannelId || crypto.randomUUID()}`,
    type: 'chat',
    channelId: body.channelId,
    userId: body.senderChannelId,
    nickname: profile.nickname || '익명',
    message: content,
    role: roleFromProfile(profile),
    badges: normalizeBadges(profile.badges || []),
    verifiedMark: !!profile.verifiedMark,
    emojis: body.emojis || {},
    createdAt: Number(body.messageTime || Date.now())
  });
}

function handleDonation(clientId, payload) {
  const body = normalizePayload(payload);
  const nickname = body.donatorNickname || body.data?.donatorNickname || '익명';
  const amount = body.payAmount || body.data?.payAmount || '';
  const text = body.donationText || body.data?.donationText || '';
  broadcastChat(clientId, {
    id: crypto.randomUUID(),
    type: 'donation',
    nickname,
    message: amount ? `${Number(amount).toLocaleString('ko-KR')}원 후원 ${text}` : text,
    role: 'donation',
    badges: [{ type: 'donation' }],
    createdAt: Date.now()
  });
}

function handleSubscription(clientId, payload) {
  const body = normalizePayload(payload);
  const nickname = body.subscriberNickname || body.nickname || '구독자';
  broadcastChat(clientId, {
    id: crypto.randomUUID(),
    type: 'subscription',
    nickname,
    message: '구독 이벤트가 도착했습니다.',
    role: 'subscriber',
    badges: [{ type: 'subscriber' }],
    createdAt: Date.now()
  });
}

function normalizePayload(payload) {
  if (!payload) return {};
  if (typeof payload === 'string') {
    try { return JSON.parse(payload); } catch { return { content: payload }; }
  }
  return payload;
}

function roleFromProfile(profile = {}) {
  const code = profile.userRoleCode || '';
  if (code === 'streamer') return 'streamer';
  if (code === 'streaming_channel_manager' || code === 'streaming_chat_manager') return 'mod';
  return 'default';
}

function normalizeBadges(badges) {
  if (!Array.isArray(badges)) return [];
  return badges.map((b) => ({ type: b.type || b.badgeNo || b.name || 'badge', imageUrl: b.imageUrl || b.url || b.badgeImageUrl || '' }));
}

function broadcastSystem(clientId, message) {
  broadcast(clientId, { type: 'system', message, clientId, createdAt: Date.now() });
}

function broadcastChat(clientId, payload) {
  broadcast(clientId, { ...payload, clientId });
}

function broadcast(clientId, payload) {
  const data = JSON.stringify(payload);
  const set = overlayClients.get(clientId);
  if (!set) return;
  for (const ws of set) {
    if (ws.readyState === ws.OPEN) ws.send(data);
  }
}

function setSessionStatus(clientId, status, lastError = null) {
  const current = runtimeSessions.get(clientId) || { startedAt: Date.now() };
  current.status = status;
  current.lastError = lastError;
  runtimeSessions.set(clientId, current);
  console.log(`[${clientId}] ${status}${lastError ? `: ${lastError}` : ''}`);
}

function getStatus(clientId) {
  const tokens = loadTokens();
  const token = tokens[clientId];
  const current = runtimeSessions.get(clientId);
  return {
    clientId,
    hasToken: !!token?.accessToken,
    tokenExpiresAt: token?.expiresAt ? new Date(token.expiresAt).toISOString() : null,
    status: current?.status || 'stopped',
    sessionKey: current?.sessionKey || null,
    startedAt: current?.startedAt ? new Date(current.startedAt).toISOString() : null,
    lastError: current?.lastError || null,
    overlayClients: overlayClients.get(clientId)?.size || 0,
    obsUrl: `${PUBLIC_BASE_URL}/chat/${clientId}`,
    authUrl: `${PUBLIC_BASE_URL}/auth/chzzk/start?clientId=${clientId}`
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
