import { carrierCardGeometry } from '../match-carrier-card';

// The card is pinned 12px inside a bottom corner of the pitch, so anything
// under half the pitch width stops short of the goalkeeper in the middle.
const CORNER_INSET = 12;

describe('possession card width', () => {
  it('never reaches the middle of the pitch, at any window size', () => {
    for (const pitchWidth of [320, 420, 560, 640, 820, 1200]) {
      for (const desktop of [true, false]) {
        const { width } = carrierCardGeometry(pitchWidth, desktop);
        expect(CORNER_INSET + width).toBeLessThan(pitchWidth / 2);
      }
    }
  });

  it('keeps its full size on a wide pitch and shrinks on a narrow one', () => {
    expect(carrierCardGeometry(1200, true).width).toBe(260);
    expect(carrierCardGeometry(600, true).width).toBeLessThan(260);
  });

  it('hands the charge strip the width inside the border and padding', () => {
    const { width, contentWidth } = carrierCardGeometry(600, true);
    expect(contentWidth).toBe(width - (12 + 2) * 2);
  });
});
