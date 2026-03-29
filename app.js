/* ═══════════════════════════════════════════════════════════
   LuongSon TV — App
   Vanilla JS SPA · Hash router · HLS.js
═══════════════════════════════════════════════════════════ */

const API = 'https://api-ls.cdnokvip.com/api';

/* ── SVG icons ─────────────────────────────────────────── */
const ICO = {
  play:   '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>',
  pause:  '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg>',
  volOn:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05A4.47 4.47 0 0 0 16.5 12z"/></svg>',
  volOff: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A9 9 0 0 0 21 12c0-4.28-3-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a7 7 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4l-2.09 2.09L12 8.18V4z"/></svg>',
  fs:     '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
  fsExit: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>',
  crop:   '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 17V1H5v4H1v2h4v10a2 2 0 0 0 2 2h10v4h2v-4h4v-2H7zm10-2V7H9v2h6v6h2z"/></svg>',
  sync:   '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 12l7-7v4h7v6h-7v4z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  back:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
  eye:    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>',
  playFill: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
};

/* ── State ─────────────────────────────────────────────── */
let allMatches    = [];
let currentFilter = 'ALL';
let searchQuery   = '';
let searchOpen    = false;
let refreshTimer  = null;
let flvPlayer     = null;
let routeToken    = 0;
let bufferTimer   = null;

/* Crop state */
let crop = {
  mode: 'idle',       // idle | selecting | cropped
  canvas: null,
  animFrame: null,
  // Selection in player-relative pixels
  sx: 0, sy: 0, sw: 0, sh: 0,
};

/* ── Router ────────────────────────────────────────────── */
function getRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  if (h.startsWith('match/')) return { page: 'match', id: decodeURIComponent(h.slice(6)) };
  return { page: 'home' };
}
function navigate(path) { location.hash = path; }

window.addEventListener('hashchange', onRoute);
window.addEventListener('load', onRoute);

function onRoute() {
  destroyPlayer();
  clearCrop();
  clearInterval(refreshTimer);
  clearTimeout(bufferTimer);
  const r = getRoute();
  if (r.page === 'match') renderMatchPage(r.id);
  else renderHomePage();
}

