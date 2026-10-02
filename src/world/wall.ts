import * as THREE from 'three';
import type { Wall } from '../game/types';
import { getMaterial, tileMeters, type MaterialName } from '../rendering/textures';
import { archShape, archRise } from './props/util';

export const WALL_THICK = 0.4;
export const DOOR_W = 1.1;
export const DOOR_H = 2.15;

export interface Hole {
  /** centre along the wall (u axis) */
  u: number;
  /** bottom / top (v axis, metres above floor) */
  v0: number;
  v1: number;
  w: number;
  /** pointed-arch top (doors) */
  arch?: boolean;
}

/** a flat pointed-arch plane (door recess, mist) with 0..1 UVs */
export function archPlane(w: number, h: number): THREE.ShapeGeometry {
  const g = new THREE.ShapeGeometry(archShape(w, h, archRise(w, h)), 12);
  g.translate(w / 2, 0, 0);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute, p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / w, p.getY(i) / h);
  g.translate(-w / 2, 0, 0);
  return g;
}

/** Rotation/position of the wall's interior-face frame. Child local: x = u (along wall), y = up, z = into the room. */
export function wallFrame(wall: Wall, w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  switch (wall) {
    case 'N': g.position.set(0, 0, -d / 2); g.rotation.y = 0; break;
    case 'S': g.position.set(0, 0, d / 2); g.rotation.y = Math.PI; break;
    case 'E': g.position.set(w / 2, 0, 0); g.rotation.y = -Math.PI / 2; break;
    case 'W': g.position.set(-w / 2, 0, 0); g.rotation.y = Math.PI / 2; break;
  }
  return g;
}

/** convert a door "offset" (x for N/S, z for E/W) into the wall's u coordinate */
export function uOf(wall: Wall, offset: number): number {
  return wall === 'S' || wall === 'W' ? -offset : offset;
}

export function wallLength(wall: Wall, w: number, d: number) {
  return wall === 'N' || wall === 'S' ? w : d;
}

/** world position/yaw where a player stands in front of a door on `wall` at `offset` (looking into the room) */
export function spawnAt(wall: Wall, offset: number, w: number, d: number, inset = 1.35) {
  switch (wall) {
    case 'N': return { x: offset, z: -d / 2 + inset, yaw: Math.PI };
    case 'S': return { x: offset, z: d / 2 - inset, yaw: 0 };
    case 'E': return { x: w / 2 - inset, z: offset, yaw: Math.PI / 2 };
    case 'W': return { x: -w / 2 + inset, z: offset, yaw: -Math.PI / 2 };
  }
}

function scaleUV(geo: THREE.BufferGeometry, scale: number) {
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * scale, uv.getY(i) * scale);
  uv.needsUpdate = true;
}

/** Extruded wall with rectangular holes; UVs are in metres / tileMeters(material). */
export function buildWall(len: number, h: number, holes: Hole[], mat: MaterialName, plaster?: MaterialName): THREE.Group {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-len / 2, 0);
  shape.lineTo(len / 2, 0);
  shape.lineTo(len / 2, h);
  shape.lineTo(-len / 2, h);
  shape.closePath();
  for (const ho of holes) {
    const x0 = ho.u - ho.w / 2, x1 = ho.u + ho.w / 2;
    if (ho.arch) {
      const pts = archShape(ho.w, ho.v1 - ho.v0, archRise(ho.w, ho.v1 - ho.v0)).getPoints(10).map((q) => new THREE.Vector2(q.x + ho.u, q.y + ho.v0));
      shape.holes.push(new THREE.Path(pts));
    } else {
      const p = new THREE.Path();
      p.moveTo(x0, ho.v0);
      p.lineTo(x0, ho.v1);
      p.lineTo(x1, ho.v1);
      p.lineTo(x1, ho.v0);
      p.closePath();
      shape.holes.push(p);
    }
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: WALL_THICK, bevelEnabled: false });
  scaleUV(geo, 1 / tileMeters(mat));
  const mesh = new THREE.Mesh(geo, [getMaterial(mat), getMaterial(plaster ?? mat)]);
  // interior face at z=0 of the frame, thickness outward (-z)
  mesh.position.z = -WALL_THICK;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return g;
}

export function boxMesh(w: number, h: number, d: number, mat: MaterialName, uvScale = true): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  if (uvScale) scaleUVBox(geo, w, h, d, tileMeters(mat));
  const m = new THREE.Mesh(geo, getMaterial(mat));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** metric UVs for box faces (order: +x, -x, +y, -y, +z, -z) */
export function scaleUVBox(geo: THREE.BoxGeometry, w: number, h: number, d: number, tile: number) {
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i;
      uv.setXY(idx, (uv.getX(idx) * dims[f][0]) / tile, (uv.getY(idx) * dims[f][1]) / tile);
    }
  }
  uv.needsUpdate = true;
}

export function planeMesh(w: number, d: number, mat: MaterialName, rotX: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, d);
  const t = tileMeters(mat);
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / t, (uv.getY(i) * d) / t);
  const m = new THREE.Mesh(geo, getMaterial(mat));
  m.rotation.x = rotX;
  m.receiveShadow = true;
  return m;
}
