const config = window.OVERLAY_CONFIG || {};
const root = document.documentElement;
const container = document.querySelector('.main-container');

const DEFAULTS = {
  alignMessages: 'bottom',
  msgHideOpt: false,
  msgHide: 7,
  msgLimit: false,
  msgLimitAmount: 4,
  namesSize: 16,
  msgSize: 16,
  namesBold: '700',
  msgBold: '700',
  namesFont: 'Quicksand',
  msgFont: 'Quicksand',
  namescolor: '#ffffff',
  msgcolor: '#47843b',
  msgback: '#ffffff',
  accentcolor: '#dcbb96',
  bordercol: '#97d561',
  badgesContcolor: '#bce78e',
  badgescolor: '#ffffff',
  msgDistance: 20,
  frog1: '#bce78e',
  lily1: '#f592b4',
  lilypad: '#82c080'
};

function val(...keys) {
  for (const k of keys) if (config[k] !== undefined) return config[k];
  return undefined;
}

function applyConfig() {
  const c = { ...DEFAULTS, ...config };
  const map = {
    '--namesSize': `${val('namesSize') ?? c.namesSize}px`,
    '--msgSize': `${val('msgSize') ?? c.msgSize}px`,
    '--msgHide': `${val('msgHide') ?? c.msgHide}s`,
    '--namesBold': val('namesBold') ?? c.namesBold,
    '--msgBold': val('msgBold') ?? c.msgBold,
    '--namesFont': `'${val('namesFont') ?? c.namesFont}', sans-serif`,
    '--msgFont': `'${val('msgFont') ?? c.msgFont}', sans-serif`,
    '--namescolor': val('namescolor', 'names-color') ?? c.namescolor,
    '--msgcolor': val('msgcolor', 'msg-color') ?? c.msgcolor,
    '--msgback': val('msgback', 'msg-back') ?? c.msgback,
    '--accentcolor': val('accentcolor') ?? c.accentcolor,
    '--bordercol': val('bordercol', 'bordercolor') ?? c.bordercol,
    '--badgesContcolor': val('badgesContcolor') ?? c.badgesContcolor,
    '--badgescolor': val('badgescolor') ?? c.badgescolor,
    '--msgDistance': `${val('msgDistance') ?? c.msgDistance}px`,
    '--frog1': val('frog1') ?? c.frog1,
    '--lily1': val('lily1') ?? c.lily1,
    '--lilypad': val('lilypad') ?? c.lilypad
  };
  Object.entries(map).forEach(([k, v]) => root.style.setProperty(k, v));
  container.style.justifyContent = (config.alignMessages || 'bottom') === 'top' ? 'flex-start' : 'flex-end';
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[ch]));
}

function renderEmojis(text, emojis = {}) {
  let out = escapeHtml(text);
  for (const [key, url] of Object.entries(emojis || {})) {
    const safeKey = escapeHtml(key);
    const safeUrl = escapeHtml(url);
    out = out.split(safeKey).join(`<img class="emote" src="${safeUrl}" alt="${safeKey}">`);
  }
  return out;
}

function roleLabel(role) {
  if (role === 'streamer') return 'S';
  if (role === 'streaming_channel_manager') return 'M';
  if (role === 'streaming_chat_manager') return 'C';
  return '';
}

function makeBadges(data) {
  const wrap = document.createElement('span');
  wrap.className = 'badges';
  const role = roleLabel(data.role);
  if (role) {
    const b = document.createElement('span');
    b.className = 'role-badge';
    b.textContent = role;
    wrap.appendChild(b);
  }
  if (data.verified) {
    const b = document.createElement('span');
    b.className = 'role-badge';
    b.textContent = '✓';
    wrap.appendChild(b);
  }
  if (Array.isArray(data.badges)) {
    data.badges.forEach((badge) => {
      const url = badge.imageUrl || badge.imageURL || badge.url;
      if (!url) return;
      const img = document.createElement('img');
      img.className = 'custombadge';
      img.src = url;
      img.alt = '';
      wrap.appendChild(img);
    });
  }
  return wrap;
}

function renderChat(data) {
  const row = document.createElement('div');
  row.className = `message-row animation1 ${escapeHtml(data.role || 'default')}`;
  row.dataset.msgid = data.id || String(Date.now());

  const namebox = document.createElement('span');
  namebox.className = 'namebox';

  const badgescont = document.createElement('div');
  badgescont.className = 'badgescont';
  const badgesbox = document.createElement('div');
  badgesbox.className = 'badgesbox';
  badgesbox.appendChild(makeBadges(data));
  badgescont.appendChild(badgesbox);
  namebox.appendChild(badgescont);

  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = data.nickname || '익명';
  namebox.appendChild(name);

  const msgcont = document.createElement('div');
  msgcont.className = 'msgcont';
  const messagebox = document.createElement('div');
  messagebox.className = 'messagebox';
  const message = document.createElement('span');
  message.className = 'message';
  message.innerHTML = renderEmojis(data.message || '', data.emojis || {});
  messagebox.appendChild(message);
  msgcont.appendChild(messagebox);

  row.appendChild(namebox);
  row.appendChild(msgcont);
  addRow(row);
}

function renderDonation(data) {
  renderChat({
    ...data,
    role: 'donation',
    nickname: data.nickname || '후원자',
    message: `${data.amount ? data.amount + '원 후원! ' : '후원! '}${data.message || ''}`
  });
}

function renderSubscription(data) {
  renderChat({
    ...data,
    role: 'subscriber',
    nickname: data.nickname || '구독자',
    message: `${data.tierName || '구독'} ${data.month ? data.month + '개월' : ''}`
  });
}

function addRow(row) {
  if ((config.alignMessages || 'bottom') === 'top') container.appendChild(row);
  else container.appendChild(row);

  if (config.msgHideOpt) {
    setTimeout(() => {
      row.classList.add('fadeOut');
      setTimeout(() => row.remove(), 650);
    }, Number(config.msgHide || 7) * 1000);
  }
  if (config.msgLimit) {
    const limit = Number(config.msgLimitAmount || 4);
    while (container.children.length > limit) container.removeChild(container.firstElementChild);
  }
}

function connect() {
  const ws = new WebSocket(window.WS_URL);
  ws.addEventListener('message', (event) => {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    if (data.type === 'chat') renderChat(data);
    if (data.type === 'donation') renderDonation(data);
    if (data.type === 'subscription') renderSubscription(data);
  });
  ws.addEventListener('close', () => setTimeout(connect, 2500));
  ws.addEventListener('error', () => {});
}

applyConfig();
connect();
