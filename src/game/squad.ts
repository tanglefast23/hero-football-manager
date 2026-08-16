import type { TeamDef } from '../sim/types';
import { MAX_PLAYER_ATTRIBUTE } from '../sim/attributes';
import { conditionedRatingD64 } from '../sim/contest';
import { buildTeamDef, isAvailableForSelection } from './lineup';
import { compareIds } from './ordering';
import { renewContract, selectLicensedHeroes } from './progression';
import {
  buildFacility as placeFacility,
  createFacilityGrid,
} from './facilities';
import { applyLowMoraleToStat } from './pyramid';
import { assertContractTermFitsCareer } from './retirement';
import {
  assertCareerLineupHonorsContractPromises,
  restoreCareerContractPromiseLineup,
} from './contract-promises';
import { reconcileBoardUltimatumCandidates } from './board-ultimatum';
import { createEmergencyYouthReplacement } from './youth-intake';
import { coachMotivatorBonusPercent } from './coach-weekly';
import {
  heroLicenseCap,
  highestDivisionReached,
  type BlockedCopy,
} from './promotion-progression';
import type { CareerPlayer, GameState } from './types';
import { generatedClubHeroCount, generatedClubPower } from './power-catalog';
import { roleOverall } from './archetype-caps';
import { deterministicCareerEventRoll } from './event-clock';

const TRAINING_GROUND_COST = 8000;
const STRONGEST_D1_OFF_DAY_CHANCE_PERCENT = 20;
const STRONGEST_D1_OFF_DAY_ATTRIBUTE_PERCENT = 97;
/**
 * Match-day form: every club, every week, plays a little above or below itself.
 *
 * Without it the same two squads produce the same margin every time they meet,
 * which is what made a stronger club feel like a settled result rather than a
 * fixture. The band is ±2% of every attribute, neutral 40% of the time, so form
 * colours a match without deciding it.
 *
 * ±2% is a measured ceiling, not a taste call. The training-leverage rail
 * compares what a training point buys a keeper against what it buys a striker;
 * at ±4% the striker arm collapsed from 0.0757 to 0.0020 and the ratio went
 * 0.16 -> 11.92, past the rail's limit of 10. At ±2% it reads 0.87 with both
 * arms healthy. Widen this band only with a fresh rail run to point at.
 *
 * Rolled from the career seed plus season, week and club, so a watched match
 * and its Quick Result agree and a replay reproduces byte-identically. Two
 * matches in one week (a shared league and cup week) share the week's form:
 * form is how the squad turned up, not a per-fixture coin flip.
 */
const MATCH_FORM_PERCENT_BANDS = [
  { roll: 10, percent: 98 },
  { roll: 30, percent: 99 },
  { roll: 70, percent: 100 },
  { roll: 90, percent: 101 },
  { roll: 100, percent: 102 },
] as const;
/** Hero License field cap, won on the pitch or bought at the permit office. */
export function careerHeroLimit(state: GameState): number {
  return heroLicenseCap(state);
}

/**
 * What the league charges for the next permit above the club's current cap.
 *
 * Priced by the permit's NUMBER, never by how many the club has bought, so the
 * bill is the same whether the club climbed to it or paid its way to it: a
 * third costs $100,000, a fourth $200,000, and every permit past the four a
 * Global League club already holds starts at $300,000 and rises $50,000 each
 * time.
 */
export function heroLicensePurchaseCost(licenseNumber: number): number {
  if (licenseNumber <= 2) {
    throw new Error(`hero license ${licenseNumber} is never sold`);
  }
  if (licenseNumber === 3) return 100_000;
  if (licenseNumber === 4) return 200_000;
  return 300_000 + 50_000 * (licenseNumber - 5);
}

export interface HeroLicenseOffer {
  /** The permit on sale — one above the club's current cap. */
  readonly licenseNumber: number;
  readonly cost: number;
  /** Why the club cannot buy it right now; undefined when the purchase is legal. */
  readonly blockedReason?: BlockedCopy;
}

/**
 * The permit on the counter, resolved once so the match-day office, the store
 * action and the purchase itself all quote the same price and the same refusal.
 */
