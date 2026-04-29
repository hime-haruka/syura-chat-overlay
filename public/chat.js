(() => {
  const container = document.querySelector('.main-container');
  const clientId = container?.dataset?.clientId || (location.pathname.split('/').filter(Boolean).pop() || 'pop');
  const cfg = window.CHAT_CONFIG || {};
  const socket = io({ transports: ['websocket', 'polling'] });

  const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s]));
  const bool = (v) => v === true || v === 'true' || v === 'on' || v === 'yes' || v === 1 || v === '1';

  function roleOf(msg = {}) {
    const badges = Array.isArray(msg.badges) ? msg.badges.map(b => Object.values(b || {}).join(' ')).join(' ') : '';
    const raw = [msg.role, msg.type, msg.userRoleCode, msg.badgeType, msg.authorType, badges].filter(Boolean).join(' ').toLowerCase();
    if (/streamer|broadcaster|owner|creator|channel_owner|방장|스트리머/.test(raw)) return 'broadcaster';
    if (/manager|moderator|mod|운영자|매니저|관리자/.test(raw)) return 'mod';
    if (/vip|premium/.test(raw)) return 'vip';
    if (/subscriber|subscription|sub|구독/.test(raw)) return 'sub';
    if (/first|first-msg|firsttime|첫/.test(raw)) return 'first-msg';
    return 'default';
  }

  function badgeSvg(role) {
    const common = `class="svgbadge" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"`;
    if (role === 'broadcaster') return `<svg ${common}><path fill="var(--badgescolor)" d="M48 7 60 35l30 2-23 19 7 30-26-16-26 16 7-30L6 37l30-2z"/></svg>`;
    if (role === 'mod') return `<svg ${common}><path fill="var(--badgescolor)" d="M48 5 88 22 82 69 48 91 14 69 8 22z"/></svg>`;
    if (role === 'vip') return `<svg ${common}><path fill="var(--badgescolor)" d="M19 11h58l18 25-47 52L1 36z"/></svg>`;
    if (role === 'sub') return `<svg ${common}><path fill="var(--badgescolor)" d="M17 31 32 18l16 19 16-19 15 13-8 47H25z"/></svg>`;
    if (role === 'first-msg') return `<svg ${common}><path fill="var(--badgescolor)" d="M48 8 58 36l30 1-23 18 8 29-25-17-25 17 8-29L8 37l30-1z"/></svg>`;
    return '';
  }

  function badgesHtml(msg, role) {
    if (cfg.badgesDisplay === false || cfg.badgesShow === false || cfg.badgesdisplay === false) return '';
    const list = [];
    const built = badgeSvg(role);
    if (built) list.push(`<span class="${role} custombadge">${built}</span>`);
    for (const b of (Array.isArray(msg.badges) ? msg.badges : []).slice(0, 5)) {
      const url = b.imageUrl || b.url || b.badgeImageUrl || b.image || b.iconUrl;
      if (url) list.push(`<span class="custombadge"><img alt="" src="${esc(url)}"></span>`);
    }
    return list.join('');
  }

  function lily(cls) {
    return `<svg class="${cls}" viewBox="0 0 66 50" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><ellipse cx="38" cy="33" rx="27" ry="12" fill="var(--lilypad)"/><path d="M5 31c10 0 18 3 27 3 11 0 19-5 29-2-4 10-15 16-29 16S8 42 5 31Z" fill="var(--lilypad)"/><path d="M33 30S18 24 17 13c8-1 15 4 18 14 3-10 9-16 17-15-1 11-16 18-16 18s-2-20 0-30c9 7 11 18 0 30Z" fill="var(--lily1)"/></svg>`;
  }
  function frog(cls) {
    return `<svg class="${cls}" viewBox="0 0 96 91" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="var(--frog1)" d="M24 18c-8 0-14 6-14 14 0 3 1 6 3 8A39 39 0 0 0 4 65c0 22 20 26 44 26s44-4 44-26c0-10-3-19-9-25a14 14 0 1 0-24-14 47 47 0 0 0-22 0 14 14 0 0 0-13-8Z"/><circle cx="28" cy="28" r="3" fill="#423e4f"/><circle cx="68" cy="28" r="3" fill="#423e4f"/><path d="M38 51c5 4 15 4 20 0" fill="none" stroke="#423e4f" stroke-width="4" stroke-linecap="round"/></svg>`;
  }
  function handDecor() {
    return `<div class="righthand"><svg viewBox="0 0 7 12"><rect x="1" y="1" width="5" height="10" rx="2.5" fill="var(--frog1)"/></svg></div><div class="lefthand"><svg class="lefthandflower" viewBox="0 0 30 30"><circle cx="15" cy="15" r="6" fill="var(--lily1)"/><g fill="var(--lily1)"><circle cx="15" cy="4" r="5"/><circle cx="15" cy="26" r="5"/><circle cx="4" cy="15" r="5"/><circle cx="26" cy="15" r="5"/></g></svg><svg class="lefthandw" viewBox="0 0 6 9"><rect x="1" y="1" width="4" height="7" rx="2" fill="var(--frog1)"/></svg></div>`;
  }
  function decor(role) {
    if (bool(cfg.decorOff)) return '';
    if (role === 'broadcaster') return handDecor() + frog('frogsub') + lily('lilyfrog') + lily('lilymod') + lily('lilymain');
    if (role === 'sub') return frog('frogsub') + lily('lilysub');
    if (role === 'vip') return lily('lilyvip');
    if (role === 'mod') return lily('lilymod');
    return lily('lilymain');
  }

  function messageHtml(msg) {
    let text = esc(msg.message || '').replace(/\n/g, '<br>');
    const emotes = Array.isArray(msg.emotes) ? msg.emotes : [];
    for (const e of emotes) {
      const token = e.name || e.token || e.id;
      const url = e.url || e.imageUrl || e.image;
      if (!token || !url) continue;
      const cls = cfg.largeEmotes === 'off' ? 'nolarge' : (String(msg.message || '').trim() === token ? 'large' : 'default');
      text = text.split(esc(token)).join(`<img class="${cls}" src="${esc(url)}" alt="${esc(token)}">`);
    }
    return text;
  }

  function prune(align) {
    if (bool(cfg.msgLimit)) {
      const limit = Math.max(1, Number(cfg.msgLimitAmount || 7));
      while (container.children.length > limit) {
        container.removeChild(align === 'top' ? container.lastElementChild : container.firstElementChild);
      }
    }
  }

  function render(msg) {
    if (!container || !msg || !msg.message) return;
    const ignored = String(cfg.ignoredUsers || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (ignored.includes(String(msg.nickname || '').toLowerCase())) return;
    if (cfg.hideCommands === 'yes' && String(msg.message || '').startsWith('!')) return;

    const role = roleOf(msg);
    const id = String(msg.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`).replace(/[^a-zA-Z0-9_-]/g, '');
    const row = document.createElement('div');
    row.className = `message-row animation1 ${role}`;
    row.id = `msg-${id}`;
    row.dataset.sender = msg.userId || msg.channelId || msg.nickname || '';
    row.dataset.msgid = id;
    const pronouns = msg.pronouns && bool(cfg.pronounsOn) ? `<span class="pronounsDiv">${esc(msg.pronouns)}</span>` : '';
    row.innerHTML = `<span class="namebox"><div class="badgescont"><div class="badgesbox"><span class="badges">${badgesHtml(msg, role)}</span></div></div><span class="name">${esc(msg.nickname || '익명')}</span>${pronouns}</span><div class="msgcont"><div class="messagebox">${decor(role)}<span class="message">${messageHtml(msg)}</span></div></div>`;

    const align = cfg.alignMessages || 'bottom';
    if (align === 'top') container.prepend(row); else container.appendChild(row);
    if (bool(cfg.msgHideOpt)) row.classList.add('animationOut');
    prune(align);
  }

  socket.on('chat-message', render);
  socket.on('connect', () => socket.emit('join-chat', { clientId }));
  socket.emit('join-chat', { clientId });
  window.__renderChatMessage = render;
})();
