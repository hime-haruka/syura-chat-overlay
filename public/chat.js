(() => {
  const container = document.querySelector('.main-container');
  const clientId = container?.dataset?.clientId || (location.pathname.split('/').filter(Boolean).pop() || 'pop');
  const cfg = window.CHAT_CONFIG || {};
  const FRAG = window.ORIGINAL_MESSAGE_FRAGMENTS || {};
  const socket = io({ transports: ['websocket', 'polling'] });
  const esc = (str) => String(str ?? '').replace(/[&<>'"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s]));
  const yes = (v) => v === true || v === 'true' || v === 'on' || v === 'yes' || v === 1 || v === '1';
  function roleOf(msg = {}) {
    const badgeText = (msg.badges || []).map(b => b?.type || b?.name || b?.code || b?.badgeId || '').join(' ');
    const raw = [msg.role, msg.userRoleCode, msg.badgeType, msg.authorType, badgeText].filter(Boolean).join(' ').toLowerCase();
    if (/streamer|broadcaster|owner|creator|channel_owner|host|방장|스트리머/.test(raw)) return 'broadcaster';
    if (/manager|moderator|mod|manager_user|manageruser|운영자|매니저|관리자/.test(raw)) return 'mod';
    if (/vip|premium/.test(raw)) return 'vip';
    if (/subscriber|subscription|sub|구독/.test(raw)) return 'subscriber';
    if (/first|first-msg|firsttime|첫/.test(raw)) return 'first';
    return 'default';
  }
  function badgeSvg(type) {
    const common = `class="svgbadge" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"`;
    if (type === 'broadcaster') return `<svg ${common}><path fill="var(--badgescolor)" d="M48 7 60 35l30 2-23 19 7 30-26-16-26 16 7-30L6 37l30-2z"/></svg>`;
    if (type === 'mod') return `<svg ${common}><path fill="var(--badgescolor)" d="M48 5 88 22 82 69 48 91 14 69 8 22z"/></svg>`;
    if (type === 'vip') return `<svg ${common}><path fill="var(--badgescolor)" d="M19 11h58l18 25-47 52L1 36z"/></svg>`;
    if (type === 'subscriber') return `<svg ${common}><path fill="var(--badgescolor)" d="M17 31 32 18l16 19 16-19 15 13-8 47H25z"/></svg>`;
    if (type === 'first') return `<svg ${common}><path fill="var(--badgescolor)" d="M48 8 58 36l30 1-23 18 8 29-25-17-25 17 8-29L8 37l30-1z"/></svg>`;
    return '';
  }
  function badges(msg, role) {
    if (cfg.badgesDisplay === false || cfg.badgesShow === false || cfg.badgesdisplay === false) return '';
    const out = [];
    const built = badgeSvg(role);
    if (built && role !== 'default') out.push(`<span class="${role} custombadge">${built}</span>`);
    for (const b of (msg.badges || []).slice(0, 5)) {
      const url = b?.imageUrl || b?.url || b?.badgeImageUrl || b?.image || b?.iconUrl;
      if (url) out.push(`<span class="custombadge"><img alt="" src="${esc(url)}"></span>`);
    }
    return out.join('');
  }
  function content(msg) {
    let text = esc(msg.message || msg.text || '').replace(/\n/g, '<br>');
    for (const e of (Array.isArray(msg.emotes) ? msg.emotes : [])) {
      const token = e?.name || e?.token || e?.id, url = e?.url || e?.imageUrl || e?.image;
      if (!token || !url) continue;
      const imgClass = cfg.largeEmotes === 'off' ? 'nolarge' : (String(msg.message || msg.text || '').trim() === token ? 'large' : 'default');
      text = text.split(esc(token)).join(`<img class="${imgClass}" src="${esc(url)}" alt="${esc(token)}">`);
    }
    return text;
  }
  function prune(align) {
    if (yes(cfg.msgLimit)) {
      const limit = Math.max(1, Number(cfg.msgLimitAmount || 4));
      while (container.children.length > limit) container.removeChild(align === 'top' ? container.lastElementChild : container.firstElementChild);
    }
    if (yes(cfg.msgFade)) {
      [...container.children].forEach(el => el.classList.remove('fadeOut'));
      const old = align === 'top' ? container.lastElementChild : container.firstElementChild;
      if (old) old.classList.add('fadeOut');
    }
  }
  function renderChatMessage(msg) {
    if (!container || !msg || !(msg.message || msg.text)) return;
    const nickname = msg.nickname || msg.displayName || msg.name || msg.sender || '익명';
    const ignored = String(cfg.ignoredUsers || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (ignored.includes(String(nickname).toLowerCase())) return;
    if (String(cfg.hideCommands || '').toLowerCase() === 'yes' && String(msg.message || msg.text || '').startsWith('!')) return;
    const role = roleOf(msg);
    const id = esc(msg.id || msg.msgId || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const pronouns = msg.pronouns && yes(cfg.pronounsOn) ? `<span class="pronounsDiv">${esc(msg.pronouns)}</span>` : '';
    const fragment = FRAG[role] || FRAG.default || `</span></span><div class="msgcont"><div class="messagebox"><span class="message">`;
    const row = document.createElement('div');
    row.className = `message-row animation1 ${role}`;
    row.dataset.sender = nickname;
    row.dataset.msgid = id;
    row.id = `msg-${id}`;
    row.innerHTML = `<span class="namebox"><div class="badgescont"><div class="badgesbox"><span class="badges">${badges(msg, role)}</span></div></div><span class="name">${esc(nickname)}${pronouns}${fragment}${content(msg)}</span></div></div>`;
    const align = cfg.alignMessages || 'bottom';
    if (align === 'top') container.prepend(row); else container.appendChild(row);
    if (yes(cfg.msgHideOpt)) row.classList.add('animationOut');
    prune(align);
  }
  socket.on('chat-message', renderChatMessage);
  socket.on('connect', () => socket.emit('join-chat', { clientId }));
  socket.emit('join-chat', { clientId });
  window.__renderChatMessage = renderChatMessage;
})();