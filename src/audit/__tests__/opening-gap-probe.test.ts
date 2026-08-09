/**
 * OPT-IN BALANCE PROBE:
 *   OPENING_GAP_PROBE=1 npm run test:probe -- \
 *     src/audit/__tests__/opening-gap-probe.test.ts
 *
 * Sizes the Division 5 opening gap. The ramp probe proved nobody escapes D5 in
 * three seasons; this reports HOW far behind the starting squad is, per club and
 * per outfield attribute, so the fix can be aimed rather than guessed.
 */
import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import {
  addCreatedPlayer,
  beginStoryOnboarding,
  buildCareerMatchTeams,
  createCareer,
} from '../../game';
import type { GameState } from '../../game';
import type { Attrs, TeamDef } from '../../sim/types';

const describeProbe =
  process.env.OPENING_GAP_PROBE === '1' ? describe : describe.skip;
const content = loadLaunchContent();
const KEYS: Array<keyof Attrs> = [
  'pac',
  'sho',
  'pas',
  'def',
  'tec',
  'sta',
  'ref',
];

function career(seed: number): GameState {
  return addCreatedPlayer(
    beginStoryOnboarding(
      createCareer(createLaunchCareerSetup(seed, undefined, content, 'COZY')),
    ),
    {
      name: 'Ramp Probe',
      ratings: { pac: 55, sho: 60, pas: 50, def: 50, tec: 50, sta: 50 },
    },
  );
}

/** Mean of every outfield attribute across the eleven strongest players. */
function teamMean(team: TeamDef): number {
  const perPlayer = team.players.map(
    (p) => KEYS.reduce((sum, k) => sum + p.attrs[k], 0) / KEYS.length,
  );
  return perPlayer.reduce((a, b) => a + b, 0) / perPlayer.length;
}

function attrMeans(team: TeamDef): Record<string, number> {
  return Object.fromEntries(
    KEYS.map((k) => [
      k,
      team.players.reduce((sum, p) => sum + p.attrs[k], 0) /
        team.players.length,
    ]),
  );
}

describeProbe('opening gap', () => {
  it('reports the user squad against its own Division 5 field', () => {
    const lines = [
      '',
      '=== D5 OPENING GAP (user vs the nine clubs it must beat) ===',
    ];
    for (const seed of [4_000_000, 20_260_725, 991_237]) {
      const state = career(seed);
      const division = state.m2?.pyramid.divisions.find((d) =>
        d.clubs.some((c) => c.id === state.userClubId),
      );
      if (division === undefined) throw new Error('no user division');
      const ids = division.clubs.map((c) => c.id);
      const teams = buildCareerMatchTeams(state, ids);
      const userMean = teamMean(teams[state.userClubId]);
      const rivals = ids
        .filter((id) => id !== state.userClubId)
        .map((id) => teamMean(teams[id]));
      const fieldMean = rivals.reduce((a, b) => a + b, 0) / rivals.length;

      lines.push(
        '',
        `seed ${seed}: user ${userMean.toFixed(2)}` +
          ` | field mean ${fieldMean.toFixed(2)}` +
          ` | weakest rival ${Math.min(...rivals).toFixed(2)}` +
          ` | strongest ${Math.max(...rivals).toFixed(2)}` +
          ` | GAP ${(fieldMean - userMean).toFixed(2)}`,
      );
      lines.push(
        `  2nd-weakest rival (the promotion bar) ${rivals
          .slice()
          .sort((a, b) => a - b)[1]
          .toFixed(2)}`,
      );

      const userAttrs = attrMeans(teams[state.userClubId]);
      const fieldAttrs = KEYS.map((k) => {
        const vals = ids
          .filter((id) => id !== state.userClubId)
          .map((id) => attrMeans(teams[id])[k]);
        return [k, vals.reduce((a, b) => a + b, 0) / vals.length] as const;
      });
      lines.push(
        '  per attribute (user / field / gap): ' +
          fieldAttrs
            .map(
              ([k, v]) =>
                `${k} ${userAttrs[k].toFixed(1)}/${v.toFixed(1)}/${(v - userAttrs[k]).toFixed(1)}`,
            )
            .join('  '),
      );
      const rivalTeams = ids
        .filter((id) => id !== state.userClubId)
        .map((id) => teams[id]);
      lines.push(
        `  keeper REF user ${userTeamKeeperRef(teams[state.userClubId])}` +
          ` / field ${mean(rivalTeams.map(userTeamKeeperRef)).toFixed(1)}` +
          ` | max SHO user ${maxShooting(teams[state.userClubId])}` +
          ` / field ${mean(rivalTeams.map(maxShooting)).toFixed(1)}`,
      );
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(KEYS.length).toBe(7);
  }, 600_000);
});

function userTeamKeeperRef(team: TeamDef): number {
  const keeper = team.players.find((player) => player.role === 'GK');
  if (keeper === undefined)
    throw new Error(`team ${team.id} has no goalkeeper`);
  return keeper.attrs.ref;
}

function maxShooting(team: TeamDef): number {
  return Math.max(
    ...team.players
      .filter((player) => player.role !== 'GK')
      .map((player) => player.attrs.sho),
  );
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
