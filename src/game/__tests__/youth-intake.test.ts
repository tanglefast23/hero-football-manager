import { createLaunchCareerSetup } from '../../application/launch';
import {
  activeCareerMatchday,
  advanceWeek,
  completeMatchday,
  createCareer,
} from '../career';
import { createFacilityGrid } from '../facilities';
import {
  BASE_ROSTER_CAPACITY,
  careerRosterCapacity,
  createPreseasonYouthIntake,
  declineYouthIntakeOffers,
  signYouthIntakeOffer,
  youthFieldLevel,
  youthSigningBonus,
} from '../youth-intake';
import type { GameState } from '../types';
import { PROMOTION_WAGE_CLAUSE_PERCENT } from '../contract-wages';

function careerWithRosterSize(
  rosterSize: number,
  seed = 20260719,
  youthFieldLevel: 0 | 1 | 2 | 3 = 0,
): GameState {
  const state = createCareer(createLaunchCareerSetup(seed));
  const userPlayers = state.players.filter(
    (player) => player.clubId === state.userClubId,
  );
  const retainedUserIds = new Set(
    userPlayers.slice(0, rosterSize).map((player) => player.id),
  );
  const grid = createFacilityGrid();
  return {
    ...state,
    players: state.players.filter(
      (player) =>
        player.clubId !== state.userClubId || retainedUserIds.has(player.id),
    ),
    facilities:
      youthFieldLevel === 0
        ? { ...state.facilities, grid }
        : {
            ...state.facilities,
            grid: {
              ...grid,
              nextBuildingId: 2,
              buildings: [
                {
                  id: 'facility-1',
                  type: 'youth-field',
                  level: youthFieldLevel,
                  capitalInvested:
                    youthFieldLevel === 1
                      ? 12_000
                      : youthFieldLevel === 2
                        ? 27_000
                        : 54_000,
                  x: 0,
                  y: 0,
                },
              ],
            },
          },
  };
}

function relevantAverage(
  state: ReturnType<typeof createPreseasonYouthIntake>,
): number {
  const totals = state.offers.map((offer) => {
    const attrs = offer.player.attrs;
    return offer.player.role === 'GK'
      ? (attrs.ref + attrs.def + attrs.pas) / 3
      : (attrs.pac +
          attrs.sho +
          attrs.pas +
          attrs.def +
          attrs.tec +
          attrs.sta) /
          6;
  });
  return totals.reduce((sum, value) => sum + value, 0) / totals.length;
}