/* ── API ───────────────────────────────────────────────── */
async function apiGet(url) {
  try { const r = await fetch(url); return r.ok ? await r.json() : null; }
  catch { return null; }
}
async function apiPost(url) {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

/* ── Utils ─────────────────────────────────────────────── */
function matchStatus(m) {
  if (m.status === 1 || m.status === 2 || m.status === 3 || m.liveGame) return 'live';
  if (m.status === 4) return 'finished';
  return 'upcoming';
}
function isRealMatch(m) {
  if (!m.homeName || !m.awayName) return false;
  const h = m.homeName.trim().toUpperCase();
  const a = m.awayName.trim().toUpperCase();
  if (h === '' || a === '') return false;

  // Exclude common non-match patterns
  const nonMatchPatterns = ['TV', 'CHANNEL', 'STREAMING', 'LIVE', 'BROADCAST', 'NEWS'];
  for (const pat of nonMatchPatterns) {
    if (h.includes(pat) || a.includes(pat)) return false;
  }

  return true;
}
function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
function fmtViews(n) {
  if (!n) return '';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return Math.round(n / 1e3) + 'k';
  return String(n);
}
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ── Player ────────────────────────────────────────────── */
function destroyPlayer() {
  if (flvPlayer) { flvPlayer.destroy(); flvPlayer = null; }
  clearTimeout(bufferTimer);
}

let retryUrl    = null;
let retryUrlFlv = null;
function retryStream() { if (retryUrl) startStream(retryUrl, retryUrlFlv); }

function restoreCrop() {
  const matchId = getRoute().id;
  if (!matchId) return;
  const saved = localStorage.getItem('crop_' + matchId);
  if (!saved) return;
  try {
    const { sx, sy, sw, sh } = JSON.parse(saved);
    const wrap = document.getElementById('player-wrap');
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    applyCrop(sx * rect.width, sy * rect.height, sw * rect.width, sh * rect.height);
    const cropBtn = document.getElementById('ctrl-crop');
    if (cropBtn) cropBtn.classList.add('active');
  } catch (e) {}
}

function startStream(url, flvUrl) {
  retryUrl    = url;
  retryUrlFlv = flvUrl || url;
  const video   = document.getElementById('nx-video');
  const overlay = document.getElementById('player-overlay');
  if (!video) return;

  destroyPlayer();

  if (overlay) { overlay.style.display = ''; overlay.innerHTML = '<div class="spinner"></div>'; }

  video.addEventListener('playing', function onFirst() {
    video.removeEventListener('playing', onFirst);
    if (overlay) overlay.style.display = 'none';
    clearTimeout(bufferTimer);
  });

  video.addEventListener('waiting', () => {
    clearTimeout(bufferTimer);
    bufferTimer = setTimeout(() => {
      if (overlay && video.readyState < 3) {
        overlay.style.display = '';
        overlay.innerHTML = '<div class="spinner"></div>';
      }
    }, 2500);
  });
  video.addEventListener('playing', () => { clearTimeout(bufferTimer); if (overlay) overlay.style.display = 'none'; });
  video.addEventListener('canplay', () => { clearTimeout(bufferTimer); if (overlay) overlay.style.display = 'none'; });

  const loadTimeout = setTimeout(() => {
    if (overlay && overlay.style.display !== 'none') {
      overlay.innerHTML = `<div class="player-overlay-msg">
        <div style="color:var(--red);font-weight:700">Flux indisponible</div>
        <div style="font-size:12px">Le stream n'a pas démarré</div>
        <button class="retry-btn" onclick="retryStream()">Réessayer</button>
      </div>`;
    }
  }, 15000);
  video.addEventListener('playing', () => clearTimeout(loadTimeout), { once: true });

  flvPlayer = mpegts.createPlayer({ type: 'flv', url: flvUrl, isLive: true }, {
    enableWorker: true,
    liveBufferLatencyChasing: true,
    liveBufferLatencyMaxLatency: 8,
    liveBufferLatencyMinRemain: 2,
    lazyLoad: false,
  });
  flvPlayer.attachMediaElement(video);
  flvPlayer.load();
  video.muted = true;
  video.play().then(() => { video.muted = false; }).catch(() => {});
  flvPlayer.on(mpegts.Events.ERROR, () => {
    if (overlay) overlay.innerHTML = `<div class="player-overlay-msg">
      <div style="color:var(--red);font-weight:700">Flux indisponible</div>
      <div style="font-size:12px">Le stream n'a pas démarré</div>
      <button class="retry-btn" onclick="retryStream()">Réessayer</button>
    </div>`;
  });
  restoreCrop();
}

/* ── Crop system ───────────────────────────────────────── */
function clearCrop() {
  if (crop.animFrame) cancelAnimationFrame(crop.animFrame);
  if (crop.canvas) crop.canvas.remove();
  crop = { mode: 'idle', canvas: null, animFrame: null, sx: 0, sy: 0, sw: 0, sh: 0 };
  // Remove any overlay
  document.querySelector('.crop-overlay')?.remove();
}

function toggleCrop() {
  const wrap = document.getElementById('player-wrap');
  const cropBtn = document.getElementById('ctrl-crop');
  if (!wrap) return;

  if (crop.mode === 'cropped') {
    // Clear crop
    clearCrop();
    if (cropBtn) cropBtn.classList.remove('active');
    // Remove from localStorage
    const matchId = getRoute().id;
    if (matchId) localStorage.removeItem('crop_' + matchId);
    return;
  }

  if (crop.mode === 'selecting') {
    // Cancel selection
    clearCrop();
    if (cropBtn) cropBtn.classList.remove('active');
    return;
  }

  // Enter selection mode
  crop.mode = 'selecting';
  if (cropBtn) cropBtn.classList.add('active');

  const overlay = document.createElement('div');
  overlay.className = 'crop-overlay';
  overlay.innerHTML = '<div class="crop-hint">Dessinez la zone à garder</div><div class="crop-sel" id="crop-sel" style="display:none"></div>';
  wrap.appendChild(overlay);

  let startX, startY, dragging = false;
  const sel = overlay.querySelector('#crop-sel');

  overlay.addEventListener('mousedown', e => {
    e.preventDefault();
    const rect = overlay.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    dragging = true;
    sel.style.display = 'block';
  });

  overlay.addEventListener('mousemove', e => {
    if (!dragging) return;
    const rect = overlay.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const x = Math.min(startX, cx);
    const y = Math.min(startY, cy);
    const w = Math.abs(cx - startX);
    const h = Math.abs(cy - startY);
    sel.style.left = x + 'px';
    sel.style.top = y + 'px';
    sel.style.width = w + 'px';
    sel.style.height = h + 'px';
  });

  overlay.addEventListener('mouseup', e => {
    if (!dragging) return;
    dragging = false;
    const rect = overlay.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const x = Math.min(startX, cx);
    const y = Math.min(startY, cy);
    const w = Math.abs(cx - startX);
    const h = Math.abs(cy - startY);

    overlay.remove();

    if (w < 20 || h < 20) {
      crop.mode = 'idle';
      if (cropBtn) cropBtn.classList.remove('active');
      return;
    }

    applyCrop(x, y, w, h);
  });

  // Touch support
  overlay.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.touches[0];
    const rect = overlay.getBoundingClientRect();
    startX = t.clientX - rect.left;
    startY = t.clientY - rect.top;
    dragging = true;
    sel.style.display = 'block';
  }, { passive: false });

  overlay.addEventListener('touchmove', e => {
    if (!dragging) return;
    const t = e.touches[0];
    const rect = overlay.getBoundingClientRect();
    const cx = t.clientX - rect.left;
    const cy = t.clientY - rect.top;
    sel.style.left = Math.min(startX, cx) + 'px';
    sel.style.top = Math.min(startY, cy) + 'px';
    sel.style.width = Math.abs(cx - startX) + 'px';
    sel.style.height = Math.abs(cy - startY) + 'px';
  }, { passive: true });

  overlay.addEventListener('touchend', e => {
    if (!dragging) return;
    dragging = false;
    const t = e.changedTouches[0];
    const rect = overlay.getBoundingClientRect();
    const cx = t.clientX - rect.left;
    const cy = t.clientY - rect.top;
    const x = Math.min(startX, cx), y = Math.min(startY, cy);
    const w = Math.abs(cx - startX), h = Math.abs(cy - startY);
    overlay.remove();
    if (w < 20 || h < 20) { crop.mode = 'idle'; if (cropBtn) cropBtn.classList.remove('active'); return; }
    applyCrop(x, y, w, h);
  });
}

