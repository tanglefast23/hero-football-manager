import { readFileSync } from 'fs';
import { join } from 'path';
import {
  GIANT_KILLING_CUP_UPSET_COPY,
  ONE_DIVISION_CUP_UPSET_COPY,
  THREE_DIVISION_CUP_UPSET_COPY,
  TWO_DIVISION_CUP_UPSET_COPY,
  completeCupGiantKillingCelebration,
  cupGiantKillingCelebration,
  queueCupGiantKillingCelebration,
} from '../../../../game/cup-giant-killing';
import type { NationalCupFixture } from '../../../../game/pyramid';
import type { GameState } from '../../../../game/types';
import { devHarnessCareerAtWeek } from '../../career';

const entry = readFileSync(
  join(process.cwd(), 'src/ui/dev-harness/entries/cup-giant-killing.tsx'),
  'utf8',
);

/**
 * `cup-giant-killing.tsx` imports react-native, which throws under Jest's node
 * environment. What matters underneath it is pure, and is exercised here with
 * the same career and the same helpers the entry uses: the Cup's frozen draw
 * seeding has to put the club in D5 with opponents above it, or the widest gap
 * the reel promises cannot exist at all.
 */
const SEED = 23;
const SEASON = 1;
const WEEK = 6;

function opponentInDivision(
  state: GameState,
  division: number,
): string | undefined {
  const seeds = state.m2?.nationalCups.find(
    (cup) => cup.season === SEASON,
  )?.seedDivisionByClubId;
  if (seeds === undefined) return undefined;
  return Object.keys(seeds).find(
    (clubId) => clubId !== state.userClubId && seeds[clubId] === division,
  );
}

function upsetFixture(
  state: GameState,
  opponentClubId: string,
): NationalCupFixture {
  return {
    id: `dev-harness-upset-${opponentClubId}`,
    season: SEASON,
    round: 4,
    homeClubId: state.userClubId,
    awayClubId: opponentClubId,
    matchSeed: 1,
    status: 'played',
  };
}

describe('the Cup giant-killing reel', () => {
  const state = devHarnessCareerAtWeek(SEASON, WEEK, SEED);

  it('opens on a season where the club is bottom of the pyramid', () => {
    const seeds = state.m2?.nationalCups.find(
      (cup) => cup.season === SEASON,
    )?.seedDivisionByClubId;

    expect(seeds).toBeDefined();
    expect(seeds![state.userClubId]).toBe(5);
  });

  it.each([
    [4, 1, ONE_DIVISION_CUP_UPSET_COPY.title],
    [3, 2, TWO_DIVISION_CUP_UPSET_COPY.title],
    [2, 3, THREE_DIVISION_CUP_UPSET_COPY.title],
    [1, 4, GIANT_KILLING_CUP_UPSET_COPY.title],
  ])('beats a D%i side for a gap of %i', (division, gap, title) => {
    const opponentClubId = opponentInDivision(state, division);
    expect(opponentClubId).toBeDefined();

    const celebration = cupGiantKillingCelebration(
      state,
      upsetFixture(state, opponentClubId!),
      state.userClubId,
    );

    expect(celebration?.divisionGap).toBe(gap);
    expect(celebration?.title).toBe(title);
  });

  /**
   * The walk-on is once per career, guarded by `m4:cup-giant-killing-seen`.
   * Bert says it the first time the club beats a bigger side and never again,
   * so the queue never holds more than that one celebration no matter how many
   * upsets follow.
   *
   * The dismissal still matters: it has to drop the field rather than leave an
   * empty array behind, because the app decides whether to show anything at all
   * by reading `[0]`.
   */
  it('queues the first upset only, then drops the field when it is dismissed', () => {
    let queued = state;
    for (const division of [4, 3, 1]) {
      const opponentClubId = opponentInDivision(state, division)!;
      queued = queueCupGiantKillingCelebration(
        queued,
        cupGiantKillingCelebration(
          queued,
          upsetFixture(state, opponentClubId),
          state.userClubId,
        ),
      );
    }

    expect(queued.eventFlags).toContain('m4:cup-giant-killing-seen');
    expect(
      queued.pendingCupGiantKillingCelebrations?.map(
        (item) => item.divisionGap,
      ),
    ).toEqual([1]);

    const drained = completeCupGiantKillingCelebration(queued);
    expect(drained.pendingCupGiantKillingCelebrations).toBeUndefined();

    // A later upset finds the flag already set and changes nothing at all.
    const laterOpponent = opponentInDivision(state, 1)!;
    expect(
      queueCupGiantKillingCelebration(
        drained,
        cupGiantKillingCelebration(
          drained,
          upsetFixture(state, laterOpponent),
          state.userClubId,
        ),
      ),
    ).toBe(drained);
  });

  /** A club its own size is no upset, and the celebration must not fire. */
  it('says nothing about beating an equal', () => {
    const opponentClubId = opponentInDivision(state, 5)!;

    expect(
      cupGiantKillingCelebration(
        state,
        upsetFixture(state, opponentClubId),
        state.userClubId,
      ),
    ).toBeUndefined();
  });

  /**
   * `cases` is read while the module is still evaluating, so anything it reads
   * has to be initialised before it. A `const` below the entry is still in its
   * temporal dead zone there, and the only symptom is a blank bundle.
   */
  it('declares its cases above the entry that reads them', () => {
    expect(entry.indexOf('const UPSET_CASES')).toBeLessThan(
      entry.indexOf('export const cupGiantKillingEntry'),
    );
  });

  /** The harness adds no audio: the management SFX table is index-addressed. */
  it('plays no sound of its own', () => {
    expect(entry).not.toContain('SfxPressable');
    expect(entry).not.toContain('playManagement');
  });
});
