(() => {
  const container = document.querySelector('.main-container');
  const clientId = container?.dataset?.clientId || (location.pathname.split('/').filter(Boolean).pop() || 'pop');
  const cfg = window.CHAT_CONFIG || {};
  const FRAG = window.ORIGINAL_MESSAGE_FRAGMENTS || {};
  const socket = io({ transports: ['websocket', 'polling'] });

  const esc = (str) => String(str ?? '').replace(/[&<>'"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s]));
  const yes = (v) => v === true || v === 'true' || v === 'on' || v === 'yes' || v === 1 || v === '1';

  function normalizeRole(msg = {}) {
    const badgeText = (msg.badges || []).map(b => b?.type || b?.name || b?.code || b?.badgeId || '').join(' ');
    const raw = [msg.role, msg.userRoleCode, msg.badgeType, msg.authorType, msg.membership, badgeText]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (/streamer|broadcaster|owner|creator|channel_owner|host|방장|스트리머/.test(raw)) return 'broadcaster';
    if (/manager|moderator|mod|manager_user|manageruser|운영자|매니저|관리자/.test(raw)) return 'mod';
    if (/subscriber|subscription|sub|paid|구독/.test(raw)) return 'subscriber';
    if (/follower|follow|팔로워|팔로우/.test(raw)) return 'follower';
    return 'default';
  }

  function badgeSvg(role) {
    const common = `class="svgbadge" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"`;
    if (role === 'broadcaster') {
      return `<svg ${common}><path fill="var(--badgescolor)" d="M48 7 60 35l30 2-23 19 7 30-26-16-26 16 7-30L6 37l30-2z"/></svg>`;
    }
    if (role === 'mod') {
      return `<svg ${common}><path fill="var(--badgescolor)" d="M48 5 86 22v25c0 23-16 36-38 44C26 83 10 70 10 47V22z"/></svg>`;
    }
    if (role === 'subscriber') {
      return `<svg ${common}><path fill="var(--badgescolor)" d="M15 34 30 21l18 22 18-22 15 13-9 45H24z"/></svg>`;
    }
    if (role === 'follower') {
      return `<svg ${common}><path fill="var(--badgescolor)" d="M48 79S16 59 16 36c0-11 8-19 19-19 6 0 11 3 13 8 3-5 8-8 14-8 11 0 19 8 19 19 0 23-33 43-33 43z"/></svg>`;
    }
    return '';
  }

  function badgesHtml(msg, role) {
    if (cfg.badgesDisplay === false || cfg.badgesShow === false || cfg.badgesdisplay === false) return '';
    const out = [];
    const built = badgeSvg(role);
    if (built) out.push(`<span class="${role} custombadge">${built}</span>`);
    for (const b of (msg.badges || []).slice(0, 5)) {
      const url = b?.imageUrl || b?.url || b?.badgeImageUrl || b?.image || b?.iconUrl;
      if (url) out.push(`<span class="custombadge"><img alt="" src="${esc(url)}"></span>`);
    }
    if (!out.length) return '';
    return `<div class="badgescont"><div class="badgesbox"><span class="badges">${out.join('')}</span></div></div>`;
  }

  function messageContent(msg) {
    let text = esc(msg.message || msg.text || '').replace(/\n/g, '<br>');
    for (const e of (Array.isArray(msg.emotes) ? msg.emotes : [])) {
      const token = e?.name || e?.token || e?.id;
      const url = e?.url || e?.imageUrl || e?.image;
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

  function addRow(row) {
    const align = cfg.alignMessages || 'bottom';
    if (align === 'top') container.prepend(row); else container.appendChild(row);
    if (yes(cfg.msgHideOpt)) row.classList.add('animationOut');
    prune(align);
  }

  function renderDonationMessage(msg) {
    if (!container || !msg) return;
    const nickname = msg.nickname || msg.displayName || msg.name || msg.sender || '익명';
    const amount = msg.amount || msg.payAmount || msg.donationAmount || msg.price || msg.value || 0;
    const currency = msg.currency || msg.unit || '₩';
    const message = msg.message || msg.text || '';
    const id = esc(msg.id || msg.msgId || `donation-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const amountText = amount ? `${currency}${Number(amount).toLocaleString('ko-KR')}` : '후원';

    const row = document.createElement('div');
    row.className = 'message-row animation1 donation donation-row';
    row.dataset.sender = nickname;
    row.dataset.msgid = id;
    row.id = `msg-${id}`;
    row.innerHTML = `
      <div class="donation-pill">
        <span class="donation-deco donation-deco-left" aria-hidden="true"></span>
        <span class="donation-text"><b>${esc(nickname)}</b> 후원 ${esc(amountText)}</span>
        <span class="donation-deco donation-deco-right" aria-hidden="true"></span>
      </div>
      ${message ? `<div class="donation-msgbox"><span class="message">${esc(message).replace(/\n/g, '<br>')}</span></div>` : ''}
    `;
    addRow(row);
  }

  function renderChatMessage(msg) {
    if (!container || !msg) return;
    if (msg.type === 'donation' || msg.event === 'donation' || msg.kind === 'donation' || msg.donation === true) {
      renderDonationMessage(msg);
      return;
    }
    if (!(msg.message || msg.text)) return;

    const nickname = msg.nickname || msg.displayName || msg.name || msg.sender || '익명';
    const ignored = String(cfg.ignoredUsers || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (ignored.includes(String(nickname).toLowerCase())) return;
    if (String(cfg.hideCommands || '').toLowerCase() === 'yes' && String(msg.message || msg.text || '').startsWith('!')) return;

    const role = normalizeRole(msg);
    const fragmentKey = role === 'follower' ? 'default' : role;
    const fragment = FRAG[fragmentKey] || FRAG.default || `</span></span><div class="msgcont"><div class="messagebox"><span class="message">`;
    const id = esc(msg.id || msg.msgId || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const pronouns = msg.pronouns && yes(cfg.pronounsOn) ? `<span class="pronounsDiv">${esc(msg.pronouns)}</span>` : '';
    const badgePart = badgesHtml(msg, role);

    const row = document.createElement('div');
    row.className = `message-row animation1 ${role}`;
    row.dataset.sender = nickname;
    row.dataset.msgid = id;
    row.id = `msg-${id}`;
    row.innerHTML = `<span class="namebox">${badgePart}<span class="name">${esc(nickname)}${pronouns}${fragment}${messageContent(msg)}</span></div></div>`;
    addRow(row);
  }

  socket.on('chat-message', renderChatMessage);
  socket.on('connect', () => socket.emit('join-chat', { clientId }));
  socket.emit('join-chat', { clientId });
  window.__renderChatMessage = renderChatMessage;
})();