function applyCrop(px, py, pw, ph) {
  const wrap  = document.getElementById('player-wrap');
  const video = document.getElementById('nx-video');
  if (!wrap || !video) return;

  crop.sx = px; crop.sy = py; crop.sw = pw; crop.sh = ph;
  crop.mode = 'cropped';

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.className = 'crop-canvas';
  const wrapRect = wrap.getBoundingClientRect();

  // Persist as normalized coords (0–1) so restore works at any player size
  const matchId = getRoute().id;
  if (matchId) {
    localStorage.setItem('crop_' + matchId, JSON.stringify({
      sx: px / wrapRect.width,
      sy: py / wrapRect.height,
      sw: pw / wrapRect.width,
      sh: ph / wrapRect.height
    }));
  }
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(wrapRect.width * dpr);
  canvas.height = Math.round(wrapRect.height * dpr);
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  wrap.appendChild(canvas);
  crop.canvas = canvas;

  const ctx = canvas.getContext('2d');

  function render() {
    if (crop.mode !== 'cropped') return;

    const cw = canvas.width;
    const ch = canvas.height;
    const playerW = cw / dpr;
    const playerH = ch / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, playerW, playerH);

    if (video.readyState < 2) {
      crop.animFrame = requestAnimationFrame(render);
      return;
    }

    // Calculate where the video displays within the player (object-fit: contain)
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) { crop.animFrame = requestAnimationFrame(render); return; }

    const videoAR = vw / vh;
    const playerAR = playerW / playerH;
    let dispW, dispH, dispX, dispY;
    if (videoAR > playerAR) {
      dispW = playerW; dispH = playerW / videoAR;
      dispX = 0; dispY = (playerH - dispH) / 2;
    } else {
      dispH = playerH; dispW = playerH * videoAR;
      dispX = (playerW - dispW) / 2; dispY = 0;
    }

    // Map selection (player coords) to video intrinsic coords
    // Clamp selection to video display area
    const sx1 = Math.max(crop.sx, dispX);
    const sy1 = Math.max(crop.sy, dispY);
    const sx2 = Math.min(crop.sx + crop.sw, dispX + dispW);
    const sy2 = Math.min(crop.sy + crop.sh, dispY + dispH);
    const cropDispW = sx2 - sx1;
    const cropDispH = sy2 - sy1;

    if (cropDispW <= 0 || cropDispH <= 0) {
      crop.animFrame = requestAnimationFrame(render);
      return;
    }

    // Source in intrinsic video pixels
    const srcX = (sx1 - dispX) / dispW * vw;
    const srcY = (sy1 - dispY) / dispH * vh;
    const srcW = cropDispW / dispW * vw;
    const srcH = cropDispH / dispH * vh;

    // Scale crop to fill the canvas
    ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, playerW, playerH);

    crop.animFrame = requestAnimationFrame(render);
  }

  crop.animFrame = requestAnimationFrame(render);
}

