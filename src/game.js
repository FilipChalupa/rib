// Rules and state: racks of ribs, cuts, the hand that holds the rack, time and penalties.
// No DOM in here, so tools/sim.mjs can play the game in Node.

// The game is played on a fixed board of BOARD.w x BOARD.h units. render.js fits it into the window
// (and turns it by 90° on portrait screens), so every screen gets the same rack and the same times.
export const BOARD = { w: 1100, h: 700 };
// The meat band of a rack. Bones stick out of it by `out`, the meat overhangs the outer bones by `end`.
export const RACK = { x0: 70, x1: 1030, top: 230, bottom: 450, out: 20, end: 38 };
export const TRAY = { x0: 170, x1: 930, y0: 576, y1: 684 };
export const LIVES = 3;
export const PENALTY = { bone: 1, finger: 5 }; // seconds added to the time
export const COUNT = 1.8; // 3-2-1 before the first rack (s)
const MID = (RACK.top + RACK.bottom) / 2;
const NEED = 24; // narrowest strip of uncovered meat that still counts as cuttable
const SPREAD = 3; // how far each cut pushes the two pieces apart
const REGRIP = 0.24; // how long the hand takes to move to a new grip (s)
// One entry per rack. Later racks have more bones (narrower gaps) and a more restless hand:
// regrip = moves after every cut, drift = sway amplitude, speed = sway rate,
// wiggle = fingers twitch, fidget = regrips on its own every few seconds.
export const LEVELS = [
  { bones: 6, regrip: false, drift: 0, speed: 0, wiggle: 0, fidget: 0 },
  { bones: 7, regrip: true, drift: 0, speed: 0, wiggle: 0, fidget: 0 },
  { bones: 8, regrip: true, drift: 40, speed: 1.2, wiggle: 0.5, fidget: 0 },
  { bones: 8, regrip: true, drift: 65, speed: 1.7, wiggle: 1, fidget: 2.6 },
  { bones: 9, regrip: true, drift: 85, speed: 2.2, wiggle: 1, fidget: 1.7 },
];

export const S = {};
// stroke tracking: pts collects the path while the knife is inside the meat band after entering it from one edge
export const knife = { x: -999, y: -999, down: false, inBand: false, pts: null, entry: 0, stuck: 0, invuln: 0, trail: [] };
// main.js plugs in sound, vibration and the end screens
export const hooks = { event() {}, onFinish() {}, onGameOver() {} };

