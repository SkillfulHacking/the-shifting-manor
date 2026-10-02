// Procedural texture / material library. Everything is generated on <canvas> at runtime, lazily on first request.
import * as THREE from 'three';
import { RGB, normalCanvas, grayCanvas, makeCanvas } from './tex/core';
import { Out, Spec, newOut } from './tex/out';
import { genWood, genParquet, genPanelling } from './tex/wood';
import { genBlocks, genFlagstone, BlockP } from './tex/masonry';
import { genWallpaper, genPlaster, genRug, genVelvet, genLeather, genMarble } from './tex/decor';
import { genBrushedMetal, genIron, genDirt, genPumpkin, genGlass, genPaper, genWax, genBone, genMoss } from './tex/misc';
import { drawSigil, SigilName as SN } from './tex/sigils';
import { drawPainting } from './tex/painting';

export type MaterialName =
  | 'darkWood' | 'floorboards' | 'parquet' | 'stoneWall' | 'stoneFloor' | 'flagstone'
  | 'wallpaperRed' | 'wallpaperGreen' | 'wallpaperBlue' | 'plaster' | 'panelling'
  | 'brass' | 'ironBlack' | 'velvetRed' | 'velvetGreen' | 'marble' | 'bricks'
  | 'leather' | 'ceilingBeam' | 'ceilingPlaster' | 'rugRed' | 'rugBlue' | 'dirt'
  | 'pumpkinSkin' | 'glassDark' | 'paper' | 'candleWax' | 'bone' | 'moss' | 'copper' | 'silver';

const ROUGH_STONE: RGB[] = [[66, 58, 48], [124, 112, 94], [170, 154, 130]];
const OAK_DARK: RGB[] = [[40, 24, 14], [88, 55, 32], [138, 92, 56]];
const OAK_MID: RGB[] = [[52, 32, 18], [108, 70, 40], [160, 112, 68]];
const BEAM: RGB[] = [[30, 20, 14], [64, 44, 30], [104, 76, 52]];

const blocks = (p: Partial<BlockP> & { seed: number }): BlockP => ({
  rows: 6, perRow: 4, hVar: 0.3, wVar: 0.4, stagger: false, ramp: ROUGH_STONE, mortar: [128, 120, 106], mortarW: 4,
  round: 8, bulge: 0.5, rough: 0.4, toneVar: 0.5, cracks: 0, ...p,
});

