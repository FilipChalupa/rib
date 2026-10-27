// Plays the game with simple bots straight on top of the game logic and prints times.
// Usage: node tools/sim.mjs [games per bot]
import { S, RACK, knife, hooks, seed, newGame, update, knifeDown, knifeMove, knifeUp, freeGaps, totalTime } from '../src/game.js';

const BOTS = [
  // react: pause before each stroke (s), aim: sideways error (units), swipe: stroke duration (s)
  { name: 'opatrný', react: 0.55, aim: 6, swipe: 0.2 },
  { name: 'průměrný', react: 0.35, aim: 10, swipe: 0.15 },
  { name: 'zbrklý', react: 0.15, aim: 16, swipe: 0.1 },
];
const games = +process.argv[2] || 40, DT = 1 / 60;
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.4;
const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? NaN;

for (const bot of BOTS) {
  const times = [], injuries = [], bones = [];
  let fails = 0, stalls = 0;
  for (let g = 0; g < games; g++) {
    seed(1000 + g); newGame();
    let done = false, wait = bot.react, stroke = null, idle = 0;
    hooks.onFinish = () => { done = true; times.push(totalTime()); injuries.push(S.injuries); bones.push(S.boneHits); };
    hooks.onGameOver = () => { done = true; fails++; };
    for (let f = 0; f < 60 * 600 && !done; f++) {
      if (S.phase === 'cut') {
        if (stroke) {
          stroke.k++;
          const t = Math.min(1, stroke.k / stroke.n);
          knifeMove(stroke.x0 + (stroke.x1 - stroke.x0) * t, stroke.y0 + (stroke.y1 - stroke.y0) * t);
          if (t >= 1) { knifeUp(); stroke = null; wait = bot.react; }
        } else if ((wait -= DT) <= 0 && S.hand.t >= 1 && knife.invuln <= 0) { // a person waits for the hand to settle
          const free = freeGaps();
          if (free.length) {
            idle = 0;
            const gap = free[Math.floor(Math.random() * free.length)], down = Math.random() < 0.5;
            const y0 = down ? RACK.top - 12 : RACK.bottom + 30, y1 = down ? RACK.bottom + 30 : RACK.top - 12;
            stroke = { x0: gap.x + gauss() * bot.aim, y0, x1: gap.x + gauss() * bot.aim, y1, k: 0, n: Math.max(1, Math.round(bot.swipe / DT)) };
            knifeDown(stroke.x0, stroke.y0);
          } else if ((idle += DT) > 4) { stalls++; idle = 0; }
        }
      }
      update(DT);
    }
    if (!done) { stalls++; }
  }
  console.log(`${bot.name.padEnd(9)} medián ${median(times).toFixed(1)} s  dokončeno ${times.length}/${games}  pohotovost ${fails}  ` +
    `prsty Ø ${(injuries.reduce((a, b) => a + b, 0) / (injuries.length || 1)).toFixed(2)}  kosti Ø ${(bones.reduce((a, b) => a + b, 0) / (bones.length || 1)).toFixed(2)}  zaseknutí ${stalls}`);
}