let rand = Math.random;
// deterministic games for tools/sim.mjs
export function seed(n) {
  let a = n >>> 0;
  rand = () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const easeOut = t => 1 - (1 - t) * (1 - t);
const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
export const fmt = (t, d = 1) => t.toFixed(d).replace('.', ',') + ' s';
export const totalTime = () => S.time + S.penalty;
const ev = (name, data) => hooks.event(name, data);
const setPhase = p => { S.phase = p; S.phaseT = 0; };
const inBand = y => y >= RACK.top && y < RACK.bottom;

// ---------- rack ----------
function makeRack(lv) {
  const n = lv.bones, a = RACK.x0 + RACK.end, step = (RACK.x1 - RACK.end - a) / (n - 1), bones = [];
  for (let i = 0; i < n; i++) {
    const jitter = i === 0 || i === n - 1 ? 0 : (rand() - 0.5) * step * 0.24;
    bones.push({ x: a + i * step + jitter, w: 20 + rand() * 8, tilt: (rand() - 0.5) * 0.08, off: 0, to: 0, gone: false });
  }
  return { bones, cuts: new Array(n - 1).fill(null), slide: 0, grill: rand() * 74 };
}
// x of a bone's centre line at height y; bx in rack space, boneX on the board (the rack slides in from the right)
const bx = (b, y, settled) => b.x + (settled ? b.to : b.off) + b.tilt * (y - MID);
export const slideDX = () => S.rack.slide * BOARD.w;
export const boneX = (b, y) => bx(b, y) + slideDX();

// Contiguous runs of bones not yet separated, as [first, last] index pairs; ribs already flown off are left out.
export function pieces() {
  const r = S.rack, n = r.bones.length, out = [];
  for (let i = 0; i < n;) {
    let j = i;
    while (j < n - 1 && !r.cuts[j]) j++;
    if (!r.bones[i].gone) out.push([i, j]);
    i = j + 1;
  }
  return out;
}
// Outline of a piece: straight ends of the rack, or the line the player actually cut, moved with the piece.
export function pieceEdges(i, j) {
  const r = S.rack, n = r.bones.length, dx = slideDX(), bi = r.bones[i], bj = r.bones[j];
  const L = i > 0 ? r.cuts[i - 1] : null, R = j < n - 1 ? r.cuts[j] : null;
  const lT = L ? L.xT + bi.off - L.base : bi.x + bi.off - RACK.end, lB = L ? L.xB + bi.off - L.base : lT;
  const rT = R ? R.xT + bj.off - R.base : bj.x + bj.off + RACK.end, rB = R ? R.xB + bj.off - R.base : rT;
  return { lT: lT + dx, lB: lB + dx, rT: rT + dx, rB: rB + dx, cutL: !!L, cutR: !!R };
}

// ---------- hand ----------
const FINGERS = [
  { dx: -58, len: 112, r: 13 }, { dx: -20, len: 136, r: 14 }, { dx: 19, len: 130, r: 14 }, { dx: 56, len: 102, r: 12 },
];
// The hand as capsules (segment + radius): arm, palm, thumb and four fingers lying across the meat.
// y is the top edge of the rack, shifted up while the hand is lifted.
function shapesAt(x, y, wig) {
  const out = [
    { kind: 'arm', i: 0, ax: x + 12, ay: y - 70, bx: x + 70, by: y - 760, r: 58 },
    { kind: 'palm', i: 0, ax: x - 38, ay: y - 50, bx: x + 38, by: y - 50, r: 56 },
    { kind: 'thumb', i: 0, ax: x - 70, ay: y - 46, bx: x - 132, by: y + 14, r: 15 },
  ];
  FINGERS.forEach((f, i) => {
    const w = wig ? wig * 7 * Math.sin(S.clock * 6 + i * 1.9) : 0;
    out.push({ kind: 'finger', i, ax: x + f.dx, ay: y - 8, bx: x + f.dx * 1.14 + w, by: y + f.len, r: f.r });
  });
  return out;
}
const handBase = (h = S.hand) => h.from + (h.to - h.from) * easeInOut(h.t);
export const handX = () => handBase() + LEVELS[S.level].drift * Math.sin(S.hand.phase);
const handLift = (h = S.hand) => -340 * h.enter * h.enter - 60 * h.hurt - 26 * Math.sin(Math.PI * h.t);
export const handShapes = () => shapesAt(handX(), RACK.top + handLift(), LEVELS[S.level].wiggle);

// x range a capsule covers inside the meat band, or null
function blockedX(s) {
  let lo = Infinity, hi = -Infinity;
  for (let k = 0; k <= 12; k++) {
    const x = s.ax + (s.bx - s.ax) * k / 12, y = s.ay + (s.by - s.ay) * k / 12;
    const dy = Math.max(0, RACK.top - y, y - RACK.bottom);
    if (dy >= s.r) continue;
    const hw = Math.sqrt(s.r * s.r - dy * dy);
    lo = Math.min(lo, x - hw); hi = Math.max(hi, x + hw);
  }
  return lo < hi ? [lo, hi] : null;
}
// Uncut gaps with a strip of meat wide enough to cut without touching the hand: [{ i, x }], x = middle of that strip.
// settled: measure where the pieces end up once they finish moving apart after the last cut.
export function freeGaps(shapes = handShapes(), need = NEED, settled = false) {
  const r = S.rack, blocks = shapes.map(blockedX).filter(Boolean), out = [];
  r.cuts.forEach((c, i) => {
    if (c) return;
    let segs = [[bx(r.bones[i], MID, settled) + r.bones[i].w / 2, bx(r.bones[i + 1], MID, settled) - r.bones[i + 1].w / 2]];
    for (const [a, b] of blocks) segs = segs.flatMap(([p, q]) => (b <= p || a >= q ? [[p, q]] : [[p, Math.min(q, a)], [Math.max(p, b), q]].filter(([u, v]) => v > u)));
    const best = segs.reduce((m, s) => (s[1] - s[0] > m[1] - m[0] ? s : m), [0, 0]);
    if (best[1] - best[0] >= need) out.push({ i, x: (best[0] + best[1]) / 2 });
  });
  return out;
}
// planning a grip: with some room to spare for twitching fingers
const freeGapsAt = x => freeGaps(shapesAt(x, RACK.top, 0), NEED + 10, true);

// Move the hand to a new grip on the meat. It always leaves at least one gap free and prefers grips
// that cover something, so the player has to watch where the fingers went.
function placeHand(instant) {
  const r = S.rack, h = S.hand, open = r.cuts.filter(c => !c).length;
  if (!open) return;
  const alive = r.bones.filter(b => !b.gone);
  let best = null, bestScore = -Infinity;
  for (let k = 0; k < 48; k++) {
    const b = alive[Math.floor(rand() * alive.length)];
    const x = clamp(b.x + b.to + (rand() - 0.5) * 140, RACK.x0 + 70, RACK.x1 - 70);
    const free = freeGapsAt(x).length;
    if (!free) continue;
    const score = rand() + (free < open ? 0.7 : 0) + Math.min(1, Math.abs(x - h.to) / 250) * 0.5;
    if (score > bestScore) { bestScore = score; best = x; }
  }
  if (best === null) { // squeeze the hand to whichever end leaves something to cut
    const a = RACK.x0 + 70, b = RACK.x1 - 70;
    best = freeGapsAt(a).length >= freeGapsAt(b).length ? a : b;
  }
  h.from = instant ? best : handBase(); h.to = best; h.t = instant ? 1 : 0;
}

// ---------- geometry ----------
function ptSeg(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, l = vx * vx + vy * vy, t = l ? clamp(((px - ax) * vx + (py - ay) * vy) / l, 0, 1) : 0;
  return Math.hypot(px - ax - vx * t, py - ay - vy * t);
}
const cross = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
function segDist(ax, ay, bx, by, s) {
  const d1 = cross(s.ax, s.ay, s.bx, s.by, ax, ay), d2 = cross(s.ax, s.ay, s.bx, s.by, bx, by);
  const d3 = cross(ax, ay, bx, by, s.ax, s.ay), d4 = cross(ax, ay, bx, by, s.bx, s.by);
  if (d1 > 0 !== d2 > 0 && d3 > 0 !== d4 > 0) return 0;
  return Math.min(ptSeg(ax, ay, s.ax, s.ay, s.bx, s.by), ptSeg(bx, by, s.ax, s.ay, s.bx, s.by), ptSeg(s.ax, s.ay, ax, ay, bx, by), ptSeg(s.bx, s.by, ax, ay, bx, by));
}

// ---------- effects (data only, render.js draws them) ----------
function pop(x, y, text, color, shadow) { S.pops.push({ x, y, text, color, shadow, t: 0 }); }
function juice(xT, xB) {
  for (let k = 0; k < 14; k++) {
    const t = rand(), a = rand() * Math.PI * 2, v = 60 + rand() * 220;
    S.parts.push({ kind: 'juice', x: xT + (xB - xT) * t, y: RACK.top + (RACK.bottom - RACK.top) * t, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + rand() * 0.3, r: 2 + rand() * 4 });
  }
}
function sparks(x, y) {
  for (let k = 0; k < 12; k++) {
    const a = rand() * Math.PI * 2, v = 250 + rand() * 450;
    S.parts.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.15 + rand() * 0.2, r: 2 });
  }
}
// A separated single rib flies into the tray.
function fly(k) {
  const r = S.rack, b = r.bones[k], e = pieceEdges(k, k), c = boneX(b, MID);
  b.gone = true;
  const shape = { lT: e.lT - c, lB: e.lB - c, rT: e.rT - c, rB: e.rB - c, w: b.w, tilt: b.tilt, grill: r.grill + RACK.x0 - bx(b, MID) + b.off };
  const side = rand() < 0.5 ? 1 : -1;
  S.flies.push({ shape, x0: c, y0: MID, x1: TRAY.x0 + 50 + rand() * (TRAY.x1 - TRAY.x0 - 100), y1: (TRAY.y0 + TRAY.y1) / 2 + (rand() - 0.5) * 24,
    rot1: side * (Math.PI / 2 + (rand() - 0.5) * 0.7), t: 0, s1: 0.42 });
}