export function nextHeroLicenseOffer(state: GameState): HeroLicenseOffer {
  const licenseNumber = careerHeroLimit(state) + 1;
  const cost = heroLicensePurchaseCost(licenseNumber);
  const club = state.clubs.find(
    (candidate) => candidate.id === state.userClubId,
  );
  if (club === undefined)
    throw new Error(`unknown user club ${state.userClubId}`);
  // Past the four a Global League club holds, the permit is a top-flight
  // privilege rather than an advance on a promotion the club can still win.
  // Price alone would not hold the line: a District League side with a good
  // season's takings could field five heroes against clubs the ladder says are
  // its equals. It is also where the desktop rail runs out — it draws at most
  // RAIL_HERO_TILE_CAP (4) power tiles — so a fifth hero plays without a tile.
  const globalOnly =
    licenseNumber > 4 &&
    (state.m2 === undefined || highestDivisionReached(state) > 1);
  return {
    licenseNumber,
    cost,
    ...(globalOnly
      ? {
          blockedReason: {
            /** @i18n-fallback for `fixtureMatchDay.heroLicenseGlobalOnly`. */
            text: 'Only a Global League club may hold more than four.',
            textKey: 'fixtureMatchDay.heroLicenseGlobalOnly',
          },
        }
      : club.cash < cost
        ? {
            /** @i18n-fallback for `squadTraining.drillNotEnoughMoney`. */
            blockedReason: {
              text: 'Not enough money.',
              textKey: 'squadTraining.drillNotEnoughMoney',
            },
          }
        : {}),
  };
}

export function rosterForClub(
  state: GameState,
  clubId: string,
): CareerPlayer[] {
  if (!state.clubs.some((club) => club.id === clubId)) {
    throw new Error(`unknown club ${clubId}`);
  }
  return state.players
    .filter((player) => player.clubId === clubId)
    .map((player) => ({ ...player, attrs: { ...player.attrs } }));
}

export function buildCareerTeamDef(state: GameState, clubId: string): TeamDef {
  const club = state.clubs.find((candidate) => candidate.id === clubId);
  if (club === undefined) throw new Error(`unknown club ${clubId}`);

  const lineup = state.lineups.find((candidate) => candidate.clubId === clubId);
  if (lineup === undefined)
    throw new Error(`missing lineup for club ${clubId}`);

  const roster = rosterForClub(state, clubId);
  // Injury and leave both land here. The check used to read injuryWeeks alone,
  // which meant a player away on a granted request did not error — they quietly
  // played the match.
  const unavailable = roster.find(
    (player) =>
      lineup.playerIds.includes(player.id) && !isAvailableForSelection(player),
  );
  if (unavailable !== undefined) {
    throw new Error(
      `unavailable player ${unavailable.id} must be replaced in the lineup`,
    );
  }

  // M2's wellbeing model defines morale as a low-morale penalty with a neutral
  // band at 30+. Normalize the legacy match adapter's separate morale scaling
  // after applying that rule so the penalty is neither doubled nor turned into
  // a high-morale stat bonus.
  const matchRoster = roster.map((player) => ({
    ...player,
    morale: 50,
    attrs: {
      pac: applyLowMoraleToStat(player.attrs.pac, player.morale),
      sho: applyLowMoraleToStat(player.attrs.sho, player.morale),
      pas: applyLowMoraleToStat(player.attrs.pas, player.morale),
      def: applyLowMoraleToStat(player.attrs.def, player.morale),
      tec: applyLowMoraleToStat(player.attrs.tec, player.morale),
      sta: applyLowMoraleToStat(player.attrs.sta, player.morale),
      ref: applyLowMoraleToStat(player.attrs.ref, player.morale),
    },
  }));

  const team = buildTeamDef(
    club,
    matchRoster,
    clubId === state.userClubId
      ? lineup.playerIds
      : fresherOpponentLineupIds(
          matchRoster,
          lineup.playerIds,
          careerHeroLimit(state),
        ),
    careerHeroLimit(state),
  );
  const inForm = applyMatchDayForm(state, clubId, team);
  if (clubId !== state.userClubId) return applyStrongestD1OffDay(state, inForm);
  const headCoach = state.market?.headCoach;
  const assistantCoach = state.market?.assistantCoach;
  const headBonus =
    headCoach?.specialties.includes('MOTIVATOR') === true
      ? coachMotivatorBonusPercent(headCoach.level, 'HEAD')
      : 0;
  const assistantBonus =
    assistantCoach?.specialties.includes('MOTIVATOR') === true
      ? coachMotivatorBonusPercent(assistantCoach.level, 'ASSISTANT')
      : 0;
  const heroGaugeBonusPercent = headBonus + assistantBonus;
  return heroGaugeBonusPercent === 0
    ? inForm
    : { ...inForm, heroGaugeRatePercent: 100 + heroGaugeBonusPercent };
}

