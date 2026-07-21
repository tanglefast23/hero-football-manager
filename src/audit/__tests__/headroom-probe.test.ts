/** SCRATCH: reports how much training headroom exists per player, per division. */
import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import {
  addCreatedPlayer,
  beginStoryOnboarding,
  createCareer,
  playerAttributeCaps,
  potentialTierForDivision,
  projectedPlayerOverall,
  roleOverall,
} from '../../game';

const content = loadLaunchContent();

describe('training headroom', () => {
  it('reports launch-roster headroom and the division potential curve', () => {
    const state = addCreatedPlayer(
      beginStoryOnboarding(createCareer(createLaunchCareerSetup(
        4_000_000, undefined, content, 'full', 'COZY',
      ))),
      { name: 'Probe Rookie', ratings: { pac: 55, sho: 60, pas: 50, def: 50, tec: 50, sta: 50 } },
    );

    const lines: string[] = ['', '=== YOUR STARTING ROSTER (D5) ==='];
    lines.push('player                role  arch          now  ceiling  headroom  pacNow/pacCap');
    for (const player of state.players.filter(p => p.clubId === state.userClubId)) {
      const caps = playerAttributeCaps(player);
      const now = roleOverall(player.role, player.attrs);
      const ceiling = projectedPlayerOverall(player);
      lines.push(
        `${player.name.padEnd(22)}${player.role.padEnd(6)}`
        + `${(player.archetype ?? '-').padEnd(14)}${String(now).padEnd(5)}`
        + `${String(ceiling).padEnd(9)}${String(ceiling - now).padEnd(10)}`
        + `${player.attrs.pac}/${caps.pac}`,
      );
    }

    lines.push('', '=== POTENTIAL TIER MIX BY DIVISION (1000 rolls) ===');
    lines.push('div   tier1(46-57) tier2(58-69) tier3(70-81) tier4(82-93) tier5(94-99)');
    for (const division of [5, 4, 3, 2, 1]) {
      const counts = [0, 0, 0, 0, 0];
      for (let roll = 0; roll < 100; roll += 1) {
        counts[potentialTierForDivision(division, roll) - 1] += 1;
      }
      lines.push(`D${division}    ${counts.map(c => `${c}%`.padEnd(13)).join('')}`);
    }

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(state.players.length).toBeGreaterThan(0);
  });
});
