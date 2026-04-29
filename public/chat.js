
const container = document.querySelector('.main-container');
const clientId = container.dataset.clientId;
const socket = io();
socket.emit('join-chat', { clientId });

function escapeHtml(str){return String(str ?? '').replace(/[&<>'"]/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s]));}
function normalizeRole(role){
  const r = String(role || '').toLowerCase();
  if(r.includes('streamer') || r.includes('broadcaster') || r.includes('owner')) return 'broadcaster';
  if(r.includes('manager') || r.includes('moderator') || r === 'mod') return 'mod';
  if(r.includes('vip')) return 'vip';
  if(r.includes('subscriber') || r.includes('sub')) return 'subscriber';
  if(r.includes('first')) return 'first';
  return 'default';
}
function badgeSvg(type){
  const color = 'var(--badgescolor)';
  if(type === 'broadcaster') return `<svg class="svgbadge" viewBox="0 0 96 96"><path fill="${color}" d="M48 6 60 35 91 37 67 57 75 88 48 71 21 88 29 57 5 37 36 35z"/></svg>`;
  if(type === 'mod') return `<svg class="svgbadge" viewBox="0 0 96 96"><path fill="${color}" d="M48 5 88 22 82 70 48 91 14 70 8 22z"/></svg>`;
  if(type === 'vip') return `<svg class="svgbadge" viewBox="0 0 96 96"><path fill="${color}" d="M15 35 32 18 48 36 64 18 81 35 72 78H24z"/></svg>`;
  if(type === 'subscriber') return `<svg class="svgbadge" viewBox="0 0 96 96"><path fill="${color}" d="M19 11h58l19 25-49 52L0 37z"/></svg>`;
  return '';
}
function renderBadges(msg, roleClass){
  if(window.CHAT_CONFIG?.badgesDisplay === false || window.CHAT_CONFIG?.badgesShow === false) return '';
  const badges = [];
  const built = badgeSvg(roleClass);
  if(built) badges.push(`<span class="${roleClass} custombadge">${built}</span>`);
  for(const b of (msg.badges||[]).slice(0,4)){
    const url = b.imageUrl || b.url || b.badgeImageUrl;
    if(url) badges.push(`<span class="custombadge"><img alt="" src="${escapeHtml(url)}"/></span>`);
  }
  return badges.join('');
}
function getFragment(roleClass){
  const frags = window.ORIGINAL_MESSAGE_FRAGMENTS || {};
  return frags[roleClass] || frags.default || '</span></span><div class="msgcont"><div class="messagebox"><span class="message">';
}
function renderChatMessage(msg){
  const role = normalizeRole(msg.role || msg.userRoleCode || msg.type);
  const row = document.createElement('div');
  row.className = `message-row animation1 ${role}`;
  row.dataset.sender = msg.userId || msg.nickname || '';
  row.dataset.msgid = msg.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const badges = renderBadges(msg, role);
  const fragment = getFragment(role);
  row.innerHTML = `<span class="namebox"><div class="badgescont"><div class="badgesbox"><span class="badges">${badges}</span></div></div><span class="name">${escapeHtml(msg.nickname || '익명')}` + fragment + `${escapeHtml(msg.message || '')}</span></div></div></div>`;
  const align = window.CHAT_CONFIG?.alignMessages || 'bottom';
  if(align === 'top') container.prepend(row); else container.appendChild(row);
  if(window.CHAT_CONFIG?.msgHideOpt){ row.classList.add('animationOut'); }
  if(window.CHAT_CONFIG?.msgFade){
    for(const el of [...container.children]) el.classList.remove('fadeOut');
    const target = align === 'top' ? container.lastElementChild : container.firstElementChild;
    if(target && target !== row) target.classList.add('fadeOut');
  }
  if(window.CHAT_CONFIG?.msgLimit){
    const limit = Number(window.CHAT_CONFIG.msgLimitAmount||4);
    while(container.children.length > limit){
      if(align === 'top') container.removeChild(container.lastElementChild); else container.removeChild(container.firstElementChild);
    }
  }
}
socket.on('chat-message', renderChatMessage);