function applyStrongestD1OffDay(state: GameState, team: TeamDef): TeamDef {
  const divisionOne = state.m2?.pyramid.divisions.find(
    (division) => division.level === 1,
  );
  if (
    divisionOne === undefined ||
    !divisionOne.clubs.some((club) => club.id === state.userClubId)
  ) {
    return team;
  }
  const strongest = divisionOne.clubs
    .filter((club) => club.id !== state.userClubId)
    .sort(
      (left, right) =>
        right.squadStrength - left.squadStrength ||
        compareIds(left.id, right.id),
    )[0];
  if (
    strongest?.id !== team.id ||
    deterministicCareerEventRoll(
      {
        careerSeed: state.careerSeed,
        season: state.season,
        week: state.week,
        riskyChoices: 0,
      },
      `strongest-d1-off-day:${team.id}`,
      0,
      100,
    ) >= STRONGEST_D1_OFF_DAY_CHANCE_PERCENT
  ) {
    return team;
  }
  return scaleTeamAttributes(team, STRONGEST_D1_OFF_DAY_ATTRIBUTE_PERCENT);
}

/** Every attribute of the eleven and the bench, at `percent` of itself. */
function scaleTeamAttributes(team: TeamDef, percent: number): TeamDef {
  if (percent === 100) return team;
  const scale = (player: TeamDef['players'][number]) => {
    const attrs = { ...player.attrs };
    for (const attribute of Object.keys(attrs) as Array<keyof typeof attrs>) {
      // Both ends clamped: form above 100% on a maxed attribute would hand the
      // sim a value past the legal ceiling, and validateTeamDef rejects the
      // whole team rather than the one number.
      attrs[attribute] = Math.min(
        MAX_PLAYER_ATTRIBUTE,
        Math.max(1, Math.round((attrs[attribute] * percent) / 100)),
      );
    }
    return { ...player, attrs };
  };
  return {
    ...team,
    players: team.players.map(scale),
    bench: team.bench?.map(scale),
  };
}

/** This club's form for this week, as a percent of its attributes. */
export function matchFormPercent(state: GameState, clubId: string): number {
  const roll = deterministicCareerEventRoll(
    {
      careerSeed: state.careerSeed,
      season: state.season,
      week: state.week,
      riskyChoices: 0,
    },
    `match-form:${clubId}`,
    0,
    100,
  );
  const band = MATCH_FORM_PERCENT_BANDS.find((entry) => roll < entry.roll);
  return band?.percent ?? 100;
}

function applyMatchDayForm(
  state: GameState,
  clubId: string,
  team: TeamDef,
): TeamDef {
  return scaleTeamAttributes(team, matchFormPercent(state, clubId));
}

export function buildCareerTeams(
  state: GameState,
): Readonly<Record<string, TeamDef>> {
  return Object.fromEntries(
    state.clubs.map((club) => [club.id, buildCareerTeamDef(state, club.id)]),
  );
}

/** Builds active-division or pyramid opposition through the production match boundary. */
export function buildCareerMatchTeams(
  state: GameState,
  clubIds: readonly string[],
): Readonly<Record<string, TeamDef>> {
  return Object.fromEntries(
    clubIds.map((clubId) => [clubId, buildCareerMatchTeamDef(state, clubId)]),
  );
}

