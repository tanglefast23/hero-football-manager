import { readFileSync } from 'fs';
import { join } from 'path';
import { loadCatalog } from '../../i18n';

describe('coach hiring guidance', () => {
  it('uses the real hire buttons without overlapping tutorial cues', () => {
    const market = readFileSync(
      join(process.cwd(), 'src/ui/screens/MarketScreen.tsx'),
      'utf8',
    );
    const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

    expect(market).not.toContain('guidedHeadCoachId');
    expect(market).not.toContain('guidedAssistantCoachId');
    expect(market).not.toContain('detail="If you want to hire this coach"');
    expect(app).toContain('const hideCoachHiringCues = store.activeTab === \'market\'');
    expect(app).toContain('guideTarget={hideCoachHiringCues ? undefined : visibleAssistantObjectiveTarget}');
  });

  it('labels the post-hire action Return home and routes it to Home', () => {
    const overlay = readFileSync(
      join(process.cwd(), 'src/ui/CoachStaffOverlay.tsx'),
      'utf8',
    );
    const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

    expect(overlay).toContain('label="Return home"');
    expect(overlay).toContain("t('coachStaff.a11y.closeCoachConfirmationAndReturnHome')");
    expect(loadCatalog('en').strings['coachStaff.a11y.closeCoachConfirmationAndReturnHome'])
      .toBe('Close coach confirmation and return home');
    expect(overlay).not.toContain('label="Return to club');
    expect(app).toContain("if (returnsHome) useM1Store.getState().setActiveTab('home');");
  });
});
