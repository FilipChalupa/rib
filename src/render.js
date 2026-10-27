// Drawing: kitchen counter, cutting board, ribs, the hand, the knife, effects and the HUD.
import { S, knife, BOARD, RACK, TRAY, LIVES, LEVELS, COUNT, handShapes, boneX, pieces, pieceEdges, slideDX, totalTime, fmt } from './game.js';

export const FONT = '"Alfa Slab One", Rockwell, Georgia, serif';
const SANS = 'Rubik, system-ui, sans-serif';
// butcher's shop palette, shared with style.css
const C = { tile: '#f2ede4', grout: '#d8cfc1', red: '#c8102e', ink: '#2a1614', mint: '#7cc6b4', paper: '#fff8ec' };
// M maps board units to CSS pixels (scaled to fit, turned by 90° on portrait screens), inv the other way.
// hud: scale of texts drawn in screen space, safe: notch insets in CSS pixels.
export const view = {
  DPR: 1, cw: 1, ch: 1, s: 1, portrait: false, hud: 1, M: new DOMMatrix(), inv: new DOMMatrix(),
  safe: { l: 0, r: 0, t: 0, b: 0 }, reduced: false, best: 0, pointer: { on: false, touch: false },
};
let ctx;
const grain = []; // wood grain of the cutting board, generated once

export function initRender(canvas) {
  ctx = canvas.getContext('2d');
  for (let i = 0; i < 46; i++) grain.push({ y: 140 + Math.random() * 396, a: 2 + Math.random() * 6, f: 0.003 + Math.random() * 0.01, p: Math.random() * 6, w: 0.6 + Math.random() * 1.8 });
  return ctx;
}

// Fit the board into the window. Portrait screens get it turned so the rack runs top to bottom,
// with a strip left free at the top for the HUD.
export function layout(cw, ch, dpr, safe) {
  Object.assign(view, { cw, ch, DPR: dpr, safe, portrait: ch > cw });
  view.hud = Math.min(1.5, Math.max(0.75, Math.min(cw, ch) / 480));
  const top = view.portrait ? safe.t + 70 * view.hud : 0, h = ch - top;
  let m = new DOMMatrix().translate(cw / 2, top + h / 2);
  if (view.portrait) { view.s = Math.min(cw / BOARD.h, h / BOARD.w); m = m.rotate(90); }
  else view.s = Math.min(cw / BOARD.w, h / BOARD.h);
  view.s *= 0.98;
  view.M = m.scale(view.s).translate(-BOARD.w / 2, -BOARD.h / 2);
  view.inv = view.M.inverse();
}
export function toBoard(x, y) { const p = view.inv.transformPoint({ x, y }); return { x: p.x, y: p.y }; }
const toScreen = (x, y) => view.M.transformPoint({ x, y });

