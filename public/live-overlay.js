
(() => {
  const container = document.querySelector('.main-container');
  const clientId = container?.dataset?.clientId || location.pathname.split('/').filter(Boolean).pop() || 'pop';
  const config = window.CHAT_CONFIG || {};
  const fragments = window.ORIGINAL_MESSAGE_FRAGMENTS || {};
  const socket = io({ transports: ['websocket', 'polling'] });

  const state = {
    maxMessages: Number(config.msgLimitAmount || 7),
    msgLimit: config.msgLimit === true || config.msgLimit === 'true' || config.msgLimit === 'yes',
    alignMessages: config.alignMessages || 'bottom',
    ignoredUsers: String(config.ignoredUsers || 'StreamElements,OtherBot').split(',').map(v => v.trim().toLowerCase()).filter(Boolean),
    hideCommands: config.hideCommands || 'yes'
  };

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function normalizeIncoming(payload = {}) {
    const data = payload?.data || payload;
    if (data.type === 'donation' || payload.type === 'donation') return { ...data, type: 'donation' };
    if (data.type === 'subscription' || payload.type === 'subscription') return { ...data, type: 'subscription' };

    return {
      type: 'chat',
      id: data.id || data.messageId || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      userId: data.userId || data.senderChannelId || data.channelId || data.nickname || 'unknown',
      nickname: data.nickname || data.name || data.sender || data.profile?.nickname || '익명',
      message: String(data.message ?? data.content ?? data.text ?? ''),
      role: normalizeRole(data.role || data.userRoleCode || data.profile?.userRoleCode, data),
      badges: Array.isArray(data.badges) ? data.badges : (Array.isArray(data.profile?.badges) ? data.profile.badges : []),
      emotes: Array.isArray(data.emotes) ? data.emotes : [],
      raw: data.raw || data
    };
  }

  function normalizeRole(role, data = {}) {
    const raw = String(role || '').toLowerCase();
    if (/broadcaster|streamer|owner|creator|방장|스트리머/.test(raw)) return 'broadcaster';
    if (/mod|moderator|manager|매니저|관리자/.test(raw)) return 'mod';
    if (/subscriber|subscription|sub|구독/.test(raw)) return 'subscriber';
    if (/vip|follower|follow|팔로워/.test(raw)) return 'vip';
    return 'default';
  }

  function fragmentKey(role) {
    if (role === 'mod') return 'mod';
    if (role === 'broadcaster') return 'broadcaster';
    if (role === 'subscriber') return 'subscriber';
    if (role === 'vip') return 'vip';
    return 'default';
  }

  function badgeSvg(type) {
    const common = `class="svgbadge" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"`;
    if (type === 'broadcaster') return `<svg ${common}><path fill="var(--badgescolor)" d="M48 7 60 35l30 2-23 19 7 30-26-16-26 16 7-30L6 37l30-2z"/></svg>`;
    if (type === 'mod') return `<svg ${common}><path fill="var(--badgescolor)" d="M48 5 88 22 82 69 48 91 14 69 8 22z"/></svg>`;
    if (type === 'subscriber') return `<svg ${common}><path fill="var(--badgescolor)" d="M17 31 32 18l16 19 16-19 15 13-8 47H25z"/></svg>`;
    if (type === 'vip') return `<svg ${common}><path fill="var(--badgescolor)" d="M48 82C23 60 11 48 11 31c0-11 8-19 19-19 7 0 14 4 18 10 4-6 11-10 18-10 11 0 19 8 19 19 0 17-12 29-37 51z"/></svg>`;
    return '';
  }

  function renderBadges(item) {
    if (item.role === 'default') return '';

    const roleBadge = badgeSvg(item.role);
    const badges = [];
    if (roleBadge) badges.push(`<span class="${item.role} custombadge">${roleBadge}</span>`);

    for (const b of item.badges || []) {
      const url = b?.imageUrl || b?.url || b?.badgeImageUrl || b?.image || b?.iconUrl;
      if (!url) continue;
      badges.push(`<span class="custombadge"><img alt="" src="${esc(url)}"></span>`);
    }
    return `<div class="badgescont"><div class="badgesbox"><span class="badges">${badges.join('')}</span></div></div>`;
  }

  function renderMessageText(message, emotes = []) {
    let html = esc(message).replace(/\n/g, '<br>');
    for (const emote of emotes) {
      const token = emote.token || emote.name || emote.id;
      const url = emote.url || emote.imageUrl || emote.image;
      if (!token || !url) continue;
      const img = `<img class="default" src="${esc(url)}" alt="${esc(token)}">`;
      html = html.split(esc(token)).join(img);
      if (emote.name && emote.name !== token) html = html.split(esc(emote.name)).join(img);
    }
    return html;
  }

  function appendNode(row) {
    if (!container) return;
    if (state.alignMessages === 'top') container.prepend(row);
    else container.appendChild(row);

    if (state.msgLimit) {
      while (container.children.length > state.maxMessages) {
        if (state.alignMessages === 'top') container.removeChild(container.lastElementChild);
        else container.removeChild(container.firstElementChild);
      }
    }
  }

  function renderChat(raw) {
    const item = normalizeIncoming(raw);
    if (item.type === 'donation') return renderDonation(item);
    if (item.type === 'subscription') {
      return renderChat({ ...item, type: 'chat', role: 'subscriber', message: item.message || '구독했습니다!' });
    }

    const nickname = String(item.nickname || '익명').trim();
    const message = String(item.message || '').trim();
    if (!message) return;
    if (state.hideCommands === 'yes' && message.startsWith('!')) return;
    if (state.ignoredUsers.includes(nickname.toLowerCase())) return;

    const role = normalizeRole(item.role, item);
    const fragment = fragments[fragmentKey(role)] || fragments.default || '';
    const row = document.createElement('div');
    row.innerHTML = `
      <div data-sender="${esc(item.userId || nickname)}" id="msg-${esc(item.id)}" data-msgid="${esc(item.id)}" class="message-row animation1 ${esc(role)}">
        <span class="namebox">
          ${renderBadges({ ...item, role })}
          <span class="name">${esc(nickname)}
          ${fragment}
          ${renderMessageText(message, item.emotes)}
          </span>
        </div>
      </div>
    `.trim();

    appendNode(row.firstElementChild);
  }

  function alertLily(cls = '') {
    return `<svg class="alertlily ${cls}" width="685.29" height="687.997" viewBox="0 0 181.316 182.032" xml:space="preserve" xmlns="http://www.w3.org/2000/svg">
      <path style="opacity:1;fill:var(--frog1);fill-opacity:1;stroke:none;stroke-width:4.23409;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:none;stroke-opacity:1;paint-order:markers fill stroke" d="M358.134 53.022a37.435 37.435 0 0 0-37.436 37.436 37.435 37.435 0 0 0 37.436 37.435 37.435 37.435 0 0 0 35.954-27.08l-12.644-8.667 13.987-4.877a37.435 37.435 0 0 0-37.297-34.247Zm127.21 21.29a16.323 16.323 0 0 0-16.323 16.323 16.323 16.323 0 0 0 16.322 16.323 16.323 16.323 0 0 0 16.323-16.323 16.323 16.323 0 0 0-16.322-16.322Zm-44.862 42.198a58.964 58.964 0 0 0-56.592 58.875 58.964 58.964 0 0 0 58.964 58.963 58.964 58.964 0 0 0 58.963-58.963 58.964 58.964 0 0 0-38.936-55.453L449 133.107z" transform="translate(-320.501 -53.022)"/>
      <path style="opacity:1;fill:var(--lily1);fill-opacity:1;stroke:none;stroke-width:3.82482;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:none;stroke-opacity:1;paint-order:markers fill stroke" d="M363.456 137.829a17.565 35.484 0 0 0-15.94 20.623 35.484 17.565 30 0 0-25.79 3.506 35.484 17.565 30 0 0 9.894 24.118 17.565 35.484 60 0 0-9.539 23.785 17.565 35.484 60 0 0 25.231 3.673 17.565 35.484 0 0 0 16.144 21.52 17.565 35.484 0 0 0 16.144-21.52 35.484 17.565 30 0 0 25.231-3.673 35.484 17.565 30 0 0-9.523-23.785 17.565 35.484 60 0 0 9.878-24.118 17.565 35.484 60 0 0-25.78-3.508 17.565 35.484 0 0 0-15.95-20.621z" transform="translate(-320.501 -53.022)"/>
    </svg>`;
  }

  function renderDonation(item) {
    const row = document.createElement('div');
    const name = item.nickname || '후원';
    const amount = item.amountText || (item.amount ? `₩${Number(item.amount).toLocaleString('ko-KR')}` : '');
    row.className = 'message-row animation1 alert-row donation';
    row.id = `msg-${esc(item.id || Date.now())}`;
    row.innerHTML = `<div class="alertcont"><div class="alerttextwrap">${alertLily('left')}<span class="alertName">${esc(name)}</span><span class="alerttext">&nbsp;후원 ${esc(amount)}</span>${alertLily('right')}</div></div>`;
    appendNode(row);
    if (item.message) renderChat({ type: 'chat', nickname: name, message: item.message, role: 'default', id: `${item.id}-msg` });
  }

  function receive(payload) {
    renderChat(payload);
  }

  socket.on('connect', () => socket.emit('join-chat', { clientId }));
  socket.on('chat-message', receive);
  socket.on('chzzk-event', receive);
  socket.emit('join-chat', { clientId });

  window.__renderLiveOverlay = renderChat;
})();
