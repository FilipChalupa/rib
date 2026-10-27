// Renders the PWA icons (tools/icon.html) and the install-dialog screenshots (the real game) with Playwright.
// Usage: node tools/assets.cjs   (Playwright must be resolvable, e.g. NODE_PATH=/path/to/node_modules)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();

  const icons = [['icon-512.png', 512, false], ['icon-192.png', 192, false], ['icon-512-maskable.png', 512, true], ['icon-192-maskable.png', 192, true],
    ['apple-touch-icon.png', 180, true], ['favicon-32.png', 32, false]];
  for (const [name, size, maskable] of icons) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.goto(`${base}/tools/icon.html?size=${size}${maskable ? '&maskable=1' : ''}`);
    await page.waitForFunction(() => document.title === 'ready');
    await page.screenshot({ path: path.join(ROOT, 'icons', name), omitBackground: !maskable });
    await page.close();
  }

  // a game in progress: a few clean cuts and one band-aid
  for (const [name, width, height] of [['wide.png', 1280, 720], ['narrow.png', 540, 960]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(`${base}/?debug`);
    await page.click('#btn');
    await page.waitForTimeout(2100);
    await page.evaluate(() => {
      const g = window.__game, cut = (x, y0, y1) => { g.knifeDown(x, y0); for (let k = 1; k <= 10; k++) g.knifeMove(x, y0 + (y1 - y0) * k / 10); g.knifeUp(); };
      for (let n = 0; n < 3; n++) { const f = g.freeGaps(); if (f.length) cut(f[0].x, g.RACK.top - 12, g.RACK.bottom + 30); }
    });
    await page.waitForTimeout(900);
    await page.evaluate(() => {
      const g = window.__game, f = g.handShapes().find(s => s.kind === 'finger' && s.i === 1);
      g.knifeDown(f.bx - 40, (f.ay + f.by) / 2); g.knifeMove(f.bx + 40, (f.ay + f.by) / 2); g.knifeUp();
    });
    await page.waitForTimeout(700);
    await page.mouse.move(width * 0.32, height * 0.45);
    await page.screenshot({ path: path.join(ROOT, 'screenshots', name) });
    await page.close();
  }
  await browser.close();
  server.close();
})();
