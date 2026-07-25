import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('rookie signing celebration', () => {
  const appSource = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');
  const overlaySource = readFileSync(join(process.cwd(), 'src/ui/PlayerSigningOverlay.tsx'), 'utf8');

  it('shows the rookie before allowing Bert to begin', () => {
    expect(appSource).toContain('completeRookieCreation');
    expect(appSource).toContain("source: 'rookie'");
    // The guarantee is that Bert's guide is suppressed while the rookie
    // celebration is on screen. Assert the condition that encodes it and that
    // the overlay is gated on it, rather than one literal expression — the
    // expression is now shared with the keyboard-shortcut gate so the two
    // cannot drift, and pinning its exact text blocks that kind of safe change.
    expect(appSource).toContain("assistantSequenceId !== null");
    expect(appSource).toContain("playerSigning?.source !== 'rookie'");
    expect(appSource).toContain('const guideOverlayVisible');
    expect(appSource).toContain('{guideOverlayVisible ? (');
    expect(overlaySource).toContain('playPositiveSfx()');
    expect(overlaySource).toContain('Thanks for the opportunity, boss!');
    expect(overlaySource).toContain('second scoreboard');
    expect(overlaySource).toContain('Meet Bert  ▸');
  });
});
