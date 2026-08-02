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
 * Forty prospects, one line each — cocky, self-deprecating, earnest and odd,
 * deliberately interleaved so a run of signings does not land in a tonal rut.
 * Each is one bubble on a phone; see MAX_ARRIVAL_LINE_LENGTH.
 *
 * A career takes an intake every season, so the pool is read dozens of times
 * over. It is also read alongside the rostrum pools in
 * `content/award-ceremony-lines.json` — the same player can walk on here and
 * speak there — so a line that lands on a joke either pool already tells is
 * worse than no line at all.
 */
export const YOUTH_ARRIVAL_LINES: readonly string[] = [
  'Save me a shirt number. A famous one.',
  'Honestly? I thought this was just the stadium tour.',
  "Same socks every match day. Don't ask me why.",
  "Tell me what to fix first. I'll start today.",
  'Do I call you boss, or...? Right. Boss it is.',
  "Don't worry, gaffer. I'll go easy on the first team.",
  'Is there a canteen? Asking for me. All of me.',
  'I brought my own pen. In case of contracts.',
  "I've watched from the stands since I was six. Odd view here.",
  'Can I get a photo before you change your mind?',
  "I'm quicker than I look. I've had to be.",
  "My mum says I'm the best in the country. She's biased.",
  'I talk to myself out there. Ignore about half of it.',
  'Whatever the badge needs, boss.',
  'Where do I put my bag? Sorry. Bag first, football after.',
  "I'll take the penalties. Starting whenever you like.",
  "I'll run until you tell me to stop. Please tell me to stop.",
  'I dreamt this exact moment. There was more rain in mine.',
  "I told the whole street I'd signed. That was yesterday.",
  "I've been awake since four. Is that normal for this?",
  "You'll want to renegotiate this after Saturday.",
  "I'm better than my highlight reel. It's mostly one goal.",
  'I counted the floodlights on the way in. There are four.',
  'Nobody in my family has ever signed anything before.',
  'Is the pitch always this big, or is it just today?',
  "I've been ready for two years. Nobody asked till now.",
  "I've practised my celebration. In a mirror. For hours.",
  "I've learned everyone's name. Including the physio's dog.",
  "Nobody tell me the wages. I'd have come for nothing.",
  'I keep waiting for somebody to ask me to leave.',
  "A scout called me unteachable. I heard 'finished product'.",
  "I've got a good feeling about this. I get those a lot.",
  "I've never seen this many footballs in one place.",
  "I'm not here to make up numbers.",
  "I don't get nervous. Ask me again in ten minutes.",
  "I promise not to break anything you've paid for.",
  "First proper boots! Size too big, but I'll grow into them.",
  "Give me a match. I'll explain the rest.",
  "My left foot is for standing on. I'm working on it.",
  "Put me anywhere. I've been in goal before. It was fine.",
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
 * Forty lines means back-to-back signings repeat about one time in forty, which
 * is rarer than a player notices and cheaper than threading "what did the last
 * one say" through the store. Academy ids are near-identical by construction
 * (`youth-s3-1`, `youth-s3-2`), and FNV-1a spreads exactly those onto
 * consecutive lines, so an intake never repeats itself within one week.
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
