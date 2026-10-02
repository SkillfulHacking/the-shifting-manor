import * as THREE from 'three';
import { Builder, archShape, bx, canvasTex, cyl, gilt, iron, brass, lathe, mesh, plain, ringGeo, smoothLathe, sph, tag, tint, tor, TAU, wood, tube, addChain, V3 } from './util';

export const caseWood = () => tint('darkWood', 0xb8946f, { key: 'caseWood' });

function handShape(len: number, wid: number, spade: boolean): THREE.Shape {
  const s = new THREE.Shape();
  const tail = len * 0.16;
  s.moveTo(0, -tail);
  s.lineTo(wid * 0.18, -tail); s.lineTo(wid * 0.14, 0);
  if (spade) {
    const y0 = len * 0.55;
    s.lineTo(wid * 0.14, y0 - wid * 0.4);
    s.bezierCurveTo(wid * 0.9, y0 - wid * 0.3, wid * 0.7, y0 + wid * 0.9, 0, y0 + wid * 1.0);
    s.bezierCurveTo(-wid * 0.7, y0 + wid * 0.9, -wid * 0.9, y0 - wid * 0.3, -wid * 0.14, y0 - wid * 0.4);
    s.lineTo(-wid * 0.14, len * 0.72);
    s.lineTo(0, len);
    s.lineTo(wid * 0.14, len * 0.72);
    s.lineTo(wid * 0.14, y0 + wid * 0.5);
    s.lineTo(-wid * 0.14, y0 + wid * 0.5);
    s.lineTo(-wid * 0.14, 0);
  } else {
    s.lineTo(wid * 0.1, len * 0.9); s.lineTo(0, len); s.lineTo(-wid * 0.1, len * 0.9); s.lineTo(-wid * 0.14, 0);
  }
  s.lineTo(-wid * 0.18, -tail); s.lineTo(0, -tail);
  return s;
}

function dialTexture(): THREE.CanvasTexture {
  return canvasTex(512, 512, (g, W, H) => {
    // aged cream plate with gilded spandrels
    g.fillStyle = '#b9975a'; g.fillRect(0, 0, W, H);
    const gr = g.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * 0.5);
    gr.addColorStop(0, '#f1e6c8'); gr.addColorStop(0.8, '#dccb9c'); gr.addColorStop(1, '#bfa872');
    g.fillStyle = gr; g.beginPath(); g.arc(W / 2, H / 2, W * 0.43, 0, TAU); g.fill();
    // spandrel leaf scroll
    g.strokeStyle = '#5b3d15'; g.lineWidth = 3; g.fillStyle = '#7b5622';
    for (const [sx, sy] of [[0, 0], [W, 0], [0, H], [W, H]]) {
      for (let i = 0; i < 4; i++) {
        g.beginPath(); g.arc(sx + (sx ? -1 : 1) * (28 + i * 18), sy + (sy ? -1 : 1) * (28 + i * 18), 10 + i * 4, 0, TAU); g.stroke();
      }
      g.beginPath(); g.arc(sx + (sx ? -1 : 1) * 48, sy + (sy ? -1 : 1) * 48, 16, 0, TAU); g.fill();
    }
    g.strokeStyle = '#24170d'; g.lineWidth = 5; g.beginPath(); g.arc(W / 2, H / 2, W * 0.43, 0, TAU); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.arc(W / 2, H / 2, W * 0.31, 0, TAU); g.stroke();
    g.beginPath(); g.arc(W / 2, H / 2, W * 0.4, 0, TAU); g.stroke();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * TAU, big = i % 5 === 0;
      g.lineWidth = big ? 4 : 1.5;
      g.beginPath(); g.moveTo(W / 2 + Math.cos(a) * W * 0.4, H / 2 + Math.sin(a) * W * 0.4);
      g.lineTo(W / 2 + Math.cos(a) * W * (big ? 0.365 : 0.38), H / 2 + Math.sin(a) * W * (big ? 0.365 : 0.38)); g.stroke();
    }
    const rom = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    g.fillStyle = '#1c120a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 44px "Times New Roman", Georgia, serif';
    rom.forEach((t, i) => {
      const a = (i / 12) * TAU - Math.PI / 2;
      g.save(); g.translate(W / 2 + Math.cos(a) * W * 0.3, H / 2 + Math.sin(a) * W * 0.3);
      g.rotate(a + Math.PI / 2 + (i >= 4 && i <= 8 ? Math.PI : 0));
      g.scale(0.85, 1); g.fillText(t, 0, 0); g.restore();
    });
    // aging vignette & stains
    const v = g.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.75);
    v.addColorStop(0, 'rgba(60,30,0,0)'); v.addColorStop(1, 'rgba(60,30,0,0.35)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
  });
}

