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

describe('settings overlay announces itself as a dialog', () => {
  const settings = readFileSync(
    join(process.cwd(), 'src/ui/SettingsOverlay.tsx'),
    'utf8',
  );

  it('names the panel and marks it modal on web', () => {
    // The overlay already blocked the page correctly — CrossPlatformModal marks
    // the app root inert and aria-hidden, background focus is refused and
    // pointer input does not reach it. What was missing was any statement of
    // what the thing in front IS: no role, and no accessible name to read.
    expect(settings).toContain(
      "return { role: 'dialog', 'aria-modal': true, 'aria-label': title };",
    );
    expect(settings).toContain(
      "{...webSettingsDialogProps(t('settings.title'))}",
    );
    // Native owns its modal boundary through accessibilityViewIsModal, so the
    // DOM props stay off it.
    expect(settings).toContain("if (Platform.OS !== 'web') return {};");
    expect(settings).toContain('accessibilityViewIsModal');
  });
});