export function buildCareerMatchTeamDef(
  state: GameState,
  clubId: string,
): TeamDef {
  if (state.clubs.some((club) => club.id === clubId))
    return buildCareerTeamDef(state, clubId);
  const division = state.m2?.pyramid.divisions.find((candidate) =>
    candidate.clubs.some((club) => club.id === clubId),
  );
  const club = division?.clubs.find((candidate) => candidate.id === clubId);
  if (club === undefined || division === undefined)
    throw new Error(`unknown career club ${clubId}`);
  const heroLimit = generatedClubHeroCount(club.id, division.level);
  let licensedHeroes = 0;
  const roster = club.squad.map((player) => {
    const heroEligible =
      (player.role === 'MID' || player.role === 'FWD') &&
      licensedHeroes < heroLimit;
    const power = heroEligible
      ? generatedClubPower(club.id, licensedHeroes, player.role)
      : undefined;
    if (power !== undefined) licensedHeroes += 1;
    return {
      ...player,
      weeklyWage: 0,
      onHeroWage: power !== undefined,
      contractSeasonsRemaining: 1,
      licensed: power !== undefined,
      injuryWeeks: 0,
      morale: 50,
      attrs: {
        pac: applyLowMoraleToStat(player.attrs.pac, player.morale),
        sho: applyLowMoraleToStat(player.attrs.sho, player.morale),
        pas: applyLowMoraleToStat(player.attrs.pas, player.morale),
        def: applyLowMoraleToStat(player.attrs.def, player.morale),
        tec: applyLowMoraleToStat(player.attrs.tec, player.morale),
        sta: applyLowMoraleToStat(player.attrs.sta, player.morale),
        ref: applyLowMoraleToStat(player.attrs.ref, player.morale),
      },
      ...(power === undefined ? {} : { power }),
    };
  });
  const take = (role: CareerPlayer['role'], count: number) =>
    roster
      .filter((player) => player.role === role)
      .slice(0, count)
      .map((player) => player.id);
  const lineupTemplate = [
    ...take('GK', 1),
    ...take('DEF', 4),
    ...take('MID', 4),
    ...take('FWD', 2),
  ];
  const lineupIds = fresherOpponentLineupIds(roster, lineupTemplate, heroLimit);
  return applyMatchDayForm(
    state,
    clubId,
    buildTeamDef(club, roster, lineupIds, heroLimit),
  );
}

function fresherOpponentLineupIds(
  roster: readonly CareerPlayer[],
  lineupTemplate: readonly string[],
  heroLimit: number,
): string[] {
  const byId = new Map(roster.map((player) => [player.id, player]));
  const selected = new Set<string>();
  let licensedHeroes = 0;
  return lineupTemplate.map((templateId) => {
    const role = byId.get(templateId)?.role;
    if (role === undefined)
      throw new Error(`lineup template has unknown player ${templateId}`);
    const player = roster
      .filter(
        (candidate) =>
          candidate.role === role &&
          !selected.has(candidate.id) &&
          isAvailableForSelection(candidate) &&
          (!candidate.licensed || licensedHeroes < heroLimit),
      )
      .sort((left, right) => {
        const rating =
          conditionedRatingD64(
            roleOverall(right.role, right.attrs),
            right.condition ?? 100,
          ) -
          conditionedRatingD64(
            roleOverall(left.role, left.attrs),
            left.condition ?? 100,
          );
        return rating || compareIds(left.id, right.id);
      })[0];
    if (player === undefined) {
      throw new Error(`club has no available ${role} for its lineup`);
    }
    selected.add(player.id);
    if (player.licensed) licensedHeroes += 1;
    return player.id;
  });
}

/**
 * Deterministically benches injured starters after weekly settlement. The
 * selection preserves the starter's role when possible, never introduces an
 * unlicensed hero, and validates the repaired eleven through the same match
 * boundary used on match day.
 *
 * **Never throws for the user club.** Weekly settlement and match day both call
 * this, so a squad with no fit cover used to brick the save — Advance Week and
 * Play Match failing with the same internal error, forever, in a game that
 * promises warnings and a forced sale but never a game over. When the bench is
 * genuinely empty the academy sends the same emergency youth a board-forced
 * sale gets. Callers who would rather NOT take that relief — a drill deciding
 * whether it may injure, a leave request deciding whether it may be granted —
 * ask `tryRepairCareerLineupForInjuries` and decline instead.
 */
export function repairCareerLineupForInjuries(
  state: GameState,
  clubId = state.userClubId,
): GameState {
  const repaired = repairLineupForInjuries(state, clubId, true);
  if (repaired === undefined) {
    throw new Error(`club ${clubId} has no eligible lineup replacement`);
  }
  return repaired;
}

/**
 * The same repair restricted to players already on the books: `undefined` when
 * the squad cannot cover the outage, so the caller can decline the thing that
 * would have caused it rather than conjuring a replacement.
 */
export function tryRepairCareerLineupForInjuries(
  state: GameState,
  clubId = state.userClubId,
): GameState | undefined {
  return repairLineupForInjuries(state, clubId, false);
}

