import awardCeremonyLinesJson from '../../content/award-ceremony-lines.json';
import type { AwardCategoryId } from '../game/types';
import type { AwardCeremonySpeechTone } from './models';
import { copyFor, proseSlug, type CopyFn } from '../i18n';

/**
 * What the players say on the rostrum at the end of a season.
 *
 * Two pools, because they answer opposite questions — but only ever one of the
 * manager's own players speaks, so both are written in his squad's voice. A
 * winner's line can still name no metric, since the same pool serves goals,
 * passes, tackles and saves. A beaten player's line is never sour about the
 * winner: that is a man the manager is about to spend a season with.
 *
 * Lines are capped at `MAX_ARRIVAL_LINE_LENGTH`, the same one-bubble ceiling
 * the walk-on pool uses. `src/content/schemas.ts` enforces both the cap and the
 * pool depth when the game loads its content.
 */
export const WINNER_CEREMONY_LINES: readonly string[] = awardCeremonyLinesJson.winner;
export const RUNNER_UP_CEREMONY_LINES: readonly string[] = awardCeremonyLinesJson.runnerUp;

export interface AwardCeremonySpeaker {
  category: AwardCategoryId;
  playerId: string;
  /** Which pool he draws from: he topped his board, or he did not. */
  tone: AwardCeremonySpeechTone;
}

export interface AwardCeremonySpeech {
  category: AwardCategoryId;
  line: string;
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
 * would have two speakers deliver the same line minutes apart, in the flagship
 * moment of the season. A hashed index already claimed by an earlier beat
 * therefore probes forward to the next free line — which keeps the whole set
 * pure: same season, same lines, no state and no `Math.random`.
 *
 * The two pools are claimed separately, because a winner and a beaten player
 * saying the same-numbered line are saying two different things.
 *
 * Beats come back in the order they were given, and the probe follows that
 * order: the first beat keeps its hashed line and later ones move.
 */
export function awardCeremonySpeeches(
  speakers: readonly AwardCeremonySpeaker[],
  season: number,
  t: CopyFn = copyFor('en'),
): AwardCeremonySpeech[] {
  const claimed: Record<AwardCeremonySpeechTone, Set<number>> = {
    winner: new Set(),
    'runner-up': new Set(),
  };

  return speakers.map(speaker => {
    const winning = speaker.tone === 'winner';
    const pool = winning ? WINNER_CEREMONY_LINES : RUNNER_UP_CEREMONY_LINES;
    // The draw stays on the English pool: which line a player gets is decided
    // by the index, so translating first would make the same season deal
    // different speeches in different languages.
    const line = pool[claimLineIndex(
      ceremonyKey(speaker.playerId, season, speaker.category),
      pool.length,
      claimed[speaker.tone],
    )];
    // Neither pool has ids — the sentence itself is the key, so rewriting a
    // line retires its translation instead of inheriting the neighbour's.
    const key = `ceremony.${winning ? 'winner' : 'runnerUp'}.${proseSlug(line)}`;
    const translated = t(key);
    return {
      category: speaker.category,
      line: translated === key ? line : translated,
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
 * A ceremony has four beats and at most one speaker each, against a pool of
 * thirty lines, so the pool cannot run dry; if a caller ever brings more
 * speakers than lines, the last of them repeat rather than speak nothing.
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
