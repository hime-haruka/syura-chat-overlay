import 'dotenv/config';
import WebSocket from 'ws';
import io from 'socket.io-client';

const OVERLAY_CLIENT_ID = process.env.OVERLAY_CLIENT_ID || 'pop';
const INGEST_KEY = process.env.INGEST_KEY || 'dev-key';
const OVERLAY_SERVER_WS = process.env.OVERLAY_SERVER_WS || 'ws://localhost:8080/receiver';
const TEST_MODE = String(process.env.TEST_MODE || '').toLowerCase() === 'true';

const CHZZK_CLIENT_ID = process.env.CHZZK_CLIENT_ID || '';
const CHZZK_CLIENT_SECRET = process.env.CHZZK_CLIENT_SECRET || '';
const CHZZK_ACCESS_TOKEN = process.env.CHZZK_ACCESS_TOKEN || '';
const CHZZK_CHANNEL_ID = process.env.CHZZK_CHANNEL_ID || '';
const CHZZK_API_BASE = 'https://openapi.chzzk.naver.com';

let overlayWs;
connectOverlayServer();

function connectOverlayServer() {
  const url = `${OVERLAY_SERVER_WS}?client=${encodeURIComponent(OVERLAY_CLIENT_ID)}&key=${encodeURIComponent(INGEST_KEY)}`;
  overlayWs = new WebSocket(url);
  overlayWs.on('open', async () => {
    console.log(`[receiver] connected to overlay server as ${OVERLAY_CLIENT_ID}`);
    if (TEST_MODE) startTestMessages();
    else await startOfficialChzzkSession().catch(err => console.error('[chzzk]', err));
  });
  overlayWs.on('close', () => {
    console.log('[receiver] disconnected. reconnecting...');
    setTimeout(connectOverlayServer, 1500);
  });
  overlayWs.on('error', err => console.error('[receiver] ws error', err.message));
}

async function startOfficialChzzkSession() {
  if (!CHZZK_ACCESS_TOKEN) throw new Error('CHZZK_ACCESS_TOKEN is empty. 먼저 /auth/chzzk/start?clientId=pop 인증 후 token을 설정하세요.');
  const sessionUrl = await createUserSessionUrl();
  console.log('[chzzk] session url created');

  const socket = io.connect(sessionUrl, {
    reconnection: false,
    'force new connection': true,
    'connect timeout': 3000,
    transports: ['websocket']
  });

  socket.on('connect', () => console.log('[chzzk] socket connected'));
  socket.on('disconnect', reason => {
    console.log('[chzzk] socket disconnected:', reason);
    setTimeout(() => process.exit(1), 1000);
  });
  socket.on('connect_error', err => console.error('[chzzk] connect error:', err.message));

  socket.on('SYSTEM', async payload => {
    const body = normalizeSocketPayload(payload);
    console.log('[chzzk SYSTEM]', body?.type || body);
    if (body?.type === 'connected' && body?.data?.sessionKey) {
      await subscribeChat(body.data.sessionKey);
      console.log('[chzzk] chat subscribed');
    }
  });

  socket.on('CHAT', payload => handleChatEvent(normalizeSocketPayload(payload)));
  socket.on('message', payload => {
    const body = normalizeSocketPayload(payload);
    if (body?.eventType === 'CHAT' || body?.type === 'CHAT' || body?.profile || body?.content) handleChatEvent(body);
    if (body?.type === 'connected' && body?.data?.sessionKey) subscribeChat(body.data.sessionKey).catch(console.error);
  });
}

async function createUserSessionUrl() {
  const r = await fetch(`${CHZZK_API_BASE}/open/v1/sessions/auth`, {
    headers: { Authorization: `Bearer ${CHZZK_ACCESS_TOKEN}`, 'Content-Type': 'application/json' }
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || json.code && json.code !== 200) throw new Error(`session auth failed: ${JSON.stringify(json)}`);
  return (json.content || json).url;
}

async function subscribeChat(sessionKey) {
  const body = { sessionKey };
  if (CHZZK_CHANNEL_ID) body.channelId = CHZZK_CHANNEL_ID;
  const r = await fetch(`${CHZZK_API_BASE}/open/v1/sessions/events/subscribe/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CHZZK_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || json.code && json.code !== 200) throw new Error(`subscribe failed: ${JSON.stringify(json)}`);
  return json.content || json;
}

function handleChatEvent(event) {
  const data = event?.data || event;
  if (!data) return;
  const normalized = normalizeChzzkChat(data);
  if (!normalized.message) return;
  sendChat(normalized);
}

function normalizeChzzkChat(raw) {
  const profile = raw.profile || {};
  const badges = normalizeBadges(profile.badges || raw.badges || []);
  const role = roleFromChzzk(profile.userRoleCode, badges);
  return {
    id: raw.messageId || raw.messageTime || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    userId: raw.senderChannelId || profile.channelId || profile.userId || profile.nickname || 'unknown',
    nickname: profile.nickname || raw.nickname || '익명',
    message: replaceEmojis(String(raw.content || raw.message || ''), raw.emojis || {}),
    role,
    badges
  };
}

function normalizeBadges(list) {
  if (!Array.isArray(list)) return [];
  return list.map(b => ({ type: b.type || b.name || b.badgeId || 'badge', url: b.imageUrl || b.url || b.badgeImageUrl })).filter(Boolean);
}
function roleFromChzzk(code, badges = []) {
  const c = String(code || '').toLowerCase();
  if (c === 'streamer') return 'broadcaster';
  if (c === 'streaming_channel_manager' || c === 'streaming_chat_manager') return 'moderator';
  const joined = badges.map(b => String(b.type).toLowerCase()).join(',');
  if (joined.includes('subscription') || joined.includes('sub')) return 'subscriber';
  return 'default';
}
function replaceEmojis(content, emojis) {
  // 오버레이 렌더러가 HTML escape를 처리하므로 여기서는 텍스트만 전달.
  return content;
}
function sendChat(data) {
  if (overlayWs?.readyState === WebSocket.OPEN) overlayWs.send(JSON.stringify({ type: 'chat', data }));
}
function normalizeSocketPayload(payload) {
  if (typeof payload === 'string') { try { return JSON.parse(payload); } catch { return payload; } }
  return payload;
}
function startTestMessages() {
  const roles = ['default', 'subscriber', 'moderator', 'vip', 'broadcaster'];
  let i = 0;
  setInterval(() => {
    const role = roles[i % roles.length];
    sendChat({
      id: `test-${Date.now()}`,
      userId: `user-${i}`,
      nickname: ['테스트유저', '구독자', '매니저', 'VIP', '스트리머'][i % roles.length],
      message: `원본 챗박스 구조 테스트 ${i + 1}번째 메시지입니다 🌿`,
      role,
      badges: role === 'default' ? [] : [{ type: role }]
    });
    i += 1;
  }, 1800);
}
