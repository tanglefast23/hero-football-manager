import { describe, expect, it } from '@jest/globals';
import { loadLaunchContent } from '../../content';
import {
  advanceFacilityConstruction,
  beginCareerTransferTalks,
  buildCareerFacility,
  createCareer,
  maxRenewalTermSeasons,
  maxSigningTermSeasons,
  seasonsBeforeRetirement,
  type CareerPlayer,
  type GameState,
} from '../../game';
import { createLaunchCareerSetup } from '../launch';
import {
  homeViewModel,
  isOneShotProductAlert,
  seasonEndViewModel,
  squadTrainingViewModel,
} from '../view-models';
import { careerMarketViewModelSource } from '../market-source-adapter';
import { marketNegotiationViewModel } from '../market-view-model';

const content = loadLaunchContent();

/**
 * Ages a player to the last season before their announcement rather than
 * guessing a number. Retirement age varies by personality AND by id hash, so a
 * hardcoded 36 is a coin flip on whether the label appears at all.
 */
function ageOneSeasonFromAnnouncing(
  player: CareerPlayer,
  careerSeed: number,
): number {
  return (player.age ?? 24) + seasonsBeforeRetirement(player, careerSeed) - 1;
}

/** A career whose guide queue is silent, so the three desk slots are free. */
function deskClearCareer(seed: number): GameState {
  const started = buildCareerFacility(
    createCareer(createLaunchCareerSetup(seed, undefined, content)),
    'training-pitch',
    { x: 0, y: 0 },
  ).state;
  let grid = started.facilities.grid!;
  while (grid.construction !== undefined) {
    grid = advanceFacilityConstruction(grid).grid;
  }
  return {
    ...started,
    week: 9,
    facilities: { trainingGroundBuilt: true, grid },
    market: undefined,
    m2: undefined,
  };
}

function firstUserPlayer(state: GameState): CareerPlayer {
  return state.players.find((player) => player.clubId === state.userClubId)!;
}

function withPlayerAged(
  state: GameState,
  playerId: string,
  overrides: Partial<CareerPlayer>,
): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId ? { ...player, ...overrides } : player,
    ),
  };
}

/** Season-end state whose first non-starter carries an expired contract. */
function seasonEndWithExpiredVeteran(
  seed: number,
  age: (player: CareerPlayer, careerSeed: number) => number,
): { state: GameState; player: CareerPlayer } {
  const initial = createCareer({ ...createLaunchCareerSetup(seed) });
  const lineupIds = new Set(
    initial.lineups.find((lineup) => lineup.clubId === initial.userClubId)!
      .playerIds,
  );
  const target = initial.players.find(
    (player) =>
      player.clubId === initial.userClubId && !lineupIds.has(player.id),
  )!;
  const aged: CareerPlayer = {
    ...target,
    contractSeasonsRemaining: 0,
    age: age(target, initial.careerSeed),
  };
  return {
    player: aged,
    state: {
      ...initial,
      phase: 'season-end' as const,
      players: initial.players.map((player) =>
        player.id === target.id ? aged : player,
      ),
    },
  };
}

describe('renewal term cap', () => {
  it('offers only the seasons the veteran has left', () => {
    const { state, player } = seasonEndWithExpiredVeteran(
      8802,
      ageOneSeasonFromAnnouncing,
    );
    const cap = maxRenewalTermSeasons(player, state.careerSeed);
    expect(cap).toBe(1);

    const view = seasonEndViewModel(state, content, 1);

    expect(view.expiredContract?.termOptions).toEqual([1]);
  });

  it('explains the short term as the player own judgement', () => {
    const { state, player } = seasonEndWithExpiredVeteran(
      8802,
      ageOneSeasonFromAnnouncing,
    );

    const view = seasonEndViewModel(state, content, 1);

    expect(view.expiredContract?.shortTermReason).toContain('1 year');
    expect(view.expiredContract?.shortTermReason).toContain(String(player.age));
    expect(view.expiredContract?.shortTermReason).toContain('left in him');
  });

  it('says nothing extra for a player with a full career ahead', () => {
    const { state } = seasonEndWithExpiredVeteran(8802, () => 24);

    const view = seasonEndViewModel(state, content, 1);

    expect(view.expiredContract?.termOptions).toEqual([1, 2, 3]);
    expect(view.expiredContract?.shortTermReason).toBeUndefined();
  });

  it('never pre-selects a term above the cap', () => {
    const { state } = seasonEndWithExpiredVeteran(
      8802,
      ageOneSeasonFromAnnouncing,
    );

    // Three is what the store would carry in from the player renewed before him.
    const view = seasonEndViewModel(state, content, 3);

    expect(view.expiredContract!.selectedTerm).toBe(1);
  });
});

