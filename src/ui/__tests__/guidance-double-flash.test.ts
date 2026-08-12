import { readFileSync } from 'fs';
import { join } from 'path';

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), 'utf8');

describe('unfinished Bert job nudge', () => {
  it('keeps only save failures hard-disabled and intercepts guide blocks', () => {
    const app = source('App.tsx');

    expect(app).toContain(
      'advanceWeekDisabled={store.saving || store.saveBlocked}',
    );
    // The flash is now the second half of the reply: the blocked press first
    // takes the manager to the job, so what flashes is on the screen they land
    // on rather than a control two boards away.
    expect(app).toMatch(
      /const handleAdvanceWeek = useCallback\(\(\) => \{\s*if \(advanceWeekGuidanceBlocked\) \{\s*setGuidanceNudgeToken\(\(token\) => token \+ 1\);/,
    );
    expect(app).toContain(
      'focusedInboxDutyId === undefined ? displayedGuideObjective : undefined',
    );
    expect(app).toContain('dutyNudgeTarget !== undefined');
  });

  it('plays two local flashes and stops them on restart or unmount', () => {
    const flash = source('src/ui/GuidanceDoubleFlash.tsx');

    expect(flash).toContain('opacity.stopAnimation();');
    expect(flash).toContain('const previousTriggerRef = useRef(trigger);');
    expect(flash).toContain('previousTrigger === undefined');
    expect(flash).toContain('trigger <= previousTrigger');
    expect(flash).toMatch(
      /Animated\.sequence\(\[\s*flashOnce\(\),\s*Animated\.delay\(70\),\s*flashOnce\(\)\s*\]\)/,
    );
    expect(flash).toContain('animation.stop();');
    expect(flash).toContain(
      'Animated.sequence([show(0), Animated.delay(500), hide(0)])',
    );
    expect(flash).toContain(
      'style={[StyleSheet.absoluteFill, styles.overlay, { opacity }]}',
    );
    expect(flash).toContain(
      'className={`flex-1 border-4 border-gold-dark bg-gold-light',
    );
    expect(flash).not.toMatch(/<Animated\.View[^>]*className=/);
  });

  it('flashes the Bert strip and preserves its guidance on the blocked press', () => {
    const shell = source('src/ui/ManagementShell.tsx');

    expect(shell).toContain('visuallyDisabled={advanceWeekGuidanceBlocked}');
    expect(shell).toContain(
      'if (advanceWeekGuidanceBlocked) event.stopPropagation();',
    );
    expect(shell).toMatch(
      /advanceWeekGuidanceBlocked\s*\? guidanceNudgeToken\s*: undefined/,
    );
    expect(shell).toContain("guidanceNudgeTarget === 'training-plan'");
    expect(shell).toContain("guidanceNudgeTarget === 'training-ground-alert'");
    expect(shell).toContain("'training-ground-facility'");
    expect(shell).toContain("guidanceNudgeTarget === 'head-coach-market'");
    expect(shell).toMatch(
      /mustDoObjective[\s\S]*?<GuidanceDoubleFlash[\s\S]*?advanceWeekGuidanceBlocked/,
    );
  });

  it('routes the same token to each visible required control', () => {
    const squad = source('src/ui/screens/SquadTrainingScreen.tsx');
    const home = source('src/ui/screens/ClubHomeScreen.tsx');
    const club = source('src/ui/screens/ClubFinancesScreen.tsx');
    const market = source('src/ui/screens/MarketScreen.tsx');

    expect(squad).toMatch(
      /guidanceNudgeTarget === 'training-plan'[\s\S]*?player\.id === viewModel\.createdPlayerId[\s\S]*?guidanceNudgeToken/,
    );
    expect(home).toContain("alert.guideSequenceId === 'coaching-office'");
    expect(home).toContain("alert.guideSequenceId === 'youth-intake'");
    expect(club).toMatch(
      /guidanceNudgeTarget === 'coaching-office'[\s\S]*?entry\.type === 'coaching-office'/,
    );
    expect(market).toMatch(
      /guidanceNudgeTarget === 'youth-intake'[\s\S]*?guidanceNudgeToken/,
    );
    expect(market).toMatch(
      /const firstAvailableHeadCoachId = viewModel\.coaches\.find\([\s\S]*?coach\.headAvailable[\s\S]*?guidanceNudgeTarget === 'head-coach-market'[\s\S]*?coach\.id === firstAvailableHeadCoachId[\s\S]*?guidanceNudgeToken/,
    );
  });
});
