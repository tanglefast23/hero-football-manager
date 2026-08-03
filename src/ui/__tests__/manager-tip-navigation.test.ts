import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe("manager's tip navigation", () => {
  it('shows Take Me There only for tips with a declared destination', () => {
    const home = read('src/ui/screens/ClubHomeScreen.tsx');

    expect(home).toContain('showManagerTips');
    expect(home).toContain("note.kind !== 'tip'");
    expect(home).toContain('note.destination');
    expect(home).toContain('label="Take me there  ▸"');
    expect(home).toContain('onOpenManagerTipDestination(note.destination)');
  });

  it('routes each actionable tip to a fresh squad guide request', () => {
    const app = read('App.tsx');

    expect(app).toContain("target: ManagerTipDestination;");
    expect(app).toContain('setManagerTipGuideRequest');
    expect(app).toContain('skipNextGuidanceDismissRef.current = true;');
    expect(app).toContain("store.setActiveTab('squad');");
    expect(app).toContain('onOpenManagerTipDestination={openManagerTipDestination}');
    expect(app).toContain('showManagerTips={preferences.managerTipsEnabled}');
    expect(app).toContain('managerTipGuideRequest={managerTipGuideRequest ?? undefined}');
  });

  it('focuses the requested squad target and dismisses its cue on the next tap', () => {
    const squad = read('src/ui/screens/SquadTrainingScreen.tsx');

    expect(squad).toContain('managerTipGuideRequest');
    expect(squad).toContain("target === 'overall-sort'");
    expect(squad).toContain("target === 'drill-shop'");
    expect(squad).toContain("label=\"Tap here\"");
    expect(squad).toContain("detail=\"To sort\"");
    expect(squad).toContain("detail=\"Drills unlock as you climb divisions\"");
    expect(squad).toContain('scrollRef.current?.scrollTo({ y: 0, animated: true })');
    expect(squad).toContain('setManagerTipGuideTarget(null)');
  });

  it('claims the top of the register in the request frame, before any late layout', () => {
    const squad = read('src/ui/screens/SquadTrainingScreen.tsx');

    expect(squad).toContain('scrollRef.current?.scrollTo({ y: 0, animated: false })');
  });

  it('sorts the register highest-first from the cue and drops the selection', () => {
    const squad = read('src/ui/screens/SquadTrainingScreen.tsx');

    // The sort orders every player, so no selected row survives above it.
    expect(squad).toContain('onSelectPlayer(undefined)');
    expect(squad).toContain("const guidedSortTap = managerTipGuideTarget === 'overall-sort';");
    expect(squad).toContain("? { key: 'overall', direction: 'descending' }");
  });
});
