import * as THREE from 'three';
import { Builder, addCandle, addChain, brass, cupGeo, cyl, gilt, iron, lathe, mesh, sph, smoothLathe, tor, tube, tag, plain, TAU, V3, bx, staticFlame, rng, ringGeo } from './util';

function candleUD(g: THREE.Group, c: { flame: THREE.Mesh; wick: THREE.Mesh; anchor: THREE.Vector3 }) {
  return tag(g, { flameAnchor: c.anchor, flame: c.flame, wick: c.wick });
}

/** Brass candlestick with one candle; origin at base centre. */
export function candleHolder(): THREE.Group {
  const b = new Builder();
  const m = brass();
  // domed base plate with rim, turned stem with knops, drip pan
  b.add(smoothLathe([[0.0001, 0], [0.075, 0], [0.078, 0.006], [0.07, 0.012], [0.055, 0.02], [0.03, 0.03], [0.018, 0.04]], 32, 4), m);
  b.add(smoothLathe([[0.018, 0.035], [0.011, 0.06], [0.014, 0.085], [0.024, 0.1], [0.012, 0.115], [0.009, 0.14], [0.011, 0.16], [0.02, 0.172], [0.012, 0.183], [0.012, 0.19]], 20, 3), m);
  b.add(cupGeo(0.03), m, { p: [0, 0.185, 0], s: [1.15, 1, 1.15] });
  // drip pan tray rim
  b.add(tor(0.036, 0.0025, 4, 24), m, { p: [0, 0.218, 0], r: [Math.PI / 2, 0, 0] });
  // finger loop handle
  b.add(tor(0.035, 0.0045, 6, 16, Math.PI * 1.3), m, { p: [0.06, 0.03, 0], r: [0, 0, -Math.PI * 0.65] });
  const c = addCandle(b, [0, 0.205, 0], 0.17, 0.0155, { drips: 3, seed: 3 });
  const g = b.build();
  return candleUD(g, c);
}

/** Freestanding pillar candle on a small brass saucer. Origin at base. */
export function pillarCandle(height = 0.25, radius = 0.03): THREE.Group {
  const b = new Builder();
  b.add(smoothLathe([[0.0001, 0], [radius * 2.2, 0], [radius * 2.3, 0.004], [radius * 2.0, 0.012], [radius * 1.3, 0.014], [0.0001, 0.014]], 24, 3), brass());
  const c = addCandle(b, [0, 0.012, 0], height, radius, { drips: 5, seed: Math.floor(height * 100 + radius * 1000) });
  return candleUD(b.build(), c);
}

/** Multi-arm candelabra standing on a surface. */
export function candelabra(arms = 3): THREE.Group {
  const b = new Builder();
  const m = brass();
  const n = Math.max(1, arms);
  // heavy turned foot & stem
  b.add(smoothLathe([[0.0001, 0], [0.11, 0], [0.115, 0.01], [0.1, 0.022], [0.07, 0.04], [0.04, 0.06], [0.022, 0.085]], 32, 4), m);
  b.add(smoothLathe([[0.02, 0.08], [0.012, 0.11], [0.02, 0.13], [0.03, 0.15], [0.014, 0.17], [0.011, 0.2], [0.018, 0.22], [0.026, 0.24], [0.012, 0.26], [0.01, 0.3], [0.014, 0.33], [0.02, 0.345]], 20, 3), m);
  const anchors: THREE.Vector3[] = [];
  const flames: THREE.Mesh[] = [];
  const wicks: THREE.Mesh[] = [];
  const addAt = (x: number, y: number, seed: number, tall: number) => {
    b.add(cupGeo(0.026), m, { p: [x, y, 0] });
    const c = addCandle(b, [x, y + 0.012, 0], tall, 0.0165, { drips: 2, seed });
    anchors.push(c.anchor); flames.push(c.flame); wicks.push(c.wick);
  };
  const pairs = Math.floor(n / 2);
  for (let k = 1; k <= pairs; k++) {
    const x = (0.07 + (k - 1) * 0.055) * (n > 5 ? 1.1 : 1) + (k - 1) * 0.03;
    const yBase = 0.16 + (k - 1) * 0.02;
    for (const s of [-1, 1]) {
      b.add(tube([[0, yBase, 0], [s * x * 0.35, yBase - 0.045, 0], [s * x * 0.85, yBase - 0.03, 0], [s * x, yBase + 0.02, 0], [s * x, yBase + 0.11 + (k - 1) * 0.02, 0]], 0.0065, 20, 6), m);
      b.add(tor(x * 0.32, 0.004, 4, 12, Math.PI * 1.4), m, { p: [s * x * 0.42, yBase - 0.005, 0], r: [0, 0, s > 0 ? -0.4 : Math.PI + 0.4 - Math.PI * 1.4 + 0.0] });
      b.add(sph(0.011, 8, 6), m, { p: [s * x, yBase + 0.07 + (k - 1) * 0.02, 0], s: [1, 1.5, 1] });
      addAt(s * x, yBase + 0.11 + (k - 1) * 0.02, 10 + k * 2 + (s > 0 ? 1 : 0), 0.14 - k * 0.006);
    }
  }
  if (n % 2 === 1) addAt(0, 0.345, 5, 0.17);
  const g = b.build();
  return tag(g, { flameAnchors: anchors, flames, wicks, flameAnchor: anchors[anchors.length - 1] ?? new THREE.Vector3() });
}

