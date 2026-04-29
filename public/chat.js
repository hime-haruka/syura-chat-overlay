const container = document.querySelector('.main-container');
const clientId = container.dataset.clientId;
const socket = io({ transports: ['websocket', 'polling'] });
socket.emit('join-chat', { clientId });

function escapeHtml(str){
  return String(str ?? '').replace(/[&<>'"]/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s]));
}
function toBool(v){ return v === true || v === 'true' || v === 'on' || v === 'yes'; }
function normalizeRole(input, msg = {}){
  const raw = [input, msg.role, msg.userRoleCode, msg.badgeType, ...(msg.badges||[]).map(b=>b.type||b.name||b.code||b.badgeId||'')]
    .filter(Boolean).join(' ').toLowerCase();
  if(/streamer|broadcaster|owner|creator|channel_owner|방장/.test(raw)) return 'broadcaster';
  if(/manager|moderator|mod|manager_user|운영자|매니저/.test(raw)) return 'mod';
  if(/vip|premium|파트너/.test(raw)) return 'vip';
  if(/subscriber|subscription|sub|구독/.test(raw)) return 'subscriber';
  if(/first|first-msg|firsttime|첫/.test(raw)) return 'first';
  return 'default';
}
function badgeSvg(type){
  const color = 'var(--badgescolor)';
  if(type === 'broadcaster') return `<svg class="svgbadge" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg"><path fill="${color}" d="M48 6 60 35 91 37 67 57 75 88 48 71 21 88 29 57 5 37 36 35z"/></svg>`;
  if(type === 'mod') return `<svg class="svgbadge" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg"><path fill="${color}" d="M48 5 88 22 82 70 48 91 14 70 8 22z"/></svg>`;
  if(type === 'vip') return `<svg class="svgbadge" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg"><path fill="${color}" d="M19 11h58l19 25-49 52L0 37z"/></svg>`;
  if(type === 'subscriber') return `<svg class="svgbadge" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg"><path fill="${color}" d="M17 31 32 18l16 19 16-19 15 13-8 47H25z"/></svg>`;
  if(type === 'first') return `<svg class="svgbadge" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg"><path fill="${color}" d="M48 8 58 36l30 1-23 18 8 29-25-17-25 17 8-29L8 37l30-1z"/></svg>`;
  return '';
}
function renderBadges(msg, roleClass){
  const cfg = window.CHAT_CONFIG || {};
  if(cfg.badgesDisplay === false || cfg.badgesShow === false || cfg.badgesdisplay === false) return '';
  const badges = [];
  const built = badgeSvg(roleClass);
  if(built && roleClass !== 'default') badges.push(`<span class="${roleClass} custombadge">${built}</span>`);
  for(const b of (msg.badges||[]).slice(0,5)){
    const url = b.imageUrl || b.url || b.badgeImageUrl || b.image || b.iconUrl;
    if(url) badges.push(`<span class="custombadge"><img alt="" src="${escapeHtml(url)}"/></span>`);
  }
  return badges.join('');
}
function getFragment(roleClass){
  const frags = window.ORIGINAL_MESSAGE_FRAGMENTS || {};
  return frags[roleClass] || frags.default || '</span></span><div class="msgcont"><div class="messagebox"><span class="message">';
}
function renderMessageContent(msg){
  const cfg = window.CHAT_CONFIG || {};
  let text = escapeHtml(msg.message || '').replace(/\n/g, '<br>');
  const emotes = Array.isArray(msg.emotes) ? msg.emotes : [];
  for(const e of emotes){
    const token = e.name || e.token || e.id;
    const url = e.url || e.imageUrl || e.image;
    if(!token || !url) continue;
    const imgClass = cfg.largeEmotes === 'off' ? 'nolarge' : (String(msg.message || '').trim() === token ? 'large' : 'default');
    const img = `<img class="${imgClass}" src="${escapeHtml(url)}" alt="${escapeHtml(token)}"/>`;
    text = text.split(escapeHtml(token)).join(img);
  }
  return text;
}
function pruneMessages(align){
  const cfg = window.CHAT_CONFIG || {};
  if(toBool(cfg.msgLimit)){
    const limit = Number(cfg.msgLimitAmount || 4);
    while(container.children.length > limit){
      if(align === 'top') container.removeChild(container.lastElementChild);
      else container.removeChild(container.firstElementChild);
    }
  }
  if(toBool(cfg.msgFade)){
    [...container.children].forEach(el => el.classList.remove('fadeOut'));
    const old = align === 'top' ? container.lastElementChild : container.firstElementChild;
    if(old) old.classList.add('fadeOut');
  }
}
function renderChatMessage(msg){
  const cfg = window.CHAT_CONFIG || {};
  if(!msg || !msg.message) return;
  const ignored = String(cfg.ignoredUsers || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  if(ignored.includes(String(msg.nickname || '').toLowerCase())) return;
  if(cfg.hideCommands === 'yes' && String(msg.message).startsWith('!')) return;

  const role = normalizeRole(msg.role || msg.userRoleCode || msg.type, msg);
  const id = String(msg.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`).replace(/[^a-zA-Z0-9_-]/g,'');
  const row = document.createElement('div');
  row.className = `message-row animation1 ${role}`;
  row.id = `msg-${id}`;
  row.dataset.sender = msg.userId || msg.channelId || msg.nickname || '';
  row.dataset.msgid = id;

  const badges = renderBadges(msg, role);
  const fragment = getFragment(role);
  const pronouns = msg.pronouns && toBool(cfg.pronounsOn) ? `<span class="pronounsDiv">${escapeHtml(msg.pronouns)}</span>` : '';
  row.innerHTML =
    `<span class="namebox">` +
      `<div class="badgescont"><div class="badgesbox"><span class="badges">${badges}</span></div></div>` +
      `<span class="name">${escapeHtml(msg.nickname || '익명')}</span>${pronouns}` +
    fragment +
      `${renderMessageContent(msg)}` +
      `</span></div></div>`;

  const align = cfg.alignMessages || 'bottom';
  if(align === 'top') container.prepend(row); else container.appendChild(row);
  if(toBool(cfg.msgHideOpt)) row.classList.add('animationOut');
  pruneMessages(align);
}

socket.on('chat-message', renderChatMessage);
socket.on('connect', () => socket.emit('join-chat', { clientId }));
