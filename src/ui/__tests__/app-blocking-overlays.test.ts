import { readFileSync } from 'fs';
import { join } from 'path';

const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

describe('blocking app overlays', () => {
  it('gives confirmations priority over the blocking save warning', () => {
    expect(app).toMatch(
      /const blockingSaveWarningVisible\s*=\s*pendingConfirmation === null/,
    );
  });

  it('makes the routed screen inert while either blocking surface owns focus', () => {
    expect(app).toMatch(
      /const backgroundInteractionBlocked\s*=\s*pendingConfirmation !== null/,
    );
    expect(app).toContain(
      "pointerEvents={backgroundInteractionBlocked ? 'none' : 'auto'}",
    );
    expect(app).toContain(
      'accessibilityElementsHidden={backgroundInteractionBlocked}',
    );
    expect(app).toContain(
      '{...confirmationBackgroundProps(backgroundInteractionBlocked)}',
    );
  });

  it('renders the blocking retry surface outside the inert background', () => {
    const backgroundClose = app.indexOf(
      '        {blockingSaveWarningVisible && store.saveWarning !== null && (',
    );
    const confirmation = app.indexOf('        <ConfirmationSheet');

    expect(backgroundClose).toBeGreaterThan(0);
    expect(confirmation).toBeGreaterThan(backgroundClose);
    expect(app.slice(backgroundClose, confirmation)).toContain(
      '<SaveWarningBanner',
    );
    expect(app.slice(backgroundClose, confirmation)).toContain('blocked');
  });
});
