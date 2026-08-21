import { createLaunchCareerSetup } from '../launch';
import { contractDraftPerk, marketViewModel } from '../market-view-model';
import {
  careerMarketScoutOptions,
  careerMarketViewModelSource,
} from '../market-source-adapter';
import { createCareer } from '../../game/career';
import { buildCareerFacility } from '../../game/management';
import { advanceFacilityConstruction } from '../../game/facilities';
import {
  beginCareerTransferTalks,
  hireCareerCoach,
  listCareerPlayer,
  startCareerScoutMission,
  type CareerMarketState,
} from '../../game/market-career';
import type { CareerPlayer, GameState } from '../../game/types';
import { playerGrowthGrade } from '../../game/training';
import {
  cheapestScoutMissionCost,
  contractWageStep,
  renewalOpeningOfferWage,
} from '../../game/market';
import { careerContractPromiseHeroLimit } from '../../game/contract-promises';
import { copyFor } from '../../i18n';

function fullCareer(seed = 20260719): GameState {
  return createCareer(createLaunchCareerSetup(seed));
}

function exactReport(
  player: CareerPlayer,
): CareerMarketState['scoutReports'][number] {
  const range = (value: number) => ({ minimum: value, maximum: value });
  return {
    playerId: player.id,
    role: player.role,
    age: player.age ?? 24,
    statRanges: {
      pac: range(player.attrs.pac),
      sho: range(player.attrs.sho),
      pas: range(player.attrs.pas),
      def: range(player.attrs.def),
      tec: range(player.attrs.tec),
      sta: range(player.attrs.sta),
      ref: range(player.attrs.ref),
    },
    potentialRange: range(player.potential ?? 3),
    ...(player.power === undefined ? {} : { power: player.power }),
  };
}

