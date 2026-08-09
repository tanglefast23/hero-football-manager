import { readFileSync } from 'fs';
import { join } from 'path';
import { seasonEndViewModel } from '../../../../application/view-models';
import { loadLaunchContent } from '../../../../content/load';
import { leagueStandings } from '../../../../game/career';
import { currentUserDivision } from '../../../../game/m2-career';
import {
  divisionAfterFinish,
  type DivisionLevel,
} from '../../../../game/pyramid';
import { devHarnessCareerAtSeasonEnd } from '../../career';

const ENTRY = join(
  process.cwd(),
  'src/ui/dev-harness/entries/promotion-transition.tsx',
);

/**
 * `promotion-transition.tsx` imports react-native and Jest runs with
 * `testEnvironment: 'node'`, where that throws — so the entry itself cannot be
 * imported here. What CAN be checked is the only thing about it that can go
 * quietly wrong: the five seasons it points at are measured against a seeded
 * career, and nothing in the career engine promises to keep a club finishing
 * where it finished. A tuning change that moves those finishes would silently
 * retarget every chip in the entry, and the reel would still render.
 *
 * So the seasons are read back out of the source and re-run.
 */
const source = readFileSync(ENTRY, 'utf8');

function seedFromSource(): number {
  const match = /const LADDER_SEED = (\d+);/.exec(source);
  if (match === null)
    throw new Error('promotion-transition.tsx no longer declares LADDER_SEED');
  return Number(match[1]);
}

function seasonsFromSource(): Map<string, number> {
  const seasons = new Map<string, number>();
  for (const match of source.matchAll(
    /id: '([a-z-]+)',[\s\S]*?season: (\d+),/g,
  )) {
    seasons.set(match[1], Number(match[2]));
  }
  return seasons;
}

/** What each chip claims about the club's season, in the screen's own words. */
const EXPECTED: Readonly<
  Record<string, { outcome: string; division: DivisionLevel; position: number }>
> = {
  'first-up': { outcome: 'PROMOTED', division: 5, position: 1 },
  promoted: { outcome: 'PROMOTED', division: 4, position: 2 },
  safe: { outcome: 'SAFE', division: 3, position: 7 },
  relegated: { outcome: 'RELEGATED', division: 2, position: 10 },
  champions: { outcome: 'CHAMPIONS', division: 1, position: 1 },
};

describe('the promotion and relegation reel', () => {
  const seed = seedFromSource();
  const seasons = seasonsFromSource();
  const content = loadLaunchContent();

  it('points at five cases and no more', () => {
    expect([...seasons.keys()]).toEqual(Object.keys(EXPECTED));
  });

  it.each(Object.keys(EXPECTED))(
    'opens %s on the season it claims',
    (caseId) => {
      const season = seasons.get(caseId)!;
      const state = devHarnessCareerAtSeasonEnd(season, seed);
      const expected = EXPECTED[caseId];
      const division: DivisionLevel =
        state.m2 === undefined ? 5 : currentUserDivision(state.m2);
      const position = leagueStandings(state).find(
        (row) => row.clubId === state.userClubId,
      )!.position;

      expect(division).toBe(expected.division);
      expect(position).toBe(expected.position);
      expect(seasonEndViewModel(state, content, 1).outcomeLabel).toBe(
        expected.outcome,
      );
    },
  );

  /**
   * The review screen re-derives promotion and relegation from the position
   * rather than calling `divisionAfterFinish`. They must agree, because the
   * reel prints both side by side and a reviewer would read the disagreement
   * as a bug in the pyramid rather than a second copy of it.
   */
  it.each(Object.keys(EXPECTED))(
    'agrees with the pyramid rule on %s',
    (caseId) => {
      const expected = EXPECTED[caseId];
      const next = divisionAfterFinish(expected.division, expected.position);

      if (expected.outcome === 'PROMOTED')
        expect(next).toBe(expected.division - 1);
      else if (expected.outcome === 'RELEGATED')
        expect(next).toBe(expected.division + 1);
      else expect(next).toBe(expected.division);
    },
  );

  /**
   * `cases` is read while the module is still evaluating, so anything it reads
   * has to be initialised before it. A `const` below the entry is still in its
   * temporal dead zone there, and the only symptom is a blank bundle.
   */
  it('declares its cases above the entry that reads them', () => {
    expect(source.indexOf('const PROMOTION_CASES')).toBeLessThan(
      source.indexOf('export const promotionTransitionEntry'),
    );
  });

  /** The harness adds no audio: the management SFX table is index-addressed. */
  it('plays no sound of its own', () => {
    expect(source).not.toContain('SfxPressable');
    expect(source).not.toContain('playManagement');
  });
});
