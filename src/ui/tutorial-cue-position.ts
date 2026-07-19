export interface TutorialAnchorLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const TUTORIAL_TAP_CUE_WIDTH = 146;

function tutorialCueLeft(anchor: TutorialAnchorLayout, viewportWidth: number): number {
  const gutter = 8;
  const idealLeft = anchor.x + anchor.width / 2 - TUTORIAL_TAP_CUE_WIDTH / 2;
  const maxLeft = Math.max(gutter, viewportWidth - TUTORIAL_TAP_CUE_WIDTH - gutter);
  return Math.min(Math.max(idealLeft, gutter), maxLeft);
}

/** Centers a cue below its measured control while keeping it on-screen. */
export function tutorialCuePosition(
  anchor: TutorialAnchorLayout,
  viewportWidth: number,
): { left: number; top: number } {
  return {
    left: tutorialCueLeft(anchor, viewportWidth),
    top: anchor.y + anchor.height + 6,
  };
}

/** Centers a cue above its measured control without relying on its rendered height. */
export function tutorialCuePositionAbove(
  anchor: TutorialAnchorLayout,
  viewportWidth: number,
  viewportHeight: number,
): { left: number; bottom: number } {
  return {
    left: tutorialCueLeft(anchor, viewportWidth),
    bottom: Math.max(0, viewportHeight - anchor.y + 6),
  };
}

/** True once enough of a vertically scrolling target is visible to act on it. */
export function isTutorialTargetVisible(
  target: TutorialAnchorLayout,
  viewport: TutorialAnchorLayout,
  minimumVisibleHeight = 24,
): boolean {
  const visibleTop = Math.max(target.y, viewport.y);
  const visibleBottom = Math.min(target.y + target.height, viewport.y + viewport.height);
  const visibleHeight = Math.max(0, visibleBottom - visibleTop);
  return visibleHeight >= Math.min(minimumVisibleHeight, target.height);
}
