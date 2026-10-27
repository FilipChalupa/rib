// Bootstrap: canvas sizing, input, overlay screens, pause, loop, PWA.
import { S, knife, hooks, newGame, update, knifeDown, knifeMove, knifeUp, totalTime, fmt, freeGaps, handShapes, RACK, LEVELS } from './game.js';
import { view, initRender, layout, toBoard, draw } from './render.js';
import { audio, sfx, unlock, setMute, setVolume, loadSound, suspend, resume } from './audio.js';
import { loadScores, qualifies, addScore, lastName } from './scores.js';

const canvas = document.getElementById('c');
initRender(canvas);
const overlay = document.getElementById('overlay');
const msgEl = document.getElementById('msg');
const statsEl = document.getElementById('stats');
const btn = document.getElementById('btn');
const pauseBtn = document.getElementById('pause');
const muteBtn = document.getElementById('mute');
const START_MSG = msgEl.textContent;
let overlayMode = 'start';

// ---------- sizing ----------
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), cw = window.innerWidth, ch = window.innerHeight;
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
  const cs = getComputedStyle(document.getElementById('safe')), px = v => parseFloat(v) || 0;
  layout(cw, ch, dpr, { l: px(cs.paddingLeft), r: px(cs.paddingRight), t: px(cs.paddingTop), b: px(cs.paddingBottom) });
  document.documentElement.style.setProperty('--ui', String(Math.max(1, view.hud)));
}
window.addEventListener('resize', resize);
resize();

// ---------- preferences ----------
loadSound();
const rm = window.matchMedia('(prefers-reduced-motion: reduce)');
view.reduced = rm.matches; rm.addEventListener('change', e => { view.reduced = e.matches; });
function refreshMute() { muteBtn.textContent = audio.muted ? 'Ticho' : 'Zvuk'; muteBtn.setAttribute('aria-pressed', String(audio.muted)); }
refreshMute();
muteBtn.addEventListener('click', () => { setMute(!audio.muted); refreshMute(); });
const volSfx = document.getElementById('volsfx');
volSfx.value = Math.round(audio.vol * 100);
volSfx.addEventListener('input', () => { setVolume(volSfx.value / 100); if (audio.muted && +volSfx.value > 0) { setMute(false); refreshMute(); } });
volSfx.addEventListener('change', () => { unlock(); sfx.chop(); }); // audible preview of the new level

// ---------- screen wake lock (keeps the phone awake while playing) ----------
let wakeLock = null;
async function keepAwake() {
  if (!('wakeLock' in navigator) || wakeLock) return;
  try { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } catch (e) {}
}
function releaseWake() { if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }

// ---------- local leaderboard ----------
const nameForm = document.getElementById('nameform'), nameInput = document.getElementById('name');
const scoresEl = document.getElementById('scores');
function renderScores(highlightId) {
  const list = loadScores(), body = scoresEl.tBodies[0];
  body.textContent = '';
  list.forEach((r, i) => {
    const tr = body.insertRow();
    if (r.id === highlightId) tr.className = 'me';
    [[i + 1 + '.', ''], [r.name, ''], [fmt(r.time, 2), 'num'], ['🩹'.repeat(r.injuries || 0), 'aid']].forEach(([txt, cls]) => { const td = tr.insertCell(); td.textContent = txt; td.className = cls; });
  });
  scoresEl.hidden = !list.length;
  if (list.length) view.best = view.best ? Math.min(view.best, list[0].time) : list[0].time;
}
nameForm.addEventListener('submit', e => {
  e.preventDefault();
  const row = addScore(nameInput.value, totalTime(), S.injuries);
  nameForm.hidden = true; renderScores(row.id); btn.focus();
});
renderScores(); // the start screen shows the table right away

// ---------- overlay / pause ----------
function finishText() {
  if (!S.injuries && !S.boneHits) return 'Čistá práce. Ani škrábnutí a nůž ani jednou nezaskřípal o kost. Žebírka jsou na míse.';
  if (!S.injuries) return 'Všechny prsty celé. Pár kostí sice zaskřípalo, ale žebírka jsou na míse.';
  return S.injuries === 1 ? 'Žebírka jsou na míse, jedna náplast navíc. Příště pozor, kam ta ruka zrovna sahá.' : 'Žebírka jsou na míse a prsty v náplastech. Rychlost je fajn, ale ruka se hýbe.';
}
function showOverlay(mode) {
  overlayMode = mode; overlay.hidden = false; overlay.dataset.mode = mode;
  const won = S.phase === 'done';
  if (mode === 'start') {
    msgEl.textContent = START_MSG; statsEl.innerHTML = ''; btn.textContent = 'Začít krájet';
  } else if (mode === 'over' && won) {
    const t = totalTime();
    if (!view.best || t < view.best) view.best = t;
    msgEl.textContent = finishText();
    statsEl.innerHTML = `Čas <b>${fmt(t, 2)}</b> &nbsp;·&nbsp; rekord <b>${fmt(view.best, 2)}</b>` +
      `<small>krájení ${fmt(S.time, 2)} · kost ${S.boneHits}× · prst ${S.injuries}× · trest +${S.penalty} s</small>`;
    btn.textContent = 'Krájet znovu';
  } else if (mode === 'over') {
    msgEl.textContent = 'Třetí řez do prstu. Žebírka počkají, jede se na pohotovost.';
    statsEl.innerHTML = `Plát <b>${S.level + 1}/${LEVELS.length}</b> &nbsp;·&nbsp; řezů <b>${S.cutCount}</b>`;
    btn.textContent = 'Zkusit znovu';
  } else {
    msgEl.textContent = 'Pauza. Nůž leží na prkně, žebírka počkají.';
    statsEl.innerHTML = `Čas <b>${fmt(totalTime())}</b> &nbsp;·&nbsp; plát <b>${S.level + 1}/${LEVELS.length}</b>`;
    btn.textContent = 'Pokračovat';
  }
  nameForm.hidden = !(mode === 'over' && won && qualifies(totalTime()));
  if (!nameForm.hidden) nameInput.value = lastName();
  if (mode === 'pause') scoresEl.hidden = true; else renderScores();
  pauseBtn.hidden = true;
  if (nameForm.hidden) btn.focus(); else nameInput.focus();
}
function pause() {
  if (!S.running || S.paused) return;
  releaseWake(); S.paused = true; knifeUp(); suspend(); showOverlay('pause');
}
function unpause() {
  S.paused = false; overlay.hidden = true; pauseBtn.hidden = false; resume(); keepAwake();
}
function start() {
  unlock(); knifeUp(); newGame(); overlay.hidden = true; pauseBtn.hidden = false; keepAwake();
}
btn.addEventListener('click', () => { if (overlayMode === 'pause') unpause(); else start(); });
pauseBtn.addEventListener('click', pause);
hooks.onFinish = hooks.onGameOver = () => { releaseWake(); showOverlay('over'); };
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('blur', pause);