describe('career market view-model source adapter', () => {
  it('derives deterministic scout briefs and live club context without mutating career state', () => {
    const initial = { ...fullCareer(711), week: 15 };
    const officeProject = buildCareerFacility(initial, 'scout-office', {
      x: 0,
      y: 0,
    }).state;
    const withOffice = {
      ...officeProject,
      facilities: {
        ...officeProject.facilities,
        grid: advanceFacilityConstruction(officeProject.facilities.grid!).grid,
      },
    };
    const before = JSON.stringify(withOffice);
    const first = careerMarketViewModelSource(withOffice);
    const second = careerMarketViewModelSource(withOffice, withOffice.market);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(withOffice)).toBe(before);
    expect(first).toMatchObject({
      careerSeed: 711,
      season: 1,
      week: 15,
      currentCareerWeek: 15,
      division: 5,
      cash: withOffice.clubs.find((club) => club.id === withOffice.userClubId)
        ?.cash,
      scoutOfficeLevel: 1,
    });
    expect(first.scoutOptions).toHaveLength(100);
    expect(first.youthIntake).toMatchObject({
      status: 'OPEN',
      rosterCapacity: 16,
    });
    expect(first.youthIntake?.offers.length).toBeGreaterThanOrEqual(1);
    expect(new Set(first.scoutOptions.map((option) => option.id)).size).toBe(
      100,
    );
    expect(
      new Set(first.scoutOptions.map((option) => option.focus.kind)),
    ).toEqual(new Set(['PROFILE']));
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    const youth = marketViewModel(first).youth;
    expect(youth).toMatchObject({
      status: 'OPEN',
      rosterLabel: '16/16 rostered',
    });
    // Asserted per offer rather than as a whole array: the intake hands out one
    // or two prospects depending on the roll, and the rule under test is that a
    // full roster blocks every one of them, not how many arrived.
    expect(youth!.offers.length).toBeGreaterThanOrEqual(1);
    for (const offer of youth!.offers) {
      expect(offer).toMatchObject({ available: false });
      expect(offer.blockedReason).toContain('Roster full');
    }
  });

  it('adds scouting briefs at permanent promotion milestones', () => {
    const initial = fullCareer(712);
    const withBestDivision = (division: 1 | 2 | 3 | 4 | 5): GameState => ({
      ...initial,
      m2: { ...initial.m2!, highestDivisionReached: division },
    });

    expect(careerMarketScoutOptions(withBestDivision(5))).toHaveLength(100);
    expect(careerMarketScoutOptions(withBestDivision(4))).toHaveLength(100);
    expect(careerMarketScoutOptions(withBestDivision(3))).toHaveLength(105);
    expect(careerMarketScoutOptions(withBestDivision(2))).toHaveLength(110);
    expect(careerMarketScoutOptions(withBestDivision(1))).toHaveLength(110);
  });

  it('quotes cheapestScoutMissionCost as the true floor of every board', () => {
    // AGE is a priced focus ($500 over LOCAL, cheaper than any PROFILE brief)
    // that no board offers. If a cheaper focus is ever wired onto the board,
    // the scout's opening-favour trigger silently stops matching the cheapest
    // slip a club can actually buy — this pins the quote to the real boards.
    const initial = fullCareer(712);
    for (const division of [5, 4, 3, 2, 1] as const) {
      const options = careerMarketScoutOptions({
        ...initial,
        m2: { ...initial.m2!, highestDivisionReached: division },
      });
      expect(
        Math.min(
          ...options.map((option) => option.cost ?? Number.POSITIVE_INFINITY),
        ),
      ).toBe(cheapestScoutMissionCost());
    }
  });

  it('exposes an active mission, its charged cash, and the same deterministic option mapping', () => {
    const state = { ...fullCareer(812), week: 15 };
    const options = careerMarketScoutOptions(state);
    const selected = options[0];
    const started = startCareerScoutMission(
      state,
      state.market!,
      selected.region,
      selected.focus,
      5,
    );
    const source = careerMarketViewModelSource(started.state, started.market);

    expect(source.activeScoutMission).toEqual(
      started.market.activeScoutMission,
    );
    expect(source.cash).toBe(
      state.clubs.find((club) => club.id === state.userClubId)!.cash -
        started.market.activeScoutMission!.cost,
    );
    expect(source.scoutOptions).toEqual(options);
  });

  it('maps current reports into buy listings and eligible user players into sell listings', () => {
    const full = fullCareer(913);
    const starters = new Set(
      full.lineups.find((lineup) => lineup.clubId === full.userClubId)!
        .playerIds,
    );
    const spare = full.players.find(
      (player) => player.clubId === full.userClubId && !starters.has(player.id),
    )!;
    const state = {
      ...full,
      players: full.players.filter((player) => player.id !== spare.id),
    };
    const target = state.players.find(
      (player) => player.clubId !== state.userClubId,
    )!;
    const market: CareerMarketState = {
      ...state.market!,
      nextMissionNumber: 2,
      scoutReports: [
        {
          ...exactReport(target),
          potentialRange: { minimum: 2, maximum: 4 },
        },
      ],
    };
    const source = careerMarketViewModelSource(state, market);
    const buy = source.transferListings.find(
      (listing) => listing.direction === 'BUY',
    );
    const sells = source.transferListings.filter(
      (listing) => listing.direction === 'SELL',
    );

    expect(source.scoutResult).toMatchObject({
      missionId: 'scout-1',
      completedWeek: 1,
      reports: [{ playerId: target.id }],
    });
    expect(source.scoutedPlayerIdentities).toContainEqual(
      expect.objectContaining({
        id: target.id,
        name: target.name,
      }),
    );
    expect(buy).toMatchObject({
      direction: 'BUY',
      sellingClubDivision: 5,
      player: {
        id: target.id,
        name: target.name,
        potentialRange: { minimum: 2, maximum: 4 },
      },
    });
    expect(buy?.player).not.toHaveProperty('potentialGrade');
    expect(sells.length).toBeGreaterThan(0);
    expect(sells.every((listing) => listing.player.id !== target.id)).toBe(
      true,
    );

    const visible = marketViewModel(source);
    expect(visible.scouting.reports[0].playerName).toBe(target.name);
    expect(
      visible.transfers.some((listing) => listing.direction === 'BUY'),
    ).toBe(true);
    expect(
      visible.transfers.some((listing) => listing.direction === 'SELL'),
    ).toBe(true);
    const ownedPlayer = state.players.find(
      (player) => player.clubId === state.userClubId,
    )!;
    expect(
      visible.transfers.find(
        (listing) =>
          listing.direction === 'SELL' && listing.playerId === ownedPlayer.id,
      )?.potentialLabel,
    ).toMatch(new RegExp(`^${playerGrowthGrade(ownedPlayer)} · SUPER \\d+%$`));
  });

  it('keeps SELL rows pressable outside the transfer window and BUY rows blocked', () => {
    // Week 10 is mid-season: registration is shut for signings, but a club may
    // move a player off its own wage bill any week of the year.
    const state = { ...fullCareer(4242), week: 10 };
    const target = state.players.find(
      (player) => player.clubId !== state.userClubId,
    )!;
    const market: CareerMarketState = {
      ...state.market!,
      nextMissionNumber: 2,
      scoutReports: [exactReport(target)],
    };
    const visible = marketViewModel(careerMarketViewModelSource(state, market));

    expect(visible.window.open).toBe(false);
    const sells = visible.transfers.filter(
      (listing) => listing.direction === 'SELL',
    );
    expect(sells.length).toBeGreaterThan(0);
    expect(sells.some((listing) => listing.available)).toBe(true);
    expect(
      visible.transfers
        .filter((listing) => listing.direction === 'BUY')
        .every((listing) => !listing.available),
    ).toBe(true);
  });

  it('maps a scouted player from outside the active division into a buy listing', () => {
    const state = fullCareer(714);
    const division = state.m2!.pyramid.divisions.find(
      (candidate) => candidate.level === 4,
    )!;
    const target = division.clubs[0].squad.find(
      (player) => player.role === 'DEF',
    )!;
    expect(state.players.some((player) => player.id === target.id)).toBe(false);
    const market: CareerMarketState = {
      ...state.market!,
      scoutReports: [
        {
          playerId: target.id,
          role: target.role,
          age: target.age,
          statRanges: Object.fromEntries(
            Object.entries(target.attrs).map(([key, value]) => [
              key,
              { minimum: value, maximum: value },
            ]),
          ) as never,
          potentialRange: { minimum: 3, maximum: 3 },
        },
      ],
    };

    const source = careerMarketViewModelSource(state, market);

    expect(
      source.transferListings.find((listing) => listing.direction === 'BUY'),
    ).toEqual(
      expect.objectContaining({
        direction: 'BUY',
        sellingClubDivision: 4,
        player: expect.objectContaining({ id: target.id, name: target.name }),
      }),
    );
    expect(source.scoutedPlayerIdentities).toEqual([
      expect.objectContaining({ id: target.id, name: target.name }),
    ]);
  });

  it('passes coach candidates and current contract talks through with the target wage context', () => {
    const state = fullCareer(1014);
    const target = state.players.find(
      (player) =>
        player.clubId !== state.userClubId && player.power !== undefined,
    )!;
    const scouted: CareerMarketState = {
      ...state.market!,
      scoutReports: [exactReport(target)],
    };
    const market = beginCareerTransferTalks(state, scouted, target.id, 5);
    const source = careerMarketViewModelSource(state, market);

    expect(source.coachCandidates).toEqual(market.coachCandidates);
    expect(source.headCoach).toBeUndefined();
    expect(source.negotiation).toMatchObject({
      playerName: target.name,
      state: { id: market.transferTalks?.negotiation.id, playerId: target.id },
    });
    expect(source.negotiation?.openingWeeklyWage).toBe(
      renewalOpeningOfferWage(
        market.transferTalks!.negotiation.weeklyAsk,
        contractWageStep(market.transferTalks!.negotiation.weeklyAsk),
      ),
    );
    expect(source.negotiation!.openingWeeklyWage).toBeGreaterThan(
      target.weeklyWage,
    );
    const visible = marketViewModel(source);
    expect(visible.negotiation).toMatchObject({
      playerName: target.name,
      status: 'OPEN',
      roundLabel: 'Round 1 of 3',
      wageStep: contractWageStep(market.transferTalks!.negotiation.weeklyAsk),
    });
    expect(visible.coaches[0]).toMatchObject({
      headWeeklyWage: source.coachCandidates[0].weeklyWage,
      assistantWeeklyWage: Math.round(source.coachCandidates[0].weeklyWage / 2),
    });
  });

  /**
   * A full Hero License cap with a scouted rival hero on the desk. `licensed`
   * is true on every AI-club hero, so this is also the shape that used to slip
   * a Starter promise past the guard entirely.
   */
  function licenseCapFull(seed: number, promiseHolders: boolean) {
    const initial = fullCareer(seed);
    const limit = careerContractPromiseHeroLimit(initial);
    const target = initial.players.find(
      (player) => player.clubId !== initial.userClubId && player.role !== 'GK',
    )!;
    const holderIds = new Set(
      initial.players
        .filter(
          (player) =>
            player.clubId === initial.userClubId && player.role !== 'GK',
        )
        .slice(0, limit)
        .map((player) => player.id),
    );
    const state: GameState = {
      ...initial,
      players: initial.players.map((player) => {
        if (player.id === target.id) {
          return { ...player, power: 'FIRE_TORCH' as never, licensed: false };
        }
        if (!holderIds.has(player.id)) return player;
        return {
          ...player,
          power: 'FIRE_TORCH' as never,
          licensed: true,
          ...(promiseHolders
            ? {
                contractSeasonsRemaining: 2,
                contractPromise: {
                  perk: 'GUARANTEED_STARTER' as const,
                  agreedSeason: initial.season,
                },
              }
            : {}),
        };
      }),
    };
    const poweredTarget = state.players.find(
      (player) => player.id === target.id,
    )!;
    const scouted: CareerMarketState = {
      ...state.market!,
      scoutReports: [exactReport(poweredTarget)],
    };
    const t = copyFor('vi');
    return {
      poweredTarget,
      t,
      negotiation: marketViewModel(
        careerMarketViewModelSource(
          state,
          beginCareerTransferTalks(state, scouted, poweredTarget.id, 5),
          t,
        ),
        t,
      ).negotiation,
    };
  }

  it('offers a translated license reclaim when the Hero Licenses are full', () => {
    const { poweredTarget, t, negotiation } = licenseCapFull(20260808, false);
    const starter = negotiation?.perks.find(
      (perk) => perk.id === 'GUARANTEED_STARTER',
    );

    // Available, but not sendable until the club names whose license it takes.
    expect(starter?.available).toBe(true);
    expect(starter?.heroLicenseReclaim?.prompt).toBe(
      t('market.reclaimHeroLicensePrompt', { player: poweredTarget.name }),
    );
    expect(starter?.heroLicenseReclaim?.options.length).toBeGreaterThan(0);
    expect(starter?.heroLicenseReclaim?.prompt).not.toContain(
      'No Hero License is free',
    );
    expect(
      starter?.heroLicenseReclaim?.options.map((option) => option.statusLabel),
    ).not.toContain('Starting XI');
    for (const option of starter?.heroLicenseReclaim?.options ?? []) {
      expect(option.consequenceLabel).toBe(
        t(
          option.statusLabel === t('market.reclaimHolderStarting')
            ? 'market.reclaimHeroLicenseStartingPreview'
            : 'market.reclaimHeroLicenseBenchPreview',
          {
            holder: option.name,
            player: poweredTarget.name,
          },
        ),
      );
    }
  });

  it('disables starting promises with a translated reason when every license is promised', () => {
    const { poweredTarget, t, negotiation } = licenseCapFull(20260808, true);
    const starter = negotiation?.perks.find(
      (perk) => perk.id === 'GUARANTEED_STARTER',
    );
    const captaincy = negotiation?.perks.find(
      (perk) => perk.id === 'CAPTAINCY',
    );

    expect(starter).toMatchObject({
      available: false,
      blockedReason: t('market.promiseBlockedHeroLicense', {
        player: poweredTarget.name,
      }),
    });
    expect(starter?.heroLicenseReclaim).toBeUndefined();
    expect(captaincy).toMatchObject({ available: false });
    expect(starter?.blockedReason).not.toContain('Hero License is promised');
    expect(contractDraftPerk(negotiation)).toBe('TRAINING_PRIORITY');
  });

  it('passes the employed head coach through so the shortlist can lock replacement hires', () => {
    const state = fullCareer(1015);
    const headCoach = state.market!.coachCandidates[0];
    const withCoach = {
      ...state,
      market: {
        ...state.market!,
        headCoach,
        coachCandidates: state.market!.coachCandidates.slice(1),
      },
    };

    const source = careerMarketViewModelSource(withCoach);
    expect(source.headCoach).toEqual(headCoach);
    expect(
      marketViewModel(source).coaches.every((coach) => !coach.available),
    ).toBe(true);
  });

  it('keeps earned coach access after relegation', () => {
    const initial = fullCareer(1016);
    const candidate = {
      ...initial.market!.coachCandidates[0],
      level: 2 as const,
      requiredDivision: 4 as const,
      requiredFame: 0,
    };
    const relegated: GameState = {
      ...initial,
      m2: { ...initial.m2!, highestDivisionReached: 4 },
      market: { ...initial.market!, coachCandidates: [candidate] },
    };

    expect(
      marketViewModel(careerMarketViewModelSource(relegated)).coaches[0]
        .available,
    ).toBe(true);
    expect(
      hireCareerCoach(relegated, relegated.market!, candidate.id).headCoach?.id,
    ).toBe(candidate.id);
  });

  it('carries the sale-path cover verdict on listings a spare on leave would strand', () => {
    // The old adapter check only looked at injuryWeeks, so a squad whose only
    // spare goalkeeper was AWAY still showed an enabled sell action that the
    // sale path then rejected. The listing must stay visible, disabled, with
    // the reason — never enabled-then-erroring, never silently gone.
    const state = fullCareer(913);
    const target = state.players.find(
      (player) => player.clubId !== state.userClubId,
    )!;
    const market: CareerMarketState = {
      ...state.market!,
      scoutReports: [exactReport(target)],
    };
    const starters = new Set(
      state.lineups.find((lineup) => lineup.clubId === state.userClubId)!
        .playerIds,
    );
    const startingOutfielder = state.players.find(
      (player) =>
        player.clubId === state.userClubId &&
        player.role !== 'GK' &&
        starters.has(player.id),
    )!;

    const baseline = careerMarketViewModelSource(
      state,
      market,
    ).transferListings.find(
      (listing) =>
        listing.direction === 'SELL' &&
        listing.player.id === startingOutfielder.id,
    );
    expect(baseline?.saleBlockedReason).toBeUndefined();

    const withOutfieldSparesAway: GameState = {
      ...state,
      players: state.players.map((player) =>
        player.clubId === state.userClubId &&
        player.role !== 'GK' &&
        !starters.has(player.id)
          ? { ...player, awayWeeks: 2 }
          : player,
      ),
    };
    const source = careerMarketViewModelSource(withOutfieldSparesAway, market);
    const listing = source.transferListings.find(
      (candidate) =>
        candidate.direction === 'SELL' &&
        candidate.player.id === startingOutfielder.id,
    );
    expect(listing).toBeDefined();
    expect(listing?.saleBlockedReason).toBeDefined();
    // The adapter's verdict matches what the sale path itself enforces.
    expect(() =>
      listCareerPlayer(
        withOutfieldSparesAway,
        market,
        startingOutfielder.id,
        5,
      ),
    ).toThrow();
    const visible = marketViewModel(source).transfers.find(
      (candidate) => candidate.playerId === startingOutfielder.id,
    );
    expect(visible).toMatchObject({
      available: false,
      blockedReason: listing?.saleBlockedReason,
    });
  });

  it('treats an unlicensed hero as bench-locked when judging sale cover, like the sale path', () => {
    const state = fullCareer(913);
    const target = state.players.find(
      (player) => player.clubId !== state.userClubId,
    )!;
    const market: CareerMarketState = {
      ...state.market!,
      scoutReports: [exactReport(target)],
    };
    const starters = new Set(
      state.lineups.find((lineup) => lineup.clubId === state.userClubId)!
        .playerIds,
    );
    const startingOutfielder = state.players.find(
      (player) =>
        player.clubId === state.userClubId &&
        player.role !== 'GK' &&
        starters.has(player.id),
    )!;
    // An unlicensed hero cannot enter a lineup, so a bench full of them is no
    // cover at all — the old adapter would still have offered the sale.
    const withUnlicensedSpares: GameState = {
      ...state,
      players: state.players.map((player) =>
        player.clubId === state.userClubId &&
        player.role !== 'GK' &&
        !starters.has(player.id)
          ? {
              ...player,
              power: 'SUPER_SPEED' as const,
              powerTier: 1 as const,
              licensed: false,
            }
          : player,
      ),
    };
    const listing = careerMarketViewModelSource(
      withUnlicensedSpares,
      market,
    ).transferListings.find(
      (candidate) =>
        candidate.direction === 'SELL' &&
        candidate.player.id === startingOutfielder.id,
    );
    expect(listing).toBeDefined();
    expect(listing?.saleBlockedReason).toBeDefined();
    expect(() =>
      listCareerPlayer(withUnlicensedSpares, market, startingOutfielder.id, 5),
    ).toThrow();
  });

  it('requires an initialized market and rejects stale reports instead of inventing players', () => {
    const state = fullCareer(1115);
    expect(() =>
      careerMarketViewModelSource({ ...state, market: undefined }),
    ).toThrow('has not been initialized');
    const stale: CareerMarketState = {
      ...state.market!,
      scoutReports: [
        { ...exactReport(state.players[0]), playerId: 'missing-player' },
      ],
    };
    expect(() => careerMarketViewModelSource(state, stale)).toThrow(
      'does not reference a transfer target',
    );
  });
});
