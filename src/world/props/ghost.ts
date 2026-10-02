import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { tag, tube, smoothLathe } from './util';

const VERT = /* glsl */ `
uniform float uTime;
uniform float uPhase;
attribute float aH;
varying vec3 vN;
varying vec3 vV;
varying float vH;
varying vec2 vUv;
varying float vAng;
void main() {
  vec3 p = position;
  float k = pow(clamp(1.0 - aH, 0.0, 1.0), 1.6);
  float ang = atan(p.z, p.x);
  float w = sin(ang * 5.0 + uTime * 1.5 + p.y * 3.5 + uPhase) * 0.075 + sin(ang * 9.0 - uTime * 2.1 + uPhase * 2.0) * 0.035 + sin(ang * 2.0 + uTime * 0.9) * 0.05;
  p.xz *= 1.0 + w * k * 2.2;
  p.y += (sin(ang * 3.0 + uTime * 1.2 + uPhase) * 0.06 + sin(ang * 7.0 - uTime * 1.7) * 0.025) * k;
  p.x += sin(uTime * 0.7 + p.y * 2.0 + uPhase) * 0.05 * (1.0 - aH);
  p.z -= (0.03 + 0.05 * sin(uTime * 0.5)) * k;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vH = aH;
  vUv = uv;
  vAng = ang;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uCore;
uniform float uTime;
uniform float uOpacity;
varying vec3 vN;
varying vec3 vV;
varying float vH;
varying vec2 vUv;
varying float vAng;
float hash(float n){ return fract(sin(n) * 43758.5453); }
void main() {
  float fres = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  float rim = pow(fres, 2.2);
  // ragged hem: tattered edge threshold
  float tat = 0.10 + 0.09 * sin(vAng * 13.0 + uTime * 0.6) + 0.06 * sin(vAng * 29.0 - uTime * 0.9) + 0.05 * hash(floor(vAng * 20.0));
  float hem = smoothstep(tat, tat + 0.22, vH);
  // vertical veil streaks
  float streak = 0.75 + 0.25 * sin(vAng * 22.0 + vH * 6.0 + uTime * 0.7);
  float a = (0.10 + 0.7 * rim) * hem * streak * uOpacity;
  vec3 col = mix(uColor, uCore, pow(1.0 - fres, 3.0) * 0.6) * (0.55 + rim * 1.3);
  if (a < 0.004) discard;
  gl_FragColor = vec4(col, a);
}`;

function withH(g: THREE.BufferGeometry, fn: (i: number, g: THREE.BufferGeometry) => number): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  const n = ng.attributes.position.count;
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = fn(i, ng);
  ng.setAttribute('aH', new THREE.BufferAttribute(a, 1));
  return ng;
}

export function ghost(): THREE.Group {
  const H = 1.75;
  // main shroud: lathe from tattered hem to a hooded head
  const prof: [number, number][] = [[0.62, 0], [0.5, 0.12], [0.4, 0.3], [0.31, 0.55], [0.24, 0.85], [0.19, 1.1], [0.15, 1.28], [0.13, 1.4], [0.14, 1.5], [0.155, 1.6], [0.13, 1.7], [0.08, 1.76], [0.0001, 1.79]];
  const body = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 56);
  // subtle vertical fold ripples
  const bp = body.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i), z = bp.getZ(i), y = bp.getY(i);
    const a = Math.atan2(z, x);
    const f = 1 + 0.06 * Math.sin(a * 7.0) * (1 - y / 1.4 > 0 ? (1 - y / 1.4) : 0);
    bp.setX(i, x * f); bp.setZ(i, z * f);
  }
  const bodyG = withH(body, (i, g) => Math.min(1, Math.max(0, g.attributes.position.getY(i) / H)));
  // outstretched sleeves
  const sleeves: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const pts = [new THREE.Vector3(s * 0.15, 1.35, 0.02), new THREE.Vector3(s * 0.3, 1.28, 0.16), new THREE.Vector3(s * 0.4, 1.18, 0.4), new THREE.Vector3(s * 0.36, 1.05, 0.65)];
    const curve = new THREE.CatmullRomCurve3(pts);
    const tg = new THREE.TubeGeometry(curve, 18, 0.06, 10);
    const pp = tg.attributes.position;
    // flare toward the end into a hanging sleeve
    for (let i = 0; i < pp.count; i++) {
      const t = tg.attributes.uv.getX(i);
      const c = curve.getPoint(t);
      const f = 1 + t * t * 1.6;
      pp.setXYZ(i, c.x + (pp.getX(i) - c.x) * f, c.y + (pp.getY(i) - c.y) * f * (1 + t * 0.6), c.z + (pp.getZ(i) - c.z) * f);
    }
    tg.computeVertexNormals();
    sleeves.push(withH(tg, (i, g) => 0.82 - g.attributes.uv.getX(i) * 0.5));
  }
  // wispy trailing tail
  const tail = new THREE.ConeGeometry(0.3, 1.0, 24, 6, true);
  tail.translate(0, -0.5, 0); tail.rotateX(0.5); tail.translate(0, 0.35, -0.25);
  const tailG = withH(tail, (i, g) => Math.max(0, 0.45 + g.attributes.position.getY(i) * 0.5));
  const geos = [bodyG, ...sleeves].map(g => { const c = g.clone(); for (const k of Object.keys(c.attributes)) if (!['position', 'normal', 'uv', 'aH'].includes(k)) c.deleteAttribute(k); return c; });
  const merged = mergeGeometries(geos, false)!;
  const mkMat = (color: number, core: number, op: number, phase: number) => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPhase: { value: phase }, uColor: { value: new THREE.Color(color) }, uCore: { value: new THREE.Color(core) }, uOpacity: { value: op } },
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const mats = [mkMat(0x6ff0d0, 0xc8f6ff, 1.0, 0.0), mkMat(0x5aa8ff, 0xb0e0ff, 0.55, 2.1)];
  const g = new THREE.Group();
  const shells: THREE.Mesh[] = [];
  mats.forEach((m, i) => {
    const me = new THREE.Mesh(merged, m); me.scale.setScalar(i === 0 ? 1 : 1.06); me.renderOrder = 10 + i; me.frustumCulled = false;
    me.castShadow = false; me.receiveShadow = false; me.userData.noShadow = true; g.add(me); shells.push(me);
  });
  // eyes & mouth: dark hollows, normal blending, drawn after the glow
  const darkM = new THREE.MeshBasicMaterial({ color: 0x010306, transparent: true, opacity: 0.92, depthWrite: false });
  const eyeG = new THREE.SphereGeometry(0.03, 12, 10);
  const holes: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(eyeG, darkM); e.position.set(s * 0.048, 1.52, 0.132); e.scale.set(0.62, 2.6, 0.5); e.rotation.z = s * 0.22; e.renderOrder = 20; holes.push(e); g.add(e);
  }
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), darkM);
  mouth.position.set(0, 1.42, 0.14); mouth.scale.set(0.55, 2.6, 0.4); mouth.renderOrder = 20; g.add(mouth);
  const update = (t: number) => {
    for (const m of mats) m.uniforms.uTime.value = t;
    g.position.y = g.userData.baseY !== undefined ? g.userData.baseY + Math.sin(t * 1.1) * 0.04 : g.position.y;
    mouth.scale.y = 2.6 + Math.sin(t * 2.3) * 0.6;
    mouth.scale.x = 0.55 + Math.sin(t * 2.3 + 1) * 0.08;
    for (const e of holes) e.scale.y = 2.6 + Math.sin(t * 0.9) * 0.2;
  };
  return tag(g, { update, materials: mats, height: 1.79, shells });
}