function bindPlayerControls(isLive) {
  const video     = document.getElementById('nx-video');
  const wrap      = document.getElementById('player-wrap');
  const playBtn   = document.getElementById('ctrl-play');
  const syncBtn   = document.getElementById('ctrl-sync');
  const cropBtn   = document.getElementById('ctrl-crop');
  const muteBtn   = document.getElementById('ctrl-mute');
  const volSlider = document.getElementById('ctrl-volume');
  const fsBtn     = document.getElementById('ctrl-fs');
  if (!video || !wrap) return;

  // Play / Pause
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (video.paused) video.play().catch(() => {}); else video.pause();
    });
    video.addEventListener('play',  () => { playBtn.innerHTML = ICO.pause; });
    video.addEventListener('pause', () => { playBtn.innerHTML = ICO.play; });
  }

  // Sync to live
  if (syncBtn) {
    syncBtn.addEventListener('click', () => {
      if (video.seekable?.length) {
        const target = video.seekable.end(video.seekable.length - 1) - 3;
        video.currentTime = Math.max(target, video.seekable.start(0));
      }
      video.playbackRate = 1;
      video.play().catch(() => {});
    });
  }

  // Crop
  if (cropBtn) {
    cropBtn.addEventListener('click', () => toggleCrop());
  }

  // Volume
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      video.muted = !video.muted;
      muteBtn.innerHTML = video.muted ? ICO.volOff : ICO.volOn;
      if (volSlider) volSlider.value = video.muted ? 0 : video.volume;
    });
  }
  if (volSlider) {
    volSlider.addEventListener('input', () => {
      video.volume = parseFloat(volSlider.value);
      video.muted  = video.volume === 0;
      if (muteBtn) muteBtn.innerHTML = video.muted ? ICO.volOff : ICO.volOn;
    });
  }

  // Fullscreen
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else wrap.requestFullscreen?.();
    });
    document.addEventListener('fullscreenchange', () => {
      if (fsBtn) fsBtn.innerHTML = document.fullscreenElement ? ICO.fsExit : ICO.fs;
      wrap.classList.toggle('show-controls', !!document.fullscreenElement);
    });
  }

  // Auto-hide controls
  let hideTimer;
  const showControls = () => {
    clearTimeout(hideTimer);
    wrap.classList.add('show-controls');
    hideTimer = setTimeout(() => wrap.classList.remove('show-controls'), 3000);
  };
  wrap.addEventListener('mousemove', showControls);
  wrap.addEventListener('mouseleave', () => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => wrap.classList.remove('show-controls'), 300);
  });
  wrap.addEventListener('mouseenter', showControls);
}

