import { readFileSync } from 'fs';
import { join } from 'path';
import type { HeroPowerCell, HeroPowerCellState } from '../hero-power-dock';
import {
  advanceHeroPowerTutorial,
  dismissHeroPowerTutorialArmed,
} from '../hero-power-tutorial';

const cell = (
  slot: number,
  state: HeroPowerCellState | null,
  playerId = `hero-${slot}`,
): HeroPowerCell => ({
  slot,
  playerId,
  name: playerId,
  power: 'GUST',
  state,
  armedTicksRemaining: 0,
  armWindowTicks: 0,
});

describe('first manual hero power tutorial', () => {
  it('owns one stable hero from ARMED through a later FIRE', () => {
    const started = advanceHeroPowerTutorial(
      null,
      [cell(3, 'arm'), cell(5, 'arm')],
      20,
      true,
      false,
    );
    expect(started).toMatchObject({
      pause: true,
      attempt: { step: 'armed', target: { slot: 3, playerId: 'hero-3' } },
    });

    const waiting = dismissHeroPowerTutorialArmed(started.attempt, 20);
    for (const state of ['arm', 'down', null] as const) {
      expect(
        advanceHeroPowerTutorial(waiting, [cell(3, state)], 21, true, false),
      ).toEqual({ attempt: waiting, pause: false });
    }
    expect(
      advanceHeroPowerTutorial(waiting, [cell(3, 'fire')], 20, true, false),
    ).toEqual({ attempt: waiting, pause: false });
    expect(
      advanceHeroPowerTutorial(waiting, [cell(3, 'fire')], 21, true, false),
    ).toMatchObject({ pause: true, attempt: { step: 'fire' } });
  });

  it('defers presentation conflicts and rejects substitution slot reuse', () => {
    expect(
      advanceHeroPowerTutorial(null, [cell(3, 'arm')], 20, true, true),
    ).toEqual({ attempt: null, pause: false });

    const started = advanceHeroPowerTutorial(
      null,
      [cell(3, 'arm')],
      20,
      true,
      false,
    );
    const waiting = dismissHeroPowerTutorialArmed(started.attempt, 20);
    expect(
      advanceHeroPowerTutorial(waiting, [cell(3, 'fire')], 21, true, true),
    ).toEqual({ attempt: waiting, pause: false });
    expect(
      advanceHeroPowerTutorial(
        waiting,
        [cell(3, 'fire', 'substitute')],
        21,
        true,
        false,
      ),
    ).toEqual({ attempt: null, pause: false });
    expect(advanceHeroPowerTutorial(waiting, [], 21, false, false)).toEqual({
      attempt: null,
      pause: false,
    });
  });

  it('wires the career gate, per-tick pause, real button, and inert background', () => {
    const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');
    const match = readFileSync(
      join(process.cwd(), 'src/render/MatchScreen.tsx'),
      'utf8',
    );
    const dock = readFileSync(
      join(process.cwd(), 'src/render/HeroPowerDock.tsx'),
      'utf8',
    );
    const matchStyles = readFileSync(
      join(process.cwd(), 'src/render/match-screen-styles.ts'),
      'utf8',
    );
    const harness = readFileSync(
      join(process.cwd(), 'src/ui/dev-harness/entries/live-match-controls.tsx'),
      'utf8',
    );

    expect(app).toContain("'hero-power-tutorial-complete'");
    expect(app).toContain('!preferences.autoPowers');
    expect(match).toContain('advanceHeroPowerTutorial(');
    expect(match).toContain('heroPowerTutorialStartedThisMatchRef');
    expect(match).toContain('.slice(eventsBefore)');
    expect(match).toContain('currentHeroTutorialAttempt.target.slot');
    expect(match).toContain('style={styles.desktopRailPane}');
    expect(match).toContain('hasHoverPointer()');
    expect(match).toContain("tutorialAttempt?.step === 'waiting-fire'");
    expect(match).toContain("automaticPauseReasonsRef.current.add('tutorial')");
    expect(match).toContain("return { inert: true, 'aria-hidden': true };");
    expect(match).toContain('const recorded = recordCoachingInput({');
    expect(match).toContain('onTargetPress=');
    expect(dock).toContain("guideStep === 'fire'");
    expect(dock).toContain('useWindowDimensions();');
    expect(dock).toContain(
      'const hiddenFromTutorial = tutorialPaused && !tutorialTarget;',
    );
    expect(dock).toContain(
      "Platform.OS === 'web' ? undefined : tutorialFireHint",
    );
    expect(dock).toContain('AccessibilityInfo.setAccessibilityFocus(handle)');
    expect(dock).toContain('tabIndex={hiddenFromTutorial ? -1 : undefined}');
    expect(harness).toContain("id: 'hero-power-tutorial'");
    expect(harness).toContain('heroPowerTutorial={tutorial}');
    expect(matchStyles).toContain("desktopRailPane: { flexDirection: 'row' }");
  });
});
