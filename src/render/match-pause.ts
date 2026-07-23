export type AutomaticMatchPauseReason =
  | 'background'
  | 'settings'
  | 'swap'
  | 'cut-in'
  | 'tutorial';

export function shouldPauseMatch(
  userPaused: boolean,
  automaticReasons: ReadonlySet<AutomaticMatchPauseReason>,
): boolean {
  return userPaused || automaticReasons.size > 0;
}
