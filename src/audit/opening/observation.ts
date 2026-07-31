/**
 * The minimal public view an opening policy is allowed to see.
 *
 * This exists so "could a real player have known that?" is a checked property
 * rather than an assumption. A policy receives only what the app puts on screen
 * before kickoff: the clock, the two currencies, visible facility and staff
 * state, and — for the club's own players — the same attributes, condition and
 * drill previews the squad room and confirmation card show.
 *
 * Deliberately absent: the career seed, the fixture match seed, PRNG state,
 * opponent attributes or strength, hidden potential/awakening values, and the
 * `GameState` itself. Full-state analytics belong in the ledger the runner
 * writes AFTER an action, never in the value handed back to a policy.
 */
import {
  FACILITY_CATALOG,
  instantTrainingPreview,
  isFacilityOperational,
  resolveTrainingDrillForPath,
  TRAINING_PATHS,
  type CareerPlayer,
  type FacilityType,
  type GameState,
} from '../../game';
import type { Attrs, Role } from '../../sim/types';

/** What one drill tap on one player would visibly do, straight from the preview. */
export interface VisibleDrillOption {
  readonly pathId: string;
  readonly attribute: keyof Attrs;
  readonly label: string;
  readonly tpCost: number;
  /** The attribute value shown before the tap. */
  readonly currentValue: number;
  /** The ordinary (non-SUPER) result the confirmation card promises. */
  readonly adjustedAfter: number;
  /** `adjustedAfter - currentValue`; zero means the card shows no improvement. */
  readonly visibleGain: number;
  /** Player-facing modifier names, e.g. Youth, FWD, Shooting Range Lv1, Coach. */
  readonly modifierLabels: readonly string[];
}

export interface VisiblePlayer {
  readonly id: string;
  readonly name: string;
  readonly role: Role;
  /** True when the player is in the club's current starting eleven. */
  readonly isStarter: boolean;
  /** Position within the visible lineup list; used only as a display-order tie-break. */
  readonly lineupOrder: number;
  readonly attrs: Readonly<Attrs>;
  readonly condition: number;
  readonly injuryWeeks: number;
  readonly isCreatedPlayer: boolean;
  readonly drills: readonly VisibleDrillOption[];
}

export interface VisibleFacility {
  readonly id: string;
  readonly type: FacilityType;
  readonly level: number;
  readonly operational: boolean;
}

export interface VisibleCoachCandidate {
  readonly id: string;
  readonly name: string;
  readonly level: number;
  readonly weeklyWage: number;
  readonly specialties: readonly string[];
}

export interface VisibleFixture {
  readonly id: string;
  readonly opponentClubId: string;
  readonly opponentName: string;
  readonly isHome: boolean;
}

export interface OpeningObservation {
  readonly season: number;
  readonly week: number;
  readonly phase: GameState['phase'];
  readonly cash: number;
  readonly trainingPoints: number;
  readonly facilities: readonly VisibleFacility[];
  /** True while any construction project occupies the single build slot. */
  readonly constructionInProgress: boolean;
  readonly headCoachHired: boolean;
  readonly coachCandidates: readonly VisibleCoachCandidate[];
  readonly players: readonly VisiblePlayer[];
  /** The club's next fixture, when one is already on the calendar. */
  readonly nextFixture?: VisibleFixture;
}

const CREATED_PLAYER_SUFFIX = '-created-player';

/**
 * Projects one `GameState` into the public view.
 *
 * Drill previews come from production `instantTrainingPreview`, so a policy can
 * never see a gain the confirmation card would not have shown. Previews are
 * computed for uninjured players only: production refuses to train an injured
 * player, and asking for a preview we could not act on would put a number on
 * screen the app does not offer.
 */
export function buildOpeningObservation(state: GameState): OpeningObservation {
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error(`unknown user club ${state.userClubId}`);
  const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId);
  const starterOrder = new Map((lineup?.playerIds ?? []).map((id, index) => [id, index]));
  const grid = state.facilities.grid;

  const players = state.players
    .filter(player => player.clubId === state.userClubId)
    .map<VisiblePlayer>(player => ({
      id: player.id,
      name: player.name,
      role: player.role,
      isStarter: starterOrder.has(player.id),
      lineupOrder: starterOrder.get(player.id) ?? Number.MAX_SAFE_INTEGER,
      attrs: { ...player.attrs },
      condition: player.condition ?? 100,
      injuryWeeks: player.injuryWeeks,
      isCreatedPlayer: player.id.endsWith(CREATED_PLAYER_SUFFIX),
      drills: player.injuryWeeks > 0 ? [] : visibleDrills(state, player),
    }));

  const fixture = nextUserFixture(state);

  return {
    season: state.season,
    week: state.week,
    phase: state.phase,
    cash: club.cash,
    trainingPoints: state.trainingPoints,
    facilities: (grid?.buildings ?? []).map(building => ({
      id: building.id,
      type: building.type,
      level: building.level,
      operational: grid !== undefined && isFacilityOperational(grid, building.id),
    })),
    constructionInProgress: grid?.construction !== undefined,
    headCoachHired: state.market?.headCoach !== undefined,
    coachCandidates: (state.market?.coachCandidates ?? []).map(candidate => ({
      id: candidate.id,
      name: candidate.name,
      level: candidate.level,
      weeklyWage: candidate.weeklyWage,
      specialties: [...candidate.specialties],
    })),
    players,
    ...(fixture === undefined ? {} : { nextFixture: fixture }),
  };
}

function visibleDrills(state: GameState, player: CareerPlayer): VisibleDrillOption[] {
  return TRAINING_PATHS.map(path => {
    const drill = resolveTrainingDrillForPath(state, path.pathId);
    const preview = instantTrainingPreview(state, player.id, path.pathId);
    const currentValue = player.attrs[path.attribute];
    return {
      pathId: path.pathId,
      attribute: path.attribute,
      label: path.label,
      tpCost: drill.tpCost,
      currentValue,
      adjustedAfter: preview.adjustedAfter,
      visibleGain: preview.adjustedAfter - currentValue,
      modifierLabels: [...preview.modifierLabels],
    };
  });
}

function nextUserFixture(state: GameState): VisibleFixture | undefined {
  const upcoming = state.fixtures
    .filter(fixture => (
      fixture.status !== 'played'
      && (fixture.homeClubId === state.userClubId || fixture.awayClubId === state.userClubId)
      && (fixture.season > state.season
        || (fixture.season === state.season && fixture.week >= state.week))
    ))
    .sort((left, right) => (
      left.season - right.season || left.week - right.week || left.id.localeCompare(right.id)
    ))[0];
  if (upcoming === undefined) return undefined;
  const isHome = upcoming.homeClubId === state.userClubId;
  const opponentClubId = isHome ? upcoming.awayClubId : upcoming.homeClubId;
  return {
    id: upcoming.id,
    opponentClubId,
    opponentName: state.clubs.find(club => club.id === opponentClubId)?.name ?? opponentClubId,
    isHome,
  };
}

/** Names every facility the catalog can build, for policies that plan a build order. */
export function facilityBuildCost(type: FacilityType): number {
  return FACILITY_CATALOG[type].buildCost;
}
