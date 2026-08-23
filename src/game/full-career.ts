import {
  developmentPotentialCeiling,
  potentialTierForDivision,
  roleOverall,
} from './archetype-caps';
import {
  assignDistinctPlayerLooks,
  nextDistinctPlayerLook,
} from './player-appearance';
import { generateSeasonFixtures, pinOpeningLeagueOpponents } from './schedule';
import {
  createCareerMarketState,
  refreshCareerMarketForNewSeason,
} from './market-career';
import { applyPromotionWageClause } from './contract-wages';
import {
  CAREER_CLUB_FAME_CEILING,
  generatedPlayerWeeklyWage,
  reducedPlayerWeeklyWage,
} from './market';
import { isAvailableForSelection } from './lineup';
import { compareIds } from './ordering';
import {
  applyM2PromotionAndRelegation,
  clubSquadStrength,
  currentUserDivision,
  deterministicM2FinishOrders,
  initializeM2Career,
  planEndlessCareerSeasonTransition,
  quickResolveM2NationalCup,
  resolveM2CareerPlayerLifecycle,
  startM2NationalCup,
  synchronizeM2ActiveDivision,
} from './m2-career';
import {
  isClubLegend,
  tuneSquadToStrength,
  type DivisionLevel,
  type PyramidClub,
  type PyramidPlayer,
} from './pyramid';
import { difficultyRules } from './difficulty';
import { divisionAwardPrize } from './division-award-prize';
import {
  careerRosterCapacity,
  initializeSeasonYouthIntake,
  reconcileStoryYouthIntake,
  YOUTH_LAST_NAMES,
} from './youth-intake';
import { reconcileBoardUltimatumCandidates } from './board-ultimatum';
import { recordFanGain } from './fan-growth';
import {
  heroLicenseLimitForDivision,
  highestDivisionReached,
  recordHighestDivisionReached,
} from './promotion-progression';
import { generatedClubHeroCount, generatedClubPower } from './power-catalog';
import {
  isSpecialHeroId,
  specialHeroAttrs,
  specialHeroTargetOverall,
  specialHeroesForDivision,
  type SpecialHero,
} from './special-heroes';
import { prunedStatLines } from './season-recap';
import {
  createProvisionalSponsorPortfolio,
  createSeasonSponsorship,
  managedSponsorCapacity,
} from './sponsors';
import type {
  CareerPlayer,
  ClubLineupState,
  ClubState,
  GameState,
  LeagueStanding,
} from './types';

/**
 * Idempotent: an already-provisioned career is only reconciled, while one whose
 * M2 sidecars are missing — a fresh `createCareer` state, or a save written
 * before the pyramid existed — has them built here.
 */
export function enableFullCareer(state: GameState): GameState {
  if (state.m2 !== undefined && state.market !== undefined) {
    const reconciled = {
      ...state,
      players: reconcileAcademyPlayerNames(state),
      m2: recordHighestDivisionReached(state.m2),
      ...(state.phase === 'complete' ? { phase: 'season-end' as const } : {}),
      cashTransactions: state.cashTransactions ?? [],
      financialSafety: state.financialSafety ?? {
        consecutiveNegativeWeeks: 0,
        emergencyLoanUsed: false,
      },
    };
    const withIntake =
      reconciled.youthIntake === undefined
        ? {
            ...reconciled,
            youthIntake: initializeSeasonYouthIntake(reconciled),
          }
        : reconciled;
    return reconcileStoryYouthIntake(withIntake);
  }
  const balancedState =
    state.season === 1 &&
    state.week === 1 &&
    state.phase === 'manage' &&
    // Only the authored launch division is deliberately retuned. Generic
    // CareerSetup fixtures keep the ratings their caller supplied.
    state.userClubId === 'bramble-rovers' &&
    state.ledgers.length === 0 &&
    (state.cashTransactions?.length ?? 0) === 0 &&
    !state.facilities.trainingGroundBuilt &&
    (state.facilities.grid?.buildings.length ?? 0) === 0 &&
    state.facilities.grid?.construction === undefined &&
    state.fixtures.every((fixture) => fixture.status === 'scheduled')
      ? balanceOpeningDivision(state)
      : state;
  const userClub = balancedState.clubs.find(
    (club) => club.id === balancedState.userClubId,
  );
  if (userClub === undefined)
    throw new Error(`unknown user club ${balancedState.userClubId}`);
  const userPlayers = balancedState.players.filter(
    (player) => player.clubId === balancedState.userClubId,
  );
  if (balancedState.clubs.length !== 10 || userPlayers.length < 11) {
    throw new Error(
      'the full career requires one complete ten-club active division',
    );
  }
  let m2 = initializeM2Career({
    careerSeed: balancedState.careerSeed,
    userClub: {
      id: userClub.id,
      name: userClub.name,
      squadStrength: careerSquadStrength(userPlayers),
    },
  });
  m2 = synchronizeM2ActiveDivision(m2, balancedState, 5);
  m2 = startM2NationalCup(m2, balancedState.season);
  const fullState: GameState = {
    ...balancedState,
    phase:
      balancedState.phase === 'complete' ? 'season-end' : balancedState.phase,
    careerMode: 'full',
    m2,
    retiredPlayers: balancedState.retiredPlayers ?? [],
    pendingLegacyPlayerIds: balancedState.pendingLegacyPlayerIds ?? [],
    cashTransactions: balancedState.cashTransactions ?? [],
    financialSafety: state.financialSafety ?? {
      consecutiveNegativeWeeks: 0,
      emergencyLoanUsed: false,
    },
  };
  const withMarket: GameState = {
    ...fullState,
    market: createCareerMarketState(fullState, 5, clubFame(fullState)),
  };
  return {
    ...withMarket,
    youthIntake: initializeSeasonYouthIntake(withMarket),
  };
}

