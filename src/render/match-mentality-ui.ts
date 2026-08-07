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
 * The desktop rail's own chip copy, which is deliberately not the same words.
 *
 * The phone HUD cycles one button through the plain three (`ATTACK`,
 * `PROTECT`); the rail has room for three chips and names the tactics the way a
 * fan would (`PRESS`, `PARK BUS`). Both were signed off, so both are keyed
 * rather than one being quietly rewritten into the other.
 */
const MENTALITY_CHIP_LABEL_KEYS: Readonly<Record<Mentality, string>> = {
  BALANCED: 'matchRail.playstyleChip.balanced',
  ATTACK: 'matchRail.playstyleChip.attack',
  PROTECT: 'matchRail.playstyleChip.protect',
};

/** The phone HUD's playstyle word — "BALANCED", "ATTACK", "PROTECT". */
export function mentalityLabel(mentality: Mentality, t: CopyFn = englishCopy()): string {
  return t(MENTALITY_LABEL_KEYS[mentality]);
}

/** The desktop rail's chip word — "BALANCED", "PRESS", "PARK BUS". */
export function mentalityChipLabel(mentality: Mentality, t: CopyFn = englishCopy()): string {
  return t(MENTALITY_CHIP_LABEL_KEYS[mentality]);
}
