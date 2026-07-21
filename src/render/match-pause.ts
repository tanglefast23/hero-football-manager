export type AutomaticMatchPauseReason = 'background' | 'settings' | 'swap' | 'cut-in';

export function shouldPauseMatch(
  userPaused: boolean,
  automaticReasons: ReadonlySet<AutomaticMatchPauseReason>,
): boolean {
  return userPaused || automaticReasons.size > 0;
}
