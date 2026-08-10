import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('facility combo lesson flow', () => {
  const app = source('App.tsx');
  const finances = source('src/ui/screens/ClubFinancesScreen.tsx');
  const walkOn = source('src/ui/BertBriefingWalkOn.tsx');

  it('opens Club > Facilities before Bert speaks', () => {
    const route = app.slice(
      app.indexOf('const facilityComboRevealVisible ='),
      app.indexOf("Bert's one consolation"),
    );
    expect(route).toContainSource("store.activeTab === 'club'");
    expect(route).toContainSource("clubOfficeTab === 'facility'");
    expect(route).toContainSource("setClubOfficeTab('facility')");
    expect(route).toContainSource("store.setActiveTab('club')");
  });

  it('keeps the custom line attached to the facility adjacency focus', () => {
    const overlay = app.slice(
      app.indexOf('facilityComboRevealVisible &&'),
      app.indexOf('guideOverlayVisible && transferWindowLessonVisible'),
    );
    expect(overlay).toContainSource('sequenceId="facility-adjacency"');
    expect(overlay).toContainSource("focus: 'facility-adjacency'");
    expect(overlay).toContainSource('onFocusChange={setActiveGuideFocus}');
    expect(walkOn).toContainSource(
      "focus: customMessage.focus ?? ('assistant' as const)",
    );
  });

  it('scrolls the viewport to the facility grid', () => {
    const focus = finances.slice(
      finances.indexOf("guideFocus === 'facility-adjacency'"),
      finances.indexOf('const slots = viewModel.sponsorship?.slots'),
    );
    expect(focus).toContainSource('facilityGuideGridTargetRef');
    expect(focus).toContainSource('scrollToTarget(');
    expect(focus).toContainSource(
      'focusGuideTarget(facilityGuideGridTargetRef.current)',
    );
  });
});
