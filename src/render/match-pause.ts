export type AutomaticMatchPauseReason =
  | 'background'
  | 'settings'
  | 'swap'
  | 'cut-in'
  | 'tutorial'
  /** The acquired-power match clip freezes on its final frame for replay/continue. */
  | 'showcase'
  /** A Global Cup tie's opening title card holds kickoff until it clears. */
  | 'title-card';

export function shouldPauseMatch(
  userPaused: boolean,
  automaticReasons: ReadonlySet<AutomaticMatchPauseReason>,
): boolean {
  return userPaused || automaticReasons.size > 0;
}

export function syncBackgroundPauseReason(
  automaticReasons: Set<AutomaticMatchPauseReason>,
  appIsActive: boolean,
): void {
  if (appIsActive) {
    automaticReasons.delete('background');
  } else {
    automaticReasons.add('background');
  }
}
