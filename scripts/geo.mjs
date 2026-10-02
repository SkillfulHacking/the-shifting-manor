// Checks every door spawn is outside furniture colliders and that each room's walkable area reaches its doors/interactables.
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.goto('http://localhost:5173/?q=low');
await page.waitForFunction(() => window.__game && window.__game.mode === 'title', null, { timeout: 180000 });
const res = await page.evaluate(() => {
  const g = window.__game; const out = [];
  const ids = ['hall','library','dining','kitchen','mirrors','gallery','conservatory','cellar','crypt','clock','upper','atticstair','attic'];
  for (const id of ids) {
    const room = g.getRoom(id); const c = room.colliders;
    // grid flood fill from each door spawn at 0.25 m
    const R = 0.34; const b = c.bounds; const step = 0.25;
    const free = (x, z) => x > b.minX + R && x < b.maxX - R && z > b.minZ + R && z < b.maxZ - R && !c.solids.some((s) => { const cx = Math.min(Math.max(x, s.minX), s.maxX), cz = Math.min(Math.max(z, s.minZ), s.maxZ); return (x - cx) ** 2 + (z - cz) ** 2 < R * R; });
    const doors = g.state.door ? [...room.doors.keys()] : [];
    const spawns = doors.map((d) => ({ d, ...room.spawnFor(d) }));
    const bad = spawns.filter((s) => !free(s.x, s.z)).map((s) => s.d);
    const key = (x, z) => Math.round(x / step) + ',' + Math.round(z / step);
    const start = spawns.find((s) => free(s.x, s.z));
    const seen = new Set(); const q = [];
    if (start) { q.push([start.x, start.z]); seen.add(key(start.x, start.z)); }
    while (q.length) { const [x, z] = q.pop(); for (const [dx, dz] of [[step,0],[-step,0],[0,step],[0,-step]]) { const nx = x+dx, nz = z+dz, k = key(nx, nz); if (!seen.has(k) && free(nx, nz)) { seen.add(k); q.push([nx, nz]); } } }
    const unreachable = spawns.filter((s) => free(s.x, s.z) && !seen.has(key(s.x, s.z))).map((s) => s.d);
    // interactables: reachable free cell within 2.2 m
    const farIt = room.interactables.filter((it) => { for (const k of seen) { const [gx, gz] = k.split(',').map(Number); if ((gx*step - it.center.x) ** 2 + (gz*step - it.center.z) ** 2 < 2.2 ** 2) return false; } return true; }).map((i) => i.id);
    out.push(`${id}: solids ${c.solids.length} badSpawns[${bad}] unreachableSpawns[${unreachable}] unreachableInteractables[${farIt}]`);
  }
  return out;
});
console.log(res.join('\n'));
// real-movement check: walk the actual controller from the attic-stair door to plate_a and face the gate door
const walk = await page.evaluate(() => {
  const g = window.__game; const room = g.getRoom('atticstair'); const P = g.player.constructor;
  const p = new P(); const sp = room.spawnFor('atticstair.s'); p.teleport(sp.x, sp.z, sp.yaw, 0);
  for (let i = 0; i < 1500; i++) { p.yaw = sp.yaw; p.update(0.03, { fwd: 1, right: 0, sprint: false }, room.colliders); if (p.pos.z < -3.5) break; }
  return { x: +p.pos.x.toFixed(2), y: +p.pos.y.toFixed(2), z: +p.pos.z.toFixed(2) };
});
console.log('walk to attic landing:', JSON.stringify(walk), walk.z < -3 && walk.y > 2.4 ? 'OK' : 'FAIL');
await browser.close();
