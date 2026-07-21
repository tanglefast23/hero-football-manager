import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('rookie signing celebration', () => {
  const appSource = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');
  const overlaySource = readFileSync(join(process.cwd(), 'src/ui/PlayerSigningOverlay.tsx'), 'utf8');

  it('shows the rookie before allowing Bert to begin', () => {
    expect(appSource).toContain('completeRookieCreation');
    expect(appSource).toContain("source: 'rookie'");
    expect(appSource).toContain("assistantSequenceId !== null && playerSigning?.source !== 'rookie'");
    expect(overlaySource).toContain('playEventSuccessSfx()');
    expect(overlaySource).toContain('Thanks for the opportunity, boss!');
    expect(overlaySource).toContain('second scoreboard');
    expect(overlaySource).toContain('Meet Bert  ▸');
  });
});