/** Hanging wrought-iron chandelier. Origin at ceiling attach point, hangs downward. */
export function chandelier(radius = 0.7, candles = 8, chainLength = 0.6): THREE.Group {
  const b = new Builder();
  const m = iron();
  const chainLen = chainLength;
  if (chainLen > 0.05) addChain(b, chainLen, m);
  const yc = -chainLen;
  // ceiling canopy
  b.add(smoothLathe([[0.0001, 0.02], [0.06, 0.02], [0.08, 0.0], [0.05, -0.03], [0.02, -0.045]], 16, 3), m);
  // crown / hub
  b.add(smoothLathe([[0.0001, yc + 0.03], [0.03, yc + 0.02], [0.05, yc], [0.075, yc - 0.03], [0.05, yc - 0.06], [0.04, yc - 0.09], [0.06, yc - 0.12], [0.04, yc - 0.15], [0.02, yc - 0.19], [0.03, yc - 0.24], [0.018, yc - 0.3], [0.0001, yc - 0.34]], 16, 3), m);
  b.add(sph(0.04, 12, 8), m, { p: [0, yc - 0.2, 0] });
  const ringY = yc - 0.28 - radius * 0.1;
  b.add(tor(radius, 0.014, 5, 48), m, { p: [0, ringY, 0], r: [Math.PI / 2, 0, 0] });
  b.add(tor(radius * 0.97, 0.007, 4, 48), m, { p: [0, ringY + 0.055, 0], r: [Math.PI / 2, 0, 0] });
  const n = Math.max(3, candles);
  const armN = Math.max(4, Math.min(n, 5));
  for (let i = 0; i < armN; i++) {
    const a = (i / armN) * TAU + 0.2;
    const c = Math.cos(a), s = Math.sin(a);
    const pts: V3[] = [[0, yc - 0.1, 0], [c * radius * 0.25, yc - 0.03, s * radius * 0.25], [c * radius * 0.65, yc - 0.06, s * radius * 0.65], [c * radius, ringY, s * radius]];
    b.add(tube(pts, 0.0095, 14, 5), m);
    // scroll ornament halfway
    b.add(tor(0.05, 0.005, 3, 8, Math.PI * 1.5), m, { p: [c * radius * 0.6, yc - 0.13, s * radius * 0.6], r: [0, -a, 0.6] });
  }
  const anchors: THREE.Vector3[] = [], flames: THREE.Mesh[] = [];
  const wax = 'candleWax' as const;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const p: V3 = [Math.cos(a) * radius, ringY, Math.sin(a) * radius];
    b.add(cupGeo(0.028), m, { p: [p[0], p[1] + 0.008, p[2]] });
    b.add(cyl(0.006, 0.006, 0.03, 6), m, { p: [p[0], p[1] + 0.0, p[2]] });
    const cd = addCandle(b, [p[0], p[1] + 0.02, p[2]], 0.13 + ((i * 7) % 3) * 0.012, 0.0175, { drips: 1, seed: i + 1, wax });
    anchors.push(cd.anchor); flames.push(cd.flame);
    // iron spike finial pendant between candles
    const a2 = a + Math.PI / n;
    const q: V3 = [Math.cos(a2) * radius, ringY, Math.sin(a2) * radius];
    b.add(new THREE.ConeGeometry(0.014, 0.12, 6), m, { p: [q[0], q[1] - 0.075, q[2]], r: [Math.PI, 0, 0] });
    b.add(sph(0.014, 4, 3), m, { p: [q[0], q[1] - 0.005, q[2]] });
  }
  // dangling finial ball
  b.add(new THREE.ConeGeometry(0.025, 0.14, 8), m, { p: [0, yc - 0.34 - 0.07, 0], r: [Math.PI, 0, 0] });
  const g = b.build();
  return tag(g, { flameAnchors: anchors, flames, flameAnchor: anchors[0], ringRadius: radius });
}

