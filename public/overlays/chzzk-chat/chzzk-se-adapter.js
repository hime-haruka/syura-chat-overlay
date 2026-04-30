(() => {
  const clientId = location.pathname.split('/').filter(Boolean).pop() || 'pop';
  const debug = new URLSearchParams(location.search).get('debug') === '1';
  const FIELD = window.SE_FIELD_DATA || {};
  let socket;
  let booted = false;
  let seq = 0;
  const queue = [];

  const BADGE_SVG = {
    vip: `<svg class="svgbadge" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 96 96"><defs/><g><path fill="var(--badgescolor, #ffffff)" d="M 19.403191,10.959868 0.36376509,36.881015 47.159463,87.576356 95.560901,35.504671 76.292081,11.189259 Z"/></g></svg>`,
    broadcaster: `<svg class="svgbadge" width="258.166" height="258.166" viewBox="0 0 68.306 68.306" xml:space="preserve" xmlns="http://www.w3.org/2000/svg"><path style="fill:var(--badgescolor, #ffffff);stroke-width:3.293;stroke-linecap:round;stroke-linejoin:round;paint-order:stroke fill markers" d="M100.243 106.668c-.419 0-.838.158-1.158.476L82.462 123.6l-12.86-11.883c-1.078-.997-2.823-.192-2.764 1.275l1.243 31.403a1.646 1.646 0 0 0 1.646 1.581h60.323c.877 0 1.6-.687 1.644-1.564l1.596-32.113c.074-1.505-1.743-2.31-2.809-1.246l-12.502 12.502-16.578-16.412a1.642 1.642 0 0 0-1.158-.476z" transform="translate(-65.823 -93.145)"/></svg>`,
    moderator: `<svg class="svgbadge" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 96 96"><defs/><g><path fill="var(--badgescolor, #ffffff)" stroke="var(--badgescolor, #ffffff)" d="m 5.514926,89.698649 6.163741,6.001538 19.302241,-12.65189 13.1385,12.489686 8.110185,-7.785778 L 39.253297,76.073538 90.671872,29.196667 90.509668,0.97322224 56.771297,1.7842408 23.843945,62.448427 10.705445,51.742982 4.8661112,59.690964 16.706982,70.396408 Z"/></g></svg>`,
    subscriber: `<svg width="260.306" height="261.125" viewBox="0 0 260.306 261.125" xmlns="http://www.w3.org/2000/svg"><path style="fill:var(--badgescolor, #ffffff);stroke:none;stroke-width:2.236;stroke-linecap:square;paint-order:markers stroke fill" d="M249.344 55.868s-49.869 46.12-66.367 73.49c0 0-44.62-8.248-65.242 35.621 0 0-4.124 9.75-3.374 20.998 0 0 4.43 12.464-21.816 36.086 0 0 60.06 4.784 85.183-8.34 25.122-13.123 26.996-44.244 26.621-47.619-.374-3.374-.374-16.498-.374-16.498l73.115-65.991s26.997 32.246 18.748 64.491c-8.249 32.246-17.998 36.746-36.37 57.368-18.373 20.623-17.248 10.499-18.748 31.871-1.5 21.373-17.998 50.994-54.368 58.868-36.37 7.874-82.115-9.374-91.864-16.123-9.749-6.75-56.618-37.87-57.368-96.738S55.868 93.363 70.491 79.115C85.114 64.867 116.235 36.37 163.48 37.12c47.244.75 68.991 2.25 85.864 18.748z" transform="translate(-37.1 -37.106)"/></svg>`
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
      '--namescolor': field('namescolor','#ffffff'), '--badgescolor': field('badgescolor','#ffffff'), '--outlinecol': field('accentcolor','#dcbb96'), '--accentcolor': field('accentcolor','#dcbb96'),
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
    const t = badgeType(userType);
    if(!t) return '';
    const svg = BADGE_SVG[t] || BADGE_SVG.vip;
    return `<div class="${t} custombadge">${svg}</div>`;
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

  function nativeDecor(userType){
    // 원본 addMessage가 노출되지 않은 경우에도 최소한 원본 CSS가 기대하는 장식 클래스를 넣어준다.
    if(userType === 'vip') return `<svg class="lilyvip" viewBox="0 0 66.131 49.763" xmlns="http://www.w3.org/2000/svg"><path style="fill:var(--lilypad);filter:brightness(1.4) hue-rotate(-10deg) saturate(90%)" d="m1.146 30.765 13.972 6.428s1.147.59.098 1.017c-1.05.426-14.76 6.888-14.76 6.888s-.82.656-.262 1.18c.558.525 3.936 3.28 7.38 3.28s29.453-.033 29.453-.033 1.344.164 2.427-2.099c1.082-2.263 1.213-2.722 1.41-2.853.197-.131.558-.984 1.148.164.59 1.148 1.837 3.739 1.837 3.739s.262 1.082 2 1.05c1.739-.033 9.676-.033 9.676-.033s5.87-.328 8.92-5.609c3.051-5.28.952-10.364.952-10.364s-2.493-5.543-6.756-6.757c0 0-9.046-3.957-17.163-3.632-8.117.325-17.115 2.922-17.115 2.922l-17.58.093s-4.685.881-6.262 3.061c0 0-.835.902.625 1.558z"/><path style="fill:var(--lily1)" d="M41.57 30.599s-4.916 3.757-14.656-1.67-10.298-12.384-10.298-12.384 5.335-2.737 13.22 1.206C37.72 21.693 41.57 30.599 41.57 30.599z"/></svg>`;
    if(userType === 'subscriber' || userType === 'sub') return `<svg class="frogsub" viewBox="0 0 96.248 91.16" xmlns="http://www.w3.org/2000/svg"><path style="fill:var(--frog1)" d="M24.29.075A12.604 12.604 0 0 0 11.686 12.679a12.604 12.604 0 0 0 2.17 7.07A48.05 49.305 0 0 0 .074 54.265a48.05 49.305 0 0 0 .125 3.434c.67 5.995 4.596 24.353 27.728 29.674 27.766 6.387 52.96-3.992 52.96-3.992S94.514 74.83 96.078 56.89a48.05 49.305 0 0 0 .096-2.625A48.05 49.305 0 0 0 82.559 19.92a12.737 12.737 0 0 0 2.06-6.931A12.737 12.737 0 0 0 71.883.252 12.737 12.737 0 0 0 60.79 6.738a48.05 49.305 0 0 0-12.666-1.779 48.05 49.305 0 0 0-12.71 1.791A12.604 12.604 0 0 0 24.29.075z"/></svg><svg class="lilysub" viewBox="0 0 57.005 23.334" xmlns="http://www.w3.org/2000/svg"><path style="fill:var(--frog1)" d="M11.667 0A11.667 11.667 0 0 0 0 11.666a11.667 11.667 0 0 0 11.668 11.668 11.667 11.667 0 0 0 11.195-8.405l-4.214-2.773 4.634-1.571A11.667 11.667 0 0 0 11.667 0zm33.723 0a11.667 11.667 0 0 0-11.668 11.666A11.667 11.667 0 0 0 45.39 23.334a11.667 11.667 0 0 0 11.195-8.405l-4.214-2.773 4.634-1.571A11.667 11.667 0 0 0 45.39 0z"/></svg>`;
    if(userType === 'mod') return `<svg class="lilymod" viewBox="0 0 51.22 21.779" xmlns="http://www.w3.org/2000/svg"><path style="fill:var(--frog1)" d="M11.667 0C5.224 0 0 5.223 0 11.666c0 6.444 5.224 11.668 11.668 11.668a11.668 11.668 0 0 0 11.195-8.405l-4.214-2.773 4.634-1.571A11.667 11.667 0 0 0 11.667 0z"/></svg>`;
    if(userType === 'streamer') return `<div class="righthand"></div><div class="lefthand"></div><svg class="lilymain" viewBox="0 0 66.131 49.763" xmlns="http://www.w3.org/2000/svg"><path style="fill:var(--lilypad);filter:brightness(1.4) hue-rotate(-10deg) saturate(90%)" d="m1.146 30.765 13.972 6.428s1.147.59.098 1.017c-1.05.426-14.76 6.888-14.76 6.888s-.82.656-.262 1.18c.558.525 3.936 3.28 7.38 3.28s29.453-.033 29.453-.033 1.344.164 2.427-2.099c1.082-2.263 1.213-2.722 1.41-2.853.197-.131.558-.984 1.148.164.59 1.148 1.837 3.739 1.837 3.739s.262 1.082 2 1.05c1.739-.033 9.676-.033 9.676-.033s5.87-.328 8.92-5.609c3.051-5.28.952-10.364.952-10.364s-2.493-5.543-6.756-6.757c0 0-9.046-3.957-17.163-3.632-8.117.325-17.115 2.922-17.115 2.922l-17.58.093s-4.685.881-6.262 3.061c0 0-.835.902.625 1.558z"/></svg><svg class="lilyfrog" viewBox="0 0 39.204 20.136" xmlns="http://www.w3.org/2000/svg"><path style="fill:var(--lilypad)" d="M19.603 0A19.602 10.068 0 0 0 0 10.067a19.602 10.068 0 0 0 19.603 10.067 19.602 10.068 0 0 0 7.62-.792c.212-.206.287-.598-.062-1.34-.862-1.835-1.05-2.29-1.05-2.29s-.048-.533.485-.423c.534.11 5.52 1.49 5.52 1.49s1.215.382 2.2-.063a19.602 10.068 0 0 0 4.888-6.65A19.602 10.068 0 0 0 19.603 0z"/></svg>`;
    return '';
  }

  function nativeFallback({ nameHtml, badges, msg, sender, msgId, userType }){
    const container=document.querySelector('.main-container'); if(!container) return;
    const row=document.createElement('div'); row.dataset.sender=sender; row.dataset.msgid=msgId; row.id=`msg-${seq++}`; row.className=`message-row animation1 ${userType} ${msgId} id${msgId}`;
    row.innerHTML = `<span class="namebox"><div class="badgescont"><div class="badgesbox">${badges}</div></div>${nameHtml}</span><div class="msgcont"><div class="messagebox">${nativeDecor(userType)}<span class="message">${msg}</span></div></div>`;
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