export function startNextFullCareerSeason(
  state: GameState,
  activeStandings: readonly LeagueStanding[],
): GameState {
  if (state.m2 === undefined) {
    throw new Error('the career has no M2 pyramid state');
  }
  const activeDivision = currentUserDivision(state.m2);
  let m2 = synchronizeM2ActiveDivision(state.m2, state, activeDivision);
  m2 = quickResolveM2NationalCup(m2);
  const finishOrders = deterministicM2FinishOrders(
    m2,
    state.season,
    activeDivision,
    activeStandings.map((row) => row.clubId),
  );
  m2 = applyM2PromotionAndRelegation(m2, finishOrders).state;
  // Chairman's 5% field growth is twice Cozy's 2.5%, so the difficulty has to
  // reach the opponent growth step.
  const transition = planEndlessCareerSeasonTransition(
    m2,
    state.season,
    difficultyRules(state),
    activeDivision === 1
      ? Object.fromEntries(
          activeStandings.map((standing) => [
            standing.clubId,
            standing.drawn + standing.lost,
          ]),
        )
      : {},
  );
  m2 = transition.state;

  // The division boards are paid here rather than by the ceremony that shows
  // them, for the reason cup prize money is: a grant folded into the state at a
  // point the career passes through exactly once cannot be paid twice by a
  // screen being re-entered, backed into, or killed halfway through. The
  // ceremony runs BEFORE this and displays a projection from the same pure
  // function; nothing has moved until the lines below run.
  //
  // `transition.division` is the division the club is entering, which is the one
  // the prize is sized against — the recap's own `division` is the one just
  // played, and for a promoted or relegated club they differ.
  const completedRecap = (state.seasonRecaps ?? []).find(
    (recap) => recap.season === state.season,
  );
  const awardPrize =
    completedRecap === undefined
      ? undefined
      : divisionAwardPrize({
          recap: completedRecap,
          userClubId: state.userClubId,
          targetDivision: transition.division,
        });

  const userPlayers = state.players.filter(
    (player) => player.clubId === state.userClubId,
  );
  const lifecycle = resolveM2CareerPlayerLifecycle(
    userPlayers,
    state.season,
    state.careerSeed,
  );
  const retiredIds = new Set(
    lifecycle.retiredPlayers.map((player) => player.id),
  );
  const replenishedUserPlayers = replenishUserSquad(
    lifecycle.activePlayers,
    state.userClubId,
    transition.nextSeason,
    state.careerSeed,
    transition.division,
    careerRosterCapacity({
      onboarding: state.onboarding,
      players: lifecycle.activePlayers,
      userClubId: state.userClubId,
    }),
  );
  const activeUserPlayers =
    transition.division < activeDivision
      ? replenishedUserPlayers.map((player) =>
          applyPromotionWageClause(player, state.season),
        )
      : replenishedUserPlayers;
  const userLineup = repairUserLineup(
    state.lineups.find((lineup) => lineup.clubId === state.userClubId),
    activeUserPlayers,
    retiredIds,
    new Map(lifecycle.retiredPlayers.map((player) => [player.id, player.role])),
  );
  const generated = generatedActiveDivision(
    transition.generatedOpponentClubs,
    transition.division,
  );
  const currentUserClub = state.clubs.find(
    (club) => club.id === state.userClubId,
  )!;
  const previousBestDivision = highestDivisionReached(state);
  const firstReachFanGain = Math.max(
    0,
    divisionFans(transition.division) - divisionFans(previousBestDivision),
  );
  const userClub: ClubState = {
    ...currentUserClub,
    // The user's gate, sponsor and ticket income scales with division exactly as
    // every generated opponent's does (see generatedActiveDivision below). This
    // used to spread the old club through unchanged, so fans, ticket price and
    // sponsor fee stayed frozen at their D5 starting values for the whole D5->D1
    // climb — docs/02's "each division up means better sponsors, bigger gates"
    // was never implemented. A newly reached division now adds its 500-fan
    // ladder step to the supporters the club already earned. Relegation never
    // removes fans, and returning to an already reached division does not pay
    // the permanent step twice.
    // The division-award prize is paid here, into the cash the new season opens
    // on. It used to be credited as Training Points a few lines below; the
    // board now writes a cheque instead, so it lands where every other prize
    // does and the season-opening balance already includes it.
    cash:
      awardPrize === undefined
        ? currentUserClub.cash
        : checkedAdd(
            currentUserClub.cash,
            awardPrize.money,
            'division award prize',
          ),
    fans: checkedAdd(
      currentUserClub.fans,
      firstReachFanGain,
      'first-reach division fans',
    ),
    ticketPrice: divisionTicketPrice(transition.division),
    sponsorMonthlyFee: divisionSponsorMonthlyFee(transition.division),
    weeklyWages: activeUserPlayers.reduce(
      (sum, player) => checkedAdd(sum, player.weeklyWage, 'user weekly wages'),
      0,
    ),
  };
  const season = transition.nextSeason;
  // The overlay runs over the joined roster, not `generated.players` alone: it
  // has to see the user's squad to know which characters have already been
  // signed away, or a bought hero quietly respawns on the new host.
  const overlaid = overlayDivisionSpecials({
    clubs: [userClub, ...generated.clubs],
    players: [...activeUserPlayers, ...generated.players],
    lineups: [userLineup, ...generated.lineups],
    division: transition.division,
    userClubId: state.userClubId,
  });
  const clubs = overlaid.clubs;
  const players = assignDistinctPlayerLooks(overlaid.players);
  const lineups = overlaid.lineups;
  const strengthByClubId = new Map<string, number>([
    [state.userClubId, clubSquadStrength(activeUserPlayers)],
    ...transition.generatedOpponentClubs.map(
      (club) => [club.id, club.squadStrength] as const,
    ),
  ]);
  const scheduleClubIds = pinOpeningLeagueOpponents(
    clubs.map((club) => club.id),
    state.userClubId,
    strengthByClubId,
  );
  const fixtures = generateSeasonFixtures(
    scheduleClubIds,
    season,
    state.careerSeed,
  );
  let nextM2 = synchronizeM2ActiveDivision(
    m2,
    { clubs, players },
    transition.division,
  );
  nextM2 = startM2NationalCup(nextM2, season);
  const retiredPlayers = [
    ...(state.retiredPlayers ?? []),
    ...lifecycle.retiredPlayers,
  ];
  const pendingLegacyPlayerIds = [
    ...(state.pendingLegacyPlayerIds ?? []),
    ...lifecycle.retiredPlayers
      .filter((player) =>
        isClubLegend({
          seasonsAtClub: player.seasonsAtClub,
          fame: player.fame,
        }),
      )
      .map((player) => player.id),
  ];
  const retirementAnnouncements = lifecycle.announcements.map(
    (announcement) => ({ ...announcement }),
  );
  const next: GameState = {
    ...state,
    season,
    week: 1,
    phase: 'manage',
    // Requests and story effects are measured in real weeks. A late-season
    // choice keeps its remaining time instead of being erased by promotion.
    // History survives too: the tab is a record of what you decided.
    //
    // The CLOCK survives too, and used to be reset to 0 here. The cadence floor
    // is a cooldown between requests — "he asked six weeks ago, give it a rest"
    // — and resetting made it bite a second time as a barrier at the start of
    // every season, silencing a pre-season the floor is longer than. A club
    // that went quiet for the last ten weeks of a season has served the wait
    // and can be asked in week 1; one that was asked in week 28 still waits.
    playerRequests: {
      weeksSinceRequest: state.playerRequests?.weeksSinceRequest ?? 0,
      effects: state.playerRequests?.effects ?? [],
      history: state.playerRequests?.history ?? [],
      ...(state.playerRequests?.lastAskingPlayerId === undefined
        ? {}
        : { lastAskingPlayerId: state.playerRequests.lastAskingPlayerId }),
    },
    clubs,
    fixtures,
    // Player leave also counts real weeks. Lineup repair already respects
    // availability, so the returning player's saved slot stays protected.
    players,
    lineups,
    seasonOpeningCash: userClub.cash,
    m2: nextM2,
    retiredPlayers,
    pendingLegacyPlayerIds,
    retirementAnnouncements,
    // The new roster has replaced the division that just finished, so rows
    // belonging to players who no longer exist anywhere can never be rendered
    // again, and neither can rows from a season no board still reads. Pruning
    // here rather than in the recap branch is what stops a season of dead rows
    // riding along for another full season; the recap recorded at week 30
    // already holds the podiums those rows produced. `state` is still the
    // pre-transition state, so `state.season` is the season just completed and
    // its rows survive.
    seasonStatLines: prunedStatLines({ ...state, players, retiredPlayers }),
    // Stamped even when it paid nothing, so an absent field always means "this
    // season has not been transitioned through yet" and never "won nothing".
    seasonRecaps:
      awardPrize === undefined
        ? state.seasonRecaps
        : (state.seasonRecaps ?? []).map((recap) =>
            recap.season === state.season
              ? { ...recap, divisionAwardPrize: awardPrize }
              : recap,
          ),
    clubBusiness: {
      ...state.clubBusiness,
      sponsorship: nextSeasonSponsorship(
        state,
        nextM2,
        transition.division,
        userClub.sponsorMonthlyFee,
        season,
      ),
    },
  };
  const withMarket: GameState = {
    ...next,
    market:
      state.market === undefined
        ? createCareerMarketState(
            next,
            highestDivisionReached(next),
            clubFame(next),
          )
        : refreshCareerMarketForNewSeason(
            next,
            state.market,
            highestDivisionReached(next),
            clubFame(next),
          ),
  };
  return recordFanGain(
    reconcileBoardUltimatumCandidates({
      ...withMarket,
      youthIntake: initializeSeasonYouthIntake(withMarket),
    }),
    userClub.fans - currentUserClub.fans,
  );
}

