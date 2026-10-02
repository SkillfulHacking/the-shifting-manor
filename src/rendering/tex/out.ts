import type { RGB } from './core';

/** Working buffers a surface generator fills. col = RGBA8, h = height 0..1, r = roughness 0..1, m = optional metalness 0..1. */
export interface Out {
  n: number;
  col: Uint8ClampedArray;
  h: Float32Array;
  r: Float32Array;
  m: Float32Array | null;
}

export function newOut(n: number, metal = false): Out {
  const o: Out = { n, col: new Uint8ClampedArray(n * n * 4), h: new Float32Array(n * n).fill(0.5), r: new Float32Array(n * n).fill(0.8), m: metal ? new Float32Array(n * n).fill(1) : null };
  return o;
}

export function setc(o: Out, i: number, r: number, g: number, b: number): void {
  const j = i * 4;
  o.col[j] = r; o.col[j + 1] = g; o.col[j + 2] = b; o.col[j + 3] = 255;
}

export function setRGB(o: Out, i: number, c: RGB, k = 1): void {
  setc(o, i, c[0] * k, c[1] * k, c[2] * k);
}

export interface Spec {
  size: number;
  tile: number;
  normal: number;      // normal-map strength
  metal: number;       // constant metalness (or scale when a metal map exists)
  gen: (o: Out) => void;
  glass?: boolean;
}
