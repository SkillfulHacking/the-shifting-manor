// Usage: node scripts/views.mjs '<json array of {n, room, door?, x?, z?, yaw?, pitch?, js?, wait?}>'
import { chromium } from 'playwright';
const views = JSON.parse(process.argv[2]);
const size = process.argv[3] ? process.argv[3].split('x').map(Number) : [1280, 720];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
const logs = new Set();
page.on('console', (m) => { const t = m.text(); if (['error'].includes(m.type()) || (m.type() === 'warning' && !/willReadFrequently|THREE.Clock|PCFSoft/.test(t))) logs.add(m.type() + ': ' + t.slice(0, 300)); });
page.on('pageerror', (e) => logs.add('pageerror: ' + e.message));
await page.goto('http://localhost:5173/?q=low');
await page.waitForFunction(() => window.__game && window.__game.mode === 'title', null, { timeout: 120000 });
await page.evaluate(() => { const g = window.__game; g.ui.clear(); g.hasStarted = true; g.mode = 'play'; g.ui.hud(true); });
for (const v of views) {
  await page.evaluate((v) => {
    const g = window.__game;
    if (v.reset) { g.state.reset(); }
    if (v.state) { new Function('g', v.state)(g); }
    g.debugTeleport(v.room, v.door);
    if (v.x !== undefined) g.player.teleport(v.x, v.z, v.yaw ?? 0, v.y ?? 0);
    else if (v.yaw !== undefined) g.player.yaw = v.yaw;
    g.player.pitch = v.pitch ?? 0;
    if (v.js) new Function('g', v.js)(g);
    g.state.echo = null;
  }, v);
  await page.waitForTimeout(v.wait ?? 1200);
  console.log(v.n, 'fps', await page.evaluate(() => window.__game.fps.toFixed(1))); await page.screenshot({ path: `shots/${v.n}.png`, timeout: 120000 });
}
console.log([...logs].join('\n') || 'no console errors');
await browser.close();
