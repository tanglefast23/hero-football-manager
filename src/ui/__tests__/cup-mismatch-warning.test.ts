import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

describe('Bert Cup mismatch warning wiring', () => {
  it('opens only over the match-day formation screen', () => {
    const declaration = app.slice(
      app.indexOf('const cupMismatchWarning ='),
      app.indexOf('const facilityComboReveal ='),
    );

    expect(declaration).toContain("store.screen === 'matchday'");
    expect(declaration).toContain('pendingCupMismatchWarning(store.career)');
  });

  it('is flavour in both assistant modes, never a Teacher-only lesson', () => {
    const declaration = app.slice(
      app.indexOf('const cupMismatchWarning ='),
      app.indexOf('const facilityComboReveal ='),
    );

    expect(declaration).not.toContain('careerTeaches');
    expect(app).toMatch(/guideOverlayVisible = \([\s\S]{0,300}\|\| cupMismatchWarning !== undefined/);
  });

  it('blocks the formation screen until its once-per-fixture flag is saved', () => {
    const overlay = app.slice(
      app.indexOf('{guideOverlayVisible && cupMismatchWarning !== undefined'),
      app.indexOf('guideOverlayVisible && cupGiantKillingCelebration !== undefined'),
    );

    expect(overlay).toContain('customMessage={cupMismatchWarning}');
    expect(overlay).toContain('onDone={store.completeCupMismatchWarning}');
  });
});
