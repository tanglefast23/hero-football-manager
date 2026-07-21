export interface TutorialTouchPoint {
  x: number;
  y: number;
}

export const TUTORIAL_DRAG_DISMISS_DISTANCE = 4;

export function shouldDismissTutorialForDrag(
  start: TutorialTouchPoint,
  current: TutorialTouchPoint,
): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y)
    >= TUTORIAL_DRAG_DISMISS_DISTANCE;
}
