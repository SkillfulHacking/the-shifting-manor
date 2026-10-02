// Full start-to-ending playthrough driven through the real game (input -> interaction -> transitions), following solver plans.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const plan = JSON.parse(readFileSync('scripts/plan.json', 'utf8'));
const withShots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = new Set();
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error') logs.add('error: ' + t.slice(0, 300)); });
page.on('pageerror', (e) => logs.add('pageerror: ' + e.message));
await page.goto('http://localhost:5173/?q=low');
await page.waitForFunction(() => window.__game && window.__game.mode === 'title', null, { timeout: 180000 });
await page.evaluate(() => { localStorage.clear(); window.__game.newGame(); });
await page.waitForTimeout(500);
const step = async (label, fn, arg) => {
  const r = await page.evaluate(fn, arg);
  console.log(label, r ?? '');
};
const adv = (s) => page.evaluate((s) => window.__game.debugAdvance(s), s);
const shot = async (n) => { if (withShots) { await page.evaluate(() => { window.__game.frame(0.016); }); await page.screenshot({ path: `shots/play-${n}.png`, timeout: 120000 }); } };
await adv(3);
const state = () => page.evaluate(() => ({ room: window.__game.state.room, phase: window.__game.state.phase, mode: window.__game.mode, flags: [...window.__game.state.flags], lit: [...window.__game.state.lit] }));
const interact = async (id, expectRoom) => {
  await page.evaluate((id) => window.__game.debugInteract(id), id);
  await adv(3.2);
  const st = await state();
  if (expectRoom && st.room !== expectRoom) throw new Error(`after ${id}: expected ${expectRoom}, got ${st.room}`);
  return st;
};
const closeNote = async () => { await page.evaluate(() => window.__game.debugClose()); await adv(0.3); };
const runPlan = async (steps) => {
  for (const s of steps) {
    let m;
    if ((m = s.match(/^use (\S+) -> (\S+)$/))) {
      const expectRoom = await page.evaluate((d) => window.__game.state.door(d).room, m[2]);
      // every use must start in the door's own room
      const here = (await state()).room;
      const doorRoom = await page.evaluate((d) => window.__game.state.door(d).room, m[1]);
      if (here !== doorRoom) throw new Error(`plan wants ${m[1]} but player is in ${here}`);
      await interact(m[1], expectRoom);
    } else if ((m = s.match(/^light (\S+)$/))) {
      await interact('c_' + m[1]);
      if (!(await state()).lit.includes('c_' + m[1])) throw new Error('candle did not light ' + m[1]);
    } else if ((m = s.match(/^snuff (\S+)$/))) {
      await interact('c_' + m[1]);
    } else if (s === 'record echo') {
      await recordEcho('plate_u', 'upper');
    } else throw new Error('unknown step ' + s);
  }
};
const recordEcho = async (plate, room) => {
  await page.evaluate((plate) => {
    const g = window.__game; const o = g.state.object(plate);
    g.player.teleport(o.x + 1.5, o.z + 1.5, 0); g.toggleEcho();
  }, plate);
  await adv(0.8);
  await page.evaluate((plate) => { const g = window.__game; const o = g.state.object(plate); g.player.teleport(o.x, o.z, 0); }, plate);
  await adv(1.2);
  await page.evaluate(() => window.__game.toggleEcho());
  await adv(4);
  const held = await page.evaluate(() => [...window.__game.state.platesHeld]);
  console.log('  echo holds', held.join(','));
};

// ---------------- phase 0
console.log('== phase 0');
let st = await state(); console.log(st);
await shot('00-start');
await interact('matches'); await closeNote();
await interact('n_intro'); await closeNote();
await runPlan(plan[0]);
await shot('01-mirrors');
st = await interact('handMirror');
await adv(4); await shot('02-mirror-taken');
console.log('  after mirror:', await state());
// ---------------- phase 1
console.log('== phase 1');
await runPlan(plan[1]);
st = await interact('clockWind'); await adv(4); await shot('03-clock');
console.log('  after clock:', await state());
// ---------------- phase 2
console.log('== phase 2');
await runPlan(plan[2]);
st = await interact('coffin'); await adv(4); await shot('04-crypt');
console.log('  after coffin:', await state());
// ---------------- phase 3: echo lesson in the crypt
console.log('== phase 3');
await recordEcho('plate_c1', 'crypt');
await page.evaluate(() => { const g = window.__game; const o = g.state.object('plate_c2'); g.player.teleport(o.x, o.z, 0); });
await adv(0.5);
await shot('05-echo');
st = await interact('crypt.s', 'ballroom');
await adv(2);
console.log('  after gate:', await state());
// ---- the waltz: record the echo walking the four sigils, then hold the organ pedal while it dances
const tiles = await page.evaluate(() => window.__game.danceTiles());
await page.evaluate((t) => { const g = window.__game; g.player.teleport(t.e[0].x + 1.2, t.e[0].z + 1.2, 0); g.toggleEcho(); }, tiles);
await adv(0.5);
for (const t of tiles.e) {
  await page.evaluate((t) => window.__game.player.teleport(t.x, t.z, 0), t);
  await adv(2.2);
}
await page.evaluate(() => window.__game.toggleEcho());
// now dance the right-hand tiles in step with the echo (poll: be on the player tile of the beat the echo is on)
for (let i = 0; i < 400 && !(await state()).flags.includes('danceDone'); i++) {
  await page.evaluate((t) => {
    const g = window.__game; const ep = g.echo.position(); if (!ep) return;
    let best = 0, bd = 1e9; t.e.forEach((q, k) => { const d = (q.x - ep.x) ** 2 + (q.z - ep.z) ** 2; if (d < bd) { bd = d; best = k; } });
    const p = t.p[best]; g.player.teleport(p.x, p.z, 0);
  }, tiles);
  await adv(0.25);
}
console.log('  danceDone:', (await state()).flags.includes('danceDone'));
await shot('05b-ballroom');
st = await interact('ballroom.n', 'upper');
await adv(3);
console.log('  after ballroom:', await state());
// ---------------- phase 4
console.log('== phase 4');
await shot('06-midnight');
const p4 = plan[4];
await runPlan(p4.slice(0, -1));
console.log('  before gate:', await state());
await shot('07-attic-stair');
st = await interact('atticstair.n', 'attic');
await adv(1);
await shot('08-attic');
st = await interact('musicBox');
await adv(3);
console.log('  ending flags:', (await state()).flags.join(','));
await adv(10);
await shot('09-ending');
const ov = await page.evaluate(() => window.__game.ui.overlayName);
console.log('overlay after ending:', ov);
console.log([...logs].join('\n') || 'no console errors');
await browser.close();