function nextSeasonSponsorship(
  state: GameState,
  nextM2: NonNullable<GameState['m2']>,
  division: DivisionLevel,
  nominalAnchor: number,
  season: number,
): GameState['clubBusiness']['sponsorship'] {
  const highest = Math.min(
    division,
    nextM2.highestDivisionReached ?? division,
  ) as DivisionLevel;
  const capacity = managedSponsorCapacity(highest);
  if (capacity === 0) {
    return { activeContracts: [], offers: [], portfolioSeason: season };
  }
  if (state.sponsorRules === undefined) {
    return {
      activeContracts: createProvisionalSponsorPortfolio(
        nominalAnchor,
        capacity,
        season,
      ),
      offers: [],
      portfolioSeason: season,
    };
  }
  return createSeasonSponsorship({
    rules: state.sponsorRules,
    careerSeed: state.careerSeed,
    season,
    division,
    difficulty: state.difficulty ?? 'COZY',
    highestDivisionReached: highest,
    nominalAnchor,
  });
}

function balanceOpeningDivision(state: GameState): GameState {
  const currentStrengths = new Map(
    state.clubs.map((club) => {
      const squad = state.players.filter((player) => player.clubId === club.id);
      if (squad.length < 11)
        throw new Error(`club ${club.id} needs at least eleven players`);
      return [club.id, clubSquadStrength(squad)] as const;
    }),
  );
  const opponentsWeakestFirst = state.clubs
    .filter((club) => club.id !== state.userClubId)
    .sort(
      (left, right) =>
        currentStrengths.get(left.id)! - currentStrengths.get(right.id)! ||
        compareIds(left.id, right.id),
    );
  // The opening is still tilted against the player — 42 against a field of
  // 42..50 leaves the user level with the weakest club and behind the other
  // eight — but no longer alone at the bottom. Climbing out is meant to take a
  // season or two of facilities and training, not a fair fight on day one.
  //
  // The user opened on 40 until an owner review of a real Season 1: that career
  // finished 7th on 22 points with ELEVEN draws in 18, having been handed the
  // division's strongest club in match one (lost 0-13). The schedule pin now
  // opens mid-table, and this raises the floor by two.
  //
  // Re-measured over three seeds, holding squad strength for the whole season
  // and doing NO management (no training, signings or facilities), so read every
  // row as a floor rather than a forecast:
  //
  // | user strength | finishes         | points     | first league win |
  // |---------------|------------------|------------|------------------|
  // | 40 (was)      | 10th, 9th, 10th  | 3, 8, 8    | never, 5, 5      |
  // | 42 (now)      | 9th, 8th, 8th    | 11, 13, 12 | 2, 5, 12         |
  // | 43            | 10th, 8th, 9th   | 7, 14, 12  | 3, 5, 8          |
  // | 45            | 9th, 8th, 6th    | 14, 16, 18 | 4, 5, 3          |
  //
  // 43 measured no better than 42, which is why the bump stops here. The table
  // this replaced claimed +5 promoted the user in 2nd on 34 points; it does not,
  // and no row of it reproduced. An active manager is worth roughly +5 of squad
  // strength on top of these numbers — the real career above out-scored every
  // unmanaged 45 run — so re-measure before trusting any of it again.
  const targetStrengthByClubId = new Map<string, number>([
    [state.userClubId, 42],
  ]);
  opponentsWeakestFirst.forEach((club, index) => {
    targetStrengthByClubId.set(club.id, 42 + index);
  });

  const players = state.clubs.flatMap((club) => {
    const squad = state.players.filter((player) => player.clubId === club.id);
    const targetStrength = targetStrengthByClubId.get(club.id);
    if (targetStrength === undefined)
      throw new Error(`missing opening strength for ${club.id}`);
    return tuneSquadToStrength(squad, targetStrength).map((player) => ({
      ...player,
      signingStatTotal: Object.values(player.attrs).reduce(
        (sum, value) => sum + value,
        0,
      ),
    }));
  });
  const balancedStrengths = new Map(
    state.clubs.map(
      (club) =>
        [
          club.id,
          clubSquadStrength(
            players.filter((player) => player.clubId === club.id),
          ),
        ] as const,
    ),
  );
  const scheduleClubIds = pinOpeningLeagueOpponents(
    state.clubs.map((club) => club.id),
    state.userClubId,
    balancedStrengths,
  );
  const fixtures = generateSeasonFixtures(
    scheduleClubIds,
    state.season,
    state.careerSeed,
  );
  // Last, on purpose. The ladder above and the pin are the most carefully tuned
  // numbers in the game, and neither should see a special: the hero is added on
  // top of a finished division, which is what makes "additive" literally true.
  const overlaid = overlayDivisionSpecials({
    clubs: state.clubs,
    players,
    lineups: state.lineups,
    division: 5,
    userClubId: state.userClubId,
  });
  return {
    ...state,
    clubs: overlaid.clubs,
    players: overlaid.players,
    lineups: overlaid.lineups,
    fixtures,
  };
}

