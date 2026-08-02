import { leagueStandings, rosterForClub, type CareerPlayer, type GameState } from '../game';
import { playerLookId } from '../render/sprites/player-look';
import type {
  EndgameCelebrationKind,
  EndgameCelebrationPlayerViewModel,
  EndgameCelebrationViewModel,
} from '../ui/models';

/**
 * The end of the main climb, which takes BOTH trophies.
 *
 * These are career flags, not season flags. The ordinary league celebration is
 * per-season by design — a D3 title is worth a screen every time it happens —
 * but the summit is reached once, and a screen that congratulated a manager on
 * finishing his own game every year would stop meaning anything the second time
 * he saw it.
 */
export const GLOBAL_LEAGUE_WON_FLAG = 'career:global-league-won';
export const NATIONAL_CUP_WON_FLAG = 'career:national-cup-won';
export const TRUE_ENDING_SEEN_FLAG = 'career:true-ending-seen';

/** The division at the top of the pyramid; the only one the ladder ends on. */
const GLOBAL_LEAGUE = 1;

/**
 * Which division the club is playing in, or nothing when that cannot be read.
 *
 * `currentUserDivision` throws when the club is not in exactly one division,
 * which is the right behaviour inside the season transition and the wrong one
 * here: this runs on the route into the boundary screens, and a throw would
 * leave a career with no way through to the recap. An unreadable pyramid means
 * "not D1", never a crash.
 */
function userDivision(state: GameState): number | undefined {
  const matches = (state.m2?.pyramid.divisions ?? []).filter(division => (
    division.clubs.some(club => club.id === state.userClubId)
  ));
  return matches.length === 1 ? matches[0].level : undefined;
}

/**
 * Whether the club has just finished top of D1.
 *
 * Read from the division being played rather than from the recap's own copy of
 * it, so it agrees with `hasPendingChampionshipCelebration` — the two decide
 * the same title from the same table, and only differ on which screen presents
 * it. Promotion has not run at this point, so this is still the division whose
 * fixtures were played.
 */
export function isGlobalLeagueChampion(state: GameState): boolean {
  if (userDivision(state) !== GLOBAL_LEAGUE) return false;
  return leagueStandings(state)[0]?.clubId === state.userClubId;
}

/** Whether the club has ever lifted the National Cup. Cups are never dropped. */
export function hasWonNationalCup(state: GameState): boolean {
  return (state.m2?.nationalCups ?? []).some(cup => cup.championClubId === state.userClubId);
}

/**
 * The endgame moment a career is owed, if any.
 *
 * Symmetric in the two trophies: whichever one completes the pair triggers the
 * true ending, and the pair completing SUPERSEDES the individual moment. A D1
 * title that finishes the set plays the true ending only — the alternative is
 * two cutscenes back to back, where the first one tells the manager to go and
 * do the thing he has already done.
 */
export function pendingEndgameCelebration(state: GameState): EndgameCelebrationKind | undefined {
  if (state.phase !== 'season-end' && state.phase !== 'complete') return undefined;
  const flags = state.eventFlags;
  if (flags.includes(TRUE_ENDING_SEEN_FLAG)) return undefined;
  const leagueFlagged = flags.includes(GLOBAL_LEAGUE_WON_FLAG);
  const cupFlagged = flags.includes(NATIONAL_CUP_WON_FLAG);
  const leagueWon = leagueFlagged || isGlobalLeagueChampion(state);
  const cupWon = cupFlagged || hasWonNationalCup(state);
  if (leagueWon && cupWon) return 'true-ending';
  if (leagueWon && !leagueFlagged) return 'global-league';
  if (cupWon && !cupFlagged) return 'cup-winners';
  return undefined;
}

/**
 * Whether the endgame screen is about to present THIS season's D1 title.
 *
 * The ordinary celebration steps aside when it is, because both screens would
 * otherwise announce the same result one after the other. It only steps aside
 * for the FIRST D1 title: a manager who stays up there replays the ordinary
 * fanfare every year, which is the same deal every other division gets.
 */
