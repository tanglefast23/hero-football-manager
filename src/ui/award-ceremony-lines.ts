import awardCeremonyLinesJson from '../../content/award-ceremony-lines.json';
import type { AwardCategoryId } from '../game/types';

/**
 * What the players say on the rostrum at the end of a season.
 *
 * Two pools, because they answer opposite questions. A winner's line is spoken
 * by whoever topped the board — the manager's player or a rival's — so it can
 * neither assume the speaker's club nor name a metric, since the same pool
 * serves goals, passes, tackles and saves. A runner-up line is only ever spoken
 * by one of the manager's own players, and is never sour about the winner:
 * that is a man the manager is about to spend a season with.
 *
 * Lines are capped at `MAX_ARRIVAL_LINE_LENGTH`, the same one-bubble ceiling
 * the walk-on pool uses. `src/content/schemas.ts` enforces both the cap and the
 * pool depth when the game loads its content.
 */
export const WINNER_CEREMONY_LINES: readonly string[] = awardCeremonyLinesJson.winner;
export const RUNNER_UP_CEREMONY_LINES: readonly string[] = awardCeremonyLinesJson.runnerUp;

export interface AwardCeremonySpeaker {
  category: AwardCategoryId;
  winnerPlayerId: string;
  /** Set only when one of the manager's own players finished second. */
  runnerUpPlayerId?: string;
}

export interface AwardCeremonySpeech {
  category: AwardCategoryId;
  winnerLine: string;
  /** Absent unless the beat named a runner-up. */
  runnerUpLine?: string;
}

/**
 * Every line the ceremony will speak, resolved in one pass before the first
 * card renders.
 *
 * Keyed on `(player, season, category)` rather than rolled, for the reason the
 * walk-on pool gives (`src/ui/player-arrival-lines.ts`) and then some: the
 * ceremony holds a speaking sprite across taps and orientation changes, and
 * re-renders on both, so a rolled line would have a player start one sentence
 * and finish another when the phone turns.
 *
 * Keying alone is not enough. Four independent draws from thirty are all
 * distinct only 29x28x27/30^3 ~ 81% of the time, so about one ceremony in five
 * would have two winners deliver the same line minutes apart, in the flagship
 * moment of the season. A hashed index already claimed by an earlier beat
 * therefore probes forward to the next free line — which keeps the whole set
 * pure: same season, same four lines, no state and no `Math.random`.
 *
 * Beats come back in the order they were given, and the probe follows that
 * order: the first beat keeps its hashed line and later ones move.
 */
export function awardCeremonySpeeches(
  speakers: readonly AwardCeremonySpeaker[],
  season: number,
): AwardCeremonySpeech[] {
  const claimedWinnerLines = new Set<number>();
  const claimedRunnerUpLines = new Set<number>();

  return speakers.map(speaker => {
    const winnerLine = WINNER_CEREMONY_LINES[claimLineIndex(
      ceremonyKey(speaker.winnerPlayerId, season, speaker.category),
      WINNER_CEREMONY_LINES.length,
      claimedWinnerLines,
    )];
    if (speaker.runnerUpPlayerId === undefined) return { category: speaker.category, winnerLine };
    return {
      category: speaker.category,
      winnerLine,
      runnerUpLine: RUNNER_UP_CEREMONY_LINES[claimLineIndex(
        ceremonyKey(speaker.runnerUpPlayerId, season, speaker.category),
        RUNNER_UP_CEREMONY_LINES.length,
        claimedRunnerUpLines,
      )],
    };
  });
}

function ceremonyKey(playerId: string, season: number, category: AwardCategoryId): string {
  return `${playerId}:${season}:${category}`;
}

/**
 * The hashed line, or the first free line after it. Wrapping past the end is
 * ordinary: a key landing on the last line still has 29 places to go.
 *
 * A ceremony has four beats and a pool has thirty lines, so the pool cannot run
 * dry; if a caller ever brings more speakers than lines, the last of them
 * repeat rather than speak nothing.
 */
function claimLineIndex(key: string, poolSize: number, claimed: Set<number>): number {
  const hashed = hashString(key) % poolSize;
  for (let step = 0; step < poolSize; step += 1) {
    const index = (hashed + step) % poolSize;
    if (!claimed.has(index)) {
      claimed.add(index);
      return index;
    }
  }
  return hashed;
}

/** FNV-1a, the same hash the arrival pool keys on. */
function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
