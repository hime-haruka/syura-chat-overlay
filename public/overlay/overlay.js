const params = new URLSearchParams(location.search);
const clientId = params.get('client') || 'pop';
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
  } catch (err) {
    console.warn('[overlay] style load failed', err);
  }
  applyCssVars(state.settings);
  container?.classList.toggle('align-top', state.settings.alignMessages === 'top');
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
  const vars = {
    namesSize: `${s.namesSize}px`,
    msgSize: `${s.msgSize}px`,
    msgback: s.msgback,
    nameback: s.nameback,
    namesBold: s.namesBold,
    msgBold: s.msgBold,
    namesFont: `'${s.namesFont}', sans-serif`,
    msgFont: `'${s.msgFont}', sans-serif`,
    namescolor: s.namescolor,
    msgcolor: s.msgcolor,
    badgesContcolor: s.badgesContcolor,
    badgescolor: s.badgescolor,
    bordercol: s.bordercol,
    frog1: s.frog1,
    lily1: s.lily1,
    lilypad: s.lilypad,
    msgHide: `${s.msgHide}s`
  };
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(`--${k}`, v));
}

function connectOverlaySocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${location.host}/ws/overlay?client=${encodeURIComponent(clientId)}`);
  ws.onopen = () => console.log('[overlay] websocket connected');
  ws.onmessage = (event) => {
    const data = safeJson(event.data);
    if (!data) return;
    if (data.type === 'chat' || data.type === 'donation' || data.type === 'subscription') renderChatMessage(data);
    if (data.type === 'system') console.log('[overlay system]', data.message);
  };
  ws.onclose = () => setTimeout(connectOverlaySocket, 1500);
}

function renderChatMessage(data) {
  const nickname = String(data.nickname || '익명').trim();
  const message = String(data.message || '').trim();
  if (!message) return;
  if (shouldIgnore(nickname, message)) return;

  const row = document.createElement('div');
  row.className = `message-row animation1 ${roleClass(data.role)} ${state.settings.msgHideOpt ? 'animationOut' : ''}`;
  row.dataset.sender = nickname;
  row.dataset.msgid = data.id || crypto.randomUUID();

  const namebox = document.createElement('span');
  namebox.className = 'namebox';

  const badgescont = document.createElement('div');
  badgescont.className = 'badgescont';
  const badgesbox = document.createElement('div');
  badgesbox.className = 'badgesbox';
  const badges = document.createElement('span');
  badges.className = 'badges';

  const renderedBadges = buildBadges(data);
  if (!renderedBadges.length || !truthy(state.settings.badgesDisplay ?? state.settings.badgesdisplay ?? state.settings.badgesShow)) badgescont.classList.add('is-empty');
  renderedBadges.forEach((b) => badges.appendChild(b));

  badgesbox.appendChild(badges);
  badgescont.appendChild(badgesbox);
  namebox.appendChild(badgescont);

  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = nickname;
  namebox.appendChild(name);

  const msgcont = document.createElement('div');
  msgcont.className = 'msgcont';
  const messagebox = document.createElement('div');
  messagebox.className = 'messagebox';
  messagebox.appendChild(decorForRole(data.role));
  const msg = document.createElement('span');
  msg.className = 'message';
  renderMessageContent(msg, message, data.emojis || {});
  messagebox.appendChild(msg);
  msgcont.appendChild(messagebox);

  row.appendChild(namebox);
  row.appendChild(msgcont);

  if (state.settings.alignMessages === 'top') container.appendChild(row);
  else container.appendChild(row);

  state.totalMessages += 1;
  enforceLimit();
}

function shouldIgnore(nickname, message) {
  if (state.settings.hideCommands === 'yes' && message.startsWith('!')) return true;
  const ignored = String(state.settings.ignoredUsers || '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
  return ignored.includes(nickname.toLowerCase());
}

function enforceLimit() {
  if (!truthy(state.settings.msgLimit)) return;
  const limit = Math.max(1, Number(state.settings.msgLimitAmount || 7));
  while (container.children.length > limit) container.removeChild(container.firstElementChild);
}

function roleClass(role) {
  if (role === 'streamer') return 'broadcaster';
  if (role === 'mod') return 'mod';
  if (role === 'vip') return 'vip';
  if (role === 'subscriber') return 'sub';
  if (role === 'donation') return 'premium';
  return 'default';
}

function buildBadges(data) {
  const out = [];
  if (data.verifiedMark) out.push(svgBadge('verified'));
  const role = data.role;
  if (role === 'streamer') out.push(svgBadge('streamer'));
  if (role === 'mod') out.push(svgBadge('mod'));
  if (role === 'vip') out.push(svgBadge('vip'));
  if (role === 'subscriber') out.push(svgBadge('sub'));
  if (role === 'donation') out.push(svgBadge('donation'));
  (data.badges || []).forEach((badge) => {
    if (badge?.imageUrl) {
      const wrap = document.createElement('span');
      wrap.className = 'custombadge';
      const img = document.createElement('img');
      img.alt = '';
      img.src = badge.imageUrl;
      wrap.appendChild(img);
      out.push(wrap);
    }
  });
  return out;
}

function svgBadge(type) {
  const wrap = document.createElement('span');
  wrap.className = `custombadge ${type}`;
  const shapes = {
    streamer: '<path fill="var(--badgescolor)" d="M48 5l12 28 31 3-23 20 7 30-27-16-27 16 7-30L5 36l31-3z"/>',
    mod: '<path fill="var(--badgescolor)" d="M48 6l36 14v25c0 23-15 37-36 45C27 82 12 68 12 45V20z"/>',
    vip: '<path fill="var(--badgescolor)" d="M12 30l18 18 18-30 18 30 18-18-6 48H18z"/>',
    sub: '<path fill="var(--badgescolor)" d="M48 10c12 0 22 10 22 22 0 22-22 28-22 50 0-22-22-28-22-50 0-12 10-22 22-22z"/>',
    donation: '<path fill="var(--badgescolor)" d="M48 8c22 0 40 18 40 40S70 88 48 88 8 70 8 48 26 8 48 8zm-5 18v9c-8 2-13 7-13 15 0 10 8 14 17 17 6 2 9 3 9 7 0 3-3 5-8 5-6 0-12-2-17-5l-3 10c4 3 10 5 16 6v10h9V90c9-2 14-8 14-16 0-9-5-14-16-18-7-3-10-4-10-7 0-3 3-5 8-5s9 1 13 3l3-10c-3-2-7-3-12-4v-7z"/>',
    verified: '<path fill="var(--badgescolor)" d="M37 78L12 53l10-10 15 15 37-40 10 9z"/>'
  };
  wrap.innerHTML = `<svg class="svgbadge" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">${shapes[type] || shapes.sub}</svg>`;
  return wrap;
}

