import type { PowerId } from '../sim/types';
import { generateSeasonFixtures } from './schedule';
import { createCareerMarketState, refreshCareerMarketForNewSeason } from './market-career';
import {
  applyM2PromotionAndRelegation,
  currentUserDivision,
  deterministicM2FinishOrders,
  initializeM2Career,
  planEndlessCareerSeasonTransition,
  quickResolveM2NationalCup,
  resolveM2CareerPlayerLifecycle,
  startM2NationalCup,
  synchronizeM2ActiveDivision,
} from './m2-career';
import { isClubLegend, type DivisionLevel, type PyramidClub, type PyramidPlayer } from './pyramid';
import { expireYouthIntakeWindow, initializeSeasonYouthIntake } from './youth-intake';
import { reconcileBoardUltimatumCandidates } from './board-ultimatum';
import type {
  CareerPlayer,
  ClubLineupState,
  ClubState,
  GameState,
  LeagueStanding,
} from './types';

const POWER_ROTATION: readonly PowerId[] = ['SUPER_SPEED', 'SUPER_STRENGTH', 'FIRE_TORCH'];

export function enableFullCareer(state: GameState): GameState {
  if (state.careerMode === 'full' && state.m2 !== undefined && state.market !== undefined) {
    const reconciled = {
      ...state,
      ...(state.phase === 'complete' ? { phase: 'season-end' as const } : {}),
      cashTransactions: state.cashTransactions ?? [],
      financialSafety: state.financialSafety ?? {
        consecutiveNegativeWeeks: 0,
        emergencyLoanUsed: false,
      },
    };
    const withIntake = reconciled.youthIntake === undefined
      ? { ...reconciled, youthIntake: initializeSeasonYouthIntake(reconciled) }
      : reconciled;
    return expireYouthIntakeWindow(withIntake);
  }
  const userClub = state.clubs.find(club => club.id === state.userClubId);
  if (userClub === undefined) throw new Error(`unknown user club ${state.userClubId}`);
  const userPlayers = state.players.filter(player => player.clubId === state.userClubId);
  if (state.clubs.length !== 10 || userPlayers.length < 11) {
    throw new Error('the full career requires one complete ten-club active division');
  }
  let m2 = initializeM2Career({
    careerSeed: state.careerSeed,
    userClub: {
      id: userClub.id,
      name: userClub.name,
      squadStrength: careerSquadStrength(userPlayers),
    },
  });
  m2 = synchronizeM2ActiveDivision(m2, state, 5);
  m2 = startM2NationalCup(m2, state.season);
  const fullState: GameState = {
    ...state,
    phase: state.phase === 'complete' ? 'season-end' : state.phase,
    careerMode: 'full',
    m2,
    retiredPlayers: state.retiredPlayers ?? [],
    pendingLegacyPlayerIds: state.pendingLegacyPlayerIds ?? [],
    cashTransactions: state.cashTransactions ?? [],
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
  if (state.careerMode !== 'full' || state.m2 === undefined) {
    throw new Error('the career is not in full mode');
  }
  const activeDivision = currentUserDivision(state.m2);
  let m2 = synchronizeM2ActiveDivision(state.m2, state, activeDivision);
  m2 = quickResolveM2NationalCup(m2);
  const finishOrders = deterministicM2FinishOrders(
    m2,
    state.season,
    activeDivision,
    activeStandings.map(row => row.clubId),
  );
  m2 = applyM2PromotionAndRelegation(m2, finishOrders).state;
  const transition = planEndlessCareerSeasonTransition(m2, state.season);
  m2 = transition.state;

  const userPlayers = state.players.filter(player => player.clubId === state.userClubId);
  const lifecycle = resolveM2CareerPlayerLifecycle(userPlayers, state.season, state.careerSeed);
  const retiredIds = new Set(lifecycle.retiredPlayers.map(player => player.id));
  const activeUserPlayers = replenishUserSquad(
    lifecycle.activePlayers,
    state.userClubId,
    transition.nextSeason,
    state.careerSeed,
  );
  const userLineup = repairUserLineup(
    state.lineups.find(lineup => lineup.clubId === state.userClubId),
    activeUserPlayers,
    retiredIds,
    new Map(lifecycle.retiredPlayers.map(player => [player.id, player.role])),
  );
  const generated = generatedActiveDivision(transition.generatedOpponentClubs, transition.division);
  const currentUserClub = state.clubs.find(club => club.id === state.userClubId)!;
  const userClub: ClubState = {
    ...currentUserClub,
    weeklyWages: activeUserPlayers.reduce(
      (sum, player) => checkedAdd(sum, player.weeklyWage, 'user weekly wages'),
      0,
    ),
  };
  const season = transition.nextSeason;
  const clubs = [userClub, ...generated.clubs];
  const players = [...activeUserPlayers, ...generated.players];
  const lineups = [userLineup, ...generated.lineups];
  const fixtures = generateSeasonFixtures(clubs.map(club => club.id), season, state.careerSeed);
  let nextM2 = synchronizeM2ActiveDivision(m2, { clubs, players }, transition.division);
  nextM2 = startM2NationalCup(nextM2, season);
  const retiredPlayers = [...(state.retiredPlayers ?? []), ...lifecycle.retiredPlayers];
  const pendingLegacyPlayerIds = [
    ...(state.pendingLegacyPlayerIds ?? []),
    ...lifecycle.retiredPlayers
      .filter(player => isClubLegend({ seasonsAtClub: player.seasonsAtClub, fame: player.fame }))
      .map(player => player.id),
  ];
  const retirementAnnouncements = lifecycle.announcements.map(announcement => ({ ...announcement }));
  const next: GameState = {
    ...state,
    season,
    week: 1,
    phase: 'manage',
    clubs,
    fixtures,
    players,
    lineups,
    trainingPlan: state.trainingPlan === undefined
      ? undefined
      : {
          ...state.trainingPlan,
          assignedPlayerIds: state.trainingPlan.assignedPlayerIds.filter(id => !retiredIds.has(id)),
        },
    m2: nextM2,
    retiredPlayers,
    pendingLegacyPlayerIds,
    retirementAnnouncements,
  };
  const withMarket: GameState = {
    ...next,
    market: state.market === undefined
      ? createCareerMarketState(next, transition.division, clubFame(next))
      : refreshCareerMarketForNewSeason(
          next,
          state.market,
          transition.division,
          clubFame(next),
        ),
  };
  return reconcileBoardUltimatumCandidates({
    ...withMarket,
    youthIntake: initializeSeasonYouthIntake(withMarket),
  });
}

function generatedActiveDivision(
  clubs: readonly PyramidClub[],
  division: DivisionLevel,
): { clubs: ClubState[]; players: CareerPlayer[]; lineups: ClubLineupState[] } {
  const generatedClubs: ClubState[] = [];
  const players: CareerPlayer[] = [];
  const lineups: ClubLineupState[] = [];
  for (const club of clubs) {
    const clubPlayers = club.squad.map((player, index) => opponentCareerPlayer(
      player,
      division,
      index,
    ));
    generatedClubs.push({
      id: club.id,
      name: club.name,
      cash: 25_000 * (6 - division),
      fans: 500 * (6 - division),
      ticketPrice: 3 + (6 - division),
      sponsorMonthlyFee: 2_000 * (6 - division),
      weeklyWages: clubPlayers.reduce(
        (sum, player) => checkedAdd(sum, player.weeklyWage, 'opponent weekly wages'),
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
  squadIndex: number,
): CareerPlayer {
  const heroCount = division === 1 ? 4 : division <= 3 ? 3 : 2;
  const heroEligible = player.role === 'MID' || player.role === 'FWD';
  const eligibleIndex = heroEligible ? Math.max(0, squadIndex - 7) : -1;
  const power = heroEligible && eligibleIndex < heroCount
    ? POWER_ROTATION[eligibleIndex % POWER_ROTATION.length]
    : undefined;
  const average = Object.values(player.attrs).reduce((sum, value) => sum + value, 0) / 7;
  return {
    id: player.id,
    clubId: player.clubId,
    name: player.name,
    role: player.role,
    attrs: { ...player.attrs },
    ...(power === undefined
      ? {}
      : { power, powerTier: (division === 1 ? 3 : division <= 3 ? 2 : 1) as 1 | 2 | 3 }),
    licensed: power !== undefined,
    weeklyWage: Math.max(150, Math.round(average * (7 - division))),
    onHeroWage: power !== undefined,
    contractSeasonsRemaining: 2,
    morale: player.morale,
    injuryWeeks: 0,
    age: player.age,
    archetype: player.archetype,
    potential: 3,
    consistency: 70,
    personality: player.personality,
    condition: player.condition,
    seasonsAtClub: player.seasonsAtClub,
    fame: player.fame,
    retirementAge: 36,
    retirementAnnounced: false,
    consecutiveLowMoraleWeeks: player.consecutiveLowMoraleWeeks,
    signingStatTotal: Object.values(player.attrs).reduce((sum, value) => sum + value, 0),
  };
}

function startingEleven(players: readonly CareerPlayer[]): string[] {
  const take = (role: CareerPlayer['role'], count: number) => players
    .filter(player => player.role === role)
    .slice(0, count)
    .map(player => player.id);
  const ids = [...take('GK', 1), ...take('DEF', 4), ...take('MID', 4), ...take('FWD', 2)];
  if (ids.length !== 11) throw new Error('generated opponent cannot form a starting eleven');
  return ids;
}

function repairUserLineup(
  current: ClubLineupState | undefined,
  players: readonly CareerPlayer[],
  retiredIds: ReadonlySet<string>,
  retiredRoleById: ReadonlyMap<string, CareerPlayer['role']>,
): ClubLineupState {
  if (current === undefined) throw new Error('the user club has no lineup');
  const playerById = new Map(players.map(player => [player.id, player]));
  const retained = current.playerIds.filter(id => !retiredIds.has(id) && playerById.has(id));
  const selected = new Set(retained);
  for (const retiredId of current.playerIds.filter(id => retiredIds.has(id))) {
    const retiredRole = retiredRoleById.get(retiredId);
    const replacement = players.find(player => !selected.has(player.id) && (
      retiredRole === undefined || player.role === retiredRole
    )) ?? players.find(player => !selected.has(player.id) && player.role !== 'GK');
    if (replacement !== undefined) {
      retained.push(replacement.id);
      selected.add(replacement.id);
    }
  }
  for (const player of players) {
    if (retained.length >= 11) break;
    if (!selected.has(player.id)) {
      retained.push(player.id);
      selected.add(player.id);
    }
  }
  if (retained.length !== 11) throw new Error('retirements leave the user without a starting eleven');
  return { clubId: current.clubId, playerIds: retained };
}

const ACADEMY_ROLE_TARGETS: Readonly<Record<CareerPlayer['role'], number>> = {
  GK: 2,
  DEF: 5,
  MID: 5,
  FWD: 4,
};
const ACADEMY_NAMES = [
  'Ari', 'Ben', 'Cal', 'Dara', 'Eli', 'Finn', 'Gio', 'Hugo',
  'Ivo', 'Jae', 'Kai', 'Leo', 'Milo', 'Nico', 'Ollie', 'Paz',
] as const;

/** Keeps the endless career playable even after a whole generation retires. */
function replenishUserSquad(
  players: readonly CareerPlayer[],
  userClubId: string,
  season: number,
  careerSeed: number,
): CareerPlayer[] {
  const result = players.map(player => ({ ...player, attrs: { ...player.attrs } }));
  const existingIds = new Set(result.map(player => player.id));
  for (const role of ['GK', 'DEF', 'MID', 'FWD'] as const) {
    let roleCount = result.filter(player => player.role === role).length;
    let intakeNumber = 1;
    while (roleCount < ACADEMY_ROLE_TARGETS[role]) {
      let id = `${userClubId}-academy-s${season}-${role.toLowerCase()}-${intakeNumber}`;
      while (existingIds.has(id)) {
        intakeNumber += 1;
        id = `${userClubId}-academy-s${season}-${role.toLowerCase()}-${intakeNumber}`;
      }
      existingIds.add(id);
      result.push(academyPlayer(id, userClubId, role, season, careerSeed, intakeNumber));
      roleCount += 1;
      intakeNumber += 1;
    }
  }
  return result;
}

function academyPlayer(
  id: string,
  clubId: string,
  role: CareerPlayer['role'],
  season: number,
  careerSeed: number,
  intakeNumber: number,
): CareerPlayer {
  const value = stableYouthValue(careerSeed, season, id);
  const base = 38 + value % 13;
  const attrs = {
    pac: Math.min(99, base + (role === 'FWD' ? 6 : 2)),
    sho: Math.min(99, base + (role === 'FWD' ? 8 : 0)),
    pas: Math.min(99, base + (role === 'MID' ? 7 : 1)),
    def: Math.min(99, base + (role === 'DEF' ? 8 : role === 'GK' ? 5 : 0)),
    tec: Math.min(99, base + (role === 'MID' ? 6 : 2)),
    sta: Math.min(99, base + 4),
    ref: Math.min(99, base + (role === 'GK' ? 10 : 0)),
  };
  const potential = (3 + ((value >>> 5) % 3)) as 3 | 4 | 5;
  const personalities = ['Fiery', 'Loyal', 'Joker', 'Professional', 'Timid'] as const;
  return {
    id,
    clubId,
    name: `${ACADEMY_NAMES[value % ACADEMY_NAMES.length]} Academy ${intakeNumber}`,
    role,
    attrs,
    licensed: false,
    weeklyWage: 120 + potential * 30,
    onHeroWage: false,
    contractSeasonsRemaining: 3,
    morale: 60,
    injuryWeeks: 0,
    age: 17,
    archetype: role === 'GK' ? 'Wall' : role === 'DEF' ? 'Anchor' : role === 'MID' ? 'Playmaker' : 'Sniper',
    potential,
    consistency: 55 + ((value >>> 9) % 21),
    personality: personalities[(value >>> 14) % personalities.length],
    condition: 100,
    seasonsAtClub: 0,
    fame: 0,
    retirementAge: 35 + ((value >>> 17) % 3),
    retirementAnnounced: false,
    signingStatTotal: Object.values(attrs).reduce((sum, rating) => sum + rating, 0),
  };
}

function stableYouthValue(careerSeed: number, season: number, id: string): number {
  let value = (careerSeed ^ Math.imul(season, 0x9e3779b1)) >>> 0;
  for (let index = 0; index < id.length; index += 1) {
    value = Math.imul(value ^ id.charCodeAt(index), 0x01000193) >>> 0;
  }
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d) >>> 0;
  return (value ^ (value >>> 15)) >>> 0;
}

function careerSquadStrength(players: readonly CareerPlayer[]): number {
  const total = players.reduce((sum, player) => {
    const values = Object.values(player.attrs);
    return sum + Math.round(values.reduce((attrSum, value) => attrSum + value, 0) / values.length);
  }, 0);
  return Math.max(1, Math.min(99, Math.round(total / players.length)));
}

function clubFame(state: GameState): number {
  return Math.max(0, Math.min(9999, state.players
    .filter(player => player.clubId === state.userClubId)
    .reduce((sum, player) => sum + (player.fame ?? 0), state.market?.clubFameAdjustment ?? 0)));
}

function checkedAdd(left: number, right: number, label: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw new Error(`${label} exceeds the safe integer range`);
  return result;
}