// ---------- helpers ----------
function line(ax, ay, bx, by) { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function cap(s, r) { ctx.lineWidth = r * 2; line(s.ax, s.ay, s.bx, s.by); }
// slab lettering with a hard offset shadow, like the title on the start card
function text(t, x, y, size, color, shadow = C.ink, font = FONT) {
  ctx.font = `${Math.round(size)}px ${font}`;
  const d = Math.max(1.5, size / 22);
  if (shadow) { ctx.fillStyle = shadow; ctx.fillText(t, x + d, y + d); }
  ctx.fillStyle = color; ctx.fillText(t, x, y);
}
// a rounded label with an ink outline and a drop, as the HTML buttons have
function label(x, y, w, h, fill) {
  ctx.fillStyle = C.ink; rr(x, y + 3, w, h, h / 2); ctx.fill();
  ctx.fillStyle = fill; rr(x, y, w, h, h / 2); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.stroke();
}

// ---------- scene ----------
// white tiles behind the counter, with a mint border row near the bottom
function background() {
  const { cw, ch } = view, t = Math.round(46 * view.hud);
  ctx.fillStyle = C.tile; ctx.fillRect(0, 0, cw, ch);
  const band = Math.floor(ch / t) - 1;
  ctx.fillStyle = C.mint; ctx.fillRect(0, band * t, cw, t);
  ctx.strokeStyle = C.grout; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = t; x < cw; x += t) { ctx.moveTo(x, 0); ctx.lineTo(x, ch); }
  for (let y = t; y < ch; y += t) { ctx.moveTo(0, y); ctx.lineTo(cw, y); }
  ctx.stroke();
  const g = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.hypot(cw, ch) / 2);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(90,60,40,.18)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
}
function board() {
  const x = 30, y = 136, w = 1040, h = 404;
  ctx.fillStyle = 'rgba(60,30,20,.28)'; rr(x + 10, y + 16, w, h, 30); ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#d9a066'); g.addColorStop(1, '#b0743f');
  ctx.fillStyle = g; rr(x, y, w, h, 30); ctx.fill();
  ctx.save(); rr(x, y, w, h, 30); ctx.clip();
  ctx.strokeStyle = 'rgba(110,60,25,.2)';
  for (const l of grain) {
    ctx.lineWidth = l.w; ctx.beginPath();
    for (let gx = x; gx <= x + w; gx += 20) { const gy = l.y + Math.sin(gx * l.f + l.p) * l.a; gx === x ? ctx.moveTo(gx, gy) : ctx.lineTo(gx, gy); }
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(90,25,8,.22)';
  for (const st of S.stains) { ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, 7); ctx.fill(); }
  ctx.restore();
  // juice groove around the edge
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(90,45,15,.35)'; rr(x + 22, y + 22, w - 44, h - 44, 18); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,225,180,.2)'; rr(x + 24, y + 25, w - 44, h - 44, 18); ctx.stroke();
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(80,40,10,.6)'; rr(x, y, w, h, 30); ctx.stroke();
}
function tray() {
  const { x0, x1, y0, y1 } = TRAY, w = x1 - x0, h = y1 - y0;
  ctx.fillStyle = 'rgba(60,30,20,.28)'; rr(x0 + 8, y0 + 12, w, h, 18); ctx.fill();
  let g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#e3e7ea'); g.addColorStop(1, '#8e979e');
  ctx.fillStyle = g; rr(x0, y0, w, h, 18); ctx.fill();
  g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#9aa3aa'); g.addColorStop(1, '#c9cfd3');
  ctx.fillStyle = g; rr(x0 + 9, y0 + 9, w - 18, h - 18, 12); ctx.fill();
  for (const f of S.tray) rib(f.shape, f.x1, f.y1, f.rot1, f.s1);
}

