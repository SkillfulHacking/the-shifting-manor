// Usage: node scripts/shot.mjs <name> "<js to eval after load>" [wait ms]
import { chromium } from 'playwright';
const [,, name = 'shot', code = '', wait = '1500', url = 'http://localhost:5173/?debug'] = process.argv;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.goto(url);
await page.waitForFunction(() => window.__game && window.__game.mode === 'title', null, { timeout: 90000 });
if (code) await page.evaluate(code);
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: `shots/${name}.png` });
console.log(logs.join('\n') || 'no console errors');
await browser.close();
