import {
  shouldDismissTutorialForDrag,
  TUTORIAL_DRAG_DISMISS_DISTANCE,
} from '../tutorial-drag-dismiss';

describe('tutorial drag dismissal', () => {
  it('keeps the helper for a touch or tiny movement', () => {
    expect(shouldDismissTutorialForDrag({ x: 20, y: 30 }, { x: 20, y: 30 })).toBe(false);
    expect(shouldDismissTutorialForDrag({ x: 20, y: 30 }, { x: 23, y: 30 })).toBe(false);
  });

  it('dismisses the helper once the finger moves four pixels', () => {
    expect(TUTORIAL_DRAG_DISMISS_DISTANCE).toBe(4);
    expect(shouldDismissTutorialForDrag({ x: 20, y: 30 }, { x: 24, y: 30 })).toBe(true);
    expect(shouldDismissTutorialForDrag({ x: 20, y: 30 }, { x: 20, y: 25 })).toBe(true);
  });
});
