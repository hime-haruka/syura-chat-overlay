(() => {
  const clientId = location.pathname.split('/').filter(Boolean).pop() || 'pop';
  const params = new URLSearchParams(location.search);
  const debug = params.get('debug') === '1';

  const pending = [];
  let widgetBooted = false;
  let widgetReadyAt = 0;
  let socket = null;

  const BADGE_URLS = {
    broadcaster: 'https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/3',
    moderator: 'https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/3',
    subscriber: 'https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/3',
    vip: 'https://static-cdn.jtvnw.net/badges/v1/b817aba4-fad8-49e2-b88a-7cc744dfa6ec/3'
  };

  function log(...args) {
    if (debug) console.log('[CHZZK-SE]', ...args);
  }

  function detailFieldData() {
    return window.SE_FIELD_DATA || {};
  }

  function bootWidget(force = false) {
    if (widgetBooted && !force) return;
    widgetBooted = true;
    widgetReadyAt = Date.now();

    const fieldData = detailFieldData();
    const detail = {
      fieldData,
      channel: {
        username: clientId,
        providerId: '100135110'
      },
      session: {
        data: {},
        currency: '치즈 '
      }
    };

    log('dispatch onWidgetLoad', detail);
    window.dispatchEvent(new CustomEvent('onWidgetLoad', { detail }));

    setTimeout(() => {
      while (pending.length) pending.shift()();
    }, 350);
  }

  // 원본 위젯의 async onWidgetLoad가 외부 emote API에서 걸려도 메시지 이벤트는 받을 수 있게 여러 번 깨워준다.
  function bootSafely() {
    setTimeout(() => bootWidget(false), 80);
    setTimeout(() => bootWidget(true), 700);
    setTimeout(() => bootWidget(true), 1800);
  }

  function dispatchSE(detail) {
    const run = () => {
      log('dispatch onEventReceived', detail);
      try {
        window.dispatchEvent(new CustomEvent('onEventReceived', { detail }));
      } catch (error) {
        console.error('[CHZZK-SE] dispatch failed', error, detail);
      }
    };

    if (!widgetBooted || Date.now() - widgetReadyAt < 350) pending.push(run);
    else run();
  }

  function roleToTags(role) {
    const r = String(role || 'common_user').toLowerCase();
    if (r === 'streamer' || r === 'broadcaster' || r === 'broadcaster/1') {
      return { type: 'broadcaster', badges: 'broadcaster/1', mod: '0', subscriber: '0', vip: '0', userType: 'streamer' };
    }
    if (r === 'manager' || r === 'moderator' || r === 'mod' || r.includes('manager')) {
      return { type: 'moderator', badges: 'moderator/1', mod: '1', subscriber: '0', vip: '0', userType: 'mod' };
    }
    if (r === 'subscriber' || r === 'sub') {
      return { type: 'subscriber', badges: 'subscriber/1', mod: '0', subscriber: '1', vip: '0', userType: 'subscriber' };
    }
    if (r === 'follower' || r === 'vip') {
      return { type: 'vip', badges: 'vip/1', mod: '0', subscriber: '0', vip: '1', userType: 'vip' };
    }
    return { type: null, badges: '', mod: '0', subscriber: '0', vip: '0', userType: 'default' };
  }

  function makeBadges(role) {
    const t = roleToTags(role);
    return t.type ? [{ type: t.type, version: '1', url: BADGE_URLS[t.type] }] : [];
  }

  function emoteArray(rawEmotes, text) {
    const out = [];
    if (Array.isArray(rawEmotes)) {
      for (const e of rawEmotes) {
        const name = e.name || e.code || e.id;
        const url = e.url || e.imageUrl || e.image;
        if (name && url) out.push({ name, urls: { 1: url, 2: url, 4: url } });
      }
    } else if (rawEmotes && typeof rawEmotes === 'object') {
      for (const [name, url] of Object.entries(rawEmotes)) {
        if (name && url) out.push({ name, urls: { 1: url, 2: url, 4: url } });
      }
    }
    if (String(text || '').includes('{:d_51:}') && !out.some(e => e.name === '{:d_51:}')) {
      const url = 'https://ssl.pstatic.net/static/nng/glive/icon/d_51.png';
      out.push({ name: '{:d_51:}', urls: { 1: url, 2: url, 4: url } });
    }
    return out;
  }

  function toSEMessage(payload) {
    const nickname = payload.nickname || payload.displayName || '익명';
    const role = roleToTags(payload.role);
    const text = String(payload.message || payload.content || payload.text || '');
    const msgId = String(payload.id || payload.msgId || ('chzzk-' + Date.now() + '-' + Math.random().toString(16).slice(2))).replace(/[^a-zA-Z0-9_-]/g, '');

    return {
      listener: 'message',
      event: {
        data: {
          tags: {
            badges: role.badges,
            color: payload.color || '#5B99FF',
            mod: role.mod,
            subscriber: role.subscriber,
            vip: role.vip,
            'user-id': payload.userId || nickname,
            'user-type': role.userType
          },
          userId: payload.userId || nickname,
          displayName: nickname,
          nick: nickname,
          displayColor: payload.color || '#5B99FF',
          badges: makeBadges(payload.role),
          text,
          emotes: emoteArray(payload.emotes, text),
          msgId
        },
        renderedText: text
      }
    };
  }

  function toSETip(payload) {
    const amount = Number(payload.amount || payload.payAmount || 0);
    const name = payload.nickname || payload.donatorNickname || payload.displayName || '익명';
    return {
      listener: 'tip-latest',
      event: {
        name: 'tip-latest',
        data: {
          name,
          displayName: name,
          sender: name,
          amount,
          formattedAmount: amount.toLocaleString('ko-KR') + ' 치즈',
          currency: '치즈',
          message: payload.message || payload.donationText || '',
          text: payload.message || payload.donationText || ''
        }
      }
    };
  }

  function handleChat(payload) {
    if (payload && payload.clientId && String(payload.clientId) !== clientId) return;
    dispatchSE(toSEMessage(payload || {}));
  }

  function handleDonation(payload) {
    if (payload && payload.clientId && String(payload.clientId) !== clientId) return;
    dispatchSE(toSETip(payload || {}));
  }

  window.__CHZZK_SE_TEST_CHAT = function(payload = {}) {
    handleChat({
      type: 'chat',
      clientId,
      id: 'direct-test-' + Date.now(),
      createdAt: Date.now(),
      nickname: payload.nickname || '스트리머테스트',
      userId: payload.userId || 'direct-test-user',
      role: payload.role || 'streamer',
      message: payload.message || '방송 전 디자인 확인용 테스트 채팅입니다 {:d_51:}',
      emotes: payload.emotes || [{ code: '{:d_51:}', name: '{:d_51:}', url: 'https://ssl.pstatic.net/static/nng/glive/icon/d_51.png' }]
    });
  };

  window.__CHZZK_SE_TEST_DONATION = function(payload = {}) {
    handleDonation({
      type: 'donation',
      clientId,
      id: 'direct-donation-test-' + Date.now(),
      createdAt: Date.now(),
      nickname: payload.nickname || '치즈테스트',
      amount: Number(payload.amount || 1000),
      currency: '치즈',
      message: payload.message || '방송 전 치즈 알림 테스트입니다'
    });
  };

  function connectOverlaySocket() {
    socket = io('/', {
      transports: ['websocket', 'polling'],
      query: { clientId },
      auth: { clientId },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => log('overlay socket connected', socket.id, clientId));
    socket.on('connect_error', (e) => console.error('[CHZZK-SE] overlay socket connect_error', e?.message || e));
    socket.on('chzzk:chat', handleChat);
    socket.on(`chzzk:chat:${clientId}`, handleChat);
    socket.on('chzzk:donation', handleDonation);
    socket.on(`chzzk:donation:${clientId}`, handleDonation);
    socket.on('se:event', detail => dispatchSE(detail));
    socket.on(`se:event:${clientId}`, detail => dispatchSE(detail));
    socket.on('chzzk:status', status => log('status', status));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootSafely);
  else bootSafely();
  connectOverlaySocket();
})();