function generatedActiveDivision(
  clubs: readonly PyramidClub[],
  division: DivisionLevel,
): { clubs: ClubState[]; players: CareerPlayer[]; lineups: ClubLineupState[] } {
  const generatedClubs: ClubState[] = [];
  const players: CareerPlayer[] = [];
  const lineups: ClubLineupState[] = [];
  for (const club of clubs) {
    let heroEligibleIndex = 0;
    const clubPlayers = club.squad.map((player) => {
      const eligibleIndex =
        player.role === 'MID' || player.role === 'FWD'
          ? heroEligibleIndex++
          : -1;
      return opponentCareerPlayer(player, division, eligibleIndex);
    });
    generatedClubs.push({
      id: club.id,
      name: club.name,
      cash: 25_000 * (6 - division),
      fans: divisionFans(division),
      ticketPrice: divisionTicketPrice(division),
      sponsorMonthlyFee: divisionSponsorMonthlyFee(division),
      weeklyWages: clubPlayers.reduce(
        (sum, player) =>
          checkedAdd(sum, player.weeklyWage, 'opponent weekly wages'),
        0,
      ),
    });
    players.push(...clubPlayers);
    lineups.push({ clubId: club.id, playerIds: startingEleven(clubPlayers) });
  }
  return { clubs: generatedClubs, players, lineups };
}