function repairLineupForInjuries(
  state: GameState,
  clubId: string,
  allowRelief: boolean,
): GameState | undefined {
  const lineup = state.lineups.find((candidate) => candidate.clubId === clubId);
  if (lineup === undefined)
    throw new Error(`missing lineup for club ${clubId}`);

  const roster = rosterForClub(state, clubId);
  const playerById = new Map(roster.map((player) => [player.id, player]));
  const playerIds = [...lineup.playerIds];
  const heroLimit = careerHeroLimit(state);
  const claimedSlots = new Set(
    roster.flatMap((player) =>
      player.returnLineupSlot === undefined ? [] : [player.returnLineupSlot],
    ),
  );
  const fulfilledReturns = new Set<string>();
  const newReturns = new Map<string, number>();
  // Emergency academy call-ups, only ever minted for the user club — the
  // generated divisions have no academy and no lineup edits to repair.
  const relief: CareerPlayer[] = [];

  for (const player of roster) {
    const slot = player.returnLineupSlot;
    if (slot === undefined) continue;
    if (
      slot >= playerIds.length ||
      (slot === 0 ? player.role !== 'GK' : player.role === 'GK')
    ) {
      fulfilledReturns.add(player.id);
      continue;
    }
    if (
      !isAvailableForSelection(player) ||
      (player.power !== undefined && !player.licensed)
    ) {
      continue;
    }

    const currentSlot = playerIds.indexOf(player.id);
    if (currentSlot !== slot) {
      const candidateIds = [...playerIds];
      if (currentSlot >= 0) candidateIds[currentSlot] = candidateIds[slot];
      candidateIds[slot] = player.id;
      const licensedCount = candidateIds.reduce(
        (count, playerId) =>
          count + (playerById.get(playerId)?.licensed === true ? 1 : 0),
        0,
      );
      if (licensedCount > heroLimit) continue;
      playerIds.splice(0, playerIds.length, ...candidateIds);
    }
    fulfilledReturns.add(player.id);
  }

  const selected = new Set(playerIds);

  for (let slot = 0; slot < playerIds.length; slot += 1) {
    const starter = playerById.get(playerIds[slot]);
    if (starter === undefined) continue;
    // Two ways a starter can no longer start, repaired by one search. An
    // unlicensed hero is as unplayable as an injured one -- `buildTeamDef`
    // refuses the eleven either way -- and every route that takes a license
    // away (the match-day toggle, a reclaim for a new signing, an old save
    // written before those benched anyone) lands the squad here.
    const unlicensedHero = starter.power !== undefined && !starter.licensed;
    if (isAvailableForSelection(starter) && !unlicensedHero) continue;

    // No return slot for a license: the player is fit and simply not picked, so
    // holding the shirt open would promise a comeback nothing will trigger.
    if (!unlicensedHero && !claimedSlots.has(slot)) {
      claimedSlots.add(slot);
      newReturns.set(starter.id, slot);
    }
    selected.delete(starter.id);
    const licensedCount = playerIds.reduce((count, playerId, playerSlot) => {
      if (playerSlot === slot) return count;
      const player = playerById.get(playerId);
      return count + (player?.licensed === true ? 1 : 0);
    }, 0);
    const replacement = roster
      .filter(
        (candidate) =>
          !selected.has(candidate.id) &&
          isAvailableForSelection(candidate) &&
          !(candidate.power !== undefined && !candidate.licensed) &&
          (!candidate.licensed || licensedCount < heroLimit) &&
          (slot === 0 ? candidate.role === 'GK' : candidate.role !== 'GK'),
      )
      .sort((left, right) => {
        const leftRolePenalty = left.role === starter.role ? 0 : 1;
        const rightRolePenalty = right.role === starter.role ? 0 : 1;
        if (leftRolePenalty !== rightRolePenalty)
          return leftRolePenalty - rightRolePenalty;
        if (left.licensed !== right.licensed) return left.licensed ? 1 : -1;
        const ratingDifference =
          roleOverall(right.role, right.attrs) -
          roleOverall(left.role, left.attrs);
        if (ratingDifference !== 0) return ratingDifference;
        return compareIds(left.id, right.id);
      })[0];
    if (replacement === undefined) {
      if (!allowRelief || clubId !== state.userClubId) return undefined;
      const youth = createEmergencyYouthReplacement(
        { ...state, players: [...state.players, ...relief] },
        slot === 0 ? 'GK' : starter.role,
        starter.id,
      );
      relief.push(youth);
      playerById.set(youth.id, youth);
      playerIds[slot] = youth.id;
      selected.add(youth.id);
      continue;
    }
    playerIds[slot] = replacement.id;
    selected.add(replacement.id);
  }

  const unchanged =
    relief.length === 0 &&
    playerIds.every((playerId, index) => playerId === lineup.playerIds[index]);
  const repaired: GameState = unchanged
    ? state
    : {
        ...state,
        players:
          relief.length === 0 && newReturns.size === 0
            ? state.players
            : [
                ...state.players.map((player) => {
                  const returnLineupSlot = newReturns.get(player.id);
                  return returnLineupSlot === undefined
                    ? player
                    : { ...player, returnLineupSlot };
                }),
                ...relief,
              ],
        clubs:
          relief.length === 0
            ? state.clubs
            : state.clubs.map((club) =>
                club.id === clubId
                  ? {
                      ...club,
                      weeklyWages: relief.reduce(
                        (sum, youth) => sum + youth.weeklyWage,
                        club.weeklyWages,
                      ),
                    }
                  : club,
              ),
        lineups: state.lineups.map((candidate) =>
          candidate.clubId === clubId ? { ...candidate, playerIds } : candidate,
        ),
      };
  const promisesRestored =
    clubId === state.userClubId
      ? restoreCareerContractPromiseLineup(repaired)
      : repaired;
  const restored =
    fulfilledReturns.size === 0
      ? promisesRestored
      : {
          ...promisesRestored,
          players: promisesRestored.players.map((player) => {
            if (!fulfilledReturns.has(player.id)) return player;
            const { returnLineupSlot: _fulfilled, ...returnedPlayer } = player;
            return returnedPlayer;
          }),
        };
  buildCareerTeamDef(restored, clubId);
  return restored;
}