describe('signing term cap', () => {
  it('offers one more season than a renewal, because week 30 has not run yet', () => {
    const { state, player } = seasonEndWithExpiredVeteran(
      8802,
      ageOneSeasonFromAnnouncing,
    );
    const signingCap = maxSigningTermSeasons(player, state.careerSeed);
    expect(signingCap).toBe(
      maxRenewalTermSeasons(player, state.careerSeed) + 1,
    );

    const view = marketNegotiationViewModel({
      state: {
        id: 'neg-1',
        playerId: player.id,
        personality: 'PROFESSIONAL',
        status: 'OPEN',
        mood: 'NEUTRAL',
        round: 0,
        history: [],
        pitchCards: [],
        usedPitchCards: [],
        pitchInfluencePercent: 0,
        weeklyAsk: player.weeklyWage,
      } as never,
      playerName: player.name,
      openingWeeklyWage: player.weeklyWage,
      maxTermSeasons: signingCap,
      playerAge: player.age,
    });

    expect(view.termOptions).toEqual([1, 2]);
    expect(view.shortTermReason).toContain('2 years');
  });

  it('offers every term when no cap is supplied', () => {
    const { player } = seasonEndWithExpiredVeteran(8802, () => 24);

    const view = marketNegotiationViewModel({
      state: {
        id: 'neg-2',
        playerId: player.id,
        personality: 'PROFESSIONAL',
        status: 'OPEN',
        mood: 'NEUTRAL',
        round: 0,
        history: [],
        pitchCards: [],
        usedPitchCards: [],
        pitchInfluencePercent: 0,
        weeklyAsk: player.weeklyWage,
      } as never,
      playerName: player.name,
      openingWeeklyWage: player.weeklyWage,
    });

    expect(view.termOptions).toEqual([1, 2, 3]);
    expect(view.shortTermReason).toBeUndefined();
  });

  /**
   * The ship path, not a hand-built view model.
   *
   * This asserted only that a fresh career has no open talks — trivially true,
   * and `maxTermSeasons` lives INSIDE `negotiation`, so the field it exists to
   * guard was never reached. It also passed the adapter a third argument it has
   * never taken, which Jest ignores at runtime and only `tsc` caught.
   *
   * So it opens real talks with a veteran instead. The age is one season short
   * of announcing, which forces the cap below the full three: an adapter that
   * ignored retirement would hand back 3 and fail here.
   */
  it('is supplied by the shipped market source, not just by tests', () => {
    const base = createCareer(
      createLaunchCareerSetup(8811, undefined, content),
    );
    const division = base.m2!.pyramid.divisions.find(
      (candidate) => candidate.level === 4,
    )!;
    const raw = division.clubs[0].squad.find(
      (candidate) => candidate.role === 'DEF',
    )!;
    const veteranAge = ageOneSeasonFromAnnouncing(
      raw as unknown as CareerPlayer,
      base.careerSeed,
    );
    const career: GameState = {
      ...base,
      m2: {
        ...base.m2!,
        pyramid: {
          ...base.m2!.pyramid,
          divisions: base.m2!.pyramid.divisions.map((entry) => ({
            ...entry,
            clubs: entry.clubs.map((club) => ({
              ...club,
              squad: club.squad.map((player) =>
                player.id === raw.id ? { ...player, age: veteranAge } : player,
              ),
            })),
          })),
        },
      },
    };

    // Talks require a scout report, the same gate the shipped flow enforces.
    const scouted = {
      ...career.market!,
      scoutReports: [
        {
          playerId: raw.id,
          role: raw.role,
          age: veteranAge,
          statRanges: Object.fromEntries(
            Object.entries(raw.attrs).map(([key, value]) => [
              key,
              { minimum: value, maximum: value },
            ]),
          ) as never,
          potentialRange: { minimum: 3 as const, maximum: 3 as const },
        },
      ],
    };
    const market = beginCareerTransferTalks(
      career,
      scouted,
      raw.id,
      division.level,
    );
    const source = careerMarketViewModelSource(career, market);
    const expected = maxSigningTermSeasons(
      { ...raw, age: veteranAge } as unknown as CareerPlayer,
      career.careerSeed,
    );

    expect(source.negotiation).toBeDefined();
    expect(source.negotiation!.maxTermSeasons).toBe(expected);
    expect(source.negotiation!.maxTermSeasons).toBeLessThan(3);
    expect(source.negotiation!.playerAge).toBe(veteranAge);
  });

  it('exposes no negotiation on a career with no talks open', () => {
    const career = createCareer(
      createLaunchCareerSetup(8811, undefined, content),
    );
    const source = careerMarketViewModelSource(career, career.market!);
    // No talks open on a fresh career; the adapter must still typecheck and
    // expose the field, which is what stops the ship path defaulting to 1-2-3.
    expect(source.negotiation).toBeUndefined();
  });
});

