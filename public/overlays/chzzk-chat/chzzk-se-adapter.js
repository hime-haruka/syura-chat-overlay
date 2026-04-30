(() => {
  const clientId = location.pathname.split('/').filter(Boolean).pop() || 'pop';
  const socket = io({ query: { clientId } });
  const pending = [];
  let widgetLoaded = false;

  const ROLE_TO_SE_BADGE = {
    common_user: null,
    follower: { type: 'vip', version: '1', url: 'https://static-cdn.jtvnw.net/badges/v1/b817aba4-fad8-49e2-b88a-7cc744dfa6ec/3' },
    subscriber: { type: 'subscriber', version: '1', url: 'https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/3' },
    streamer: { type: 'broadcaster', version: '1', url: 'https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/3' },
    manager: { type: 'moderator', version: '1', url: 'https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/3' }
  };

  function dispatchSE(listener, event) {
    const detail = { listener, event };
    const run = () => window.dispatchEvent(new CustomEvent('onEventReceived', { detail }));

    if (!widgetLoaded) pending.push(run);
    else run();
  }

  function fireWidgetLoad() {
    if (widgetLoaded) return;
    widgetLoaded = true;

    window.dispatchEvent(new CustomEvent('onWidgetLoad', {
      detail: {
        fieldData: window.SE_FIELD_DATA || {},
        channel: { username: clientId, providerId: clientId },
        session: { data: {} }
      }
    }));

    while (pending.length) pending.shift()();
  }

  function escapeText(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function normalizeRole(role) {
    const r = String(role || 'common_user').toLowerCase();
    if (r === 'streamer' || r === 'broadcaster') return 'streamer';
    if (r === 'manager' || r === 'moderator' || r === 'mod') return 'manager';
    if (r === 'subscriber' || r === 'sub') return 'subscriber';
    if (r === 'follower' || r === 'vip') return 'follower';
    return 'common_user';
  }

  function makeBadges(role) {
    const badge = ROLE_TO_SE_BADGE[normalizeRole(role)];
    return badge ? [badge] : [];
  }

  function convertChzzkEmotes(rawEmotes) {
    if (!Array.isArray(rawEmotes)) return [];
    return rawEmotes
      .map((e) => ({
        type: 'emote',
        name: e.name || e.code || e.id || '',
        id: e.id || e.code || e.name || '',
        urls: {
          1: e.url || e.imageUrl || e.image || '',
          2: e.url || e.imageUrl || e.image || '',
          4: e.url || e.imageUrl || e.image || ''
        }
      }))
      .filter((e) => e.name && e.urls[1]);
  }

  function replaceInlineEmoteCodes(text, rawEmotes) {
    let output = escapeText(text);
    if (!Array.isArray(rawEmotes)) return output;

    for (const e of rawEmotes) {
      const code = e.code || e.name || e.id;
      const url = e.url || e.imageUrl || e.image;
      if (!code || !url) continue;
      const safeCode = escapeText(code).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      output = output.replace(new RegExp(safeCode, 'g'), `<img class="default" src="${escapeText(url)}"/>`);
    }
    return output;
  }

  function toSEMessage(payload) {
    const role = normalizeRole(payload.role);
    return {
      data: {
        msgId: payload.id || `${Date.now()}`,
        userId: payload.userId || payload.nickname || 'chzzk-user',
        displayName: payload.nickname || '익명',
        nick: payload.nickname || '익명',
        username: payload.nickname || '익명',
        text: replaceInlineEmoteCodes(payload.message || '', payload.emotes),
        message: replaceInlineEmoteCodes(payload.message || '', payload.emotes),
        emotes: convertChzzkEmotes(payload.emotes),
        badges: makeBadges(role),
        tags: {
          badges: makeBadges(role).map((b) => `${b.type}/${b.version}`).join(','),
          color: payload.color || '',
          'display-name': payload.nickname || '익명'
        },
        role,
        profileImage: payload.profileImage || ''
      }
    };
  }

  function toSETip(payload) {
    const amount = Number(payload.amount || 0);
    return {
      name: 'tip-latest',
      data: {
        name: payload.nickname || '익명',
        displayName: payload.nickname || '익명',
        amount,
        formattedAmount: amount ? amount.toLocaleString('ko-KR') : '',
        currency: payload.currency || 'KRW',
        message: payload.message || '',
        text: payload.message || ''
      }
    };
  }

  socket.on('connect', () => {});
  socket.on('chzzk:chat', (payload) => dispatchSE('message', toSEMessage(payload)));
  socket.on('chzzk:donation', (payload) => dispatchSE('tip-latest', toSETip(payload)));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(fireWidgetLoad, 0));
  } else {
    setTimeout(fireWidgetLoad, 0);
  }
})();