describe('pre-season youth intake', () => {
  it('offers 1-2 deterministic, JSON-safe 16-17 year olds each pre-season', () => {
    const state = careerWithRosterSize(14, 101);
    const before = JSON.stringify(state);
    const first = createPreseasonYouthIntake(state);
    const second = createPreseasonYouthIntake(
      JSON.parse(JSON.stringify(state)) as GameState,
    );

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.status).toBe('OPEN');
    expect(first.offers.length).toBeGreaterThanOrEqual(1);
    expect(first.offers.length).toBeLessThanOrEqual(2);
    expect(
      first.offers.every(
        (offer) => offer.player.age === 16 || offer.player.age === 17,
      ),
    ).toBe(true);
    expect(
      first.offers.every((offer) => offer.player.clubId === state.userClubId),
    ).toBe(true);
    expect(
      first.offers.every(
        (offer) => offer.player.contractSeasonsRemaining === 3,
      ),
    ).toBe(true);
    expect(
      first.offers.every(
        (offer) =>
          offer.player.potentialCeiling !== undefined &&
          offer.player.potentialCeiling >= 46 &&
          offer.player.potentialCeiling <= 99,
      ),
    ).toBe(true);
    expect(
      first.offers.every((offer) => offer.player.lookId !== undefined),
    ).toBe(true);
    expect(
      first.offers.every(
        (offer) =>
          !state.players.some(
            (player) => player.lookId === offer.player.lookId,
          ),
      ),
    ).toBe(true);
    expect(
      first.offers.every(
        (offer) => offer.signingBonus === youthSigningBonus(0),
      ),
    ).toBe(true);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('reads the best operational Youth Field, not the first one built', () => {
    const base = careerWithRosterSize(12, 303);
    const withFields = (...levels: readonly (1 | 2 | 3)[]): GameState => ({
      ...base,
      facilities: {
        ...base.facilities,
        grid: {
          ...base.facilities.grid!,
          nextBuildingId: levels.length + 1,
          buildings: levels.map((level, index) => ({
            id: `facility-${index + 1}`,
            type: 'youth-field' as const,
            level,
            capitalInvested:
              level === 1 ? 12_000 : level === 2 ? 27_000 : 54_000,
            x: index * 2,
            y: 0,
          })),
        },
      },
    });

    expect(youthFieldLevel(base)).toBe(0);
    expect(youthFieldLevel(withFields(2))).toBe(2);
    // `.find()` used to return whichever field was built first, so upgrading a
    // second one paid for nothing.
    expect(youthFieldLevel(withFields(1, 3))).toBe(3);
    expect(youthFieldLevel(withFields(3, 1))).toBe(3);
  });

  it('keeps a full roster intake visible but blocks signing until the club makes space', () => {
    const oneSlot = createPreseasonYouthIntake(careerWithRosterSize(15, 202));
    const fullState = careerWithRosterSize(BASE_ROSTER_CAPACITY, 202);
    const full = createPreseasonYouthIntake(fullState);

    expect(oneSlot.offers.length).toBeGreaterThanOrEqual(1);
    expect(oneSlot.offers.length).toBeLessThanOrEqual(2);
    expect(full.status).toBe('OPEN');
    expect(full.offers.length).toBeGreaterThanOrEqual(1);
    expect(full.offers.length).toBeLessThanOrEqual(2);
    expect(() =>
      signYouthIntakeOffer(fullState, full, full.offers[0].player.id),
    ).toThrow('16-player roster is full');
  });

  it('keeps the story-created player as one explicit extra slot without opening an unlimited cap', () => {
    const base = careerWithRosterSize(BASE_ROSTER_CAPACITY, 212);
    const template = base.players.find(
      (player) => player.clubId === base.userClubId,
    )!;
    const created = {
      ...template,
      id: `${base.userClubId}-created-player`,
      name: 'Joe Hero',
    };
    const storyState: GameState = {
      ...base,
      players: [...base.players, created],
      onboarding: { stage: 'complete', createdPlayerId: created.id },
    };
    const intake = createPreseasonYouthIntake(storyState);

    expect(careerRosterCapacity(storyState)).toBe(17);
    expect(() =>
      signYouthIntakeOffer(storyState, intake, intake.offers[0].player.id),
    ).toThrow('17-player roster is full');

    const withSpace = {
      ...storyState,
      players: storyState.players.filter((player) => player.id !== template.id),
    };
    const signed = signYouthIntakeOffer(
      withSpace,
      intake,
      intake.offers[0].player.id,
    );
    expect(
      signed.state.players.filter(
        (player) => player.clubId === storyState.userClubId,
      ),
    ).toHaveLength(17);
  });

  it('expires and clears every open offer after pre-season Week 4', () => {
    let state = createCareer(createLaunchCareerSetup(222));
    expect(state.youthIntake?.status).toBe('OPEN');

    while (state.week < 5) {
      state = advanceWeek(state);
      if (state.phase !== 'matchday') continue;
      const matchday = activeCareerMatchday(state);
      if (matchday === undefined) throw new Error('expected an active fixture');
      state = completeMatchday(
        state,
        matchday.fixtures.map((fixture) => ({
          fixtureId: fixture.id,
          homeGoals: 0,
          awayGoals: 0,
        })),
      );
    }

    expect(state).toMatchObject({ week: 5, phase: 'manage' });
    expect(state.youthIntake).toMatchObject({ status: 'CLOSED', offers: [] });
  });

  it('raises current quality and the explicit signing bonus with Youth Field level', () => {
    const noField = createPreseasonYouthIntake(
      careerWithRosterSize(14, 303, 0),
    );
    const levelThree = createPreseasonYouthIntake(
      careerWithRosterSize(14, 303, 3),
    );

    expect(levelThree.offers.map((offer) => offer.player.id)).toEqual(
      noField.offers.map((offer) => offer.player.id),
    );
    expect(relevantAverage(levelThree)).toBeGreaterThan(
      relevantAverage(noField) + 10,
    );
    expect(
      levelThree.offers.every((offer) => offer.signingBonus === 1250),
    ).toBe(true);
    expect(
      Math.min(
        ...levelThree.offers.map((offer) => offer.player.potential ?? 0),
      ),
    ).toBeGreaterThanOrEqual(
      Math.min(...noField.offers.map((offer) => offer.player.potential ?? 0)),
    );
  });

  it('signs one player, charges the bonus, adds wages, and never mutates its inputs', () => {
    const state = {
      ...careerWithRosterSize(15, 404, 2),
      cashTransactions: [],
    };
    const intake = createPreseasonYouthIntake(state);
    const offer = intake.offers[0];
    expect(offer.player.promotionWagePercent).toBe(
      PROMOTION_WAGE_CLAUSE_PERCENT,
    );
    const clubBefore = state.clubs.find(
      (club) => club.id === state.userClubId,
    )!;
    const stateBefore = JSON.stringify(state);
    const intakeBefore = JSON.stringify(intake);

    const result = signYouthIntakeOffer(state, intake, offer.player.id);
    const clubAfter = result.state.clubs.find(
      (club) => club.id === state.userClubId,
    )!;

    expect(result).toMatchObject({
      signedPlayerId: offer.player.id,
      signingBonusPaid: offer.signingBonus,
      intake: {
        status: 'CLOSED',
        offers: [],
        signedPlayerIds: [offer.player.id],
      },
    });
    expect(
      result.state.players.filter(
        (player) => player.clubId === state.userClubId,
      ),
    ).toHaveLength(16);
    expect(
      result.state.players.find((player) => player.id === offer.player.id),
    ).toEqual(offer.player);
    expect(clubAfter.cash).toBe(clubBefore.cash - offer.signingBonus);
    expect(clubAfter.weeklyWages).toBe(
      clubBefore.weeklyWages + offer.player.weeklyWage,
    );
    expect(result.state.cashTransactions).toEqual([
      expect.objectContaining({
        kind: 'youth-signing',
        label: `Youth signing · ${offer.player.name}`,
        amount: -offer.signingBonus,
        balanceAfter: clubAfter.cash,
      }),
    ]);
    expect(result.state.ledgers).toHaveLength(0);
    expect(JSON.stringify(state)).toBe(stateBefore);
    expect(JSON.stringify(intake)).toBe(intakeBefore);
  });

  it('declines and clears every remaining offer without changing career data', () => {
    const state = careerWithRosterSize(14, 505);
    const intake = createPreseasonYouthIntake(state);
    const result = declineYouthIntakeOffers(state, intake);

    expect(result.state).toBe(state);
    expect(result.signingBonusPaid).toBe(0);
    expect(result.intake).toEqual({
      ...intake,
      status: 'CLOSED',
      offers: [],
      signedPlayerIds: [],
      declined: true,
    });
    expect(intake.offers.length).toBeGreaterThan(0);
  });

  it('rejects unaffordable, duplicate, stale-season, and non-preseason signings', () => {
    const state = careerWithRosterSize(15, 606);
    const intake = createPreseasonYouthIntake(state);
    const offer = intake.offers[0];
    const broke = {
      ...state,
      clubs: state.clubs.map((club) =>
        club.id === state.userClubId ? { ...club, cash: 0 } : club,
      ),
    };
    expect(() => signYouthIntakeOffer(broke, intake, offer.player.id)).toThrow(
      'not affordable',
    );
    expect(() =>
      signYouthIntakeOffer(
        { ...state, players: [...state.players, offer.player] },
        intake,
        offer.player.id,
      ),
    ).toThrow('already in the career');
    expect(() =>
      signYouthIntakeOffer({ ...state, season: 2 }, intake, offer.player.id),
    ).toThrow('different season');
    expect(() => createPreseasonYouthIntake({ ...state, week: 5 })).toThrow(
      'pre-season weeks 1-4',
    );
  });
});