// ---------- cutting ----------
function hitBone(p) {
  S.penalty += PENALTY.bone; S.boneHits++;
  knife.stuck = 0.35; knife.pts = null;
  S.shake = Math.max(S.shake, 0.35);
  sparks(p.x, p.y);
  pop(p.x, p.y, 'KOST! +' + PENALTY.bone + ' s', '#fff8ec', '#2a1614');
  ev('bone');
}
// pts: the stroke from one edge of the meat band to the other
function evaluateCut(pts) {
  const r = S.rack, n = r.bones.length;
  let left = -1, right = -1; // nearest remaining bones on each side of the stroke
  for (let i = 0; i < n; i++) {
    const b = r.bones[i];
    if (b.gone) continue;
    let side = 0;
    for (const p of pts) {
      const d = p.x - boneX(b, p.y), s = d > b.w / 2 ? 1 : d < -b.w / 2 ? -1 : 0;
      if (!s || (side && s !== side)) return hitBone(p);
      side = s;
    }
    if (side > 0) left = i;
    else if (right < 0) right = i;
  }
  if (left < 0 || right !== left + 1 || r.cuts[left]) return ev('miss'); // the overhang, or between pieces already apart
  const a = pts[0], z = pts[pts.length - 1], top = a.y < z.y ? a : z, bot = top === a ? z : a;
  r.cuts[left] = { xT: top.x, xB: bot.x, base: r.bones[left].off };
  S.cutCount++; S.firstCut = true;
  r.bones.forEach((b, k) => { b.to = r.cuts.reduce((s, c, g) => (c ? s + (g < k ? SPREAD : -SPREAD) : s), 0); });
  juice(top.x, bot.x);
  ev('cut', { x: (top.x + bot.x) / 2 });
  const single = k => (k === 0 || r.cuts[k - 1]) && (k === n - 1 || r.cuts[k]);
  for (const k of [left, left + 1]) if (single(k) && !r.bones[k].gone) fly(k);
  if (r.cuts.every(Boolean)) return rackDone();
  if (LEVELS[S.level].regrip || !freeGapsAt(S.hand.to).length) placeHand();
}
function rackDone() {
  S.splits.push(S.rackTime); S.rackTime = 0; knife.pts = null;
  if (S.level >= LEVELS.length - 1) { setPhase('done'); ev('finish'); }
  else { setPhase('between'); S.nextReady = false; ev('rack', S.splits[S.splits.length - 1]); }
}
// Knife against the hand; a hit costs a life and five seconds.
function touchHand(ax, ay, bx2, by2) {
  if (knife.invuln > 0) return false;
  for (const s of handShapes()) {
    if (segDist(ax, ay, bx2, by2, s) >= s.r) continue;
    const vx = s.bx - s.ax, vy = s.by - s.ay, t = clamp(((bx2 - s.ax) * vx + (by2 - s.ay) * vy) / (vx * vx + vy * vy), 0.25, 0.8);
    hurt(s, t, bx2, by2);
    return true;
  }
  return false;
}
function hurt(s, t, x, y) {
  S.lives--; S.injuries++; S.penalty += PENALTY.finger;
  knife.invuln = 1.1; knife.pts = null;
  S.hand.hurt = 1;
  S.hand.aids.push({ kind: s.kind, i: s.i, t, rot: (rand() - 0.5) * 0.6 });
  S.flash = 1; S.shake = 1;
  pop(x, y, 'AU! +' + PENALTY.finger + ' s', '#c8102e', '#fff8ec');
  ev('ouch', { lives: S.lives });
  if (S.lives <= 0) { setPhase('over'); ev('fail'); return; }
  placeHand();
}
// Follows the knife across the meat band. A stroke counts once it has crossed the whole band, top to bottom
// or bottom to top, so a zigzag without lifting the finger cuts one gap per pass.
function slice(ax, ay, bx2, by2) {
  const ts = [];
  for (const Y of [RACK.top, RACK.bottom]) if (ay < Y !== by2 < Y) ts.push((Y - ay) / (by2 - ay));
  ts.sort((a, b) => a - b);
  for (const t of ts) {
    const p = { x: ax + (bx2 - ax) * t, y: ay + (by2 - ay) * t };
    if (!knife.inBand) { knife.inBand = true; knife.entry = p.y; knife.pts = knife.stuck > 0 ? null : [p]; }
    else {
      knife.inBand = false;
      if (knife.pts && Math.abs(p.y - knife.entry) > 1) { knife.pts.push(p); evaluateCut(knife.pts); }
      knife.pts = null;
    }
  }
  if (knife.inBand && knife.pts) knife.pts.push({ x: bx2, y: by2 });
}

