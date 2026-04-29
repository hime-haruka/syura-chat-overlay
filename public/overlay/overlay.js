const params = new URLSearchParams(location.search);
const clientId = params.get('client') || 'demo';
const container = document.querySelector('.main-container');

const state = {
  settings: {
    alignMessages: 'bottom',
    hideCommands: 'yes',
    ignoredUsers: 'StreamElements,OtherBot',
    msgHideOpt: false,
    msgHide: 7,
    msgLimit: false,
    msgLimitAmount: 7,
    badgesDisplay: true,
    badgesCustom: true,
    msgFade: false,
    largeEmotes: 'on',
    namesFont: 'Quicksand',
    msgFont: 'Quicksand',
    namesBold: '700',
    msgBold: '700',
    namesSize: 16,
    msgSize: 16,
    nameback: '#97d561',
    msgback: '#ffffff',
    namescolor: '#ffffff',
    msgcolor: '#47843b',
    badgesContcolor: '#bce78e',
    badgescolor: '#ffffff',
    bordercol: '#97d561',
    frog1: '#bce78e',
    lily1: '#f592b4',
    lilypad: '#82c080'
  },
  totalMessages: 0
};

init();

async function init() {
  await loadStyle();
  connectOverlaySocket();
  window.CHZZK_CHAT_TEST = () => renderChatMessage({
    id: crypto.randomUUID(),
    userId: 'test-user',
    nickname: '테스트유저',
    message: '원본 챗박스 구조 테스트 메시지입니다 🌿',
    role: 'subscriber',
    badges: [{ type: 'subscriber' }]
  });
}

async function loadStyle() {
  try {
    const res = await fetch(`/api/style/${clientId}`);
    const style = await res.json();
    state.settings = { ...state.settings, ...normalizeStyle(style) };
  } catch {}
  applyCssVars(state.settings);
  document.querySelector('.main-container')?.classList.toggle('align-top', state.settings.alignMessages === 'top');
}

function normalizeStyle(s) {
  return {
    ...s,
    nameback: s.nameback || s['name-back'] || s.nameBack,
    msgback: s.msgback || s['msg-back'] || s.messageBack,
    namescolor: s.namescolor || s['names-color'],
    msgcolor: s.msgcolor || s['msg-color'],
    badgesContcolor: s.badgesContcolor || s.badgesback,
    bordercol: s.bordercol || s.bordercolor,
    msgHide: Number(s.msgHide ?? 7),
    namesSize: Number(s.namesSize ?? 16),
    msgSize: Number(s.msgSize ?? 16),
    msgLimitAmount: Number(s.msgLimitAmount ?? 7)
  };
}

function applyCssVars(s) {
  const root = document.documentElement;
  setVar('namesSize', `${s.namesSize}px`);
  setVar('msgSize', `${s.msgSize}px`);
  setVar('msgback', s.msgback);
  setVar('nameback', s.nameback);
  setVar('namesBold', s.namesBold);
  setVar('msgBold', s.msgBold);
  setVar('namesFont', `'${s.namesFont}', sans-serif`);
  setVar('msgFont', `'${s.msgFont}', sans-serif`);
  setVar('namescolor', s.namescolor);
  setVar('msgcolor', s.msgcolor);
  setVar('msgHide', `${s.msgHide}s`);
  setVar('badgesContcolor', s.badgesContcolor);
  setVar('badgescolor', s.badgescolor);
  setVar('bordercol', s.bordercol);
  setVar('frog1', s.frog1);
  setVar('lily1', s.lily1);
  setVar('lilypad', s.lilypad);
  function setVar(k, v) { if (v !== undefined && v !== null) root.style.setProperty(`--${k}`, v); }
}

function connectOverlaySocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${location.host}/overlay-ws?client=${encodeURIComponent(clientId)}`);
  ws.addEventListener('message', (event) => {
    const payload = safeJson(event.data);
    if (!payload) return;
    if (payload.type === 'chat') renderChatMessage(payload.data);
    if (payload.type === 'deleteMessage') deleteMessage(payload.id);
    if (payload.type === 'deleteUser') deleteUser(payload.userId);
  });
  ws.addEventListener('close', () => setTimeout(connectOverlaySocket, 1500));
}

function renderChatMessage(input) {
  const msg = normalizeMessage(input);
  if (!msg.message.trim()) return;
  if (state.settings.hideCommands === 'yes' && msg.message.trim().startsWith('!')) return;
  const ignored = String(state.settings.ignoredUsers || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
  if (ignored.includes(msg.nickname.toLowerCase())) return;

  const row = document.createElement('div');
  row.className = `message-row animation1 ${msg.role || 'default'}`;
  row.dataset.sender = msg.userId || msg.nickname;
  row.dataset.msgid = msg.id;
  row.id = `msg-${msg.id}`;

  const namebox = document.createElement('span');
  namebox.className = 'namebox';
  const badgesCont = document.createElement('div');
  badgesCont.className = 'badgescont';
  const badgesBox = document.createElement('div');
  badgesBox.className = 'badgesbox';
  const badges = document.createElement('span');
  badges.className = 'badges';

  for (const badge of msg.badges) badges.appendChild(renderBadge(badge));
  if (!state.settings.badgesDisplay || msg.badges.length === 0) badgesCont.classList.add('is-empty');
  badgesBox.appendChild(badges);
  badgesCont.appendChild(badgesBox);
  namebox.appendChild(badgesCont);

  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = msg.nickname;
  namebox.appendChild(name);

  const msgCont = document.createElement('div');
  msgCont.className = 'msgcont';
  const messageBox = document.createElement('div');
  messageBox.className = 'messagebox';
  messageBox.appendChild(renderDecor(msg.role));
  const message = document.createElement('span');
  message.className = 'message';
  message.innerHTML = linkify(escapeHtml(msg.message));
  messageBox.appendChild(message);
  msgCont.appendChild(messageBox);

  row.appendChild(namebox);
  row.appendChild(msgCont);

  if (state.settings.alignMessages === 'top') container.prepend(row);
  else container.appendChild(row);

  state.totalMessages += 1;
  if (state.settings.msgHideOpt) row.classList.add('animationOut');
  enforceLimit();
}

function normalizeMessage(v) {
  return {
    id: String(v.id || v.messageId || crypto.randomUUID()),
    userId: String(v.userId || v.hash || v.nickname || 'unknown'),
    nickname: String(v.nickname || v.nick || v.name || '익명'),
    message: String(v.message || v.text || v.content || ''),
    role: normalizeRole(v.role, v.badges),
    badges: Array.isArray(v.badges) ? v.badges : []
  };
}

function normalizeRole(role, badges = []) {
  const r = String(role || '').toLowerCase();
  if (['streamer', 'broadcaster'].includes(r)) return 'broadcaster';
  if (['manager', 'mod', 'moderator'].includes(r)) return 'moderator';
  if (['vip'].includes(r)) return 'vip';
  if (['subscriber', 'sub'].includes(r)) return 'subscriber';
  const list = badges.map(b => String(b.type || b).toLowerCase());
  if (list.includes('broadcaster')) return 'broadcaster';
  if (list.includes('moderator') || list.includes('manager')) return 'moderator';
  if (list.includes('vip')) return 'vip';
  if (list.includes('subscriber') || list.includes('sub')) return 'subscriber';
  return 'default';
}

function renderBadge(badge) {
  const wrap = document.createElement('span');
  wrap.className = `custombadge ${escapeAttr(badge.type || badge)}`;
  if (badge.url) {
    const img = document.createElement('img');
    img.alt = '';
    img.src = badge.url;
    wrap.appendChild(img);
    return wrap;
  }
  wrap.innerHTML = badgeSvg(badge.type || badge);
  return wrap;
}

function badgeSvg(type) {
  const t = String(type).toLowerCase();
  if (t.includes('moderator') || t.includes('manager')) return `<svg viewBox="0 0 96 96"><path fill="var(--badgescolor)" d="M12 52 39 78 86 18l-10-8-39 49-16-16z"/></svg>`;
  if (t.includes('vip')) return `<svg viewBox="0 0 96 96"><path fill="var(--badgescolor)" d="M9 36 25 15l23 18 23-18 16 21-17 45H26z"/></svg>`;
  if (t.includes('broadcaster') || t.includes('streamer')) return `<svg viewBox="0 0 96 96"><path fill="var(--badgescolor)" d="M15 19h66v46H57l-16 13V65H15z"/></svg>`;
  return `<svg viewBox="0 0 96 96"><path fill="var(--badgescolor)" d="M48 8 60 34l28 3-21 19 6 28-25-14-25 14 6-28L8 37l28-3z"/></svg>`;
}

function renderDecor(role) {
  const frag = document.createDocumentFragment();
  const box = document.createElement('span');
  box.className = 'decor-svg';
  const commonFrog = `<svg class="frogsub" viewBox="0 0 96 91"><path fill="var(--frog1)" d="M24 9c-8 0-15 7-15 15 0 3 1 6 3 9A43 43 0 0 0 5 57c0 23 19 34 43 34s43-11 43-34c0-9-3-17-8-24a15 15 0 1 0-23-18 45 45 0 0 0-24 0A15 15 0 0 0 24 9Z"/><circle cx="30" cy="55" r="7" fill="#423e4f"/><circle cx="66" cy="55" r="7" fill="#423e4f"/></svg>`;
  const lily = `<svg class="lilymain" viewBox="0 0 66 50"><path fill="var(--lilypad)" d="M1 31c13 6 14 7 0 14-3 2 3 5 9 5h28c4 0 3-9 6-5 2 5 3 5 8 5 6 0 11-2 14-8 4-9-4-15-10-17-12-4-31 1-31 1S6 27 1 31Z"/><path fill="var(--lily1)" d="M42 31S31 35 22 28s-5-12-5-12 9-3 17 4 8 11 8 11Z"/></svg>`;
  const pad = `<svg class="lilyfrog" viewBox="0 0 40 21"><path fill="var(--lilypad)" d="M20 0C9 0 0 5 0 10s9 11 20 11c4 0 8-1 11-2 1-1-2-4-1-4 1-1 6 2 7 1 2-2 3-4 3-6C40 5 31 0 20 0Z"/></svg>`;
  const sub = `<svg class="lilysub" viewBox="0 0 57 23"><circle cx="12" cy="12" r="11" fill="var(--frog1)"/><circle cx="45" cy="12" r="11" fill="var(--frog1)"/></svg>`;
  const mod = `<svg class="lilymod" viewBox="0 0 51 22"><circle cx="12" cy="11" r="10" fill="var(--frog1)"/><circle cx="39" cy="11" r="10" fill="var(--frog1)"/></svg>`;
  const hands = `<span class="lefthand"><svg class="lefthandflower" viewBox="0 0 30 30"><path fill="var(--lily1)" d="M15 0c3 8 7 9 15 6-4 7-3 11 0 18-8-3-12-2-15 6-3-8-7-9-15-6 4-7 3-11 0-18 8 3 12 2 15-6Z"/></svg></span><span class="righthand"></span>`;
  if (role === 'broadcaster') box.innerHTML = hands + commonFrog + pad + lily;
  else if (role === 'subscriber') box.innerHTML = commonFrog + sub;
  else if (role === 'moderator') box.innerHTML = commonFrog + mod + pad + lily;
  else if (role === 'vip') box.innerHTML = commonFrog + `<svg class="lilyvip" viewBox="0 0 66 50"><path fill="var(--lilypad)" d="M1 31c13 6 14 7 0 14-3 2 3 5 9 5h28c4 0 3-9 6-5 2 5 3 5 8 5 6 0 11-2 14-8 4-9-4-15-10-17-12-4-31 1-31 1S6 27 1 31Z"/><path fill="var(--lily1)" d="M42 31S31 35 22 28s-5-12-5-12 9-3 17 4 8 11 8 11Z"/></svg>`;
  else box.innerHTML = pad + lily;
  frag.appendChild(box);
  return frag;
}

function enforceLimit() {
  if (!state.settings.msgLimit) return;
  const limit = Math.max(1, Number(state.settings.msgLimitAmount || 7));
  const rows = [...container.querySelectorAll('.message-row')];
  while (rows.length > limit) {
    const target = state.settings.alignMessages === 'top' ? rows.pop() : rows.shift();
    target?.remove();
  }
}

function deleteMessage(id) { document.querySelector(`[data-msgid="${CSS.escape(String(id))}"]`)?.remove(); }
function deleteUser(userId) { document.querySelectorAll(`[data-sender="${CSS.escape(String(userId))}"]`).forEach(el => el.remove()); }
function safeJson(v) { try { return JSON.parse(v); } catch { return null; } }
function escapeHtml(v) { return String(v).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch])); }
function escapeAttr(v) { return String(v).replace(/[^a-zA-Z0-9_-]/g, ''); }
function linkify(v) { return v.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" style="color:inherit">$1</a>'); }
