import 'dotenv/config';
import WebSocket from 'ws';

const CLIENT_ID = process.env.CLIENT_ID || 'demo';
const INGEST_KEY = process.env.INGEST_KEY || 'dev-key';
const SERVER_WS = process.env.OVERLAY_SERVER_WS || 'ws://localhost:8080/receiver';
const TEST_MODE = String(process.env.TEST_MODE || '').toLowerCase() === 'true';
const CHZZK_USER_HASH = process.env.CHZZK_USER_HASH || '';

let ws;
connectServer();

function connectServer() {
  const url = `${SERVER_WS}?client=${encodeURIComponent(CLIENT_ID)}&key=${encodeURIComponent(INGEST_KEY)}`;
  ws = new WebSocket(url);
  ws.on('open', async () => {
    console.log('[receiver] connected to overlay server');
    if (TEST_MODE) startTestMessages();
    else await startChzzk();
  });
  ws.on('close', () => {
    console.log('[receiver] disconnected. reconnecting...');
    setTimeout(connectServer, 1500);
  });
  ws.on('error', (err) => console.error('[receiver] ws error', err.message));
}

async function startChzzk() {
  if (!CHZZK_USER_HASH) {
    console.error('[receiver] CHZZK_USER_HASH is empty. Set TEST_MODE=true or fill CHZZK_USER_HASH.');
    return;
  }

  const mod = await import('@d2n0s4ur/chzzk-chat');
  const { ChzzkChat } = mod;
  const chzzkChat = new ChzzkChat(CHZZK_USER_HASH);

  chzzkChat.addMessageHandler((payload) => {
    const normalized = normalizeChzzkMessage(payload);
    sendChat(normalized);
  });

  // 라이브러리 버전에 따라 connect/start 이름이 다를 수 있어 둘 다 대응
  if (typeof chzzkChat.connect === 'function') await chzzkChat.connect();
  else if (typeof chzzkChat.start === 'function') await chzzkChat.start();
  else console.log('[receiver] chzzk chat handler registered. Check library start method if messages do not arrive.');
}

function normalizeChzzkMessage(payload) {
  const badges = normalizeBadges(payload.badges || payload.badge || []);
  return {
    id: payload.id || payload.messageId || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    userId: payload.userId || payload.hash || payload.nick || payload.nickname || 'unknown',
    nickname: payload.nick || payload.nickname || payload.name || '익명',
    message: payload.message || payload.content || payload.text || '',
    role: inferRole(payload, badges),
    badges
  };
}

function normalizeBadges(badges) {
  if (!Array.isArray(badges)) return [];
  return badges.map((b) => {
    if (typeof b === 'string') return { type: b };
    return { type: b.type || b.name || b.badgeId || 'badge', url: b.url || b.imageUrl || b.img };
  });
}

function inferRole(payload, badges) {
  const raw = JSON.stringify(payload).toLowerCase();
  const badgeTypes = badges.map(b => String(b.type || '').toLowerCase());
  if (raw.includes('streamer') || raw.includes('broadcaster') || badgeTypes.includes('streamer')) return 'broadcaster';
  if (raw.includes('manager') || raw.includes('moderator') || badgeTypes.includes('manager')) return 'moderator';
  if (raw.includes('vip') || badgeTypes.includes('vip')) return 'vip';
  if (raw.includes('subscriber') || raw.includes('subscription') || badgeTypes.includes('subscriber')) return 'subscriber';
  return 'default';
}

function sendChat(data) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'chat', data }));
}

function startTestMessages() {
  const samples = [
    { nickname: '방송자', role: 'broadcaster', badges: [{ type: 'broadcaster' }], message: '방송자 테스트 메시지입니다!' },
    { nickname: '매니저', role: 'moderator', badges: [{ type: 'moderator' }], message: '매니저 뱃지/장식 테스트 🌿' },
    { nickname: '구독자', role: 'subscriber', badges: [{ type: 'subscriber' }], message: '구독자 채팅도 원본 구조로 출력됩니다.' },
    { nickname: 'VIP유저', role: 'vip', badges: [{ type: 'vip' }], message: 'VIP 테스트 메시지!' },
    { nickname: '일반유저', role: 'default', badges: [], message: '일반 채팅 테스트입니다. OBS에서 이렇게 보이면 성공!' }
  ];
  let i = 0;
  setInterval(() => {
    const s = samples[i++ % samples.length];
    sendChat({
      id: `${Date.now()}-${i}`,
      userId: `${s.nickname}-${i}`,
      ...s
    });
  }, 1600);
}
