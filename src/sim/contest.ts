import type { Rng } from './rng';
import table from './contest-table.json';
import { clamp } from './geometry';

/** P(attacker beats defender), from the committed integer table — no Math.exp at runtime. */
export function contestProbability(attacker: number, defender: number, mod = 0): number {
  const d = clamp(Math.round(attacker + mod - defender), -99, 99);
  return table[d + 99] / 65536;
}

export function contest(rng: Rng, attacker: number, defender: number, mod = 0): boolean {
  return rng() < contestProbability(attacker, defender, mod);
}
