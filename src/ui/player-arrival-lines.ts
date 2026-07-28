import type { PlayerSigningConfirmation } from './PlayerSigningOverlay';

/**
 * What a new signing says on their way in.
 *
 * The rookie has one fixed line, because the manager built that player and the
 * beat is about the two of them. A youth graduate is one of many, so they draw
 * from a pool — the walk-on only stays charming if the twelfth academy kid does
 * not say what the first one said.
 */
export const ROOKIE_ARRIVAL_LINE = 'Thanks for believing in me!';

/**
 * Twenty prospects, one line each — cocky, self-deprecating, earnest and odd,
 * deliberately interleaved so a run of signings does not land in a tonal rut.
 * Each is one bubble on a phone; see MAX_ARRIVAL_LINE_LENGTH.
 */
export const YOUTH_ARRIVAL_LINES: readonly string[] = [
  'Save me a shirt number. A famous one.',
  'Honestly? I thought this was just the stadium tour.',
  'Is there a canteen? Asking for me. All of me.',
  "I'll run until you tell me to stop. Please tell me to stop.",
  "Don't worry, gaffer. I'll go easy on the first team.",
  "I'm quicker than I look. I've had to be.",
  'I brought my own pen. In case of contracts.',
  "I've watched from the stands since I was six. Odd view here.",
  "You'll want to renegotiate this after Saturday.",
  "My mum says I'm the best in the country. She's biased.",
  "I told the whole street I'd signed. That was yesterday.",
  'Whatever the badge needs, boss.',
  "I've practised my celebration. In a mirror. For hours.",
  "I promise not to break anything you've paid for.",
  'I dreamt this exact moment. There was more rain in mine.',
  'Nobody in my family has ever signed anything before.',
  "A scout called me unteachable. I heard 'finished product'.",
  "First proper boots! Size too big, but I'll grow into them.",
  "I've learned everyone's name. Including the physio's dog.",
  'Do I call you boss, or...? Right. Boss it is.',
];

/**
 * A speech bubble is 320pt wide at most, and a walk-on holds it for one beat.
 * Past this a line stops being a remark and starts being a paragraph.
 */
export const MAX_ARRIVAL_LINE_LENGTH = 64;

/**
 * The line this arrival speaks.
 *
 * Keyed on the player rather than rolled: the overlay re-renders on every
 * window resize, so a rolled line would change under the player mid-walk.
 * Twenty lines means back-to-back signings repeat about one time in twenty,
 * which is rarer than a player notices and cheaper than threading "what did the
 * last one say" through the store.
 *
 * Only the rookie and the academy graduates walk on — a transfer gets the
 * receipt card — so everyone who is not the rookie draws from the youth pool.
 */
export function arrivalLine(
  player: Pick<PlayerSigningConfirmation, 'playerId' | 'source'>,
): string {
  if (player.source === 'rookie') return ROOKIE_ARRIVAL_LINE;
  return YOUTH_ARRIVAL_LINES[hashString(player.playerId) % YOUTH_ARRIVAL_LINES.length];
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
