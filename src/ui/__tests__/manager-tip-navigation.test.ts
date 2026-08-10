import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe("manager's tip navigation", () => {
  it('shows Take Me There only for tips with a declared destination', () => {
    const home = read('src/ui/screens/ClubHomeScreen.tsx');

    expect(home).toContain('showManagerTips');
    expect(home).toContain("note.kind !== 'tip'");
    expect(home).toContain('note.destination');
    expect(home).toContain("label={`${t('clubHome.takeMeThere')}  ▸`}");
    expect(home).toContain('onOpenManagerTipDestination(note.destination)');
    expect(home).toContain(
      'className="border-2 border-b-4 border-grey-dark bg-paper-dark p-3"',
    );
    expect(home).toContain('text-grey-dark');
    expect(home).not.toContain("? 'border-gold-dark bg-gold-light'");
  });

  it('routes each actionable tip to a fresh squad guide request', () => {
    const app = read('App.tsx');

    expect(app).toContain('target: ManagerTipDestination;');
    expect(app).toContain('setManagerTipGuideRequest');
    expect(app).toContain('skipNextGuidanceDismissRef.current = true;');
    expect(app).toContain("store.setActiveTab('squad');");
    expect(app).toContain(
      'onOpenManagerTipDestination={openManagerTipDestination}',
    );
    expect(app).toContain('showManagerTips={careerTeaches}');
    expect(app).toContain(
      'managerTipGuideRequest={visibleManagerTipGuideRequest ?? undefined}',
    );
  });

  it('focuses the requested drill-shop target and dismisses its cue on the next tap', () => {
    const squad = read('src/ui/screens/SquadTrainingScreen.tsx');

    expect(squad).toContain('managerTipGuideRequest');
    expect(squad).toContain("target === 'drill-shop'");
    expect(squad).toContain("detail={t('squadTraining.drillsUnlockAsYou')}");
    expect(squad).toContain('setManagerTipGuideTarget(null)');
  });
});
