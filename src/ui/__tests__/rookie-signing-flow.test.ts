import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('rookie signing celebration', () => {
  const appSource = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');
  const walkOnSource = readFileSync(join(process.cwd(), 'src/ui/PlayerWalkOnWelcome.tsx'), 'utf8');
  const receiptSource = readFileSync(join(process.cwd(), 'src/ui/PlayerSigningOverlay.tsx'), 'utf8');

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
  });

  it('gives the rookie a walk-on and leaves the receipt card to squad signings', () => {
    // The rookie walks onto the home screen and says one line; only the
    // transfers and academy graduates still get the framed confirmation.
    expect(appSource).toContain("playerSigning.source === 'rookie' ? (");
    expect(appSource).toContain('<PlayerWalkOnWelcome');
    expect(appSource).toContain("playerSigning.source !== 'rookie' ? (");
    expect(appSource).toContain('<PlayerSigningOverlay');

    expect(walkOnSource).toContain('playPositiveSfx()');
    expect(walkOnSource).toContain("lines={['Thanks for believing in me!']}");
    // He is the match sprite, not a portrait: the celebration and the pitch
    // must never disagree about what the player looks like.
    expect(walkOnSource).toContain('<PlayerRunSprite');

    // The dead rookie branches are gone rather than left unreachable.
    expect(receiptSource).not.toContain('isRookie');
    expect(receiptSource).not.toContain('Meet Bert  ▸');
  });
});
