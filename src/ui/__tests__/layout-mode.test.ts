import { TWO_COLUMN_MIN_WIDTH, layoutModeForWidth } from '../layout/layout-mode';

describe('layoutModeForWidth', () => {
  it('keeps phones and portrait tablets single-column', () => {
    expect(layoutModeForWidth(390)).toBe('single');   // iPhone
    expect(layoutModeForWidth(834)).toBe('single');   // iPad portrait
    expect(layoutModeForWidth(TWO_COLUMN_MIN_WIDTH - 1)).toBe('single');
  });

  it('flows desktop-width viewports into two columns', () => {
    expect(layoutModeForWidth(TWO_COLUMN_MIN_WIDTH)).toBe('twoColumn');
    expect(layoutModeForWidth(1280)).toBe('twoColumn');
  });
});
