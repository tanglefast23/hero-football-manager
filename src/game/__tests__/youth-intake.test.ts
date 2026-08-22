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
  createEmergencyYouthReplacement,
  createPreseasonYouthIntake,
  declineYouthIntakeOffers,
  signYouthIntakeOffer,
  youthFieldLevel,
  youthSigningBonus,
} from '../youth-intake';
import { DIVISION_STRENGTH_BANDS } from '../pyramid';
import type { Attrs, Role } from '../../sim/types';
import type { GameState } from '../types';
import { PROMOTION_WAGE_CLAUSE_PERCENT } from '../contract-wages';
import {
  archetypeTrainingBonusPercent,
  POSITION_TRAINING_ATTRIBUTES,
} from '../archetype-caps';

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

/**
 * A player's strength in the stats their own role is judged on.
 *
 * The split matters. A keeper's finishing is noise, and averaging it in drags
 * the number down by a fixed amount that has nothing to do with how good the
 * keeper is — which is exactly how a role-blind floor passes for midfielders
 * and fails for goalkeepers while the code under it is correct.
 */
function roleRelevantAverage(role: Role, attrs: Attrs): number {
  return role === 'GK'
    ? (attrs.ref + attrs.def + attrs.pas) / 3
    : (attrs.pac + attrs.sho + attrs.pas + attrs.def + attrs.tec + attrs.sta) /
        6;
}

function relevantAverage(
  state: ReturnType<typeof createPreseasonYouthIntake>,
): number {
  const totals = state.offers.map((offer) =>
    roleRelevantAverage(offer.player.role, offer.player.attrs),
  );
  return totals.reduce((sum, value) => sum + value, 0) / totals.length;
}

describe('pre-season youth intake', () => {
  /**
   * Board relief is the fail-soft rescue: the board sells a player the club
   * cannot pay for, and hands back an academy replacement. Its strength is the
   * whole point. At the old target of 27 each rescue left the squad weaker than
   * anything in Division 5, so a run of forced sales sank the club for good.
   *
   * The rail is therefore a band tied to the Division 5 clubs themselves, not a
   * literal number: relief lands just under the division floor and never above
   * its ceiling. It stays cheap relief, and it stays survivable.
   *
   * Every role, many draws. The first version of this test checked one DEF at
   * one seed against a role-blind floor of 37 — which goalkeepers miss by
   * construction, on 18 of 40 seeds, with the code working exactly as intended.
   */
  it('keeps emergency board relief inside the Division 5 band, in every role', () => {
    const [d5Minimum, d5Maximum] = DIVISION_STRENGTH_BANDS[5];
    // Just under the division floor: relief is a lifeline, not a signing.
    const floor = d5Minimum - 5;
    const state = careerWithRosterSize(15, 404);
    const roles: readonly Role[] = ['GK', 'DEF', 'MID', 'FWD'];

    for (const role of roles) {
      // The source ID is mixed into the seed, so one career yields many draws.
      const drawn = Array.from({ length: 40 }, (_, index) =>
        roleRelevantAverage(
          role,
          createEmergencyYouthReplacement(state, role, `board-test-${index}`)
            .attrs,
        ),
      );

      expect({
        role,
        tooWeak: drawn.filter((average) => average < floor),
        tooStrong: drawn.filter((average) => average > d5Maximum),
      }).toEqual({ role, tooWeak: [], tooStrong: [] });
    }
  });

  /**
   * The rescue kid grows. He takes the division-scaled potential roll a normal
   * intake gets, floored at 2 — and the floor is the point, not a hedge.
   * `potentialTierForDivision` is humble at the bottom and returns tier 1 on 90%
   * of Division 5 rolls, so the raw roll would have downgraded board relief in
   * the very division where the board sells players.
   */
  it('never hands board relief a worse growth tier than the old fixed one', () => {
    const state = careerWithRosterSize(15, 404);
    const roles: readonly Role[] = ['GK', 'DEF', 'MID', 'FWD'];

    for (const role of roles) {
      const drawn = Array.from({ length: 40 }, (_, index) =>
        createEmergencyYouthReplacement(state, role, `potential-${index}`),
      );

      expect({
        role,
        belowOldFixedTier: drawn
          .map((player) => player.potential)
          .filter((potential) => potential === undefined || potential < 2),
        missingCeiling: drawn.filter(
          (player) => player.potentialCeiling === undefined,
        ).length,
      }).toEqual({ role, belowOldFixedTier: [], missingCeiling: 0 });
    }
  });

  it('offers two deterministic, JSON-safe 16-17 year olds each pre-season', () => {
    const state = careerWithRosterSize(14, 101);
    const before = JSON.stringify(state);
    const first = createPreseasonYouthIntake(state);
    const second = createPreseasonYouthIntake(
      JSON.parse(JSON.stringify(state)) as GameState,
    );

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.status).toBe('OPEN');
    expect(first.offers).toHaveLength(2);
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

  it('offers archetypes that help each prospect in their own role', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      for (const offer of createPreseasonYouthIntake(
        careerWithRosterSize(14, seed),
      ).offers) {
        expect(
          POSITION_TRAINING_ATTRIBUTES[offer.player.role].some(
            (attribute) =>
              archetypeTrainingBonusPercent(
                offer.player.archetype,
                attribute,
              ) > 0,
          ),
        ).toBe(true);
      }
    }
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

    expect(oneSlot.offers).toHaveLength(2);
    expect(full.status).toBe('OPEN');
    expect(full.offers).toHaveLength(2);
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
