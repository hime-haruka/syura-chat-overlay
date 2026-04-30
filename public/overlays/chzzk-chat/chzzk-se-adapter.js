(() => {
  const clientId = location.pathname.split('/').filter(Boolean).pop() || 'pop';
  const debug = new URLSearchParams(location.search).get('debug') === '1';
  const FIELD = window.SE_FIELD_DATA || {};
  let socket;
  let booted = false;
  let seq = 0;
  const queue = [];

  const BADGE_URLS = {
    broadcaster: 'https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/3',
    moderator: 'https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/3',
    subscriber: 'https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/3',
    vip: 'https://static-cdn.jtvnw.net/badges/v1/b817aba4-fad8-49e2-b88a-7cc744dfa6ec/3'
  };

  function log(...a){ if(debug) console.log('[CHZZK native renderer]', ...a); }
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
    const vars = {
      '--namesSize': `${field('namesSize',16)}px`, '--msgSize': `${field('msgSize',16)}px`, '--msgback': field('msgback','#ffffff'),
      '--namesBold': field('namesBold','700'), '--msgBold': field('msgBold','700'), '--textback': field('textback','rgba(173,143,255,0)'),
      '--namesFont': `'${field('namesFont','Quicksand')}', sans-serif`, '--msgFont': `'${field('msgFont','Quicksand')}', sans-serif`,
      '--namescolor': field('namescolor','#ffffff'), '--outlinecol': field('accentcolor','#dcbb96'), '--accentcolor': field('accentcolor','#dcbb96'),
      '--msgcolor': field('msgcolor','#47843b'), '--alerttext': field('alerttext','#47843b'), '--msgHide': `${field('msgHide',7)}s`,
      '--alertback': field('alertsboxcol','#ffffff'), '--frog1': field('frog1','#bce78e'), '--frog2': hexToHsl(field('frog1','#bce78e'),0,8),
      '--lily1': lily, '--lily2': hexToHsl(lily,21,12), '--lily3': hexToHsl(lily,30,20), '--lilypad': field('lilypad','#82c080')
    };
    for(const [k,v] of Object.entries(vars)){ document.documentElement.style.setProperty(k,v); document.querySelector('.main-container')?.style.setProperty(k,v); }
  }

  function bootOriginalRenderer(){
    if(booted) return; booted = true; applyVars();
    try {
      // 원본 StreamElements JS는 이벤트 수신용으로 쓰지 않는다. 필드값/CSS 변수/애니메이션 컨텍스트와 addMessage 템플릿만 초기화한다.
      window.dispatchEvent(new CustomEvent('onWidgetLoad', { detail: { fieldData: FIELD, channel: { username: clientId, providerId: '100135110' }, session: { data: {}, currency: ' 치즈' } } }));
    } catch(e) { console.warn('[CHZZK native renderer] onWidgetLoad init failed', e); }
    setTimeout(() => { while(queue.length) queue.shift()(); }, 300);
  }

  function roleToUserType(role){
    const r = String(role || '').toLowerCase();
    if(r.includes('streamer') || r.includes('broadcaster') || r.includes('owner')) return 'streamer';
    if(r.includes('manager') || r.includes('moderator') || r === 'mod') return 'mod';
    if(r.includes('subscriber') || r === 'sub') return 'subscriber';
    if(r.includes('follower') || r === 'vip') return 'vip';
    return 'default';
  }
  function badgeType(userType){ return userType === 'streamer' ? 'broadcaster' : userType === 'mod' ? 'moderator' : userType === 'subscriber' ? 'subscriber' : userType === 'vip' ? 'vip' : ''; }
  function badgesHtml(userType){
    const t = badgeType(userType); if(!t) return ''; const url = BADGE_URLS[t];
    return `<div class="${t} custombadge"><img alt="" src="${url}" class="badge2"></div>`;
  }
  function emotes(text, raw){
    const out=[]; if(Array.isArray(raw)){ for(const e of raw){ const name=e.code||e.name||e.id, url=e.url||e.imageUrl||e.image; if(name&&url) out.push({name:String(name),url:String(url)}); } }
    else if(raw && typeof raw === 'object'){ for(const [name,url] of Object.entries(raw)) out.push({name:String(name),url:String(url)}); }
    if(String(text).includes('{:d_51:}') && !out.some(e=>e.name==='{:d_51:}')) out.push({name:'{:d_51:}',url:'https://ssl.pstatic.net/static/nng/glive/icon/d_51.png'});
    return out;
  }
  function messageHtml(text, rawEmotes){
    let html = esc(text || '');
    for(const e of emotes(text, rawEmotes)){ html = html.split(esc(e.name)).join(`<img class="default" src="${esc(e.url)}" alt="${esc(e.name)}">`); }
    return html;
  }

  function nativeFallback({ nameHtml, badges, msg, sender, msgId, userType }){
    const container=document.querySelector('.main-container'); if(!container) return;
    const row=document.createElement('div'); row.dataset.sender=sender; row.dataset.msgid=msgId; row.id=`msg-${seq++}`; row.className=`message-row animation1 ${userType} ${msgId} id${msgId}`;
    row.innerHTML = `<span class="namebox"><div class="badgescont"><div class="badgesbox">${badges}</div></div>${nameHtml}</span><div class="msgcont"><div class="messagebox"><span class="message">${msg}</span></div></div>`;
    if(field('alignMessages','bottom') === 'top') container.prepend(row); else container.append(row);
    row.style.display='none'; window.jQuery ? window.jQuery(row).slideToggle(400) : row.style.display='';
  }

  function renderChat(payload){
    if(!payload || (payload.clientId && String(payload.clientId) !== clientId)) return;
    const run = () => {
      applyVars();
      const userType = roleToUserType(payload.role);
      const msgId = String(payload.id || payload.msgId || `chzzk-${Date.now()}-${seq++}`).replace(/[^a-zA-Z0-9_-]/g, '');
      const sender = String(payload.userId || payload.nickname || 'unknown').replace(/["<>]/g, '');
      const nameHtml = `<span class="name">${esc(payload.nickname || payload.displayName || '익명')}<span class="pronouns"></span></span>`;
      const badges = badgesHtml(userType);
      const msg = messageHtml(payload.message || payload.content || payload.text || '', payload.emotes);
      const container = document.querySelector('.main-container'); const before = container ? container.children.length : 0;
      try {
        if(typeof window.addMessage !== 'function') throw new Error('addMessage is not ready');
        window.addMessage(nameHtml, badges, msg, false, sender, msgId, userType, `id${msgId}`);
        log('rendered with original addMessage', { userType, msgId });
      } catch(e) {
        console.warn('[CHZZK native renderer] original addMessage failed; fallback DOM used', e);
        nativeFallback({ nameHtml, badges, msg, sender, msgId, userType });
      }
      if(container && container.children.length <= before) nativeFallback({ nameHtml, badges, msg, sender, msgId, userType });
      trimRows();
    };
    if(!booted) queue.push(run); else run();
  }

  function renderDonation(payload){
    if(!payload || (payload.clientId && String(payload.clientId) !== clientId)) return;
    applyVars();
    const container=document.querySelector('.main-container'); if(!container) return;
    const amount=Number(payload.amount || payload.payAmount || 0).toLocaleString('ko-KR');
    const name=esc(payload.nickname || payload.donatorNickname || payload.displayName || '익명');
    const row=document.createElement('div'); row.className='message-row animation1 chzzk-cheese-alert';
    row.innerHTML=`<div class="alertcont"><div class="alerttextwrap"><span class="alertName">${name}</span><span class="alerttext"> ${amount} 치즈</span></div></div>`;
    if(field('alignMessages','bottom') === 'top') container.prepend(row); else container.append(row);
    row.style.display='none'; window.jQuery ? window.jQuery(row).slideToggle(400) : row.style.display='';
    trimRows();
  }

  function trimRows(){
    const limit = field('msgLimit', false) ? Number(field('msgLimitAmount',4)) : 30;
    const rows=[...document.querySelectorAll('.main-container > .message-row')]; while(rows.length > limit) rows.shift()?.remove();
  }

  window.__CHZZK_SE_TEST_CHAT = (p={}) => renderChat({ type:'chat', clientId, id:'direct-test-'+Date.now(), createdAt:Date.now(), nickname:p.nickname||'스트리머테스트', userId:p.userId||'direct-test-user', role:p.role||'streamer', message:p.message||'방송 전 디자인 확인용 테스트 채팅입니다 {:d_51:}', emotes:p.emotes||[{code:'{:d_51:}',name:'{:d_51:}',url:'https://ssl.pstatic.net/static/nng/glive/icon/d_51.png'}] });
  window.__CHZZK_SE_TEST_DONATION = (p={}) => renderDonation({ type:'donation', clientId, id:'direct-donation-test-'+Date.now(), createdAt:Date.now(), nickname:p.nickname||'치즈테스트', amount:Number(p.amount||1000), currency:'치즈', message:p.message||'방송 전 치즈 알림 테스트입니다' });

  function connectSocket(){
    socket = io('/', { transports:['websocket','polling'], query:{clientId}, auth:{clientId}, reconnection:true, reconnectionAttempts:Infinity, reconnectionDelay:1000 });
    socket.on('connect', () => log('socket connected', socket.id));
    socket.on('connect_error', e => console.error('[CHZZK native renderer] socket error', e?.message || e));
    socket.on('chzzk:chat', renderChat); socket.on(`chzzk:chat:${clientId}`, renderChat);
    socket.on('chzzk:donation', renderDonation); socket.on(`chzzk:donation:${clientId}`, renderDonation);
    socket.on('chzzk:status', s => log('status', s));
  }

  function start(){ bootOriginalRenderer(); connectSocket(); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