export function setCareerLineup(
  state: GameState,
  playerIds: readonly string[],
): GameState {
  assertManagementChoicePhase(state, 'the lineup');
  assertCareerLineupHonorsContractPromises(state, playerIds);
  const nextLineups = state.lineups.map((lineup) =>
    lineup.clubId === state.userClubId
      ? { ...lineup, playerIds: [...playerIds] }
      : lineup,
  );
  if (!nextLineups.some((lineup) => lineup.clubId === state.userClubId)) {
    throw new Error(`missing lineup for club ${state.userClubId}`);
  }

  const candidate = { ...state, lineups: nextLineups };
  buildCareerTeamDef(candidate, state.userClubId);
  return candidate;
}

/**
 * Replaces one starter with an eligible bench player. The lineup slot preserves
 * the selected formation, so any outfield player may occupy any outfield slot;
 * goalkeeper and hero-license boundaries remain strict.
 */
export function swapCareerLineupPlayer(
  state: GameState,
  starterId: string,
  replacementId: string,
): GameState {
  assertManagementChoicePhase(state, 'the lineup');
  const lineup = state.lineups.find(
    (candidate) => candidate.clubId === state.userClubId,
  );
  if (lineup === undefined)
    throw new Error(`missing lineup for club ${state.userClubId}`);

  const starterSlot = lineup.playerIds.indexOf(starterId);
  if (starterSlot < 0)
    throw new Error('Select a player from the Starting XI first.');
  if (lineup.playerIds.includes(replacementId)) {
    throw new Error('The replacement must come from the bench.');
  }

  const roster = rosterForClub(state, state.userClubId);
  const starter = roster.find((player) => player.id === starterId);
  const replacement = roster.find((player) => player.id === replacementId);
  if (starter === undefined || replacement === undefined) {
    throw new Error('Both lineup players must belong to your club.');
  }
  if ((starter.role === 'GK') !== (replacement.role === 'GK')) {
    throw new Error(
      starter.role === 'GK'
        ? 'Choose another GK for the goalkeeper slot.'
        : 'Choose an outfield player for this formation slot.',
    );
  }
  if (replacement.injuryWeeks > 0) {
    throw new Error(
      `${replacement.name} is injured and unavailable for selection.`,
    );
  }
  if ((replacement.awayWeeks ?? 0) > 0) {
    throw new Error(
      `${replacement.name} is away and unavailable for selection.`,
    );
  }
  if (replacement.power !== undefined && !replacement.licensed) {
    throw new Error(
      `${replacement.name} needs a Hero License before joining the Starting XI.`,
    );
  }

  return setCareerLineup(
    state,
    lineup.playerIds.map((playerId) =>
      playerId === starterId ? replacementId : playerId,
    ),
  );
}