// ---------- sound and vibration for game events ----------
function buzz(pattern) { if (!view.reduced && navigator.vibrate) try { navigator.vibrate(pattern); } catch (e) {} }
const SOUNDS = { cut: 'chop', bone: 'bone', ouch: 'ouch', land: 'land', tick: 'tick', go: 'go', rack: 'rack', finish: 'finish', fail: 'fail' };
hooks.event = name => {
  if (SOUNDS[name]) sfx[SOUNDS[name]]();
  if (name === 'bone') buzz(25);
  if (name === 'ouch') buzz([90, 50, 140]);
};

// ---------- input ----------
// Every pointer sample counts (coalesced events), so a fast swipe cannot skip over a finger or a bone.
let lastMove = null, lastSwish = 0;
function moveTo(e) {
  const p = toBoard(e.clientX, e.clientY), now = e.timeStamp || performance.now();
  knifeMove(p.x, p.y);
  if (knife.down && S.phase === 'cut' && lastMove && now > lastMove.t) {
    const v = Math.hypot(p.x - lastMove.x, p.y - lastMove.y) / ((now - lastMove.t) / 1000);
    if (v > 2200 && now - lastSwish > 220) { lastSwish = now; sfx.swish(); }
  }
  lastMove = { x: p.x, y: p.y, t: now };
}
canvas.addEventListener('pointerdown', e => {
  if (!e.isPrimary) return;
  unlock();
  view.pointer.touch = e.pointerType !== 'mouse'; view.pointer.on = true;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  const p = toBoard(e.clientX, e.clientY);
  knifeDown(p.x, p.y); lastMove = { x: p.x, y: p.y, t: e.timeStamp };
});
canvas.addEventListener('pointermove', e => {
  if (!e.isPrimary) return;
  view.pointer.touch = e.pointerType !== 'mouse'; view.pointer.on = true;
  const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  for (const c of list.length ? list : [e]) moveTo(c);
});
const lift = e => { if (e.isPrimary) knifeUp(); };
canvas.addEventListener('pointerup', lift);
canvas.addEventListener('pointercancel', lift);
canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') view.pointer.on = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
window.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement && e.target.type === 'text') return; // typing a name must not trigger game shortcuts
  if (e.code === 'Space' && !overlay.hidden) { e.preventDefault(); btn.click(); }
  if (e.key === 'm' || e.key === 'M') { setMute(!audio.muted); refreshMute(); }
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { if (S.running) { S.paused ? unpause() : pause(); } }
});

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  update(dt); draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// tools/assets.mjs drives the game through this to take the install screenshots
if (new URLSearchParams(location.search).has('debug')) window.__game = { S, knife, view, RACK, toBoard, knifeDown, knifeMove, knifeUp, freeGaps, handShapes };

// ---------- PWA: install prompt, offline cache, update notice ----------
const installBtn = document.getElementById('install');
const iosHint = document.getElementById('ioshint');
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastmsg');
const toastBtn = document.getElementById('toastbtn');
const standalone = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true;

let installEvent = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; installBtn.hidden = false; });
installBtn.addEventListener('click', async () => {
  if (!installEvent) return;
  installEvent.prompt();
  try { await installEvent.userChoice; } catch (e) {}
  installEvent = null; installBtn.hidden = true;
});
window.addEventListener('appinstalled', () => { installBtn.hidden = true; iosHint.hidden = true; });
// iOS Safari has no install prompt; explain the manual way once.
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (isIOS && !standalone) iosHint.hidden = false;

function showToast(text, action, onClick) {
  toastMsg.textContent = text; toastBtn.textContent = action; toastBtn.hidden = !action;
  toastBtn.onclick = onClick || null; toast.hidden = false;
}
if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      const offerUpdate = worker => {
        if (!navigator.serviceWorker.controller) return; // first install, nothing to update
        showToast('Je k dispozici nová verze.', 'Obnovit', () => worker.postMessage('SKIP_WAITING'));
      };
      if (reg.waiting) offerUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state !== 'installed') return;
          if (navigator.serviceWorker.controller) offerUpdate(w);
          else { showToast('Hra je připravená i offline.', '', null); setTimeout(() => { toast.hidden = true; }, 3500); }
        });
      });
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded || !toastBtn.onclick) return;
        reloaded = true; location.reload();
      });
    } catch (e) {}
  });
}
