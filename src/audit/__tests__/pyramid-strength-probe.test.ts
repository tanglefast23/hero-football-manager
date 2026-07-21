/** SCRATCH: reports real generated squad strength per division vs the launch league. */
import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import {
  addCreatedPlayer,
  beginStoryOnboarding,
  buildCareerMatchTeamDef,
  createCareer,
} from '../../game';

const content = loadLaunchContent();

const KEYS = ['pac', 'sho', 'pas', 'def', 'tec', 'sta'] as const;

describe('pyramid strength', () => {
  it('reports division strength as the match engine sees it', () => {
    const state = addCreatedPlayer(
      beginStoryOnboarding(createCareer(createLaunchCareerSetup(
        4_000_000, undefined, content, 'full', 'COZY',
      ))),
      { name: 'Probe Rookie', ratings: { pac: 55, sho: 60, pas: 50, def: 50, tec: 50, sta: 50 } },
    );

    const lines = ['', '=== STARTING XI STRENGTH AS THE ENGINE SEES IT ==='];
    const you = strengthOf(state.userClubId);
    lines.push(`YOU (${state.userClubId}): ${you}`);

    const launch = content.clubs.clubs
      .filter(club => club.id !== state.userClubId)
      .map(club => strengthOf(club.id));
    lines.push(
      `Your season-1 league (9 launch clubs): `
      + `${Math.min(...launch)} - ${Math.max(...launch)}, avg ${mean(launch)}`,
    );

    lines.push('', 'generated pyramid clubs (what you meet after promotion / in the cup):');
    for (const division of state.m2!.pyramid.divisions) {
      const values = division.clubs
        .filter(club => club.id !== state.userClubId)
        .map(club => strengthOf(club.id));
      lines.push(
        `  D${division.level}: ${Math.min(...values)} - ${Math.max(...values)}`
        + `  avg ${mean(values)}   (gap vs you: ${round(mean(values) - you)})`,
      );
    }

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));

    function strengthOf(clubId: string): number {
      const team = buildCareerMatchTeamDef(state, clubId);
      const total = team.players.reduce(
        (sum, player) => sum + KEYS.reduce((inner, key) => inner + player.attrs[key], 0),
        0,
      );
      return round(total / (team.players.length * KEYS.length));
    }
    expect(you).toBeGreaterThan(0);
  });
});

function mean(values: readonly number[]): number {
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
function round(value: number): number {
  return Math.round(value * 10) / 10;
}