function opponentCareerPlayer(
  player: PyramidPlayer,
  division: DivisionLevel,
  eligibleIndex: number,
): CareerPlayer {
  const heroCount = generatedClubHeroCount(player.clubId, division);
  const heroEligible = eligibleIndex >= 0;
  const power =
    heroEligible && eligibleIndex < heroCount
      ? generatedClubPower(player.clubId, eligibleIndex, player.role)
      : undefined;
  const potential = opponentPotential(player.id, division);
  return {
    id: player.id,
    clubId: player.clubId,
    name: player.name,
    role: player.role,
    ...(player.lookId === undefined ? {} : { lookId: player.lookId }),
    attrs: { ...player.attrs },
    ...(power === undefined
      ? {}
      : {
          power,
          powerTier: (division === 1 ? 3 : division <= 3 ? 2 : 1) as 1 | 2 | 3,
        }),
    licensed: power !== undefined,
    weeklyWage: generatedPlayerWeeklyWage(player.attrs, division),
    onHeroWage: power !== undefined,
    contractSeasonsRemaining: 2,
    morale: player.morale,
    injuryWeeks: 0,
    age: player.age,
    archetype: player.archetype,
    potential,
    potentialCeiling: developmentPotentialCeiling({
      id: player.id,
      role: player.role,
      attrs: player.attrs,
      age: player.age,
      potential,
    }),
    consistency: 70,
    personality: player.personality,
    condition: player.condition,
    seasonsAtClub: player.seasonsAtClub,
    fame: player.fame,
    retirementAge: 36,
    retirementAnnounced: false,
    consecutiveLowMoraleWeeks: player.consecutiveLowMoraleWeeks,
    signingStatTotal: Object.values(player.attrs).reduce(
      (sum, value) => sum + value,
      0,
    ),
  };
}

function opponentPotential(
  playerId: string,
  division: DivisionLevel,
): 1 | 2 | 3 | 4 | 5 {
  let value = 2166136261;
  for (let index = 0; index < playerId.length; index += 1) {
    value = Math.imul(value ^ playerId.charCodeAt(index), 16777619) >>> 0;
  }
  return potentialTierForDivision(division, value % 100);
}

/**
 * Division income levers, shared by the user club and every generated opponent
 * so the two can never drift apart again. A lower division number is a higher
 * tier, so each promotion raises all three.
 */
export function divisionFans(division: DivisionLevel): number {
  return 500 * (6 - division);
}

export function divisionTicketPrice(division: DivisionLevel): number {
  return 3 + (6 - division);
}

export function divisionSponsorMonthlyFee(division: DivisionLevel): number {
  return ({ 5: 3_000, 4: 4_000, 3: 6_000, 2: 8_000, 1: 10_000 } as const)[
    division
  ];
}

/**
 * Puts the division's named superheroes on the strongest rival club.
 *
 * Called at both season starts and nowhere else. In season 1 it runs at the very
 * end of `balanceOpeningDivision`, after the 42-50 strength ladder and the
 * fixture pin, so none of the opening's tuned numbers ever sees a special. From
 * season 2 it runs straight after `generatedActiveDivision` and before looks are
 * assigned.
 *
 * Rebuilding from scratch each season is the whole design: the heroes belong to
 * the division, not to a club, so a club that is strongest this year fields them
 * and a club that is relegated leaves them behind.
 */