/* ── Navbar ─────────────────────────────────────────────── */
function renderNav(back) {
  return `<nav class="nav" id="main-nav">
    <div class="nav-logo" onclick="navigate('/')">LUONGSON</div>
    ${!back ? `<ul class="nav-links">
      <li><a href="#/">Accueil</a></li>
      <li><a href="#/" onclick="setFilter('live',event)">En direct</a></li>
    </ul>` : ''}
    <div class="nav-right">
      ${!back ? `<div class="search-wrap">
        <button class="search-toggle" id="search-toggle">${ICO.search}</button>
        <input type="text" class="search-input" id="search-input" placeholder="Rechercher…">
      </div>` : `<button class="back-btn" onclick="navigate('/')">${ICO.back} Accueil</button>`}
    </div>
  </nav>`;
}

function bindNav() {
  const nav = document.getElementById('main-nav');
  const toggle = document.getElementById('search-toggle');
  const input  = document.getElementById('search-input');
  const check = () => { if (nav) nav.classList.toggle('solid', window.scrollY > 20); };
  window.addEventListener('scroll', check, { passive: true });
  check();
  if (!toggle || !input) return;
  toggle.addEventListener('click', () => {
    searchOpen = !searchOpen;
    input.classList.toggle('open', searchOpen);
    if (searchOpen) input.focus();
    else { searchQuery = ''; input.value = ''; renderMatchList(); }
  });
  input.addEventListener('input', e => { searchQuery = e.target.value.toLowerCase().trim(); renderMatchList(); });
  if (searchOpen) { input.classList.add('open'); input.value = searchQuery; }
}

/* ── Home ──────────────────────────────────────────────── */
function getMatches() {
  return allMatches.filter(isRealMatch);
}

function getFeatured() {
  const live = getMatches().filter(m => matchStatus(m) === 'live');
  if (!live.length) return null;
  live.sort((a, b) => (b.viewNumber || 0) - (a.viewNumber || 0));
  return live[0];
}

async function renderHomePage() {
  const tk = ++routeToken;
  document.getElementById('app').innerHTML = renderNav(false) + `
    <div class="page"><div class="container">
      <div id="hero-slot"></div>
      <div class="filters" id="filters"></div>
      <div id="match-list"><div class="loading"><div class="spinner"></div></div></div>
    </div></div>`;
  bindNav();
  renderFilters();
  if (await loadMatches(false, tk)) {
    refreshTimer = setInterval(() => loadMatches(true, tk), 60000);
  }
}

async function loadMatches(silent, tk) {
  if (!silent) {
    const el = document.getElementById('match-list');
    if (el) el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  }
  const json = await apiGet(`${API}/get-livestream-group`);
  if (tk !== routeToken) return false;
  if (json?.value?.datas) {
    allMatches = json.value.datas;
    renderFilters();
    renderHero();
    renderMatchList();
    return true;
  }
  if (!silent) {
    const el = document.getElementById('match-list');
    if (el) el.innerHTML = `<div class="error-state">
      <div class="error-icon">Connexion impossible</div>
      <div class="error-sub">L'API est temporairement indisponible</div>
      <button class="retry-btn" onclick="loadMatches()">Réessayer</button>
    </div>`;
  }
  return false;
}