export function grandfatherClock(): THREE.Group {
  const b = new Builder();
  const w = caseWood();
  const g = gilt();
  const cw = 0.65, cd = 0.4;
  // plinth with stepped mouldings & bracket feet
  b.add(bx(cw, 0.05, cd, 0.006), w, { p: [0, 0.025, 0] });
  b.add(bx(cw - 0.02, 0.2, cd - 0.02, 0.008), w, { p: [0, 0.15, 0] });
  b.add(bx(cw + 0.02, 0.03, cd + 0.02, 0.008), w, { p: [0, 0.265, 0] });
  b.add(bx(cw - 0.06, 0.03, cd - 0.05, 0.008), w, { p: [0, 0.295, 0] });
  // blind gothic arch on plinth front
  const pa = new THREE.ExtrudeGeometry(archShape(0.3, 0.17, 0.11), { depth: 0.008, bevelEnabled: false });
  b.add(pa, tint('darkWood', 0x8a6a50, { key: 'clockPanel' }), { p: [0, 0.06, cd / 2 - 0.02] });
  // trunk: side boards, back, top/bottom
  const tw = 0.5, td = 0.34;
  for (const s of [-1, 1]) {
    b.add(bx(0.03, 1.5, td, 0.004), w, { p: [s * (tw / 2 - 0.015), 1.05, 0] });
  }
  b.add(bx(tw, 1.5, 0.03), w, { p: [0, 1.05, -td / 2 + 0.015] });
  // front frame with opening (0.3 x 1.12) from y=0.5..1.62
  const opW = 0.3, opH = 1.12, opY = 1.06;
  b.add(bx((tw - opW) / 2, 1.5, 0.03, 0.004), w, { p: [-(opW / 2 + (tw - opW) / 4), 1.05, td / 2 - 0.015] });
  b.add(bx((tw - opW) / 2, 1.5, 0.03, 0.004), w, { p: [(opW / 2 + (tw - opW) / 4), 1.05, td / 2 - 0.015] });
  b.add(bx(opW, opY - opH / 2 - 0.3, 0.03), w, { p: [0, 0.3 + (opY - opH / 2 - 0.3) / 2, td / 2 - 0.015] });
  b.add(bx(opW, 1.8 - (opY + opH / 2), 0.03), w, { p: [0, (1.8 + opY + opH / 2) / 2, td / 2 - 0.015] });
  // inner dark
  b.add(bx(tw - 0.06, 1.5, 0.01), plain(0x1a0f08, 0.9), { p: [0, 1.05, -td / 2 + 0.035] });
  // door bezel (brass) & glass
  b.add(ringGeo(opW + 0.05, opH + 0.05, opW, opH, 0.02, 0.003), g, { p: [0, opY, td / 2 + 0.0] }, { uv: 'keep' });
  // waist moulding
  b.add(bx(tw + 0.04, 0.03, td + 0.03, 0.008), w, { p: [0, 1.795, 0] });
  b.add(bx(tw + 0.07, 0.02, td + 0.05, 0.006), w, { p: [0, 1.82, 0] });
  // turned columns on hood
  const hoodBase = 1.83, hoodH = 0.5;
  for (const s of [-1, 1]) b.add(smoothLathe([[0.026, 0], [0.02, 0.05], [0.026, 0.1], [0.018, 0.2], [0.018, 0.4], [0.026, 0.48], [0.02, 0.54]], 12, 3), g, { p: [s * 0.27, hoodBase, 0.14] });
  // hood body (behind dial)
  const hw = 0.55;
  b.add(bx(hw, hoodH, 0.27, 0.004), w, { p: [0, hoodBase + hoodH / 2, -0.035] });
  for (const s of [-1, 1]) b.add(bx(0.06, hoodH, 0.03), w, { p: [s * 0.25, hoodBase + hoodH / 2, 0.145] });
  // dial frame ring
  const dialY = hoodBase + hoodH / 2 - 0.02;
  b.add(ringGeo(0.46, 0.5, 0.385, 0.385, 0.06, 0.004), w, { p: [0, dialY, 0.1] }, { uv: 'keep' });
  b.add(tor(0.2, 0.008, 6, 40), g, { p: [0, dialY, 0.168] });
  // hood cornice and gothic crest
  b.add(bx(hw + 0.06, 0.03, 0.34, 0.006), w, { p: [0, hoodBase + hoodH + 0.015, 0] });
  b.add(bx(hw + 0.1, 0.025, 0.37, 0.006), w, { p: [0, hoodBase + hoodH + 0.04, 0] });
  const crestH = 0.17;
  const crest = new THREE.ExtrudeGeometry(archShape(hw, crestH, crestH * 0.9), { depth: 0.24, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1 });
  b.add(crest, w, { p: [0, hoodBase + hoodH + 0.052, -0.12] });
  // gilded crest tracery (trefoil ring + fleur)
  b.add(tor(0.045, 0.007, 5, 24), g, { p: [0, hoodBase + hoodH + 0.11, 0.128] });
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + Math.PI / 2; b.add(sph(0.022, 8, 6), g, { p: [Math.cos(a) * 0.028, hoodBase + hoodH + 0.11 + Math.sin(a) * 0.028, 0.128], s: [1, 1, 0.5] }); }
  for (const s of [-1, 0, 1]) {
    const x = s * 0.27, y = hoodBase + hoodH + (s === 0 ? 0.052 + crestH * 0.9 : 0.052);
    b.add(smoothLathe([[0.02, 0], [0.012, 0.025], [0.015, 0.05], [0.008, 0.07], [0.0001, 0.1]], 8, 2), g, { p: [x, y, s === 0 ? 0 : 0.11] });
  }
  // dial plate
  const dialMat = new THREE.MeshStandardMaterial({ map: dialTexture(), roughness: 0.55 });
  const grp = b.build();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.385, 0.385), dialMat);
  face.name = 'face'; face.position.set(0, dialY, 0.104); face.receiveShadow = true;
  grp.add(face);
  // hands
  const hMat = plain(0x120c07, 0.5, 0.3);
  const mk = (len: number, wid: number, spade: boolean, z: number, name: string) => {
    const pivot = new THREE.Group(); pivot.name = name; pivot.position.set(0, dialY, z);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(handShape(len, wid, spade), { depth: 0.003, bevelEnabled: false }), hMat);
    m.castShadow = true; pivot.add(m); grp.add(pivot); return pivot;
  };
  const hourHand = mk(0.095, 0.035, true, 0.112, 'hourHand');
  const minuteHand = mk(0.15, 0.026, true, 0.117, 'minuteHand');
  hourHand.rotation.z = -Math.PI * 0.35; minuteHand.rotation.z = -Math.PI * 0.6;
  const hub = mesh(sph(0.012, 8, 6), brass(), { p: [0, dialY, 0.124], s: [1, 1, 0.6] }); grp.add(hub);
  // dial glass
  const gm = new THREE.MeshStandardMaterial({ color: 0xcfe3ea, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.1, depthWrite: false });
  const dg = new THREE.Mesh(new THREE.CircleGeometry(0.19, 32), gm); dg.position.set(0, dialY, 0.165); dg.userData.noShadow = true; grp.add(dg);
  const dr = new THREE.Mesh(new THREE.PlaneGeometry(opW, opH), gm); dr.position.set(0, opY, td / 2 - 0.01); dr.userData.noShadow = true; grp.add(dr);
  // pendulum
  const pendulum = new THREE.Group(); pendulum.name = 'pendulum'; pendulum.position.set(0, 1.7, -0.02);
  const pb = new Builder(pendulum);
  pb.add(cyl(0.004, 0.004, 0.98, 6), brass(), { p: [0, -0.49, 0] });
  pb.add(cyl(0.05, 0.05, 0.012, 24), g, { p: [0, -0.98, 0], r: [Math.PI / 2, 0, 0] });
  pb.add(cyl(0.035, 0.035, 0.016, 20), brass(), { p: [0, -0.98, 0.008], r: [Math.PI / 2, 0, 0] });
  pb.add(sph(0.012, 8, 6), brass(), { p: [0, -0.98, 0.02] });
  pb.build(); grp.add(pendulum);
  // weights & chains
  const wb = new Builder(grp);
  for (const [x, y, z] of [[-0.09, 0.98, 0.04], [0.09, 0.78, 0.04]] as V3[]) {
    wb.add(smoothLathe([[0.0001, 0], [0.045, 0], [0.05, 0.02], [0.052, 0.2], [0.04, 0.24], [0.02, 0.26]], 14, 2), brass(), { p: [x, y, z] });
    addChain(wb, 1.66 - (y + 0.26), 'brass', 0.03, x, z, 1.66);
  }
  wb.build();
  // finials on plinth-corner feet
  return tag(grp, { pendulum, hourHand, minuteHand, face, faceCenter: new THREE.Vector3(0, dialY, 0.104), glass: dr });
}