// One piece of meat between a left and a right edge (top and bottom x of each), with its bones.
// bones: [{ t, b, w }] = bone centre x at the top and bottom edge; g0: origin of the grill marks.
function meat(e, bones, top, bot, g0) {
  const poly = (ox = 0, oy = 0) => {
    ctx.beginPath(); ctx.moveTo(e.lT + ox, top + oy); ctx.lineTo(e.rT + ox, top + oy); ctx.lineTo(e.rB + ox, bot + oy); ctx.lineTo(e.lB + ox, bot + oy); ctx.closePath();
  };
  ctx.fillStyle = 'rgba(0,0,0,.35)'; poly(7, 11); ctx.fill();
  // bone ends sticking out above and below the meat
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#a88a62';
  for (const b of bones) {
    for (const [x, y, dir] of [[b.t, top, -1], [b.b, bot, 1]]) {
      ctx.fillStyle = '#efe1c2'; rr(x - b.w / 2, dir < 0 ? y - RACK.out : y - 10, b.w, RACK.out + 10, b.w * 0.45); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(190,120,90,.45)'; ctx.beginPath(); ctx.ellipse(x, y + dir * (RACK.out - 6), b.w * 0.22, 3, 0, 0, 7); ctx.fill();
    }
  }
  // crust, then the glazed meat
  ctx.lineJoin = 'round'; ctx.lineWidth = 9; ctx.strokeStyle = '#4a1407'; poly(); ctx.stroke();
  const g = ctx.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, '#8a2c12'); g.addColorStop(0.35, '#a6421b'); g.addColorStop(1, '#6b1e0b');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); poly(); ctx.clip();
  // bones under the meat show as ridges, the gaps between them as darker valleys (that is where to cut)
  bones.forEach((b, k) => {
    ctx.lineWidth = b.w + 14; ctx.strokeStyle = 'rgba(60,12,2,.3)'; line(b.t, top, b.b, bot);
    ctx.lineWidth = b.w + 4; ctx.strokeStyle = 'rgba(255,170,120,.3)'; line(b.t, top, b.b, bot);
    ctx.lineWidth = b.w * 0.45; ctx.strokeStyle = 'rgba(255,225,185,.25)'; line(b.t, top, b.b, bot);
    if (k) { const p = bones[k - 1]; ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(35,5,0,.5)'; line((p.t + b.t) / 2, top, (p.b + b.b) / 2, bot); }
  });
  ctx.lineWidth = 11; ctx.strokeStyle = 'rgba(35,8,2,.22)';
  const lo = Math.min(e.lT, e.lB), hi = Math.max(e.rT, e.rB);
  for (let x = g0 + Math.floor((lo - 260 - g0) / 74) * 74; x < hi + 40; x += 74) line(x, top, x + 200, bot);
  ctx.fillStyle = 'rgba(255,200,150,.1)';
  ctx.beginPath(); ctx.ellipse((lo + hi) / 2, top + (bot - top) * 0.28, (hi - lo) * 0.42, (bot - top) * 0.08, 0, 0, 7); ctx.fill();
  ctx.restore();
  // fresh cut faces
  ctx.lineWidth = 5; ctx.strokeStyle = '#dc8d74';
  if (e.cutL) line(e.lT + 3, top + 3, e.lB + 3, bot - 3);
  if (e.cutR) line(e.rT - 3, top + 3, e.rB - 3, bot - 3);
}
function rack() {
  const r = S.rack, top = RACK.top, bot = RACK.bottom;
  for (const [i, j] of pieces()) {
    const bones = [];
    for (let k = i; k <= j; k++) { const b = r.bones[k]; bones.push({ t: boneX(b, top), b: boneX(b, bot), w: b.w }); }
    meat(pieceEdges(i, j), bones, top, bot, RACK.x0 + r.grill + slideDX() + r.bones[i].off);
  }
}
// a single rib, centred on its bone (flying or lying in the tray)
function rib(sh, x, y, rot, s) {
  const h = (RACK.bottom - RACK.top) / 2;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  meat({ lT: sh.lT, lB: sh.lB, rT: sh.rT, rB: sh.rB, cutL: true, cutR: true }, [{ t: -sh.tilt * h, b: sh.tilt * h, w: sh.w }], -h, h, sh.grill);
  ctx.restore();
}
function flies() {
  for (const f of S.flies) {
    const t = f.t, e = 1 - (1 - t) * (1 - t), hop = Math.sin(Math.PI * t);
    rib(f.shape, f.x0 + (f.x1 - f.x0) * e, f.y0 + (f.y1 - f.y0) * e - hop * 60, f.rot1 * e, (1 + (f.s1 - 1) * e) * (1 + hop * 0.25));
  }
}
function particles() {
  for (const p of S.parts) {
    if (p.kind === 'spark') { ctx.strokeStyle = `rgba(255,240,170,${Math.min(1, p.life * 6)})`; ctx.lineWidth = 2.5; line(p.x, p.y, p.x - p.vx * 0.03, p.y - p.vy * 0.03); }
    else { ctx.fillStyle = '#6b1a08'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
  }
}

// ---------- hand ----------
const SKIN = '#f3c597', SKIN_EDGE = '#b9774a';
function hand() {
  if (S.hand.enter >= 1) return;
  const sh = handShapes(), arm = sh[0], skin = sh.slice(1), hurt = S.hand.hurt;
  ctx.lineCap = 'round';
  ctx.save(); ctx.translate(12, 16); ctx.strokeStyle = 'rgba(0,0,0,.28)'; for (const s of sh) cap(s, s.r); ctx.restore();
  // wrist, then the chef's sleeve further up the arm
  ctx.strokeStyle = SKIN_EDGE; cap(arm, arm.r + 3); ctx.strokeStyle = SKIN; cap(arm, arm.r);
  const ux = (arm.bx - arm.ax) / 690, uy = (arm.by - arm.ay) / 690;
  const sleeve = { ax: arm.ax + ux * 95, ay: arm.ay + uy * 95, bx: arm.bx, by: arm.by };
  ctx.strokeStyle = '#a9a69e'; cap(sleeve, arm.r + 9); ctx.strokeStyle = '#f6f4ee'; cap(sleeve, arm.r + 6);
  ctx.strokeStyle = 'rgba(150,145,135,.5)'; ctx.lineWidth = 3;
  line(sleeve.ax - uy * (arm.r + 4) + ux * 16, sleeve.ay + ux * (arm.r + 4) + uy * 16, sleeve.ax + uy * (arm.r + 4) + ux * 16, sleeve.ay - ux * (arm.r + 4) + uy * 16);
  // palm, thumb and fingers as one silhouette: all outlines first, then all fills
  ctx.strokeStyle = SKIN_EDGE; for (const s of skin) cap(s, s.r + 3);
  ctx.strokeStyle = hurt > 0.05 ? mix(SKIN, '#f08a78', hurt) : SKIN; for (const s of skin) cap(s, s.r);
  ctx.fillStyle = 'rgba(255,235,210,.35)'; ctx.beginPath(); ctx.ellipse(skin[0].ax + 30, skin[0].ay - 14, 44, 18, 0, 0, 7); ctx.fill();
  for (const s of skin) {
    if (s.kind === 'palm') continue;
    const dx = s.bx - s.ax, dy = s.by - s.ay, l = Math.hypot(dx, dy), ux2 = dx / l, uy2 = dy / l;
    // knuckle creases
    ctx.strokeStyle = 'rgba(170,100,60,.45)'; ctx.lineWidth = 2;
    for (const k of [0.42, 0.7]) { const cx = s.ax + dx * k, cy = s.ay + dy * k; line(cx - uy2 * s.r * 0.5, cy + ux2 * s.r * 0.5, cx + uy2 * s.r * 0.5, cy - ux2 * s.r * 0.5); }
    // nail
    ctx.fillStyle = '#f9dccb'; ctx.strokeStyle = '#d9a283'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(s.bx - ux2 * s.r * 0.3, s.by - uy2 * s.r * 0.3, s.r * 0.78, s.r * 0.6, Math.atan2(dy, dx), 0, 7); ctx.fill(); ctx.stroke();
  }
  for (const a of S.hand.aids) { const s = sh.find(z => z.kind === a.kind && z.i === a.i); if (s) aid(s, a); }
}
function aid(s, a) {
  const dx = s.bx - s.ax, dy = s.by - s.ay, w = s.r * 2 + 12;
  ctx.save(); ctx.translate(s.ax + dx * a.t, s.ay + dy * a.t); ctx.rotate(Math.atan2(dy, dx) + Math.PI / 2 + a.rot);
  ctx.fillStyle = '#e9b98a'; ctx.strokeStyle = '#b98656'; ctx.lineWidth = 1.5; rr(-w / 2, -9, w, 18, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f7e2c8'; rr(-7, -7, 14, 14, 3); ctx.fill();
  ctx.fillStyle = 'rgba(150,100,60,.5)';
  for (const x of [-w / 2 + 6, -w / 2 + 11, w / 2 - 11, w / 2 - 6]) for (const y of [-4, 3]) { ctx.beginPath(); ctx.arc(x, y, 1.1, 0, 7); ctx.fill(); }
  ctx.restore();
}
function mix(a, b, t) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), x = p(a), y = p(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
}

// ---------- knife ----------
function trail() {
  const tr = knife.trail;
  ctx.lineCap = 'round';
  for (let i = 1; i < tr.length; i++) {
    if (tr[i].start) continue; // a new press does not connect to the previous stroke
    const a = 1 - (S.clock - tr[i].t) / 0.16;
    if (a <= 0) continue;
    ctx.strokeStyle = `rgba(255,250,235,${a * 0.75})`; ctx.lineWidth = 3 + a * 8;
    line(tr[i - 1].x, tr[i - 1].y, tr[i].x, tr[i].y);
  }
}
function knifeSprite() {
  const p = view.pointer;
  if (S.phase === 'idle' || (!knife.down && (!p.on || p.touch))) return;
  ctx.save(); ctx.translate(knife.x, knife.y);
  ctx.rotate(-0.2 + (knife.stuck > 0 && !view.reduced ? Math.sin(S.clock * 90) * 0.12 : 0));
  ctx.globalAlpha = knife.down ? 1 : 0.8;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.moveTo(10, 14); ctx.lineTo(34, -136); ctx.lineTo(0, -136); ctx.closePath(); ctx.fill();
  const g = ctx.createLinearGradient(-20, 0, 14, 0);
  g.addColorStop(0, '#f4f7f9'); g.addColorStop(0.55, '#b9c2c9'); g.addColorStop(1, '#8a949c');
  ctx.fillStyle = g; ctx.strokeStyle = '#6f7880'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-20, -60, -20, -150); ctx.lineTo(14, -150); ctx.lineTo(14, -44); ctx.quadraticCurveTo(10, -14, 0, 0); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-2, -6); ctx.quadraticCurveTo(-17, -60, -17, -146); ctx.stroke();
  ctx.fillStyle = '#9aa3ab'; rr(-22, -162, 38, 13, 4); ctx.fill();
  ctx.fillStyle = '#2b2522'; rr(-17, -256, 30, 96, 10); ctx.fill();
  ctx.fillStyle = '#c9ced2'; for (const y of [-182, -208, -234]) { ctx.beginPath(); ctx.arc(-2, y, 3.2, 0, 7); ctx.fill(); }
  ctx.restore();
}