function renderHero() {
  const slot = document.getElementById('hero-slot');
  if (!slot) return;
  const m = getFeatured();
  if (!m) { slot.innerHTML = ''; return; }

  const st = matchStatus(m);
  const hasScore = m.homeScore != null && m.awayScore != null && st !== 'upcoming';
  const center = hasScore
    ? `<div class="hero-score">${m.homeScore} — ${m.awayScore}</div>`
    : '<div class="hero-vs">VS</div>';
  const viewers = m.viewNumber ? `<span>${ICO.eye} ${fmtViews(m.viewNumber)} spectateurs</span>` : '';

  slot.innerHTML = `
    <div class="hero" onclick="navigate('/match/${esc(m.matchId)}')">
      <div class="hero-glow"></div>
      <div class="hero-inner">
        <div class="hero-teams">
          <div class="hero-team">
            ${m.homeLogo ? `<img src="${esc(m.homeLogo)}" alt="" onerror="this.style.display='none'">` : ''}
            <div class="hero-team-name">${esc(m.homeName)}</div>
          </div>
          ${center}
          <div class="hero-team">
            ${m.awayLogo ? `<img src="${esc(m.awayLogo)}" alt="" onerror="this.style.display='none'">` : ''}
            <div class="hero-team-name">${esc(m.awayName)}</div>
          </div>
        </div>
        <div class="hero-info">
          <div class="hero-badge"><span class="live-dot" style="background:#fff"></span> EN DIRECT</div>
          <div class="hero-title">${esc(m.homeName)} vs ${esc(m.awayName)}</div>
          <div class="hero-meta">
            <span>${esc(m.leagueName || '')}</span>
            ${viewers ? `<span style="color:#555">·</span> ${viewers}` : ''}
          </div>
          <button class="hero-cta">${ICO.playFill} Regarder</button>
        </div>
      </div>
    </div>`;
}

function setFilter(id, ev) {
  if (ev) ev.preventDefault();
  currentFilter = id;
  renderFilters();
  renderMatchList();
}

function renderFilters() {
  const el = document.getElementById('filters');
  if (!el) return;
  const matches = getMatches();
  const c = {
    ALL:      matches.length,
    live:     matches.filter(m => matchStatus(m) === 'live').length,
    upcoming: matches.filter(m => matchStatus(m) === 'upcoming').length,
    finished: matches.filter(m => matchStatus(m) === 'finished').length,
  };
  el.innerHTML = [
    { id:'ALL', l:'Tous' }, { id:'live', l:'En direct' },
    { id:'upcoming', l:'À venir' }, { id:'finished', l:'Terminés' }
  ].map(t => `<button class="filter-btn ${currentFilter===t.id?'active':''}"
    onclick="setFilter('${t.id}')">
    ${t.id==='live' && c.live ? '<span class="live-dot"></span>' : ''}
    ${t.l} <span class="filter-count">${c[t.id]}</span>
  </button>`).join('');
}

function renderMatchList() {
  const el = document.getElementById('match-list');
  if (!el) return;

  let list = getMatches();
  const featured = getFeatured();

  if (currentFilter !== 'ALL') list = list.filter(m => matchStatus(m) === currentFilter);
  if (searchQuery) list = list.filter(m =>
    m.homeName?.toLowerCase().includes(searchQuery) ||
    m.awayName?.toLowerCase().includes(searchQuery) ||
    m.leagueName?.toLowerCase().includes(searchQuery));

  // Exclude featured match from list (already in hero)
  if (featured && currentFilter === 'ALL' && !searchQuery) {
    list = list.filter(m => m.matchId !== featured.matchId);
  }

  if (!list.length) { el.innerHTML = '<div class="empty-state">Aucun match trouvé</div>'; return; }

  const O = { live:0, upcoming:1, finished:2 };
  list.sort((a,b) => (O[matchStatus(a)] - O[matchStatus(b)]) || (a.matchTime||0) - (b.matchTime||0));

  const g = new Map();
  for (const m of list) { const k = m.leagueName||'Autres'; if (!g.has(k)) g.set(k,[]); g.get(k).push(m); }
  const sorted = [...g.entries()].sort(([,a],[,b]) =>
    (a.some(m => matchStatus(m)==='live')?0:1) - (b.some(m => matchStatus(m)==='live')?0:1));

  el.innerHTML = sorted.map(([league, ms]) => `
    <div class="league-group">
      <div class="league-title">${esc(league)}</div>
      <div class="cards-grid">${ms.map(renderCard).join('')}</div>
    </div>
  `).join('');
}

