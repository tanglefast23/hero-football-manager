import {
  isTutorialTargetVisible,
  tutorialCuePosition,
  tutorialCuePositionAbove,
} from '../tutorial-cue-position';

describe('tutorial cue positioning', () => {
  it('centers the cue below the measured control', () => {
    expect(tutorialCuePosition({ x: 160, y: 70, width: 64, height: 34 }, 390)).toEqual({
      left: 119,
      top: 110,
    });
  });

  it('keeps the cue inside either edge of the viewport', () => {
    expect(tutorialCuePosition({ x: 0, y: 10, width: 20, height: 20 }, 390).left).toBe(8);
    expect(tutorialCuePosition({ x: 370, y: 10, width: 20, height: 20 }, 390).left).toBe(236);
  });

  it('pins an upward cue to the top edge of a measured bottom control', () => {
    expect(tutorialCuePositionAbove({ x: 8, y: 742, width: 374, height: 62 }, 390, 844)).toEqual({
      left: 122,
      bottom: 108,
    });
  });

  it('only considers a scroll target visible once it is clearly inside the viewport', () => {
    const viewport = { x: 0, y: 100, width: 390, height: 600 };
    expect(isTutorialTargetVisible({ x: 20, y: 676, width: 350, height: 54 }, viewport)).toBe(true);
    expect(isTutorialTargetVisible({ x: 20, y: 690, width: 350, height: 54 }, viewport)).toBe(false);
    expect(isTutorialTargetVisible({ x: 20, y: 720, width: 350, height: 54 }, viewport)).toBe(false);
  });
});