export function endgameSupersedesLeagueTitle(state: GameState): boolean {
  if (state.eventFlags.includes(GLOBAL_LEAGUE_WON_FLAG)) return false;
  if (!isGlobalLeagueChampion(state)) return false;
  return pendingEndgameCelebration(state) !== undefined;
}

/**
 * Idempotent. The true ending banks all three flags at once, because it is the
 * proof that both trophies are in the cabinet — leaving the individual flags
 * unset would let the two smaller moments fire afterwards for trophies the
 * manager has just been congratulated on.
 */
export function markEndgameCelebrationComplete(state: GameState): GameState {
  const kind = pendingEndgameCelebration(state);
  if (kind === undefined) return state;
  const flags = new Set(state.eventFlags);
  if (kind === 'true-ending') {
    flags.add(GLOBAL_LEAGUE_WON_FLAG);
    flags.add(NATIONAL_CUP_WON_FLAG);
    flags.add(TRUE_ENDING_SEEN_FLAG);
  } else if (kind === 'global-league') {
    flags.add(GLOBAL_LEAGUE_WON_FLAG);
  } else {
    flags.add(NATIONAL_CUP_WON_FLAG);
  }
  return { ...state, eventFlags: [...flags] };
}

/**
 * The player the summit belongs to: the most famous man in the squad, and
 * among equals the one who has been here longest.
 *
 * Not the top scorer, which is what the ordinary celebration parades — a
 * season's goal tally only knows about this year, and the summit is about the
 * whole climb.
 *
 * Fame alone is not enough, and the reason is measured rather than assumed.
 * `resolveCareerMatchFame` caps fame at 99 (`career.ts:557`) and awards it to
 * anyone in the lineup every match, so a first eleven saturates within about
 * two seasons: a seeded career at season 3 already holds eleven starters at 99
 * against five reserves at 8. By the time anybody reaches this screen, fame has
 * stopped discriminating, and ranking on it alone would have handed the game's
 * most personal moment to whoever happened to sort first by ID.
 *
 * `seasonsAtClub` breaks that tie, which is the truer reading anyway: among
 * players the club made equally famous, the one who stayed for all of it is the
 * one whose journey this was. ID order remains the final tiebreak so the choice
 * stays deterministic.
 */
export function highestFamePlayer(
  squad: readonly CareerPlayer[],
): CareerPlayer | undefined {
  return [...squad].sort((left, right) => (
    (right.fame ?? 0) - (left.fame ?? 0)
    || (right.seasonsAtClub ?? 0) - (left.seasonsAtClub ?? 0)
    || compareIds(left.id, right.id)
  ))[0];
}

/**
 * The moment a career is about to watch.
 *
 * TOTAL BY CONSTRUCTION, for the reason `careerAwardCeremonyViewModel` gives:
 * the screen sits inside the season transition and its own completion is the
 * only way off it, so a thrown view model would strand the save. A club with no
 * squad left loses its star and keeps its copy rather than crashing.
 */