export function selectCareerLicensedHeroes(
  state: GameState,
  selectedPlayerIds: readonly string[],
): GameState {
  assertManagementChoicePhase(state, 'hero licenses');
  const userRoster = rosterForClub(state, state.userClubId);
  const selected = selectLicensedHeroes(
    userRoster,
    selectedPlayerIds,
    careerHeroLimit(state),
  );
  const selectedById = new Map(selected.map((player) => [player.id, player]));

  // Benching whoever just lost a license is part of taking it away, not a
  // separate step a caller may forget. Without it the hero stayed in the eleven
  // unlicensed, `buildTeamDef` refused to build it, and the career stopped at
  // "Hero <id> must be licensed or benched" with no way forward from the save.
  return repairCareerLineupForInjuries({
    ...state,
    players: state.players.map((player) => {
      const next = selectedById.get(player.id);
      return next === undefined
        ? player
        : { ...player, ...next, attrs: { ...next.attrs } };
    }),
  });
}

/**
 * Load-time fail-soft for a save whose eleven already holds an unlicensed hero.
 *
 * Saves written before license changes benched anyone can carry an eleven the
 * match boundary refuses, and the refusal lands at Play Match -- past the point
 * weekly settlement would have repaired it. Repairing on load turns a dead
 * career into a benched hero and a note in the squad list.
 */
export function reconcileCareerLineupLicenses(state: GameState): GameState {
  const lineup = state.lineups.find(
    (candidate) => candidate.clubId === state.userClubId,
  );
  if (lineup === undefined) return state;
  const playerById = new Map(
    state.players.map((player) => [player.id, player]),
  );
  const stranded = lineup.playerIds.some((playerId) => {
    const player = playerById.get(playerId);
    return (
      player !== undefined && player.power !== undefined && !player.licensed
    );
  });
  return stranded ? repairCareerLineupForInjuries(state) : state;
}

export function buildTrainingGround(
  state: GameState,
  cost = TRAINING_GROUND_COST,
): GameState {
  if (state.phase !== 'manage') {
    throw new Error('facilities can only be built during the manage phase');
  }
  if (!Number.isSafeInteger(cost) || cost < 0) {
    throw new Error('training ground cost must be a non-negative safe integer');
  }
  if (state.facilities.trainingGroundBuilt) {
    throw new Error('the training ground is already built');
  }

  const club = state.clubs.find(
    (candidate) => candidate.id === state.userClubId,
  );
  if (club === undefined)
    throw new Error(`unknown user club ${state.userClubId}`);
  if (club.cash < cost)
    throw new Error('the training ground is not affordable');

  return {
    ...state,
    clubs: state.clubs.map((candidate) =>
      candidate.id === state.userClubId
        ? { ...candidate, cash: candidate.cash - cost }
        : candidate,
    ),
    facilities: {
      ...state.facilities,
      // The works order occupies the site immediately, but benefits begin
      // only after weekly settlement completes the construction project.
      trainingGroundBuilt: false,
      grid: placeFacility(
        state.facilities.grid ?? createFacilityGrid(),
        'training-pitch',
        { x: 0, y: 0 },
        TRAINING_GROUND_COST,
      ).grid,
    },
  };
}

export function renewCareerPlayer(
  state: GameState,
  playerId: string,
  heroMultiplier = 4,
  termSeasons = 1,
): GameState {
  if (state.phase !== 'season-end') {
    throw new Error('expired contracts can only be renewed at season end');
  }
  const player = state.players.find(
    (candidate) =>
      candidate.id === playerId && candidate.clubId === state.userClubId,
  );
  if (player === undefined)
    throw new Error(`unknown user-club player ${playerId}`);
  // `renewContract` is pure and holds neither the career seed nor the squad, so
  // the career-length check cannot live inside it. This is the live path — the
  // store renews through here, not through the negotiated market flow.
  assertContractTermFitsCareer(
    player,
    termSeasons,
    state.careerSeed,
    'renewal',
  );

  const renewed = renewContract(player, heroMultiplier, termSeasons);
  const wageIncrease = renewed.weeklyWage - player.weeklyWage;
  if (!Number.isSafeInteger(wageIncrease)) {
    throw new Error('renewal wage increase exceeds the safe integer range');
  }

  return {
    ...state,
    clubs: state.clubs.map((club) => {
      if (club.id !== state.userClubId) return club;
      const weeklyWages = club.weeklyWages + wageIncrease;
      if (!Number.isSafeInteger(weeklyWages) || weeklyWages < 0) {
        throw new Error('club weekly wages exceed the supported range');
      }
      return { ...club, weeklyWages };
    }),
    players: state.players.map((candidate) =>
      candidate.id === playerId
        ? { ...candidate, ...renewed, attrs: { ...renewed.attrs } }
        : candidate,
    ),
  };
}

