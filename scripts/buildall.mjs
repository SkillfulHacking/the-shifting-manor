import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://localhost:5173/');
await page.waitForFunction(() => window.__game && window.__game.mode === 'title', null, { timeout: 180000 });
const res = await page.evaluate(() => {
  const g = window.__game; const out = [];
  for (const id of ['hall','library','dining','kitchen','mirrors','gallery','conservatory','cellar','crypt','clock','upper','atticstair','attic']) {
    try { const t = performance.now(); g.getRoom(id); out.push(id + ' ok ' + (performance.now() - t).toFixed(0) + 'ms'); } catch (e) { out.push(id + ' ERR ' + e.stack.split('\n').slice(0, 4).join(' | ')); }
  }
  return out;
});
console.log(res.join('\n'));
await browser.close();