export function knifeDown(x, y) {
  Object.assign(knife, { x, y, down: true, inBand: inBand(y), pts: null });
  knife.trail.push({ x, y, t: S.clock, start: true });
  if (S.phase === 'cut') touchHand(x, y, x, y);
}
export function knifeMove(x, y) {
  const ax = knife.x, ay = knife.y;
  knife.x = x; knife.y = y;
  if (!knife.down) return;
  knife.trail.push({ x, y, t: S.clock });
  if (S.phase !== 'cut' || touchHand(ax, ay, x, y)) { knife.inBand = inBand(y); knife.pts = null; return; }
  slice(ax, ay, x, y);
}
export function knifeUp() { knife.down = false; knife.pts = null; }

// ---------- game flow ----------
function reset() {
  Object.assign(S, { running: false, paused: false, phase: 'idle', phaseT: 0, clock: 0, level: 0, time: 0, rackTime: 0, penalty: 0,
    lives: LIVES, injuries: 0, boneHits: 0, cutCount: 0, splits: [], tick: 4, nextReady: false, firstCut: false,
    tray: [], flies: [], pops: [], parts: [], stains: [], shake: 0, flash: 0 });
  S.hand = { from: 550, to: 550, t: 1, phase: 0, hurt: 0, enter: 0, fidget: 0, aids: [] };
  S.rack = makeRack(LEVELS[0]);
  placeHand(true);
  Object.assign(knife, { down: false, pts: null, stuck: 0, invuln: 0, trail: [] });
}
export function newGame() {
  reset();
  S.running = true; S.phase = 'count'; S.rack.slide = 1; S.hand.enter = 1;
}
reset(); // the start screen shows an untouched rack behind the menu

