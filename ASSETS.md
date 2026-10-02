# Assets and licences

**The Shifting Manor ships with no third-party art, audio, fonts or model files.**

| Category | Source | Licence |
| --- | --- | --- |
| All 3D models (furniture, architecture, pumpkins, ghosts, clock, stairs, ...) | Generated at runtime from Three.js primitives in `src/world/props/` | Original work, project licence |
| All textures (wood, stone, wallpaper, marble, rugs, paintings, sigils, ...) | Generated at runtime on `<canvas>` in `src/rendering/textures.ts` and `src/rendering/tex/` | Original work, project licence |
| All sound effects and music (rain, thunder, footsteps, clock chimes, candles, ambience, the generative score) | Synthesised live with the Web Audio API in `src/audio/audio.ts` | Original work, project licence |
| Fonts | System serif stack (`Palatino Linotype`, `Georgia`, ...) - nothing is bundled or downloaded | n/a |

## Third-party code

| Asset: | Author: | Source: | URL: | License: | Retrieved: | Modified: | Used in: | Attribution required: |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| three (Three.js) and `three/examples/jsm` (Reflector, EffectComposer, UnrealBloomPass, OutlinePass, RoomEnvironment) | mrdoob and contributors | npm | https://github.com/mrdoob/three.js | MIT | 2026-09-30 (npm `three@0.186.1`) | No | Rendering | Licence notice retained in `node_modules/three/LICENSE` |
| vite, vitest, typescript, tsx, playwright (dev tooling only, not shipped in the game bundle) | respective authors | npm | - | MIT / Apache-2.0 | 2026-09-30 | No | Build and test tooling | n/a |
