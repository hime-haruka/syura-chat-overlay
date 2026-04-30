(() => {
  const clientId = location.pathname.split('/').filter(Boolean).pop() || 'pop';
  const socket = io({ query: { clientId } });
  const pending = [];
  let widgetLoaded = false;

  const BADGE_URLS = {
    vip: 'https://static-cdn.jtvnw.net/badges/v1/b817aba4-fad8-49e2-b88a-7cc744dfa6ec/3',
    subscriber: 'https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/3',
    broadcaster: 'https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/3',
    moderator: 'https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/3'
  };

  function fireSE(listener, event) {
    const run = () => window.dispatchEvent(new CustomEvent('onEventReceived', {
      detail: { listener, event }
    }));

    if (!widgetLoaded) pending.push(run);
    else run();
  }

  function fireWidgetLoad() {
    if (widgetLoaded) return;

    window.dispatchEvent(new CustomEvent('onWidgetLoad', {
      detail: {
        fieldData: window.SE_FIELD_DATA || {},
        channel: {
          username: clientId,
          providerId: '100135110'
        },
        session: {
          data: {
            currency: '₩'
          }
        }
      }
    }));

    widgetLoaded = true;
    while (pending.length) pending.shift()();
  }

  function roleToTags(role) {
    const r = String(role || 'common_user').toLowerCase();
    return {
      broadcaster: r === 'streamer' || r === 'broadcaster' ? '1' : '0',
      mod: r === 'manager' || r === 'moderator' || r === 'mod' ? '1' : '0',
      subscriber: r === 'subscriber' || r === 'sub' ? '1' : '0',
      vip: r === 'follower' || r === 'vip' ? '1' : '0',
      badges: '',
      color: '',
      'display-name': ''
    };
  }

  function roleToBadges(role) {
    const tags = roleToTags(role);
    const badges = [];
    if (tags.broadcaster === '1') badges.push({ type: 'broadcaster', version: '1', url: BADGE_URLS.broadcaster });
    if (tags.mod === '1') badges.push({ type: 'moderator', version: '1', url: BADGE_URLS.moderator });
    if (tags.subscriber === '1') badges.push({ type: 'subscriber', version: '1', url: BADGE_URLS.subscriber });
    if (tags.vip === '1') badges.push({ type: 'vip', version: '1', url: BADGE_URLS.vip });
    return badges;
  }

  function normalizeEmotes(rawEmotes) {
    if (!Array.isArray(rawEmotes)) return [];
    return rawEmotes
      .map((e) => {
        const name = e.code || e.name || e.id || '';
        const url = e.url || e.imageUrl || e.image || '';
        if (!name || !url) return null;
        return {
          type: 'emote',
          name,
          id: e.id || name,
          urls: { 1: url, 2: url, 4: url }
        };
      })
      .filter(Boolean);
  }

  function toSEMessage(payload) {
    const displayName = payload.nickname || '익명';
    const tags = roleToTags(payload.role);
    tags['display-name'] = displayName;
    tags.badges = roleToBadges(payload.role).map((b) => `${b.type}/${b.version}`).join(',');

    return {
      data: {
        msgId: payload.id || `chzzk-${Date.now()}`,
        userId: payload.userId || displayName,
        displayName,
        nick: displayName,
        username: displayName,
        text: String(payload.message || ''),
        emotes: normalizeEmotes(payload.emotes),
        badges: roleToBadges(payload.role),
        tags,
        isAction: false
      }
    };
  }

  function toSETip(payload) {
    const amount = Number(payload.amount || 0);
    return {
      name: payload.nickname || '익명',
      displayName: payload.nickname || '익명',
      amount,
      formattedAmount: amount.toLocaleString('ko-KR'),
      currency: payload.currency || 'KRW',
      message: payload.message || '',
      text: payload.message || ''
    };
  }

  socket.on('connect', () => {
    window.__CHZZK_OVERLAY_CONNECTED__ = true;
  });

  socket.on('chzzk:chat', (payload) => {
    fireSE('message', toSEMessage(payload));
  });

  socket.on('chzzk:donation', (payload) => {
    fireSE('tip-latest', toSETip(payload));
  });

  socket.on('chzzk:test-widget-button', (field) => {
    fireSE('event:test', { listener: 'widget-button', field });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(fireWidgetLoad, 50));
  } else {
    setTimeout(fireWidgetLoad, 50);
  }
})();