function renderCard(m) {
  const st = matchStatus(m);
  const hasScore = m.homeScore != null && m.awayScore != null && st !== 'upcoming';

  const badge = st === 'live'
    ? '<div class="card-badge badge-live">LIVE</div>'
    : st === 'finished'
    ? '<div class="card-badge badge-finished">FIN</div>'
    : `<div class="card-badge badge-upcoming">${esc(fmtTime(m.matchTime))}</div>`;

  const center = hasScore
    ? `<div class="card-score">${m.homeScore} - ${m.awayScore}</div>`
    : '<div class="card-vs">VS</div>';

  const timeStr = st === 'live'
    ? `<span class="live-dot"></span> En direct`
    : st === 'finished' ? 'Terminé' : fmtTime(m.matchTime);

  const viewers = m.viewNumber
    ? `<span class="card-viewers">${ICO.eye} ${fmtViews(m.viewNumber)}</span>` : '';

  return `<div class="match-card" onclick="navigate('/match/${esc(m.matchId)}')">
    <div class="card-poster">
      ${badge}
      <div class="card-team">
        ${m.homeLogo ? `<img src="${esc(m.homeLogo)}" alt="" onerror="this.style.display='none'">` : '<div class="team-placeholder"></div>'}
        <div class="card-team-name">${esc(m.homeName)}</div>
      </div>
      ${center}
      <div class="card-team">
        ${m.awayLogo ? `<img src="${esc(m.awayLogo)}" alt="" onerror="this.style.display='none'">` : '<div class="team-placeholder"></div>'}
        <div class="card-team-name">${esc(m.awayName)}</div>
      </div>
    </div>
    <div class="card-info">
      <div class="card-info-row">
        <span class="card-time">${timeStr}</span>
        ${viewers}
      </div>
      <div class="card-league">${esc(m.leagueName||'')}</div>
    </div>
  </div>`;
}

/* ── Match page ────────────────────────────────────────── */
async function renderMatchPage(matchId) {
  const tk = ++routeToken;
  document.getElementById('app').innerHTML = renderNav(true) + `
    <div class="page"><div class="match-page">
      <div class="loading" style="min-height:400px"><div class="spinner"></div></div>
    </div></div>`;
  bindNav();

  const [detail, group] = await Promise.all([
    apiPost(`${API}/match-detail?matchId=${encodeURIComponent(matchId)}`),
    apiGet(`${API}/get-livestream-group`)
  ]);
  if (tk !== routeToken) return;
  allMatches = group?.value?.datas || [];

  const m = detail?.value?.datas;
  const page = document.querySelector('.match-page');
  if (!page) return;

  if (!m) {
    page.innerHTML = `<div class="error-state">
      <div class="error-icon">Match introuvable</div>
      <div class="error-sub">Ce match n'existe pas ou a été supprimé</div>
      <button class="retry-btn" onclick="navigate('/')">Retour</button>
    </div>`;
    return;
  }

  buildMatchUI(m, page);
}