export function endgameCelebrationViewModel(
  state: GameState,
  assistantName: string,
  kind = pendingEndgameCelebration(state) ?? 'true-ending',
): EndgameCelebrationViewModel {
  const clubName = state.clubs.find(club => club.id === state.userClubId)?.name ?? 'Your club';
  const squad = rosterForClub(state, state.userClubId);
  const star = highestFamePlayer(squad);
  const spriteSide = finalFixtureSide(state);
  const toViewModel = (player: CareerPlayer): EndgameCelebrationPlayerViewModel => ({
    id: player.id,
    name: player.name,
    role: player.role,
    isHero: player.power !== undefined,
    fame: player.fame ?? 0,
    spriteKey: `${spriteSide}:${playerLookId(player.id, player.role, player.lookId)}:run0`,
    ...(player.lookId === undefined ? {} : { lookId: player.lookId }),
  });
  const starViewModel = star === undefined ? undefined : toViewModel(star);
  const starName = starViewModel?.name ?? 'Your captain';
  const copy = celebrationCopy(kind, clubName, starName);

  return {
    kind,
    seasonLabel: `Season ${state.season}`,
    clubName,
    assistantName,
    headline: copy.headline,
    subheading: copy.subheading,
    lines: copy.lines,
    ...(starViewModel === undefined ? {} : { star: starViewModel }),
    // The star is never in here twice: he is carried separately because all
    // three moments treat him differently from the men beside him.
    //
    // The true ending takes the squad too. It OPENS as one man talking to his
    // manager, and the rest of the club is not on the pitch while he does it —
    // but once he has finished and walked off, everybody comes out for the
    // curtain call, and a screen holding no squad would have had nobody to
    // bring on for the last thing the game ever shows.
    squad: squad
      .filter(player => player.id !== star?.id)
      .sort((left, right) => compareIds(left.id, right.id))
      .map(toViewModel),
    // Held in on the true ending, which plays once per career and never again.
    skippable: kind !== 'true-ending',
    accessibilityLabel: `${copy.headline}. ${copy.subheading}. ${copy.lines.join(' ')}`,
  };
}

interface EndgameCopy {
  readonly headline: string;
  readonly subheading: string;
  readonly lines: readonly string[];
}

/**
 * Everything the three moments say.
 *
 * Kept out of the component and beside the trigger it belongs to, because Jest
 * runs with no DOM and cannot render one — and because the copy IS the feature.
 * The two smaller screens each have a job the other must not do: the D1 screen
 * points at the Cup, the Cup screen points at the division, and neither is
 * allowed to sound like the end.
 */
function celebrationCopy(
  kind: EndgameCelebrationKind,
  clubName: string,
  starName: string,
): EndgameCopy {
  if (kind === 'global-league') {
    return {
      headline: 'GLOBAL LEAGUE CHAMPIONS',
      subheading: `${clubName} · Top of the pyramid`,
      lines: [
        'There is no division above this one. The ladder is finished.',
        `${starName} climbed every rung of it with you.`,
        'One trophy is still out there. Win the National Cup and the climb is complete.',
      ],
    };
  }
  if (kind === 'cup-winners') {
    return {
      headline: 'NATIONAL CUP WINNERS',
      subheading: `${clubName} · Knockout champions`,
      lines: [
        'Every round a single tie, every tie a single chance. You took all of them.',
        `${starName} carried the run.`,
        'The division is still the goal. Win D1 and the climb is complete.',
      ],
    };
  }
  return {
    headline: 'THE CLIMB IS COMPLETE',
    subheading: `${clubName} · Global League and National Cup`,
    // One bubble per entry. He is talking to the manager, not to a camera.
    lines: [
      'Boss. Before anyone else gets in here — thank you.',
      'You made me the player I am. Every bit of it came out of your coaching.',
      'We won the league. We won the Cup. I am glad we did.',
      'But it is not the trophies I will carry.',
      'It is the mornings on the training pitch, and the one man who kept turning up.',
      'Wherever this goes next, I got here with you. Thank you, boss.',
    ],
  };
}

/**
 * Which way the squad faced in the last match played, so the celebration draws
 * the same characters the manager just watched. Defaults to the home side when
 * there is no completed fixture to read.
 */
function finalFixtureSide(state: GameState): 'r' | 'u' {
  const finalFixture = state.fixtures
    .filter(fixture => fixture.status === 'played'
      && (fixture.homeClubId === state.userClubId || fixture.awayClubId === state.userClubId))
    .sort((left, right) => right.week - left.week || compareIds(right.id, left.id))[0];
  return finalFixture?.awayClubId === state.userClubId ? 'u' : 'r';
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
