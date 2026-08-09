import { readFileSync } from 'fs';
import { join } from 'path';
import { createMatch } from '../../sim/match';
import { ROVERS, UNITED } from '../../sim/teams';
import type { PlayerDef, TeamDef } from '../../sim/types';
import {
  FIRST_MATCH_RED_ENERGY_THRESHOLD,
  nextFirstMatchCoachingPrompt,
} from '../first-match-coaching';

function reserve(id: string, role: PlayerDef['role']): PlayerDef {
  return {
    ...ROVERS.players.find((player) => player.role === role)!,
    id,
    name: `Reserve ${id}`,
  };
}

function watchedMatch(): ReturnType<typeof createMatch> {
  const home: TeamDef = {
    ...ROVERS,
    bench: [
      reserve('bench-gk', 'GK'),
      reserve('bench-def', 'DEF'),
      reserve('bench-fwd', 'FWD'),
    ],
  };
  return createMatch(808, home, UNITED, { controlledTeam: 0 });
}

describe('first match coaching prompts', () => {
  it('waits for the first controlled player to enter the red energy band', () => {
    const state = watchedMatch();
    state.players[1].condition = FIRST_MATCH_RED_ENERGY_THRESHOLD + 1;

    expect(
      nextFirstMatchCoachingPrompt(state, 0, {
        tiredPlayer: false,
      }),
    ).toBeNull();

    state.players[1].condition = FIRST_MATCH_RED_ENERGY_THRESHOLD;
    expect(
      nextFirstMatchCoachingPrompt(state, 0, {
        tiredPlayer: false,
      }),
    ).toEqual({ kind: 'tired-player', player: 1 });
    expect(
      nextFirstMatchCoachingPrompt(state, 0, {
        tiredPlayer: true,
      }),
    ).toBeNull();
  });

  it('does not point at Swap when no legal fresh replacement remains', () => {
    const state = watchedMatch();
    state.players[5].condition = FIRST_MATCH_RED_ENERGY_THRESHOLD;
    state.bench[0] = state.bench[0].filter((player) => player.role === 'GK');

    expect(
      nextFirstMatchCoachingPrompt(state, 0, {
        tiredPlayer: false,
      }),
    ).toBeNull();
  });

  it('does not interrupt the match when the opponent opens a three-goal lead', () => {
    const state = watchedMatch();
    state.score = [0, 3];
    expect(
      nextFirstMatchCoachingPrompt(state, 0, {
        tiredPlayer: true,
      }),
    ).toBeNull();
  });

  it('wires the prompts only to the story opening fixture and keeps the requested copy', () => {
    const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');
    const match = readFileSync(
      join(process.cwd(), 'src/render/MatchScreen.tsx'),
      'utf8',
    );

    expect(app).toContainSource(
      'firstMatchTutorial={careerTeaches && isFirstOnboardingFixture(',
    );
    // The words moved into the catalog, so the wiring is what this can still
    // see here; the English itself is asserted by the i18n catalog gates.
    expect(match).toContainSource("t('matchScreen.swapInAFreshPlayer')");
    expect(match).toContainSource("t('matchScreen.playerIsVeryTired'");
    expect(match).toContainSource("t('matchScreen.onePlayerIsVeryTired')");
    expect(match).toContainSource(
      'firstMatchTiredPlayerRef.current = prompt.player;',
    );
    expect(match).toContainSource('tutorialTiredStarter');
    expect(match).toContainSource("detail={t('matchScreen.swapPlayers')}");
    expect(match).not.toContainSource('Try a new strategy');
    expect(match).not.toContainSource('The other team is pulling away.');
  });

  it('turns the Swap control into the undimmed action that opens substitutions', () => {
    const match = readFileSync(
      join(process.cwd(), 'src/render/MatchScreen.tsx'),
      'utf8',
    );

    expect(match).toContainSource(
      "const guideSwapButton = firstMatchTutorialStep === 'tired-swap-cue';",
    );
    expect(match).toContainSource(
      'guideSwapButton ? styles.coachButtonGuided : null',
    );
    expect(match).toContainSource(
      'guideSwapButton ? styles.swapIconGuided : null',
    );
    expect(match).toContainSource(
      'guideSwapButton ? styles.coachLabelGuided : null',
    );
    expect(match).toContainSource('<TutorialSpotlight');
    expect(match).toContainSource('anchor={swapGuideAnchor}');
    expect(match).not.toContainSource('dismissFirstMatchCueAfterPress');
    const swapTarget = match.indexOf('ref={swapGuideTargetRef}');
    const swapPressable = match.slice(
      match.lastIndexOf('<Pressable', swapTarget),
      match.indexOf('</Pressable>', swapTarget),
    );
    expect(swapPressable).toContainSource('pressSfx="match-control"');
    expect(swapPressable).toMatchSource(
      /onPress=\{\(\) => \{\s*openSwap\(\);\s*\}\}/,
    );
    expect(swapPressable).not.toContainSource('playUiClickSfx');
    // The StyleSheet itself now lives beside the screen in match-screen-styles.
    const styles = readFileSync(
      join(process.cwd(), 'src/render/match-screen-styles.ts'),
      'utf8',
    );
    expect(styles).toMatchSource(
      /coachButtonGuided:\s*\{[\s\S]*?opacity: 1,[\s\S]*?backgroundColor: '#5a8fd6',/,
    );
  });

  it('carries the named player into a device-specific substitution-board cue', () => {
    const match = readFileSync(
      join(process.cwd(), 'src/render/MatchScreen.tsx'),
      'utf8',
    );
    const board = readFileSync(
      join(process.cwd(), 'src/render/SubstitutionBoard.tsx'),
      'utf8',
    );

    expect(match).toContainSource(
      "firstMatchTutorialStepRef.current = 'tired-player-cue';",
    );
    expect(match).toContainSource(
      "guideFieldPlayer={firstMatchTutorialStep === 'tired-player-cue'",
    );
    expect(match).toContainSource(
      'firstMatchTiredPlayerRef.current ?? undefined',
    );
    expect(match).toContainSource(
      'onGuideFieldPlayerAction={finishTiredPlayerTutorial}',
    );
    // Desktop takes either, so the cue names both rather than the drag alone.
    expect(board).toContainSource("t('substitutionBoard.guideClickOrDrag')");
    expect(board).toContainSource("t('substitutionBoard.guideTap')");
    expect(board).toContainSource('const guided = id === guideCardId;');
    expect(board).toContainSource(
      'guideLabel === undefined ? null : styles.cardGuided',
    );
    expect(board).toContainSource('consumeGuide(source);');
  });
});
