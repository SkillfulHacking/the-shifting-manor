# The Shifting Manor

A first-person supernatural puzzle game for the browser. It is Halloween night, the storm is loud, and the house you have just entered does not keep its doors. Rooms are nodes, doors are edges, and the graph is rewritten as the night goes on. Learn the rules of the house, then build a route to the attic before midnight.

Built with **Three.js**, **TypeScript** and **Vite**. There are no image, model or audio files: every texture, prop, sound and note of music is generated procedurally at runtime.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production bundle in dist/
npm run preview    # serve the production build
npm test           # unit tests + puzzle solver checks
```

Add `?debug` to the URL (or press **F3**) for the developer overlay: current room, door under the cursor and where it leads, clock state, puzzle flags, player coordinates and FPS. `?q=low|medium|high` forces a graphics quality.

## Controls

| Key | Action |
| --- | --- |
| W A S D | walk (Shift to walk faster) |
| Mouse | look |
| E | open doors, light or snuff candles, read, use |
| F or right mouse | raise the Seer's Glass (once you have found it) |
| Q | begin / end an echo of yourself (once the dead have granted it) |
| Tab | journal: what you have learned about the house |
| Esc | pause |

Settings (mouse sensitivity, FOV, volumes, graphics quality, head bob, invert Y) are in the title and pause menus. Progress is saved automatically in the browser (`localStorage`).

## The rules of the house

1. **Stable doors** always lead to the same place, but not necessarily back where you came from.
2. **Restless doors** hang a row of lanterns over the lintel. The lit lantern shows which of the door's destinations is live.
3. Whenever you pass through a restless door **the house shifts**: every restless door turns one lantern.
4. A **candle** lit beside a restless door holds it still while the rest of the house turns. Snuff it to release the door.
5. **Mirrors tell the truth.** The Seer's Glass shows the sigil of every place a restless door will lead. Every room carries its own sigil.
6. The **grandfather clock** rewrites the house each time it moves: new destinations, every flame snuffed.
7. The **dead can be asked to stand in for you.** An echo of yourself holds a pressure plate even while you are somewhere else.

## Architecture

```
src/
  game/      pure logic (no THREE/DOM): GameState (routing, candles, clock, flags, saves), BFS solver, echo, Game (loop)
  data/      the manor as data: rooms, doors, objects, per-phase lantern cycles, story text
  world/     RoomView (builds a room from a ThemeSpec), walls, per-room themes/decor, weather, hand mirror, props/
  player/    first-person controller with circle-vs-AABB collision and walkable steps
  rendering/ procedural materials (tex/), post-processing stack
  audio/     procedural Web Audio: rain, thunder, footsteps, chimes, candles, generative music
  ui/        DOM menus, HUD, notes, journal, ending
tests/       vitest: graph consistency, shifting rules, candles, clock, saves, plates, win condition, solver over every phase
scripts/     tune2.ts (puzzle search), plan.ts, screenshot + full-playthrough Playwright drivers
```

The mansion is a directed graph: a door's destination is *another door* (the player emerges from it), so a door can lead anywhere and going back through the door you arrived by does not have to return you. `src/data/cycles.ts` holds each restless door's lantern cycle per clock phase. `src/game/solver.ts` breadth-first searches the complete state space of every phase (room, lantern positions, lit candles, echo) to prove each act is solvable and can never soft-lock; `tests/state.test.ts` runs it in CI.

## Credits and licences

See `ASSETS.md`. No third-party assets are used.
