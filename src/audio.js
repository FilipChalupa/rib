// Synthesized sound effects (WebAudio, no sound files). Mute and volume are remembered.
const KEY = 'zebirka-sound';
export const audio = { ctx: null, out: null, noise: null, muted: false, vol: 0.8 };

export function loadSound() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || '{}');
    audio.muted = !!p.muted;
    if (Number.isFinite(p.vol)) audio.vol = p.vol;
  } catch (e) {}
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ muted: audio.muted, vol: audio.vol })); } catch (e) {} }
function apply() { if (audio.out) audio.out.gain.value = audio.muted ? 0 : audio.vol; }
export function setMute(m) { audio.muted = m; apply(); save(); }
export function setVolume(v) { audio.vol = v; apply(); save(); }

// Browsers only allow audio after a user gesture, so this runs on the first press.
export function unlock() {
  if (!audio.ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = audio.ctx = new AC();
    audio.out = c.createGain(); audio.out.connect(c.destination); apply();
    audio.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = audio.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
}
export function suspend() { if (audio.ctx) audio.ctx.suspend().catch(() => {}); }
export function resume() { if (audio.ctx) audio.ctx.resume().catch(() => {}); }

function env(g, t, gain, attack, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
function tone(f, dur, { type = 'sine', gain = 0.3, to = 0, delay = 0, attack = 0.005, dest } = {}) {
  const c = audio.ctx;
  if (!c || audio.muted) return;
  const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  env(g, t, gain, attack, dur);
  o.connect(g).connect(dest || audio.out); o.start(t); o.stop(t + dur + 0.02);
  return o;
}
function noise(dur, { f = 1000, q = 1, gain = 0.3, to = 0, type = 'bandpass', delay = 0, attack = 0.003 } = {}) {
  const c = audio.ctx;
  if (!c || audio.muted) return;
  const t = c.currentTime + delay, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  s.buffer = audio.noise; fl.type = type; fl.Q.value = q;
  fl.frequency.setValueAtTime(f, t);
  if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
  env(g, t, gain, attack, dur);
  s.connect(fl).connect(g).connect(audio.out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

export const sfx = {
  swish() { noise(0.14, { f: 2200, to: 6500, q: 0.7, gain: 0.1, attack: 0.03 }); },
  // wet thunk of the knife going through meat into the board
  chop() {
    noise(0.07, { f: 1500, to: 500, q: 0.9, gain: 0.5 });
    tone(120, 0.13, { gain: 0.45, to: 55 });
    noise(0.16, { f: 600, q: 1, gain: 0.14, delay: 0.02, type: 'lowpass' });
  },
  bone() {
    tone(1480, 0.3, { type: 'triangle', gain: 0.22 });
    tone(2230, 0.2, { type: 'square', gain: 0.04 });
    noise(0.05, { f: 5000, q: 2, gain: 0.2 });
  },
  // a cartoon "au!": a falling sawtooth through two vowel formants
  ouch() {
    const c = audio.ctx;
    if (!c || audio.muted) return;
    const t = c.currentTime, mixG = c.createGain();
    mixG.gain.value = 1; mixG.connect(audio.out);
    for (const [f, q, gain] of [[750, 6, 1.4], [1150, 8, 0.8]]) {
      const bp = c.createBiquadFilter(), g = c.createGain();
      bp.type = 'bandpass'; bp.frequency.setValueAtTime(f, t); bp.frequency.linearRampToValueAtTime(f * 0.55, t + 0.4); bp.Q.value = q;
      g.gain.value = gain; bp.connect(g).connect(mixG);
      tone(430, 0.42, { type: 'sawtooth', gain: 0.5, to: 230, attack: 0.02, dest: bp });
    }
    noise(0.06, { f: 900, q: 1, gain: 0.35 });
  },
  land() { tone(170, 0.08, { gain: 0.12, to: 90 }); },
  tick() { tone(660, 0.09, { type: 'square', gain: 0.06 }); },
  go() { tone(990, 0.08, { type: 'square', gain: 0.07 }); tone(1320, 0.22, { type: 'square', gain: 0.07, delay: 0.08 }); },
  rack() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'triangle', gain: 0.16, delay: i * 0.07 })); },
  finish() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i === 6 ? 0.6 : 0.22, { type: 'triangle', gain: 0.18, delay: i * 0.1 })); },
  fail() { [392, 370, 349, 311].forEach((f, i) => tone(f, i === 3 ? 0.8 : 0.3, { type: 'sawtooth', gain: 0.07, delay: i * 0.3, to: i === 3 ? 240 : 0 })); },
};
