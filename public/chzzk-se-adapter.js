(() => {
  const clientId = (location.pathname.split('/').filter(Boolean).pop() || 'pop');
  const config = window.CHAT_CONFIG || {};
  const fieldData = {
    alignMessages: 'bottom',
    msgHideOpt: false,
    msgHide: 7,
    msgFade: false,
    msgLimit: false,
    msgLimitAmount: 4,
    largeEmotes: 'on',
    badgesDisplay: true,
    badgesCustom: true,
    pronounsOn: false,
    badgescolor: '#ffffff',
    badgesContcolor: '#bce78e',
    nameback: '#97d561',
    msgback: '#ffffff',
    bordercol: '#97d561',
    namescolor: '#ffffff',
    msgcolor: '#47843b',
    frog1: '#bce78e',
    frog2: '#bce78e',
    lily1: '#f592b4',
    lilypad: '#82c080',
    msgFont: 'Quicksand',
    namesFont: 'Quicksand',
    namesBold: '700',
    msgBold: '700',
    msgSize: 16,
    namesSize: 16,
    alertson: true,
    alertsfollower: false,
    alertssub: true,
    alertsdonation: true,
    alertsbits: true,
    alertsraids: true,
    alertsboxcol: '#ffffff',
    alerttext: '#47843b',
    alertnames: '#47843b',
    alertSize: 16,
    ignoredUsers: 'StreamElements,OtherBot',
    hideCommands: 'yes',
    ...config
  };

  function emitWidgetLoad() {
    window.dispatchEvent(new CustomEvent('onWidgetLoad', {
      detail: {
        fieldData,
        channel: {
          username: clientId,
          displayName: clientId,
          providerId: clientId
        },
        session: {
          data: {}
        },
        currency: {
          code: 'KRW',
          symbol: '₩',
          name: 'KRW'
        }
      }
    }));
  }

  function normalizeRole(msg = {}) {
    const rawParts = [
      msg.role,
      msg.type,
      msg.userRoleCode,
      msg.badgeType,
      msg.authorType,
      msg.isStreamer ? 'broadcaster' : '',
      msg.isManager ? 'mod' : '',
      msg.isSubscriber ? 'subscriber' : '',
      msg.isFollower ? 'follower' : '',
      ...(Array.isArray(msg.badges) ? msg.badges.map(b => b?.type || b?.name || b?.code || b?.badgeId || b?.badgeNo || '') : [])
    ];
    const raw = rawParts.filter(Boolean).join(' ').toLowerCase();

    if (/streamer|broadcaster|owner|creator|channel_owner|host|방장|스트리머/.test(raw)) return 'broadcaster';
    if (/manager|moderator|mod|manager_user|manageruser|운영자|매니저|관리자/.test(raw)) return 'moderator';
    if (/subscriber|subscription|sub|paid|구독/.test(raw)) return 'subscriber';
    if (/follower|follow|팔로워/.test(raw)) return 'follower';
    return 'default';
  }

  function seBadge(role) {
    // These are role names the original widget already understands.
    if (role === 'broadcaster') return { type: 'broadcaster', version: '1', url: '' };
    if (role === 'moderator') return { type: 'moderator', version: '1', url: '' };
    if (role === 'subscriber') return { type: 'subscriber', version: '1', url: '' };
    // CHZZK has no VIP; follower is visually mapped to the original VIP fragment/badge lane.
    if (role === 'follower') return { type: 'vip', version: '1', url: '' };
    return null;
  }

  function mapBadges(msg, role) {
    const out = [];
    const roleBadge = seBadge(role);
    if (roleBadge) out.push(roleBadge);

    if (Array.isArray(msg.badges)) {
      for (const b of msg.badges) {
        const url = b?.url || b?.imageUrl || b?.badgeImageUrl || b?.image || b?.iconUrl;
        const type = b?.type || b?.name || b?.code || 'custom';
        if (url) out.push({ type, version: '1', url });
      }
    }
    return out;
  }

  function mapEmotes(msg) {
    if (!Array.isArray(msg.emotes)) return [];
    return msg.emotes.map(e => ({
      type: e.type || 'emote',
      name: e.name || e.token || e.id || '',
      id: e.id || e.name || e.token || '',
      urls: {
        1: e.url || e.imageUrl || e.image || '',
        2: e.url || e.imageUrl || e.image || '',
        4: e.url || e.imageUrl || e.image || ''
      }
    })).filter(e => e.name && e.urls[1]);
  }

  function dispatchSE(listener, event) {
    window.dispatchEvent(new CustomEvent('onEventReceived', {
      detail: { listener, event }
    }));
  }

  function emitChat(msg = {}) {
    const role = normalizeRole(msg);
    const displayName = msg.nickname || msg.name || msg.sender || msg.profile?.nickname || '익명';
    const userId = String(msg.userId || msg.channelId || msg.memberNo || displayName);
    const badges = mapBadges(msg, role);
    const text = String(msg.message ?? msg.content ?? msg.text ?? '');

    dispatchSE('message', {
      service: 'chzzk',
      renderedText: text,
      data: {
        msgId: String(msg.id || msg.messageId || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
        userId,
        displayName,
        nick: displayName,
        username: displayName,
        text,
        renderedText: text,
        badges,
        tags: {},
        emotes: mapEmotes(msg),
        role,
        isAction: false
      }
    });
  }

  function emitDonation(msg = {}) {
    const displayName = msg.nickname || msg.name || msg.sender || '후원테스트';
    const amount = Number(msg.amount || msg.payAmount || msg.donationAmount || 0);
    const text = String(msg.message ?? msg.content ?? msg.text ?? '');
    dispatchSE('tip-latest', {
      name: displayName,
      amount,
      formattedAmount: msg.amountText || (amount ? `₩${amount.toLocaleString('ko-KR')}` : ''),
      message: text,
      currency: 'KRW'
    });
  }

  function routeChzzkEvent(payload = {}) {
    const event = payload.event || payload.type || payload.kind || payload.action;
    const data = payload.data || payload;
    const normalized = String(event || data.type || '').toLowerCase();

    if (/donation|donate|mission|cheer|후원/.test(normalized) || data.amount || data.payAmount || data.donationAmount) {
      emitDonation(data);
      return;
    }

    if (/chat|message|msg|채팅/.test(normalized) || data.message || data.content || data.text) {
      emitChat(data);
    }
  }

  window.__chzzkToStreamElements = routeChzzkEvent;
  window.__emitChzzkChat = emitChat;
  window.__emitChzzkDonation = emitDonation;

  emitWidgetLoad();

  const socket = window.io ? io({ transports: ['websocket', 'polling'] }) : null;
  if (socket) {
    const join = () => {
      socket.emit('join-chat', { clientId });
      socket.emit('join', { clientId });
      socket.emit('join', `chat:${clientId}`);
    };

    socket.on('connect', join);
    join();

    const receive = (payload) => {
      console.log('[chzzk-se-adapter] received', payload);
      routeChzzkEvent(payload);
    };

    socket.on('chat-message', receive);
    socket.on('chzzk-event', receive);
    socket.on('message', receive);
    socket.on('donation', (payload) => {
      console.log('[chzzk-se-adapter] donation', payload);
      routeChzzkEvent({ event: 'donation', data: payload?.data || payload });
    });
  }
})();