function overlayDivisionSpecials(input: {
  clubs: readonly ClubState[];
  players: readonly CareerPlayer[];
  lineups: readonly ClubLineupState[];
  division: DivisionLevel;
  userClubId: string;
}): {
  clubs: ClubState[];
  players: CareerPlayer[];
  lineups: ClubLineupState[];
} {
  // Last season's specials arrive back through the pyramid round trip. They are
  // dropped before anything is measured, so the host is picked on ordinary
  // strength alone and a character can never be double-booked.
  const carried = input.players.filter(
    (player) =>
      !isSpecialHeroId(player.id) || player.clubId === input.userClubId,
  );
  const signedIds = new Set(
    carried
      .filter(
        (player) =>
          player.clubId === input.userClubId && isSpecialHeroId(player.id),
      )
      .map((player) => player.id),
  );
  // A hero the user has bought is gone from the rival pool for the rest of the
  // save. The host simply fields one fewer rather than being handed a stand-in.
  const heroes = specialHeroesForDivision(input.division).filter(
    (hero) => !signedIds.has(hero.id),
  );
  if (heroes.length === 0) {
    return {
      clubs: [...input.clubs],
      players: carried,
      lineups: [...input.lineups],
    };
  }

  const rivals = input.clubs.filter((club) => club.id !== input.userClubId);
  if (rivals.length === 0) {
    return {
      clubs: [...input.clubs],
      players: carried,
      lineups: [...input.lineups],
    };
  }
  const strengthByClubId = new Map(
    rivals.map((club) => {
      const squad = carried.filter((player) => player.clubId === club.id);
      return [
        club.id,
        squad.length === 0 ? 0 : clubSquadStrength(squad),
      ] as const;
    }),
  );
  const hostId = rivals
    .slice()
    .sort(
      (left, right) =>
        strengthByClubId.get(right.id)! - strengthByClubId.get(left.id)! ||
        compareIds(left.id, right.id),
    )[0].id;

  const hostSquad = carried.filter((player) => player.clubId === hostId);
  const base = Math.max(
    ...hostSquad.map((player) => roleOverall(player.role, player.attrs)),
  );
  const specials = heroes.map((hero, index) =>
    buildSpecialHeroPlayer({
      hero,
      clubId: hostId,
      division: input.division,
      target: specialHeroTargetOverall(base, heroes.length, index + 1),
    }),
  );

  // The named specials own the first field licenses. Excess generated heroes
  // become ordinary players on this season's host. Merely unlicensing them is
  // not enough: a generated squad can have no same-role ordinary reserve, so
  // startingEleven would have to field an unlicensed hero and still crash.
  // Without this reconciliation, the D2 host can start three generated heroes
  // plus three specials against a three-license cap.
  const fieldLicenseLimit = heroLicenseLimitForDivision(input.division);
  let ordinaryLicenseSlots = Math.max(0, fieldLicenseLimit - specials.length);
  const adjustedCarried = carried.map((player) => {
    if (
      player.clubId !== hostId ||
      player.power === undefined ||
      player.licensed !== true
    ) {
      return player;
    }
    if (ordinaryLicenseSlots > 0) {
      ordinaryLicenseSlots -= 1;
      return player;
    }
    const ordinary = { ...player };
    delete ordinary.power;
    delete ordinary.powerTier;
    ordinary.licensed = false;
    ordinary.onHeroWage = false;
    return ordinary;
  });
  const adjustedHostSquad = adjustedCarried.filter(
    (player) => player.clubId === hostId,
  );

  // Specials come first in the HOST'S slice, because startingEleven takes the
  // first N of each role in array order — an appended special becomes the sixth
  // defender and never plays. They go LAST in the roster as a whole, so the
  // global ordering every other caller sees is undisturbed: putting them at
  // index 0 silently changed which player "the first rival forward" means.
  const hostPlayers = [...specials, ...adjustedHostSquad];
  const players = [...adjustedCarried, ...specials];
  const clubs = input.clubs.map((club) =>
    club.id === hostId
      ? {
          ...club,
          weeklyWages: hostPlayers.reduce(
            (sum, player) =>
              checkedAdd(sum, player.weeklyWage, 'special hero host wages'),
            0,
          ),
        }
      : club,
  );
  /**
   * Rebuild the host, and any club whose lineup no longer names its own squad.
   *
   * Rebuilding only the host was not enough. `carried` above drops every
   * non-user special before the measuring starts, so when the host changes —
   * which any change to squad strength can do — the PREVIOUS host keeps an
   * eleven naming a character who is no longer in its squad, or in the league
   * at all. Nothing downstream notices until the save is serialized, where it
   * surfaces as `lineup player belongs to another club`, a long way from here.
   *
   * Checked against each club's own final squad rather than against a list of
   * specials: any future reassignment gets the same repair for free.
   */
  const squadByClubId = new Map<string, CareerPlayer[]>();
  for (const player of players) {
    const squad = squadByClubId.get(player.clubId);
    if (squad === undefined) squadByClubId.set(player.clubId, [player]);
    else squad.push(player);
  }
  const lineups = input.lineups.map((lineup) => {
    if (lineup.clubId === hostId)
      return { clubId: hostId, playerIds: startingEleven(hostPlayers) };
    const squad = squadByClubId.get(lineup.clubId) ?? [];
    const ownSquadIds = new Set(squad.map((player) => player.id));
    if (lineup.playerIds.every((playerId) => ownSquadIds.has(playerId)))
      return lineup;
    return { clubId: lineup.clubId, playerIds: startingEleven(squad) };
  });
  return { clubs, players, lineups };
}

function buildSpecialHeroPlayer(input: {
  hero: SpecialHero;
  clubId: string;
  division: DivisionLevel;
  target: number;
}): CareerPlayer {
  const attrs = specialHeroAttrs(input.hero.role, input.target);
  const potential = 5;
  return {
    id: input.hero.id,
    clubId: input.clubId,
    name: input.hero.name,
    role: input.hero.role,
    lookId: input.hero.lookId,
    attrs,
    power: input.hero.power,
    powerTier: (input.division === 1 ? 3 : input.division <= 3 ? 2 : 1) as
      1 | 2 | 3,
    licensed: true,
    weeklyWage: generatedPlayerWeeklyWage(attrs, input.division),
    onHeroWage: true,
    contractSeasonsRemaining: 3,
    morale: 70,
    injuryWeeks: 0,
    age: 26,
    archetype: 'All-Rounder',
    potential,
    potentialCeiling: developmentPotentialCeiling({
      id: input.hero.id,
      role: input.hero.role,
      attrs,
      age: 26,
      potential,
    }),
    consistency: 90,
    personality: 'Professional',
    condition: 100,
    seasonsAtClub: 0,
    fame: 0,
    retirementAge: 36,
    retirementAnnounced: false,
    consecutiveLowMoraleWeeks: 0,
    signingStatTotal: Object.values(attrs).reduce(
      (sum, value) => sum + value,
      0,
    ),
  };
}

