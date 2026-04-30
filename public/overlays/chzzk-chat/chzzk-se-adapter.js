
(() => {
  const clientId = location.pathname.split('/').filter(Boolean).pop() || 'pop';
  const debug = new URLSearchParams(location.search).get('debug') === '1';
  const FIELD = window.SE_FIELD_DATA || {};
  let socket;
  let booted = false;
  let seq = 0;
  const queue = [];

  function log(...a){ if(debug) console.log('[CHZZK exact renderer]', ...a); }
  function esc(v){ return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function field(k,f=''){ return FIELD[k] ?? f; }

  function hexToHsl(hex, satAdd=0, lightAdd=0) {
    hex = String(hex || '#bce78e').trim();
    if (hex.length === 4) hex = '#' + hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3];
    const r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;
    const max=Math.max(r,g,b), min=Math.min(r,g,b); let h=0,s=0,l=(max+min)/2; const d=max-min;
    if(d){ s=d/(1-Math.abs(2*l-1)); if(max===r)h=((g-b)/d)%6; else if(max===g)h=(b-r)/d+2; else h=(r-g)/d+4; h=Math.round(h*60); if(h<0)h+=360; }
    return `hsl(${h},${Math.max(0,Math.min(100,Math.round(s*100+satAdd)))}%,${Math.max(0,Math.min(100,Math.round(l*100+lightAdd)))}%)`;
  }

  function applyVars(){
    const lily = field('lily1', '#f592b4');
    const frog = field('frog1', '#bce78e');
    const vars = {
      '--namesSize': `${field('namesSize',16)}px`, '--msgSize': `${field('msgSize',16)}px`, '--msgback': field('msgback','#ffffff'),
      '--namesBold': field('namesBold','700'), '--msgBold': field('msgBold','700'), '--textback': field('textback','rgba(173,143,255,0)'),
      '--namesFont': `'${field('namesFont','Quicksand')}', sans-serif`, '--msgFont': `'${field('msgFont','Quicksand')}', sans-serif`,
      '--namescolor': field('namescolor','#ffffff'), '--badgescolor': field('badgescolor','#ffffff'), '--outlinecol': field('accentcolor','#dcbb96'), '--accentcolor': field('accentcolor','#dcbb96'),
      '--msgcolor': field('msgcolor','#47843b'), '--alerttext': field('alerttext','#47843b'), '--msgHide': `${field('msgHide',7)}s`,
      '--alertback': field('alertsboxcol','#ffffff'), '--frog1': frog, '--frog2': field('frog2', hexToHsl(frog,0,8)),
      '--lily1': lily, '--lily2': field('lily2', hexToHsl(lily,21,12)), '--lily3': field('lily3', hexToHsl(lily,30,20)), '--lilypad': field('lilypad','#82c080')
    };
    for(const [k,v] of Object.entries(vars)){
      document.documentElement.style.setProperty(k,v);
      document.body?.style.setProperty(k,v);
      document.querySelector('.main-container')?.style.setProperty(k,v);
    }
  }

  function bootOriginalRenderer(){
    if(booted) return;
    applyVars();
    try {
      window.dispatchEvent(new CustomEvent('onWidgetLoad', {
        detail: { fieldData: FIELD, channel: { username: clientId, providerId: '100135110' }, session: { data: {}, currency: '치즈 ' } }
      }));
    } catch(e) { console.warn('[CHZZK exact renderer] onWidgetLoad init failed', e); }
    booted = true;
    setTimeout(() => { while(queue.length) queue.shift()(); }, 500);
  }

  function roleToUserType(role){
    const r = String(role || '').toLowerCase();
    if(r.includes('streamer') || r.includes('broadcaster') || r.includes('owner')) return 'streamer';
    if(r.includes('manager') || r.includes('moderator') || r === 'mod') return 'mod';
    if(r.includes('subscriber') || r === 'sub') return 'subscriber';
    if(r.includes('follower') || r === 'vip') return 'vip';
    return 'default';
  }
  function chzzkEmotesToSE(text, raw){
    const list=[];
    if(Array.isArray(raw)){
      for(const e of raw){ const name=e.code||e.name||e.id; const url=e.url||e.imageUrl||e.image; if(name&&url) list.push({name:String(name), type:'chzzk', urls:{1:String(url),2:String(url),4:String(url)}}); }
    } else if(raw && typeof raw === 'object') {
      for(const [name,url] of Object.entries(raw)) list.push({name:String(name), type:'chzzk', urls:{1:String(url),2:String(url),4:String(url)}});
    }
    if(String(text).includes('{:d_51:}') && !list.some(e=>e.name==='{:d_51:}')) { const url='https://ssl.pstatic.net/static/nng/glive/icon/d_51.png'; list.push({name:'{:d_51:}', type:'chzzk', urls:{1:url,2:url,4:url}}); }
    return list;
  }
  function seBadges(userType){
    if(userType === 'streamer') return [{ type:'broadcaster', version:'1', url:'' }];
    if(userType === 'mod') return [{ type:'moderator', version:'1', url:'' }];
    if(userType === 'subscriber') return [{ type:'subscriber', version:'1', url:'' }];
    if(userType === 'vip') return [{ type:'vip', version:'1', url:'' }];
    return [];
  }
  function seTags(userType, userId){
    return { badges: userType === 'streamer' ? 'broadcaster/1' : userType === 'mod' ? 'moderator/1' : userType === 'subscriber' ? 'subscriber/1' : userType === 'vip' ? 'vip/1' : '', color: '#5B99FF', mod: userType === 'mod' || userType === 'streamer' ? '1' : '0', subscriber: userType === 'subscriber' ? '1' : '0', vip: userType === 'vip' ? '1' : '0', broadcaster: userType === 'streamer' ? '1' : '0', 'user-id': userId, 'user-type': userType };
  }
  function dispatchOriginalMessage(payload){
    const userType = roleToUserType(payload.role);
    const msgId = String(payload.id || payload.msgId || `chzzk-${Date.now()}-${seq++}`).replace(/[^a-zA-Z0-9_-]/g, '');
    const userId = String(payload.userId || payload.nickname || 'chzzk-user');
    const text = String(payload.message || payload.content || payload.text || '');
    window.dispatchEvent(new CustomEvent('onEventReceived', { detail: { listener: 'message', event: { data: { tags: seTags(userType, userId), userId, displayName: String(payload.nickname || payload.displayName || '익명'), displayColor: '#5B99FF', badges: seBadges(userType), text, emotes: chzzkEmotesToSE(text, payload.emotes), msgId, isAction: false }, renderedText: esc(text) } } }));
    return { userType, msgId };
  }
  function renderChat(payload){
    if(!payload || (payload.clientId && String(payload.clientId) !== clientId)) return;
    const run = () => {
      applyVars();
      const container = document.querySelector('.main-container');
      const before = container ? container.children.length : 0;
      const info = dispatchOriginalMessage(payload);
      log('dispatched original message event', info);
      setTimeout(() => {
        const after = container ? container.children.length : 0;
        if(after <= before) console.warn('[CHZZK exact renderer] original event produced no DOM. Check original-widget.js console errors.');
        document.querySelectorAll('.svgbadge path[fill*="{"]').forEach(p => p.setAttribute('fill', field('badgescolor','#ffffff')));
        document.querySelectorAll('[style*="{"]').forEach(el => { el.setAttribute('style', el.getAttribute('style').replaceAll('{badgescolor}', field('badgescolor','#ffffff')).replaceAll('{bordercol}', field('bordercol','#97d561')).replaceAll('{msgback}', field('msgback','#ffffff')).replaceAll('{nameback}', field('nameback','#97d561')).replaceAll('{alertsboxcol}', field('alertsboxcol','#ffffff'))); });
      }, 80);
    };
    if(!booted) queue.push(run); else run();
  }
  function renderDonation(payload){
    if(!payload || (payload.clientId && String(payload.clientId) !== clientId)) return;
    applyVars();
    window.dispatchEvent(new CustomEvent('onEventReceived', { detail: { listener: 'tip-latest', event: { name: String(payload.nickname || payload.donatorNickname || payload.displayName || '익명'), amount: Number(payload.amount || payload.payAmount || 0), message: String(payload.message || '') } } }));
  }
  window.__CHZZK_SE_TEST_CHAT = (p={}) => renderChat({ type:'chat', clientId, id:'direct-test-'+Date.now(), createdAt:Date.now(), nickname:p.nickname||'스트리머테스트', userId:p.userId||'direct-test-user', role:p.role||'streamer', message:p.message||'방송 전 디자인 확인용 테스트 채팅입니다 {:d_51:}', emotes:p.emotes||[{code:'{:d_51:}',name:'{:d_51:}',url:'https://ssl.pstatic.net/static/nng/glive/icon/d_51.png'}] });
  window.__CHZZK_SE_TEST_DONATION = (p={}) => renderDonation({ type:'donation', clientId, id:'direct-donation-test-'+Date.now(), createdAt:Date.now(), nickname:p.nickname||'치즈테스트', amount:Number(p.amount||1000), currency:'치즈', message:p.message||'방송 전 치즈 알림 테스트입니다' });
  function connectSocket(){
    socket = io('/', { transports:['websocket','polling'], query:{clientId}, auth:{clientId}, reconnection:true, reconnectionAttempts:Infinity, reconnectionDelay:1000 });
    socket.on('connect', () => log('socket connected', socket.id));
    socket.on('connect_error', e => console.error('[CHZZK exact renderer] socket error', e?.message || e));
    socket.on('chzzk:chat', renderChat); socket.on(`chzzk:chat:${clientId}`, renderChat); socket.on('chzzk:donation', renderDonation); socket.on(`chzzk:donation:${clientId}`, renderDonation); socket.on('chzzk:status', s => log('status', s));
  }
  function start(){ bootOriginalRenderer(); connectSocket(); setTimeout(() => applyVars(), 1000); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