/** Lets an expired player leave and repairs the starting eleven immediately. */
export function releaseCareerPlayer(
  state: GameState,
  playerId: string,
): GameState {
  if (state.phase !== 'season-end') {
    throw new Error('expired players can only leave at season end');
  }
  const player = state.players.find(
    (candidate) =>
      candidate.id === playerId && candidate.clubId === state.userClubId,
  );
  if (player === undefined)
    throw new Error(`unknown user-club player ${playerId}`);
  if (player.contractSeasonsRemaining !== 0) {
    throw new Error('only an expired player can leave');
  }

  const lineup = state.lineups.find(
    (candidate) => candidate.clubId === state.userClubId,
  );
  if (lineup === undefined) throw new Error('the user club has no lineup');
  const needsReplacement = lineup.playerIds.includes(playerId);
  const lineupIds = new Set(lineup.playerIds);
  // Only an UNLICENSED hero is bench-only. Barring every powered player left an
  // expired starter unable to leave whenever the bench cover happened to be a
  // licensed hero, who is a perfectly legal starter.
  const isEligibleReplacement = (candidate: CareerPlayer): boolean =>
    candidate.clubId === state.userClubId &&
    candidate.id !== playerId &&
    !lineupIds.has(candidate.id) &&
    candidate.contractSeasonsRemaining > 0 &&
    isAvailableForSelection(candidate) &&
    !(candidate.power !== undefined && !candidate.licensed);
  const rosterReplacement = needsReplacement
    ? (state.players.find(
        (candidate) =>
          isEligibleReplacement(candidate) && candidate.role === player.role,
      ) ??
      state.players.find(
        (candidate) =>
          isEligibleReplacement(candidate) &&
          player.role !== 'GK' &&
          candidate.role !== 'GK',
      ))
    : undefined;
  // Fail-soft: with no cover on the books, refusing the release would dead-end
  // the career — startNextSeason blocks while any expired contract remains, and
  // renewal can be locked out for the whole season (a walked-away agent, or
  // loyalty below the re-signing threshold). The academy sends a role-correct
  // emergency youth instead, the same relief a board-forced sale uses.
  const emergencyYouth =
    needsReplacement && rosterReplacement === undefined
      ? createEmergencyYouthReplacement(state, player.role, player.id)
      : undefined;
  const replacement = rosterReplacement ?? emergencyYouth;

  return reconcileBoardUltimatumCandidates({
    ...state,
    releasedPlayerIds: [
      ...new Set([...(state.releasedPlayerIds ?? []), playerId]),
    ],
    clubs: state.clubs.map((club) => {
      if (club.id !== state.userClubId) return club;
      const weeklyWages =
        club.weeklyWages -
        player.weeklyWage +
        (emergencyYouth?.weeklyWage ?? 0);
      if (!Number.isSafeInteger(weeklyWages) || weeklyWages < 0) {
        throw new Error('club weekly wages exceed the supported range');
      }
      return { ...club, weeklyWages };
    }),
    players: [
      ...state.players.filter((candidate) => candidate.id !== playerId),
      ...(emergencyYouth === undefined ? [] : [emergencyYouth]),
    ],
    lineups: state.lineups.map((candidate) =>
      candidate.clubId !== state.userClubId
        ? candidate
        : {
            ...candidate,
            playerIds: candidate.playerIds.map((id) =>
              id === playerId ? replacement!.id : id,
            ),
          },
    ),
    // After the tutorial is complete this record is historical only. Clearing
    // it allows the created player to leave without leaving a dangling save ID.
    onboarding:
      state.onboarding?.createdPlayerId === playerId
        ? undefined
        : state.onboarding,
    ...(state.market?.renewalTalks?.playerId === playerId
      ? { market: { ...state.market, renewalTalks: undefined } }
      : {}),
  });
}

function assertManagementChoicePhase(state: GameState, choice: string): void {
  if (state.phase !== 'manage' && state.phase !== 'matchday') {
    throw new Error(`${choice} can only change before a match`);
  }
}