const SPECS: Record<MaterialName, Spec> = {
  darkWood: { size: 512, tile: 1, normal: 3, metal: 0, gen: o => genWood(o, { rows: 5, joints: 0, ramp: OAK_DARK, gap: 1.5, knots: 3, ringF: 4, rough: 0.55, seed: 11, cracks: 1 }) },
  floorboards: { size: 512, tile: 2, normal: 3, metal: 0, gen: o => genWood(o, { rows: 13, joints: 2, ramp: OAK_MID, gap: 2, knots: 10, ringF: 3.5, rough: 0.65, seed: 21, cracks: 2 }) },
  parquet: { size: 512, tile: 1, normal: 2.5, metal: 0, gen: o => genParquet(o, 31) },
  stoneWall: { size: 512, tile: 2, normal: 5, metal: 0, gen: o => genBlocks(o, blocks({ seed: 41, rows: 7, perRow: 4, hVar: 0.3, wVar: 0.5, round: 10, bulge: 0.6, rough: 0.55, mortarW: 4, cracks: 2, soot: 0.5, pitted: true })) },
  stoneFloor: { size: 512, tile: 2, normal: 3.5, metal: 0, gen: o => genBlocks(o, blocks({ seed: 51, rows: 4, perRow: 3, hVar: 0.08, wVar: 0.25, stagger: true, ramp: [[46, 46, 44], [88, 86, 80], [124, 118, 106]], mortar: [58, 54, 48], mortarW: 4, round: 6, bulge: 0.08, rough: 0.3, cracks: 3, soot: 0.3 })) },
  flagstone: { size: 512, tile: 2, normal: 4, metal: 0, gen: o => genFlagstone(o, 61) },
  wallpaperRed: { size: 512, tile: 1.5, normal: 2, metal: 0, gen: o => genWallpaper(o, [104, 30, 34], [150, 68, 60], 71) },
  wallpaperGreen: { size: 512, tile: 1.5, normal: 2, metal: 0, gen: o => genWallpaper(o, [52, 70, 50], [90, 112, 76], 72) },
  wallpaperBlue: { size: 512, tile: 1.5, normal: 2, metal: 0, gen: o => genWallpaper(o, [44, 58, 84], [84, 100, 130], 73) },
  plaster: { size: 512, tile: 2, normal: 2, metal: 0, gen: o => genPlaster(o, [172, 160, 138], 81, 2, 0.6) },
  panelling: { size: 512, tile: 1.2, normal: 4, metal: 0, gen: o => genPanelling(o, 91) },
  brass: { size: 512, tile: 0.5, normal: 1.5, metal: 0.9, gen: o => genBrushedMetal(o, [172, 140, 76], [96, 74, 36], [66, 50, 30], 101, 0.6, 0.4) },
  ironBlack: { size: 512, tile: 0.5, normal: 3, metal: 0.8, gen: o => genIron(o, 111) },
  velvetRed: { size: 512, tile: 1, normal: 1.5, metal: 0, gen: o => genVelvet(o, [58, 8, 18], [122, 26, 36], [178, 74, 68], 121) },
  velvetGreen: { size: 512, tile: 1, normal: 1.5, metal: 0, gen: o => genVelvet(o, [10, 40, 28], [30, 82, 56], [80, 140, 102], 122) },
  marble: { size: 512, tile: 2, normal: 0.8, metal: 0, gen: o => genMarble(o, [208, 202, 190], [70, 68, 72], 131) },
  bricks: { size: 512, tile: 1, normal: 4, metal: 0, gen: o => genBlocks(o, blocks({ seed: 141, rows: 12, perRow: 4, hVar: 0, wVar: 0.03, stagger: true, ramp: [[86, 36, 28], [144, 66, 46], [178, 96, 66]], mortar: [150, 140, 122], mortarW: 4, round: 5, bulge: 0.15, rough: 0.35, toneVar: 0.8, soot: 0.5 })) },
  leather: { size: 512, tile: 0.5, normal: 3, metal: 0, gen: o => genLeather(o, 151) },
  ceilingBeam: { size: 512, tile: 1.5, normal: 4, metal: 0, gen: o => genWood(o, { rows: 2, joints: 0, ramp: BEAM, gap: 0, knots: 4, ringF: 5, rough: 0.85, seed: 161, cracks: 5, toneVar: 0.15 }) },
  ceilingPlaster: { size: 512, tile: 2, normal: 1.6, metal: 0, gen: o => genPlaster(o, [178, 168, 148], 171, 1, 0.8) },
  rugRed: { size: 512, tile: 3, normal: 2.5, metal: 0, gen: o => genRug(o, { field: [104, 26, 30], field2: [86, 20, 26], dark: [26, 22, 34], cream: [200, 180, 138], accent: [36, 44, 78], gold: [176, 134, 62] }, 181) },
  rugBlue: { size: 512, tile: 3, normal: 2.5, metal: 0, gen: o => genRug(o, { field: [38, 52, 92], field2: [30, 42, 78], dark: [22, 20, 28], cream: [198, 182, 144], accent: [112, 34, 36], gold: [172, 132, 62] }, 182) },
  dirt: { size: 512, tile: 2, normal: 4, metal: 0, gen: o => genDirt(o, 191) },
  pumpkinSkin: { size: 512, tile: 1, normal: 3, metal: 0, gen: o => genPumpkin(o, 201) },
  glassDark: { size: 512, tile: 1, normal: 1, metal: 0, glass: true, gen: o => genGlass(o, 211) },
  paper: { size: 512, tile: 0.5, normal: 1.5, metal: 0, gen: o => genPaper(o, 221) },
  candleWax: { size: 512, tile: 0.3, normal: 1.5, metal: 0, gen: o => genWax(o, 231) },
  bone: { size: 512, tile: 0.5, normal: 2, metal: 0, gen: o => genBone(o, 241) },
  moss: { size: 512, tile: 1, normal: 5, metal: 0, gen: o => genMoss(o, 251) },
  copper: { size: 512, tile: 0.5, normal: 1.5, metal: 0.85, gen: o => genBrushedMetal(o, [164, 98, 68], [96, 54, 34], [66, 42, 30], 261, 0.6, 0.42, 0.8) },
  silver: { size: 512, tile: 0.5, normal: 1.5, metal: 0.9, gen: o => genBrushedMetal(o, [196, 196, 198], [130, 130, 134], [84, 80, 74], 271, 0.5, 0.32) },
};