/** Brass wall sconce with a candle. Origin at the wall mounting point; +Z out of the wall. */
export function wallSconce(): THREE.Group {
  const b = new Builder();
  const m = brass();
  // back plate: pointed shield
  const s = new THREE.Shape();
  s.moveTo(0, 0.14); s.bezierCurveTo(0.05, 0.11, 0.055, 0.02, 0.05, -0.03); s.bezierCurveTo(0.04, -0.09, 0.01, -0.12, 0, -0.15);
  s.bezierCurveTo(-0.01, -0.12, -0.04, -0.09, -0.05, -0.03); s.bezierCurveTo(-0.055, 0.02, -0.05, 0.11, 0, 0.14);
  b.add(new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: true, bevelSize: 0.005, bevelThickness: 0.004, bevelSegments: 1, curveSegments: 8 }), m, { p: [0, 0, 0] });
  b.add(sph(0.018, 10, 8), m, { p: [0, 0.02, 0.022], s: [1, 1, 0.8] });
  b.add(sph(0.01, 8, 6), m, { p: [0, -0.09, 0.016], s: [1, 1.4, 0.8] });
  // curved arm
  b.add(tube([[0, 0.02, 0.02], [0, 0.0, 0.07], [0, -0.05, 0.13], [0, -0.04, 0.2], [0, -0.005, 0.225]], 0.0075, 20, 6), m);
  // scroll curl
  b.add(tor(0.035, 0.0045, 4, 14, Math.PI * 1.6), m, { p: [0, -0.06, 0.09], r: [0, Math.PI / 2, 2.0] });
  b.add(cupGeo(0.028), m, { p: [0, -0.005, 0.225] });
  const c = addCandle(b, [0, 0.007, 0.225], 0.17, 0.0165, { drips: 3, seed: 7 });
  return candleUD(b.build(), c);
}

/** A plate with several melted candles; flames are static and visible (not lit). */
export function candleCluster(seed = 1): THREE.Group {
  const r = rng(seed);
  const b = new Builder();
  b.add(smoothLathe([[0.0001, 0], [0.16, 0], [0.165, 0.008], [0.15, 0.016], [0.1, 0.02], [0.0001, 0.02]], 32, 3), brass());
  // wax puddle
  b.add(cyl(0.11, 0.12, 0.012, 20), 'candleWax', { p: [0, 0.02, 0], s: [1, 1, 0.8] });
  const n = 4 + Math.floor(r() * 3);
  const anchors: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + r() * 0.6, d = i === 0 ? 0 : 0.055 + r() * 0.05;
    const p: V3 = [Math.cos(a) * d, 0.02, Math.sin(a) * d * 0.85];
    const h = 0.05 + r() * 0.2;
    const c = addCandle(b, p, h, 0.014 + r() * 0.012, { drips: 4, seed: seed * 10 + i });
    c.flame.visible = true; anchors.push(c.anchor);
  }
  return tag(b.build(), { flameAnchors: anchors });
}
