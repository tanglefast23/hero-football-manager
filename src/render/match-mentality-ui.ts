import type { Mentality } from '../sim/tactics';
import { copyFor, type CopyFn } from '../i18n';

let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

/**
 * The playstyle words the player reads, keyed — mirroring `match-energy-ui`.
 *
 * `Mentality` itself stays exactly as the engine writes it. It is a control
 * value: `selectMentality` compares against it, `SET_MENTALITY` carries it into
 * the recorded input stream, and the replay codec validates it as an enum. A
 * translated `ATTACK` would break a saved replay in every language but English.
 * So the enum keys a label instead of becoming one.
 */
const MENTALITY_LABEL_KEYS: Readonly<Record<Mentality, string>> = {
  BALANCED: 'matchScreen.playstyleMode.balanced',
  ATTACK: 'matchScreen.playstyleMode.attack',
  PROTECT: 'matchScreen.playstyleMode.protect',
};


/**
 * The playstyle word the player reads — "BALANCED", "ATTACK", "PROTECT".
 *
 * One vocabulary on both layouts. The desktop rail used to carry its own
 * fan-speak set ("PRESS", "PARK BUS") while the banner that fires when you tap
 * a chip said "PLAYSTYLE · ATTACK" — so on a wide screen the control and its
 * own confirmation named the same tactic differently, at the same moment.
 * Owner's call, 2026-08-07: the rail says what the banner says.
 */
export function mentalityLabel(mentality: Mentality, t: CopyFn = englishCopy()): string {
  return t(MENTALITY_LABEL_KEYS[mentality]);
}