/** Tile size in metres for a material's texture (world-space UV scale used by the room builder). */
export function tileMeters(name: MaterialName): number { return SPECS[name].tile; }

function tex(cv: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const matCache = new Map<MaterialName, THREE.MeshStandardMaterial>();

/** Cached shared MeshStandardMaterial with map / normalMap / roughnessMap as appropriate. */
export function getMaterial(name: MaterialName): THREE.MeshStandardMaterial {
  const hit = matCache.get(name);
  if (hit) return hit;
  const spec = SPECS[name];
  const n = spec.size;
  const hasMetal = spec.metal > 0;
  const o: Out = newOut(n, hasMetal);
  spec.gen(o);
  const colCv = makeCanvas(n, n);
  const cctx = colCv.getContext('2d')!;
  const id = cctx.createImageData(n, n);
  id.data.set(o.col);
  cctx.putImageData(id, 0, 0);
  const m = new THREE.MeshStandardMaterial({
    map: tex(colCv, true),
    normalMap: tex(normalCanvas(o.h, n, spec.normal), false),
    roughnessMap: tex(grayCanvas(o.r, n), false),
    roughness: 1,
    metalness: hasMetal ? spec.metal : 0,
  });
  if (o.m) m.metalnessMap = tex(grayCanvas(o.m, n), false);
  m.normalScale.set(0.6, 0.6);
  if (spec.glass) { m.transparent = true; m.opacity = 0.62; m.depthWrite = false; m.envMapIntensity = 1.5; }
  m.name = name;
  matCache.set(name, m);
  return m;
}

export type SigilName = SN;
export const SIGILS: SigilName[] = ['moon', 'chalice', 'flame', 'raven', 'eye', 'rose', 'spider', 'skull', 'bell', 'crown', 'star', 'key'];

const sigilCache = new Map<string, THREE.CanvasTexture>();

/** Square canvas texture of a glyph on transparent background, drawn in `color`. */
export function sigilTexture(name: SigilName, color = '#e8d9a8', size = 256): THREE.CanvasTexture {
  const key = `${name}|${color}|${size}`;
  const hit = sigilCache.get(key);
  if (hit) return hit;
  const t = new THREE.CanvasTexture(drawSigil(name, color, size));
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  sigilCache.set(key, t);
  return t;
}

/** Generic helper: draw on a fresh canvas and wrap it in a CanvasTexture. */
export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true): THREE.CanvasTexture {
  const cv = makeCanvas(w, h);
  draw(cv.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Old-master style painting (6 distinct looks by seed): portraits, moonlit landscape, ruin, still life. */
export function paintingTexture(seed: number, w = 512, h = 640): THREE.CanvasTexture {
  return canvasTexture(w, h, (c, cw, ch) => drawPainting(c, cw, ch, seed));
}