function buildMatchUI(m, page) {
  const st = matchStatus(m);
  const isLive = st === 'live';
  const hasScore = m.homeScore != null && m.awayScore != null && st !== 'upcoming';

  const scoreOrVs = hasScore
    ? `<span class="match-score-big">${m.homeScore} — ${m.awayScore}</span>`
    : '<span class="match-vs">VS</span>';

  const metaParts = [];
  if (m.leagueName) metaParts.push(`<span class="match-league">${esc(m.leagueName)}</span>`);
  if (isLive) metaParts.push(`<span class="meta-live"><span class="live-dot"></span> EN DIRECT</span>`);
  if (m.viewNumber) metaParts.push(`<span>${ICO.eye} ${fmtViews(m.viewNumber)} spectateurs</span>`);

  const comms = m.listCommentators || [];
  const commHtml = comms.length > 1 ? `
    <div class="comm-selector">
      <span class="comm-label">Commentateur :</span>
      <div class="comm-list" id="comm-list">${comms.map(c => `
        <button class="comm-btn ${c.matchId===m.matchId?'active':''}" data-match-id="${esc(c.matchId)}">
          ${c.avatar ? `<img class="comm-avatar" src="${esc(c.avatar)}" alt="" onerror="this.style.display='none'">` : ''}
          <span>${esc(c.commentator)}</span>
          ${c.isOnline ? '<span class="comm-live-badge">LIVE</span>' : ''}
        </button>`).join('')}
      </div>
    </div>` : '';

  const related = getMatches().filter(r => r.matchId !== m.matchId && matchStatus(r) === 'live').slice(0, 8);
  const relHtml = related.length ? `
    <div class="related-section">
      <div class="section-title">Autres matchs en direct</div>
      <div class="related-grid">${related.map(renderCard).join('')}</div>
    </div>` : '';

  page.innerHTML = `
    <div class="match-header">
      <div class="match-teams">
        <div class="match-team">
          ${m.homeLogo ? `<img src="${esc(m.homeLogo)}" alt="" onerror="this.style.display='none'">` : ''}
          <span class="match-team-name">${esc(m.homeName)}</span>
        </div>
        ${scoreOrVs}
        <div class="match-team">
          ${m.awayLogo ? `<img src="${esc(m.awayLogo)}" alt="" onerror="this.style.display='none'">` : ''}
          <span class="match-team-name">${esc(m.awayName)}</span>
        </div>
      </div>
    </div>
    <div class="match-meta">${metaParts.join(' <span style="color:#333">·</span> ')}</div>

    <div class="player-wrap" id="player-wrap">
      <video id="nx-video" autoplay muted playsinline></video>
      <div class="player-overlay" id="player-overlay"><div class="spinner"></div></div>
      <div class="player-controls">
        <button class="ctrl-btn" id="ctrl-play">${ICO.pause}</button>
        <div class="ctrl-spacer"></div>
        <button class="ctrl-btn ctrl-crop" id="ctrl-crop" title="Recadrer">${ICO.crop}</button>
        <button class="ctrl-btn ctrl-sync" id="ctrl-sync" title="Rattraper le direct">${ICO.sync}</button>
        <button class="ctrl-btn" id="ctrl-mute">${ICO.volOn}</button>
        <input type="range" class="ctrl-volume" id="ctrl-volume" min="0" max="1" step="0.05" value="1">
        <button class="ctrl-btn" id="ctrl-fs">${ICO.fs}</button>
      </div>
    </div>

    ${commHtml}
    ${relHtml}
    <div class="site-footer">LuongSon TV</div>`;

  bindPlayerControls(isLive);
  bindCommentatorSwitch();

  if (m.linkLive) startStream(m.linkLive, m.linkLiveFlv);
  else {
    const ov = document.getElementById('player-overlay');
    if (ov) ov.innerHTML = '<div class="player-overlay-msg"><div style="color:var(--red);font-weight:700">Flux non disponible</div></div>';
  }
}

function bindCommentatorSwitch() {
  const list = document.getElementById('comm-list');
  if (!list) return;
  list.addEventListener('click', async e => {
    const btn = e.target.closest('.comm-btn');
    if (!btn) return;
    list.querySelectorAll('.comm-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const ov = document.getElementById('player-overlay');
    if (ov) { ov.style.display = ''; ov.innerHTML = '<div class="spinner"></div>'; }
    const d = await apiPost(`${API}/match-detail?matchId=${encodeURIComponent(btn.dataset.matchId)}`);
    if (d?.value?.datas?.linkLive) startStream(d.value.datas.linkLive, d.value.datas.linkLiveFlv);
  });
}