function decorForRole(role) {
  const frag = document.createDocumentFragment();
  if (role === 'streamer') frag.append(svgDecor('lilymain'), svgDecor('lilyfrog'));
  else if (role === 'mod') frag.append(svgDecor('lilymod'));
  else if (role === 'vip') frag.append(svgDecor('lilyvip'));
  else if (role === 'subscriber') frag.append(svgDecor('lilysub'), svgDecor('frogsub'));
  return frag;
}

function svgDecor(className) {
  const div = document.createElement('span');
  div.className = `${className} decor-svg`;
  const map = {
    lilymain: '<svg viewBox="0 0 66 50"><ellipse cx="39" cy="31" rx="24" ry="12" fill="var(--lilypad)"/><path d="M29 30s-12-3-13-15c8-3 20 2 25 15z" fill="var(--lily1)"/></svg>',
    lilyfrog: '<svg viewBox="0 0 80 42"><ellipse cx="40" cy="24" rx="36" ry="15" fill="var(--lilypad)"/></svg>',
    lilymod: '<svg viewBox="0 0 80 38"><circle cx="24" cy="19" r="14" fill="var(--frog1)"/><circle cx="54" cy="19" r="14" fill="var(--frog1)"/></svg>',
    lilyvip: '<svg viewBox="0 0 80 60"><ellipse cx="40" cy="37" rx="32" ry="16" fill="var(--lilypad)"/><path d="M40 34s-18-8-18-22c13-4 26 8 30 22z" fill="var(--lily1)"/></svg>',
    lilysub: '<svg viewBox="0 0 80 36"><circle cx="24" cy="18" r="13" fill="var(--frog1)"/><circle cx="56" cy="18" r="13" fill="var(--frog1)"/></svg>',
    frogsub: '<svg viewBox="0 0 96 91"><path d="M48 8c22 0 40 18 40 40S70 85 48 85 8 70 8 48 26 8 48 8z" fill="var(--frog1)"/><circle cx="31" cy="43" r="5" fill="#423e4f"/><circle cx="65" cy="43" r="5" fill="#423e4f"/></svg>'
  };
  div.innerHTML = map[className] || '';
  return div;
}

function renderMessageContent(target, message, emojis) {
  const emojiMap = emojis && typeof emojis === 'object' ? emojis : {};
  if (!Object.keys(emojiMap).length) {
    target.textContent = message;
    return;
  }
  const parts = message.split(/(\s+)/);
  parts.forEach((part) => {
    if (emojiMap[part]) {
      const img = document.createElement('img');
      img.className = 'default';
      img.src = emojiMap[part];
      img.alt = part;
      target.appendChild(img);
    } else {
      target.appendChild(document.createTextNode(part));
    }
  });
}

function truthy(v) {
  return v === true || v === 'true' || v === 'yes' || v === 'on';
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return null; }
}
