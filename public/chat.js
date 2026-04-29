(() => {
  const container = document.querySelector('.main-container');
  const clientId = container?.dataset?.clientId || (location.pathname.split('/').filter(Boolean).pop() || 'pop');
  const cfg = window.CHAT_CONFIG || {};
  const fragments = window.ORIGINAL_MESSAGE_FRAGMENTS || {};
  const socket = io({ transports: ['websocket', 'polling'] });

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>'"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s]));
  }

  function toBool(v) {
    return v === true || v === 'true' || v === 'on' || v === 'yes' || v === 1 || v === '1';
  }

  function normalizeRole(input, msg = {}) {
    const badgeText = (msg.badges || []).map(b => b?.type || b?.name || b?.code || b?.badgeId || b?.badgeNo || '').join(' ');
    const raw = [input, msg.role, msg.userRoleCode, msg.badgeType, msg.authorType, badgeText].filter(Boolean).join(' ').toLowerCase();

    if (/streamer|broadcaster|owner|creator|channel_owner|host|방장|스트리머/.test(raw)) return 'broadcaster';
    if (/manager|moderator|mod|manager_user|manageruser|운영자|매니저|관리자/.test(raw)) return 'mod';
    if (/subscriber|subscription|sub|paid|구독/.test(raw)) return 'subscriber';
    if (/follower|follow|팔로워/.test(raw)) return 'follower';
    if (/first|first-msg|firsttime|첫/.test(raw)) return 'first';
    return 'default';
  }

  function badgeSvg(type) {
    // Original-widget compatible simple badge SVGs. CSS forces fill to white.
    const common = `class="svgbadge" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"`;
    if (type === 'broadcaster') return `<svg ${common}><path d="M48 7 60 35l30 2-23 19 7 30-26-16-26 16 7-30L6 37l30-2z"/></svg>`;
    if (type === 'mod') return `<svg ${common}><path d="M48 5 88 22 82 69 48 91 14 69 8 22z"/></svg>`;
    if (type === 'subscriber') return `<svg ${common}><path d="M17 31 32 18l16 19 16-19 15 13-8 47H25z"/></svg>`;
    if (type === 'follower') return `<svg ${common}><path d="M48 82C23 60 11 48 11 31c0-11 8-19 19-19 7 0 14 4 18 10 4-6 11-10 18-10 11 0 19 8 19 19 0 17-12 29-37 51z"/></svg>`;
    if (type === 'first') return `<svg ${common}><path d="M48 8 58 36l30 1-23 18 8 29-25-17-25 17 8-29L8 37l30-1z"/></svg>`;
    return '';
  }

  function renderBadges(msg, role) {
    if (cfg.badgesDisplay === false || cfg.badgesShow === false || cfg.badgesdisplay === false) return '';
    if (role === 'default') return '';

    const out = [];
    const built = badgeSvg(role);
    if (built) out.push(`<span class="${role} custombadge">${built}</span>`);

    for (const b of (msg.badges || []).slice(0, 5)) {
      const url = b?.imageUrl || b?.url || b?.badgeImageUrl || b?.image || b?.iconUrl;
      if (url) out.push(`<span class="custombadge"><img alt="" src="${escapeHtml(url)}"></span>`);
    }
    return out.join('');
  }

  function renderMessageContent(msg) {
    let text = escapeHtml(msg.message || '').replace(/\n/g, '<br>');
    const emotes = Array.isArray(msg.emotes) ? msg.emotes : [];
    for (const e of emotes) {
      const token = e?.name || e?.token || e?.id;
      const url = e?.url || e?.imageUrl || e?.image;
      if (!token || !url) continue;
      const imgClass = cfg.largeEmotes === 'off' ? 'nolarge' : (String(msg.message || '').trim() === token ? 'large' : 'default');
      const img = `<img class="${imgClass}" src="${escapeHtml(url)}" alt="${escapeHtml(token)}">`;
      text = text.split(escapeHtml(token)).join(img);
    }
    return text;
  }

  function originalFragmentFor(role) {
    if (role === 'follower') return fragments.vip || fragments.default || '';
    return fragments[role] || fragments.default || '';
  }

  function rowHtml(msg, role, id) {
    const fragment = originalFragmentFor(role);
    const badges = renderBadges(msg, role);
    const pronouns = msg.pronouns && toBool(cfg.pronounsOn) ? `<span class="pronounsDiv">${escapeHtml(msg.pronouns)}</span>` : '';
    return `
      <div data-sender="${escapeHtml(msg.userId || msg.channelId || msg.nickname || '')}" id="msg-${id}" data-msgid="${id}" class="message-row animation1 ${role}">
        <span class="namebox">
          <div class="badgescont"><div class="badgesbox"><span class="badges">${badges}</span></div></div>
          <span class="name">${escapeHtml(msg.nickname || '익명')}${pronouns}
          ${fragment}
          ${renderMessageContent(msg)}
          </span>
        </div>
      </div>
    `;
  }

  function pruneMessages(align) {
    if (toBool(cfg.msgLimit)) {
      const limit = Math.max(1, Number(cfg.msgLimitAmount || 4));
      while (container.children.length > limit) {
        if (align === 'top') container.removeChild(container.lastElementChild);
        else container.removeChild(container.firstElementChild);
      }
    }
  }

  function renderChatMessage(msg) {
    if (!container || !msg) return;
    if (msg.type === 'donation' || msg.type === 'cheer' || msg.kind === 'donation' || msg.amount) {
      renderDonation(msg);
      return;
    }
    if (!msg.message) return;

    const ignored = String(cfg.ignoredUsers || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (ignored.includes(String(msg.nickname || '').toLowerCase())) return;
    if (cfg.hideCommands === 'yes' && String(msg.message || '').startsWith('!')) return;

    const role = normalizeRole(msg.role || msg.userRoleCode || msg.type, msg);
    const id = String(msg.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`).replace(/[^a-zA-Z0-9_-]/g, '');
    const holder = document.createElement('div');
    holder.innerHTML = rowHtml(msg, role, id).trim();
    const row = holder.firstElementChild;

    const align = cfg.alignMessages || 'bottom';
    if (align === 'top') container.prepend(row);
    else container.appendChild(row);
    if (toBool(cfg.msgHideOpt)) row.classList.add('animationOut');
    pruneMessages(align);
  }

  function alertLily(cls = '') {
    return `<svg class="alertlily ${cls}" width="685.29" height="687.997" viewBox="0 0 181.316 182.032" xml:space="preserve" xmlns="http://www.w3.org/2000/svg">
      <path style="opacity:1;fill:var(--frog1);fill-opacity:1;stroke:none;stroke-width:4.23409;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:none;stroke-opacity:1;paint-order:markers fill stroke" d="M358.134 53.022a37.435 37.435 0 0 0-37.436 37.436 37.435 37.435 0 0 0 37.436 37.435 37.435 37.435 0 0 0 35.954-27.08l-12.644-8.667 13.987-4.877a37.435 37.435 0 0 0-37.297-34.247Zm127.21 21.29a16.323 16.323 0 0 0-16.323 16.323 16.323 16.323 0 0 0 16.322 16.323 16.323 16.323 0 0 0 16.323-16.323 16.323 16.323 0 0 0-16.322-16.322Zm-44.862 42.198a58.964 58.964 0 0 0-56.592 58.875 58.964 58.964 0 0 0 58.964 58.963 58.964 58.964 0 0 0 58.963-58.963 58.964 58.964 0 0 0-38.936-55.453L449 133.107z" transform="translate(-320.501 -53.022)"/>
      <path style="opacity:1;fill:var(--lily1);fill-opacity:1;stroke:none;stroke-width:3.82482;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:none;stroke-opacity:1;paint-order:markers fill stroke" d="M363.456 137.829a17.565 35.484 0 0 0-15.94 20.623 35.484 17.565 30 0 0-25.79 3.506 35.484 17.565 30 0 0 9.894 24.118 17.565 35.484 60 0 0-9.539 23.785 17.565 35.484 60 0 0 25.231 3.673 17.565 35.484 0 0 0 16.144 21.52 17.565 35.484 0 0 0 16.144-21.52 35.484 17.565 30 0 0 25.231-3.673 35.484 17.565 30 0 0-9.523-23.785 17.565 35.484 60 0 0 9.878-24.118 17.565 35.484 60 0 0-25.78-3.508 17.565 35.484 0 0 0-15.95-20.621z" transform="translate(-320.501 -53.022)"/>
    </svg>`;
  }

  function renderDonation(msg) {
    if (!container) return;
    const id = String(msg.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`).replace(/[^a-zA-Z0-9_-]/g, '');
    const name = escapeHtml(msg.nickname || msg.sender || '후원테스트');
    const amount = msg.amountText || (msg.amount ? `₩${Number(msg.amount).toLocaleString('ko-KR')}` : '');
    const verb = msg.verb || '후원';
    const row = document.createElement('div');
    row.className = 'message-row animation1 alert-row donation';
    row.id = `msg-${id}`;
    row.innerHTML = `
      <div class="alertcont">
        <div class="alerttextwrap">
          ${alertLily('left')}
          <span class="alertName">${name}</span>
          <span class="alerttext">&nbsp;${escapeHtml(verb)} ${escapeHtml(amount)}</span>
          ${alertLily('right')}
        </div>
      </div>
    `;
    const align = cfg.alignMessages || 'bottom';
    if (align === 'top') container.prepend(row);
    else container.appendChild(row);
    if (msg.message) renderChatMessage({ ...msg, type: 'message', amount: 0, role: msg.role || 'default', nickname: msg.nickname || msg.sender || '후원테스트', message: msg.message });
    pruneMessages(align);
  }

  socket.on('chat-message', renderChatMessage);
  socket.on('connect', () => socket.emit('join-chat', { clientId }));
  socket.emit('join-chat', { clientId });

  window.__renderChatMessage = renderChatMessage;
})();
