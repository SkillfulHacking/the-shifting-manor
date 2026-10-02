import { writeFileSync } from 'node:fs';
import { solve } from '../src/game/solver';
import { PHASE_SPECS } from '../src/data/phases';
const out: Record<number, string[]> = {};
for (const s of PHASE_SPECS) {
  const sol = solve(s)!;
  out[s.phase] = sol.steps;
  console.log(`phase ${s.phase}: ${sol.steps.length} steps, ${sol.states} states, deadend-free ${sol.noDeadEnds}`);
}
writeFileSync('scripts/plan.json', JSON.stringify(out, null, 1));