function updateFx(dt) {
  for (const f of S.flies) if ((f.t += dt / 0.55) >= 1) { S.tray.push(f); ev('land'); }
  S.flies = S.flies.filter(f => f.t < 1);
  for (const p of S.pops) p.t += dt;
  S.pops = S.pops.filter(p => p.t < 1.1);
  for (const p of S.parts) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 5; p.vy *= 1 - dt * 5;
    if ((p.life -= dt) <= 0 && p.kind === 'juice' && S.stains.length < 160) S.stains.push({ x: p.x, y: p.y, r: p.r * 1.3 });
  }
  S.parts = S.parts.filter(p => p.life > 0);
}

export function update(dt) {
  if (S.paused) return;
  S.clock += dt;
  const h = S.hand;
  knife.stuck = Math.max(0, knife.stuck - dt); knife.invuln = Math.max(0, knife.invuln - dt);
  knife.trail = knife.trail.filter(p => S.clock - p.t < 0.16);
  h.t = Math.min(1, h.t + dt / REGRIP); h.hurt = Math.max(0, h.hurt - dt * 1.8);
  S.shake = Math.max(0, S.shake - dt * 3); S.flash = Math.max(0, S.flash - dt * 2.5);
  for (const b of S.rack.bones) b.off += (b.to - b.off) * Math.min(1, dt * 14);
  updateFx(dt);
  if (!S.running) return;
  S.phaseT += dt;
  if (S.phase === 'count') {
    const k = S.phaseT / COUNT;
    S.rack.slide = 1 - easeOut(Math.min(1, k * 1.6));
    h.enter = 1 - easeOut(clamp(k * 1.6 - 0.4, 0, 1));
    const n = 3 - Math.floor(S.phaseT / (COUNT / 3));
    if (n > 0 && n < S.tick) { S.tick = n; ev('tick', n); }
    if (S.phaseT >= COUNT) { S.rack.slide = 0; h.enter = 0; setPhase('cut'); ev('go', 0); }
  } else if (S.phase === 'cut') {
    const lv = LEVELS[S.level];
    S.time += dt; S.rackTime += dt; h.phase += lv.speed * dt;
    if (lv.fidget && (h.fidget -= dt) <= 0) { h.fidget = lv.fidget * (0.7 + rand() * 0.6); placeHand(); }
    // safety net: a settled hand that covers every remaining gap lets go after a moment
    h.stuck = h.t >= 1 && !freeGapsAt(handBase()).length ? (h.stuck || 0) + dt : 0;
    if (h.stuck > 1) { h.stuck = 0; placeHand(); }
  } else if (S.phase === 'between') {
    // the empty hand goes up, a new rack slides in from the right and the hand comes back down on it
    if (S.phaseT < 0.45) h.enter = Math.min(1, S.phaseT / 0.45);
    else {
      if (!S.nextReady) {
        S.nextReady = true; S.level++;
        S.rack = makeRack(LEVELS[S.level]); S.rack.slide = 1;
        placeHand(true); h.phase = 0; h.fidget = LEVELS[S.level].fidget;
      }
      const k = Math.min(1, (S.phaseT - 0.45) / 0.55);
      S.rack.slide = 1 - easeOut(k); h.enter = 1 - easeOut(k);
      if (k >= 1) { setPhase('cut'); ev('go', S.level); }
    }
  } else if (S.phase === 'done' || S.phase === 'over') {
    if (S.phase === 'done') h.enter = Math.min(1, S.phaseT / 0.5);
    if (S.phaseT > 1) { S.running = false; (S.phase === 'done' ? hooks.onFinish : hooks.onGameOver)(); }
  }
}