function startingEleven(players: readonly CareerPlayer[]): string[] {
  const take = (role: CareerPlayer['role'], count: number) =>
    players
      .filter((player) => player.role === role)
      .slice(0, count)
      .map((player) => player.id);
  const ids = [
    ...take('GK', 1),
    ...take('DEF', 4),
    ...take('MID', 4),
    ...take('FWD', 2),
  ];
  if (ids.length !== 11)
    throw new Error('generated opponent cannot form a starting eleven');
  return ids;
}

/**
 * Slot order carries meaning: slot 0 must hold the goalkeeper (`buildTeamDef`
 * rejects anything else) and the remaining indices encode formation position.
 * Replacements are therefore written into the vacated slot — filtering the
 * array and appending would shift every survivor down one place and eventually
 * leave an outfielder keeping goal, which bricks the career.
 */
function repairUserLineup(
  current: ClubLineupState | undefined,
  players: readonly CareerPlayer[],
  retiredIds: ReadonlySet<string>,
  retiredRoleById: ReadonlyMap<string, CareerPlayer['role']>,
): ClubLineupState {
  if (current === undefined) throw new Error('the user club has no lineup');
  const playerById = new Map(players.map((player) => [player.id, player]));
  const slots: Array<string | undefined> = current.playerIds.map((id) =>
    retiredIds.has(id) || !playerById.has(id) ? undefined : id,
  );
  const selected = new Set(
    slots.filter((id): id is string => id !== undefined),
  );
  for (let index = 0; index < slots.length; index += 1) {
    if (slots[index] !== undefined) continue;
    const vacatedId = current.playerIds[index];
    const vacatedRole =
      retiredRoleById.get(vacatedId) ?? playerById.get(vacatedId)?.role;
    // Availability, not just a free shirt. Injuries deliberately survive the
    // season boundary (only `awayWeeks` is zeroed), so a backfill that ignored
    // it handed the retired starter's slot to a reserve who is still hurt —
    // and then every lineup edit on week 1, including a swap of an unrelated
    // player, threw `unavailable player <id> must be replaced in the lineup`.
    // The last-resort pick still ignores it so a thin squad fields eleven.
    const free = (player: CareerPlayer): boolean =>
      !selected.has(player.id) && isAvailableForSelection(player);
    const sameRole = players.find(
      (player) => free(player) && player.role === vacatedRole,
    );
    const fallback =
      index === 0
        ? players.find((player) => free(player) && player.role === 'GK')
        : players.find((player) => free(player) && player.role !== 'GK');
    const replacement =
      sameRole ??
      fallback ??
      players.find(free) ??
      players.find((player) => !selected.has(player.id));
    if (replacement !== undefined) {
      slots[index] = replacement.id;
      selected.add(replacement.id);
    }
  }
  const retained = slots.filter((id): id is string => id !== undefined);
  for (const player of players) {
    if (retained.length >= 11) break;
    if (!selected.has(player.id)) {
      retained.push(player.id);
      selected.add(player.id);
    }
  }
  if (retained.length !== 11)
    throw new Error('retirements leave the user without a starting eleven');
  ensureKeeperFirst(retained, players);
  return { clubId: current.clubId, playerIds: retained };
}

/**
 * Restores the slot-0 keeper contract in place. Swapping with a keeper already
 * in the eleven is preferred; only when the eleven has none does a spare come
 * in from the squad.
 */
function ensureKeeperFirst(
  playerIds: string[],
  players: readonly CareerPlayer[],
): void {
  const roleById = new Map(players.map((player) => [player.id, player.role]));
  if (playerIds.length === 0 || roleById.get(playerIds[0]) === 'GK') return;
  const keeperIndex = playerIds.findIndex((id) => roleById.get(id) === 'GK');
  if (keeperIndex > 0) {
    const keeper = playerIds[keeperIndex];
    playerIds[keeperIndex] = playerIds[0];
    playerIds[0] = keeper;
    return;
  }
  const spare = players.find(
    (player) => player.role === 'GK' && !playerIds.includes(player.id),
  );
  if (spare !== undefined) playerIds[0] = spare.id;
}

const ACADEMY_ROLE_TARGETS: Readonly<Record<CareerPlayer['role'], number>> = {
  GK: 2,
  DEF: 5,
  MID: 5,
  FWD: 4,
};
const ACADEMY_NAMES = [
  'Ari',
  'Ben',
  'Cal',
  'Dara',
  'Eli',
  'Finn',
  'Gio',
  'Hugo',
  'Ivo',
  'Jae',
  'Kai',
  'Leo',
  'Milo',
  'Nico',
  'Ollie',
  'Paz',
] as const;

function academyPlayerName(
  careerSeed: number,
  season: number,
  id: string,
): string {
  const value = stableYouthValue(careerSeed, season, id);
  return `${ACADEMY_NAMES[value % ACADEMY_NAMES.length]} ${YOUTH_LAST_NAMES[(value >>> 8) % YOUTH_LAST_NAMES.length]}`;
}

function reconcileAcademyPlayerNames(state: GameState): CareerPlayer[] {
  return state.players.map((player) => {
    const season = /-academy-s(\d+)-(?:gk|def|mid|fwd)-\d+$/i.exec(
      player.id,
    )?.[1];
    return season !== undefined && / Academy \d+$/.test(player.name)
      ? {
          ...player,
          name: academyPlayerName(state.careerSeed, Number(season), player.id),
        }
      : player;
  });
}