// ---------- screen space: pops, flash, HUD, banners ----------
function pops() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const p of S.pops) {
    const q = toScreen(p.x, p.y);
    ctx.globalAlpha = Math.max(0, Math.min(1, 1.6 - p.t * 1.5));
    text(p.text, q.x, q.y - 22 * view.hud - p.t * 50 * view.hud, 30 * view.hud, p.color, p.shadow);
  }
  ctx.globalAlpha = 1;
}
function fingerIcon(x, y, k, lost) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = SKIN_EDGE; ctx.lineWidth = 14 * k; line(x, y, x, y + 18 * k);
  ctx.strokeStyle = SKIN; ctx.lineWidth = 10 * k; line(x, y, x, y + 18 * k);
  if (lost) { ctx.fillStyle = '#e9b98a'; ctx.strokeStyle = '#b98656'; ctx.lineWidth = 1; rr(x - 9 * k, y + 5 * k, 18 * k, 8 * k, 3 * k); ctx.fill(); ctx.stroke(); }
}
// top left: the time on a red enamel badge, below it a paper label with the rack and the fingers left
function hud() {
  if (S.phase === 'idle') return;
  const k = view.hud, x = view.safe.l + 14 * k, y = view.safe.t + 12 * k;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const t = fmt(totalTime());
  ctx.font = `${Math.round(30 * k)}px ${FONT}`;
  const tw = Math.max(ctx.measureText('00,0 s').width, ctx.measureText(t).width), bh = 44 * k;
  label(x, y, tw + 32 * k, bh, C.red);
  text(t, x + 16 * k, y + bh / 2 + 1, 30 * k, C.paper, null);
  if (S.penalty) {
    ctx.font = `700 ${Math.round(14 * k)}px ${SANS}`;
    const pt = `+${S.penalty} s trest`, pw = ctx.measureText(pt).width + 20 * k, px = x + tw + 42 * k;
    label(px, y + 9 * k, pw, 26 * k, C.ink);
    ctx.fillStyle = C.paper; ctx.fillText(pt, px + 10 * k, y + 22 * k + 1);
  }
  const y2 = y + bh + 10 * k, l2 = `Plát ${Math.min(S.level + 1, LEVELS.length)}/${LEVELS.length}`;
  ctx.font = `700 ${Math.round(15 * k)}px ${SANS}`;
  const lw = ctx.measureText(l2).width, h2 = 30 * k;
  label(x, y2, lw + LIVES * 16 * k + 40 * k, h2, C.paper);
  ctx.fillStyle = C.ink; ctx.fillText(l2, x + 12 * k, y2 + h2 / 2 + 1);
  for (let i = 0; i < LIVES; i++) fingerIcon(x + lw + 24 * k + i * 16 * k, y2 + 6 * k, k * 0.9, i >= S.lives);
  if (view.best) {
    ctx.font = `600 ${Math.round(13 * k)}px ${SANS}`; ctx.fillStyle = C.ink;
    ctx.fillText('rekord ' + fmt(view.best), x + lw + LIVES * 16 * k + 52 * k, y2 + h2 / 2 + 1);
  }
}
function banner() {
  const k = view.hud, cx = view.cw / 2, cy = view.ch / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let t = '', sub = '', a = 1, size = 96;
  if (S.phase === 'count') {
    const step = COUNT / 3, f = (S.phaseT % step) / step;
    t = String(Math.max(1, 3 - Math.floor(S.phaseT / step))); size = 120 * (1.2 - f * 0.3); a = 1 - f * 0.6;
  } else if (S.phase === 'cut' && S.phaseT < 0.7) {
    t = S.level ? `PLÁT ${S.level + 1}` : 'ŘEŽ!'; a = 1 - S.phaseT / 0.7; size = S.level ? 70 : 110;
  } else if (S.phase === 'between') {
    t = 'PLÁT HOTOVÝ'; sub = fmt(S.splits[S.splits.length - 1]); size = 64; a = Math.min(1, S.phaseT * 5);
  } else if (S.phase === 'done') { t = 'NAKRÁJENO!'; sub = fmt(totalTime(), 2); size = 80; }
  else if (S.phase === 'over') { t = 'POHOTOVOST'; sub = 'tři řezy do prstů'; size = 80; }
  if (t) {
    ctx.globalAlpha = Math.max(0, a);
    text(t, cx, cy, size * k, S.phase === 'count' ? C.paper : C.red, C.ink);
    if (sub) text(sub, cx, cy + size * k * 0.75, 28 * k, C.paper, C.ink);
    ctx.globalAlpha = 1;
  }
  // first rack, nothing cut yet: say what to do
  if (S.phase === 'cut' && S.level === 0 && !S.firstCut && S.phaseT > 1.2) {
    ctx.globalAlpha = Math.min(1, (S.phaseT - 1.2) * 2);
    const msg = view.pointer.touch ? 'Táhni prstem přes celý plát, mezi kostmi' : 'Drž tlačítko a táhni přes celý plát, mezi kostmi';
    ctx.font = `600 ${Math.round(16 * k)}px ${SANS}`;
    const w = ctx.measureText(msg).width + 32 * k, h = 36 * k, y = view.ch - view.safe.b - 24 * k - h;
    label(cx - w / 2, y, w, h, C.paper);
    ctx.fillStyle = C.ink; ctx.fillText(msg, cx, y + h / 2 + 1);
    ctx.globalAlpha = 1;
  }
}

export function draw() {
  const { DPR } = view;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  background();
  const sh = view.reduced ? 0 : S.shake * S.shake * 14;
  ctx.setTransform(new DOMMatrix().scale(DPR).translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh).multiply(view.M));
  tray(); board(); rack(); particles(); hand(); flies(); trail(); knifeSprite();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  pops();
  if (S.flash > 0) { ctx.fillStyle = `rgba(200,16,46,${S.flash * 0.3})`; ctx.fillRect(0, 0, view.cw, view.ch); }
  hud(); banner();
}
