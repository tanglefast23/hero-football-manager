/**
 * OPT-IN ARTIFACT PROBE:
 *   DIVISION_GK_PROBE=1 DIVISION_GK_OUTPUT=/tmp/gk.json npm run test:probe -- \
 *     src/audit/__tests__/division-gk-balance-probe.test.ts
 *
 * Measures peer-club goals and saves in every generated division. Powers are
 * omitted so the result isolates the explicit SHO/REF ladder.
 */
import { writeFileSync } from 'node:fs';

import artifact from '../fixtures/division-goalkeeper-gate.json';
import { generateLeaguePyramid } from '../../game/pyramid';
import { runMatch } from '../../sim/match';
import type { PlayerDef, TeamDef } from '../../sim/types';

const describeProbe =
  process.env.DIVISION_GK_PROBE === '1' ? describe : describe.skip;
const OUTPUT = process.env.DIVISION_GK_OUTPUT;
const MATCHES_PER_DIVISION = artifact.matchesPerDivision;

interface BalanceSample {
  readonly goals: number;
  readonly saves: number;
}

describeProbe('division goalkeeper balance artifact probe', () => {
  it('exports paired peer-club goals and saves for all five divisions', () => {
    if (OUTPUT === undefined) throw new Error('DIVISION_GK_OUTPUT is required');
    const pyramid = generateLeaguePyramid(artifact.rosterSeed);
    const divisions: Record<string, BalanceSample[]> = {};
    const aggregates: Record<
      string,
      {
        goals: number;
        saves: number;
        goalsPerMatch: number;
        saveRate: number;
      }
    > = {};

    for (const division of pyramid.divisions) {
      const peers = division.clubs
        .slice()
        .sort(
          (left, right) =>
            left.squadStrength - right.squadStrength ||
            left.id.localeCompare(right.id),
        )
        .slice(4, 6)
        .map((club) => team(club.id, club.name, club.squad));
      const samples = Array.from(
        { length: MATCHES_PER_DIVISION },
        (_, index) => {
          const swap = index % 2 === 1;
          const result = runMatch(
            division.level * 10_000_000 + index * artifact.matchSeedStride,
            swap ? peers[1] : peers[0],
            swap ? peers[0] : peers[1],
            [],
            { homePolicy: 'FIRE_WHEN_READY', awayPolicy: 'FIRE_WHEN_READY' },
          );
          return {
            goals: result.score[0] + result.score[1],
            saves: result.events.filter((event) => event.kind === 'SAVE')
              .length,
          };
        },
      );
      divisions[String(division.level)] = samples;
      const goals = samples.reduce((total, sample) => total + sample.goals, 0);
      const saves = samples.reduce((total, sample) => total + sample.saves, 0);
      aggregates[String(division.level)] = {
        goals,
        saves,
        goalsPerMatch: goals / samples.length,
        saveRate: saves / (saves + goals),
      };
    }

    writeFileSync(
      OUTPUT,
      `${JSON.stringify(
        {
          version: 1,
          matchesPerDivision: MATCHES_PER_DIVISION,
          divisions,
        },
        null,
        2,
      )}\n`,
    );
    expect(
      Object.values(divisions).every(
        (samples) => samples.length === MATCHES_PER_DIVISION,
      ),
    ).toBe(true);
    expect(aggregates).toEqual(artifact.divisions);
  }, 900_000);
});

function team(id: string, name: string, squad: readonly PlayerDef[]): TeamDef {
  const take = (role: PlayerDef['role'], count: number) =>
    squad.filter((player) => player.role === role).slice(0, count);
  return {
    id,
    name,
    players: [
      ...take('GK', 1),
      ...take('DEF', 4),
      ...take('MID', 4),
      ...take('FWD', 2),
    ].map((player) => ({
      id: player.id,
      name: player.name,
      role: player.role,
      attrs: { ...player.attrs },
    })),
  };
}
