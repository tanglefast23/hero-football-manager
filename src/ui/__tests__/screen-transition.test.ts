import { readFileSync } from 'fs';
import { join } from 'path';
import { MOTION_MS } from '../motion';

/**
 * The dissolve between screens can only be read from source here: it lives in a
 * component that imports react-native, and this suite runs on plain node with no
 * renderer. So these guard the invariants that make it safe rather than the
 * pixels — every one of them is something that would silently un-fix the polish
 * or break a screen if it drifted.
 */
function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

const TRANSITION = 'src/ui/components/ScreenTransition.tsx';

describe('screen transition', () => {
  it('sits between interactions rather than on top of one', () => {
    // Long enough to be seen, short enough that it never becomes the thing the
    // player is waiting for. A screen change happens dozens of times a session.
    expect(MOTION_MS.QUICK).toBeGreaterThanOrEqual(140);
    expect(MOTION_MS.QUICK).toBeLessThanOrEqual(200);
    expect(source(TRANSITION)).toContain(
      'export const SCREEN_FADE_MS = MOTION_MS.QUICK;',
    );
  });

  it('keeps every animated wrapper style-only', () => {
    // NativeWind silently drops `className` on Animated components: the styles
    // vanish, nothing errors, and the screen renders unstyled. The classNamed
    // content belongs to the screens; these wrappers carry raw styles only.
    const animatedViews =
      source(TRANSITION).match(/<Animated\.\w+[\s\S]*?>/g) ?? [];
    expect(animatedViews.length).toBeGreaterThan(0);
    for (const view of animatedViews) {
      expect(view).not.toContain('className');
    }
  });

  it('drives the fade off the UI thread', () => {
    // The app has no `useNativeDriver: false` left anywhere, and a transition
    // that ran on the JS thread would stutter exactly when the incoming screen
    // is doing its mount work.
    const file = source(TRANSITION);
    expect(file).toContain('useNativeDriver: true');
    expect(file).not.toContain('useNativeDriver: false');
    // Native driver only carries opacity and transforms; anything else silently
    // throws at runtime.
    expect(file).not.toMatch(
      /toValue[\s\S]{0,80}(width|height|backgroundColor)/,
    );
  });

  it('cuts instead of dissolving under Reduce Motion', () => {
    // Not a shortened fade — no hold and no animation at all, which also means
    // no screen is kept alive past its handover.
    expect(source(TRANSITION)).toContain('if (reduceMotion) return false;');
  });

  it('needs both sides of a change to opt in', () => {
    // A screen excluded from the dissolve is excluded leaving as well as
    // arriving: either direction would hold it on screen past its handover.
    expect(source(TRANSITION)).toContain(
      'return previous.animated && next.animated;',
    );
  });

  it('never re-parents a screen between the two slots', () => {
    // Moving a mounted screen to a different place in the tree unmounts and
    // remounts it, replaying every mount effect it owns — its music, its
    // cutscene, its frame loop. Both slots are therefore permanent, and zIndex
    // (not tree order) decides which is on top.
    const file = source(TRANSITION);
    expect(file).toContain('zIndex: active === 0 ? 0 : 1');
    expect(file).toContain('zIndex: active === 1 ? 0 : 1');
    // Two fixed slots, each rendering the live children or the outgoing one.
    expect(
      file.match(/\{active === [01] \? children : outgoing\}/g),
    ).toHaveLength(2);
  });

  it('leaves the fading screen untouchable and unread', () => {
    const file = source(TRANSITION);
    expect(file).toContain(
      "pointerEvents={active === 0 && inputSettled ? 'auto' : 'none'}",
    );
    expect(file).toContain(
      "pointerEvents={active === 1 && inputSettled ? 'auto' : 'none'}",
    );
    expect(file).toContain('accessibilityElementsHidden={active !== 0}');
    expect(file).toContain('accessibilityElementsHidden={active !== 1}');
  });

  it('makes the hidden slot inert, not merely unclickable', () => {
    // pointerEvents stops the mouse and nothing else. The departed title screen
    // kept tabIndex=0 buttons in the tab order for the whole session, so Tab +
    // Enter on the invisible "Start over · erase save" raised the career-erase
    // confirm over whatever screen the manager was actually on.
    const file = source(TRANSITION);
    expect(file).toContain("return { inert: true, 'aria-hidden': true };");
    expect(file).toContain('{...hiddenSlotProps(active !== 0)}');
    expect(file).toContain('{...hiddenSlotProps(active !== 1)}');
    // Native already owns its AX boundary; `inert` is a DOM attribute.
    expect(file).toContain("if (!hidden || Platform.OS !== 'web') return {};");
  });

  it('unmounts the departed screen even when the fade never completes', () => {
    // react-native-web drives this fade on requestAnimationFrame, which a
    // backgrounded tab stops outright. Without the timer the outgoing screen
    // stayed mounted for the rest of the session, still running its intervals.
    const file = source(TRANSITION);
    expect(file).toContain(
      'const backstop = setTimeout(drop, SCREEN_FADE_MS + 100);',
    );
    expect(file).toContain('clearTimeout(backstop);');
  });

  it('swallows the stray taps of a double-tap that changed the screen', () => {
    // Both slots fill the same rect, so the weekly review's confirm button and
    // the management shell's Club tab share a y-band. Taps 2-3 of an impatient
    // triple-tap landed on the tab and moved the manager to Club Office.
    const file = source(TRANSITION);
    expect(file).toContain('export const SCREEN_INPUT_SETTLE_MS = 250;');
    expect(file).toContain('setInputSettled(false);');
    expect(file).toContain('SCREEN_INPUT_SETTLE_MS,');
    // The first screen of the session has no stray tap in flight behind it.
    expect(file).toContain('useState(true);');
  });

  it('never updates transition state while React is rendering', () => {
    const file = source(TRANSITION);
    const renderBody = file.slice(
      file.indexOf('export function ScreenTransition'),
      file.indexOf('useLayoutEffect(() => {'),
    );
    expect(renderBody).not.toContain('setState(');
    expect(file).toContain('if (state.key === screenKey) return;');
  });
});

describe('App screen routing', () => {
  const app = source('App.tsx');

  it('wraps the routed screen and honours Reduce Motion', () => {
    expect(app).toContain('<ScreenTransition');
    expect(app).toContain('screenKey={screenKey}');
    expect(app).toContain('reduceMotion={reduceMotion}');
    expect(app).toContain('animated={!screenRequiresHardCut}');
  });

  it('identifies a screen by the component the routing chain picked', () => {
    // A parallel key derived from `store.screen` would be a second routing table
    // to keep in step with the if/else chain, and would get the welcome views
    // and the two loading branches wrong.
    expect(app).toContain(
      'const screenKey: unknown = isValidElement(screen) ? screen.type : screen;',
    );
  });

  it('excludes frame-loop screens and the blocking rival cutscene', () => {
    // The watched match and the face-off must not be held on screen after they
    // hand over: both keep drawing, and the moment they hand over is the moment
    // the next screen is doing its most expensive work.
    expect(app).toContain('screenKey === MatchScreen');
    expect(app).toContain('screenKey === PenaltyShootout');
    expect(app).toContain('screenKey === QuickResultFaceOff');
    expect(app).toContain('screenKey === RivalHeroIntroScreen');
  });
});