describe('player-card retirement label', () => {
  it('stays quiet while retirement is more than one season away', () => {
    const career = createCareer(
      createLaunchCareerSetup(73101, undefined, content),
    );
    const target = firstUserPlayer(career);
    const state = withPlayerAged(career, target.id, { age: 24 });

    const view = squadTrainingViewModel(state, content, undefined);

    expect(
      view.players.find((player) => player.id === target.id)?.retirementLabel,
    ).toBeUndefined();
  });

  it('warns one season before the announcement', () => {
    const career = createCareer(
      createLaunchCareerSetup(73101, undefined, content),
    );
    const target = firstUserPlayer(career);
    const state = withPlayerAged(career, target.id, {
      age: ageOneSeasonFromAnnouncing(
        { ...target, age: 24 },
        career.careerSeed,
      ),
    });

    const view = squadTrainingViewModel(state, content, undefined);

    expect(
      view.players.find((player) => player.id === target.id)?.retirementLabel,
    ).toBe('Considering retirement in 1 year');
  });

  it('marks the final season once announced', () => {
    const career = createCareer(
      createLaunchCareerSetup(73101, undefined, content),
    );
    const target = firstUserPlayer(career);
    const state = withPlayerAged(career, target.id, {
      age: 37,
      retirementAnnouncementSeason: 1,
    });

    const view = squadTrainingViewModel(state, content, undefined);

    expect(
      view.players.find((player) => player.id === target.id)?.retirementLabel,
    ).toBe('Final season, retires in summer');
  });
});

describe('retirement heads-up alert', () => {
  it('lands for a player one season from announcing', () => {
    const clear = deskClearCareer(20261101);
    const target = firstUserPlayer(clear);
    const state = withPlayerAged(clear, target.id, {
      age: ageOneSeasonFromAnnouncing({ ...target, age: 24 }, clear.careerSeed),
    });

    const alerts = homeViewModel(state).alerts;

    expect(alerts.map((alert) => alert.id)).toContain(
      `retirement-considering-${state.season}-${target.id}`,
    );
    expect(
      alerts.find((alert) => alert.id.startsWith('retirement-considering-'))
        ?.detail,
    ).toContain('one more season after this one');
  });

  it('does not land for a player with seasons still ahead', () => {
    const clear = deskClearCareer(20261102);
    const target = firstUserPlayer(clear);
    const state = withPlayerAged(clear, target.id, { age: 24 });

    const alerts = homeViewModel(state).alerts;

    expect(
      alerts.some((alert) => alert.id.startsWith('retirement-considering-')),
    ).toBe(false);
  });

  it('does not repeat once the player has announced', () => {
    const clear = deskClearCareer(20261103);
    const target = firstUserPlayer(clear);
    const state = withPlayerAged(clear, target.id, {
      age: 37,
      retirementAnnouncementSeason: 1,
    });

    const alerts = homeViewModel(state).alerts;

    expect(
      alerts.some((alert) => alert.id.startsWith('retirement-considering-')),
    ).toBe(false);
  });

  it('is one-shot, so it does not hold a desk slot all season', () => {
    expect(isOneShotProductAlert('retirement-considering-3-player-7')).toBe(
      true,
    );
    expect(isOneShotProductAlert('retirement-announcement-3-player-7')).toBe(
      false,
    );
  });
});
