import * as THREE from 'three';
import * as P from './props';

/** A gaunter, paler, less cartoonish take on the spectral figure (used for the echo, the lord's shade and Ismene). */
export function spectre(scale = 1, tone: 'pale' | 'cold' = 'pale'): THREE.Group {
  const g = P.ghost();
  const mats: THREE.ShaderMaterial[] = g.userData.materials ?? [];
  const cols = tone === 'pale' ? [0xcfe0ea, 0x8fa6c0] : [0x9fd6e8, 0x6f8fd0];
  mats.forEach((m, i) => {
    m.uniforms.uColor.value.setHex(cols[i] ?? cols[0]);
    m.uniforms.uCore.value.setHex(0xeef6ff);
    m.uniforms.uOpacity.value *= 0.7;
  });
  g.scale.set(0.72 * scale, 1.14 * scale, 0.72 * scale);
  g.children.forEach((c) => { const m = c as THREE.Mesh; if (m.isMesh && m.material instanceof THREE.MeshBasicMaterial) m.visible = false; }); // faceless
  g.children.forEach((c) => { if ((c as THREE.Mesh).isMesh && !(c as THREE.Mesh).userData.noShadow) { const m = c as THREE.Mesh; if ((m.geometry as THREE.SphereGeometry).parameters?.radius === 0.035) m.visible = false; } });
  return g;
}
