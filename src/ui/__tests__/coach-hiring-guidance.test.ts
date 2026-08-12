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

    expect(market).not.toContainSource('guidedHeadCoachId');
    expect(market).not.toContainSource('guidedAssistantCoachId');
    expect(market).not.toContainSource(
      'detail="If you want to hire this coach"',
    );
    expect(app).toContainSource(
      "const hideCoachHiringCues = store.activeTab === 'market'",
    );
    expect(app).toContainSource("focusedInboxDutyId === 'head-coach-market'");
    expect(app).toContainSource(
      "focusedInboxDutyId === 'assistant-coach-hire'",
    );
    expect(app).toContainSource(
      'guideTarget={hideCoachHiringCues ? undefined : visibleAssistantObjectiveTarget}',
    );
  });

  it('labels the post-hire action Return home and routes it to Home', () => {
    const overlay = readFileSync(
      join(process.cwd(), 'src/ui/CoachStaffOverlay.tsx'),
      'utf8',
    );
    const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

    // The visible label is catalog copy now, so assert the key and the English
    // behind it rather than a literal that has moved out of the component.
    expect(overlay).toContainSource("label={t('coachStaff.returnHome')}");
    expect(loadCatalog('en').strings['coachStaff.returnHome']).toBe(
      'Return home',
    );
    expect(overlay).toContainSource(
      "t('coachStaff.a11y.closeCoachConfirmationAndReturnHome')",
    );
    expect(
      loadCatalog('en').strings[
        'coachStaff.a11y.closeCoachConfirmationAndReturnHome'
      ],
    ).toBe('Close coach confirmation and return home');
    expect(overlay).not.toContainSource('label="Return to club');
    expect(app).toContainSource(
      "if (returnsHome) useM1Store.getState().setActiveTab('home');",
    );
  });
});