/**
 * Keeps the endless career playable even after a whole generation retires.
 *
 * The refill fills real roster vacancies, never per-role targets on their own:
 * the market gates on the total roster and not per role, so a full squad can
 * sit above its target in one role and below it in another. Filling every
 * shortage there pushed the club past the capacity every other system enforces
 * and it paid the extra wage forever. Each empty place goes to the role that is
 * furthest below target.
 */
function replenishUserSquad(
  players: readonly CareerPlayer[],
  userClubId: string,
  season: number,
  careerSeed: number,
  division: DivisionLevel,
  capacity: number,
): CareerPlayer[] {
  const result = players.map((player) => ({
    ...player,
    attrs: { ...player.attrs },
  }));
  const existingIds = new Set(result.map((player) => player.id));
  const roles = ['GK', 'DEF', 'MID', 'FWD'] as const;
  const shortages = new Map(
    roles.map((role) => [
      role,
      ACADEMY_ROLE_TARGETS[role] -
        result.filter((player) => player.role === role).length,
    ]),
  );
  const intakeNumbers = new Map(roles.map((role) => [role, 1]));
  for (let place = result.length; place < capacity; place += 1) {
    const role = roles.reduce((worst, candidate) =>
      shortages.get(candidate)! > shortages.get(worst)! ? candidate : worst,
    );
    if (shortages.get(role)! <= 0) break;
    let intakeNumber = intakeNumbers.get(role)!;
    let id = `${userClubId}-academy-s${season}-${role.toLowerCase()}-${intakeNumber}`;
    while (existingIds.has(id)) {
      intakeNumber += 1;
      id = `${userClubId}-academy-s${season}-${role.toLowerCase()}-${intakeNumber}`;
    }
    existingIds.add(id);
    const player = academyPlayer(
      id,
      userClubId,
      role,
      season,
      careerSeed,
      division,
    );
    result.push({
      ...player,
      lookId: nextDistinctPlayerLook(player, result),
    });
    shortages.set(role, shortages.get(role)! - 1);
    intakeNumbers.set(role, intakeNumber + 1);
  }
  return result;
}

/** @i18n-fallback Generated player names are product data and stay English. */
function academyPlayer(
  id: string,
  clubId: string,
  role: CareerPlayer['role'],
  season: number,
  careerSeed: number,
  division: DivisionLevel,
): CareerPlayer {
  const value = stableYouthValue(careerSeed, season, id);
  const base = 38 + (value % 13);
  const attrs = {
    pac: Math.min(99, base + (role === 'FWD' ? 6 : 2)),
    sho: Math.min(99, base + (role === 'FWD' ? 8 : 0)),
    pas: Math.min(99, base + (role === 'MID' ? 7 : 1)),
    def: Math.min(99, base + (role === 'DEF' ? 8 : role === 'GK' ? 5 : 0)),
    tec: Math.min(99, base + (role === 'MID' ? 6 : 2)),
    sta: Math.min(99, base + 4),
    ref: Math.min(99, base + (role === 'GK' ? 10 : 0)),
  };
  const potential = potentialTierForDivision(division, (value >>> 5) % 100);
  const personalities = [
    'Fiery',
    'Loyal',
    'Joker',
    'Professional',
    'Timid',
  ] as const;
  return {
    id,
    clubId,
    name: academyPlayerName(careerSeed, season, id),
    role,
    attrs,
    licensed: false,
    weeklyWage: reducedPlayerWeeklyWage(120 + potential * 30),
    onHeroWage: false,
    contractSeasonsRemaining: 3,
    morale: 60,
    injuryWeeks: 0,
    age: 17,
    archetype:
      role === 'GK'
        ? 'Wall'
        : role === 'DEF'
          ? 'Anchor'
          : role === 'MID'
            ? 'Playmaker'
            : 'Sniper',
    potential,
    potentialCeiling: developmentPotentialCeiling({
      id,
      role,
      attrs,
      age: 17,
      potential,
    }),
    consistency: 55 + ((value >>> 9) % 21),
    personality: personalities[(value >>> 14) % personalities.length],
    condition: 100,
    seasonsAtClub: 0,
    fame: 0,
    retirementAge: 35 + ((value >>> 17) % 3),
    retirementAnnounced: false,
    signingStatTotal: Object.values(attrs).reduce(
      (sum, rating) => sum + rating,
      0,
    ),
  };
}

function stableYouthValue(
  careerSeed: number,
  season: number,
  id: string,
): number {
  let value = (careerSeed ^ Math.imul(season, 0x9e3779b1)) >>> 0;
  for (let index = 0; index < id.length; index += 1) {
    value = Math.imul(value ^ id.charCodeAt(index), 0x01000193) >>> 0;
  }
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d) >>> 0;
  return (value ^ (value >>> 15)) >>> 0;
}

function careerSquadStrength(players: readonly CareerPlayer[]): number {
  return clubSquadStrength(players);
}

function clubFame(state: GameState): number {
  return Math.max(
    0,
    Math.min(
      CAREER_CLUB_FAME_CEILING,
      state.players
        .filter((player) => player.clubId === state.userClubId)
        .reduce(
          (sum, player) => sum + (player.fame ?? 0),
          state.market?.clubFameAdjustment ?? 0,
        ),
    ),
  );
}

function checkedAdd(left: number, right: number, label: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result))
    throw new Error(`${label} exceeds the safe integer range`);
  return result;
}
