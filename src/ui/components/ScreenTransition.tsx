import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { MOTION_MS } from '../motion';

/**
 * The dissolve between whole screens.
 *
 * App.tsx routes with an if/else chain rather than a navigator, so every screen
 * change was a hard cut: the desk vanished and the team sheet was simply there,
 * in one frame, with nothing in between. A polish audit scored this the worst
 * instance of "nothing appears or disappears instantly" in the build, because it
 * happens between every screen rather than inside one.
 *
 * WHY THE OUTGOING SCREEN FADES, NOT THE INCOMING ONE. Fading the new screen up
 * from nothing shows the app's ink background through it, so two paper screens
 * in a row would blink dark — a new instant appearance, traded for the one we
 * removed. So the arriving screen is never touched: it is laid down at full
 * strength and the departing screen dissolves off the top of it.
 *
 * WHY TWO FIXED SLOTS. The departing screen has to stay mounted while it fades,
 * and moving its element to a different place in the tree would unmount and
 * remount it — replaying every mount effect it owns, including its sounds. So
 * the two slots below are permanent: a screen is rendered into one of them and
 * stays there for its whole life, and `zIndex` (not tree order) decides which is
 * on top. Nothing is ever re-parented, so nothing is ever remounted.
 *
 * Style-only, deliberately: NativeWind silently drops `className` on Animated
 * components, so the animated wrappers carry raw styles and the classNamed
 * content stays in the screens themselves.
 */

/** Short on purpose: this sits between every interaction, not on top of one. */
export const SCREEN_FADE_MS = MOTION_MS.QUICK;

/** One side of a screen change, as far as the dissolve is concerned. */
export interface ScreenTransitionSide {
  /**
   * Anything with a stable identity per screen — compared with `!==`, never
   * rendered. App.tsx passes the component its routing chain picked.
   */
  key: unknown;
  /**
   * False for a screen that must not be held on screen after it hands over:
   * the watched match runs a Skia canvas and a frame loop, and keeping it
   * drawing while the post-match ledger builds is exactly the wrong moment to
   * ask the device for another 150ms of it.
   */
  animated: boolean;
}

/**
 * Whether a change from `previous` to `next` dissolves or cuts.
 *
 * Both sides must opt in: a screen excluded from the dissolve is excluded on the
 * way in and on the way out, since either direction would hold it on screen.
 */
export function screenChangeDissolves(
  previous: ScreenTransitionSide,
  next: ScreenTransitionSide,
  reduceMotion: boolean,
): boolean {
  if (reduceMotion) return false;
  if (previous.key === next.key) return false;
  return previous.animated && next.animated;
}

export interface ScreenTransitionProps {
  /** See `ScreenTransitionSide.key`. */
  screenKey: unknown;
  /** Reduce Motion cuts, with no hold and no fade at all. */
  reduceMotion: boolean;
  /** See `ScreenTransitionSide.animated`. Defaults to true. */
  animated?: boolean;
  children: ReactNode;
}

type Slot = 0 | 1;

function otherSlot(slot: Slot): Slot {
  return slot === 0 ? 1 : 0;
}

interface DissolveState {
  /** The screen key currently living in `active`. */
  key: unknown;
  active: Slot;
  /** The screen still fading off the other slot, or null when nothing is. */
  outgoing: ReactNode;
  /** Bumps once per screen change, so a fade interrupted mid-way restarts. */
  pass: number;
}

export function ScreenTransition({
  screenKey,
  reduceMotion,
  animated = true,
  children,
}: ScreenTransitionProps) {
  const opacities = useRef<[Animated.Value, Animated.Value]>([
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;
  // What was on screen at the last commit. Read only on the render where the
  // key changes, which is the one render where it is still the old screen.
  const committed = useRef<{ side: ScreenTransitionSide; node: ReactNode }>({
    side: { key: screenKey, animated },
    node: children,
  });
  const [state, setState] = useState<DissolveState>(() => ({
    key: screenKey,
    active: 0,
    outgoing: null,
    pass: 0,
  }));

  if (state.key !== screenKey) {
    const dissolves = screenChangeDissolves(
      committed.current.side,
      { key: screenKey, animated },
      reduceMotion,
    );
    const active = dissolves ? otherSlot(state.active) : state.active;
    // The only Animated write outside an effect, and it only ever writes a slot
    // UP to full. A render React throws away can therefore leave a slot visible,
    // never blank — the failure direction that costs polish, not the screen.
    if (dissolves) opacities[active].setValue(1);
    setState({
      key: screenKey,
      active,
      outgoing: dissolves ? committed.current.node : null,
      pass: state.pass + 1,
    });
  }

  useEffect(() => {
    committed.current = { side: { key: screenKey, animated }, node: children };
  });

  const { active, outgoing, pass } = state;
  const fading = otherSlot(active);
  useEffect(() => {
    if (outgoing === null) return undefined;
    const opacity = opacities[fading];
    const animation = Animated.timing(opacity, {
      toValue: 0,
      duration: SCREEN_FADE_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      // Only drop the screen. Parking the slot back at full strength here would
      // land a frame BEFORE the children are cleared, flashing the screen that
      // just finished dissolving back to solid — the cleanup below does it once
      // the slot is genuinely empty.
      if (!finished) return;
      setState((current) =>
        current.pass === pass ? { ...current, outgoing: null } : current,
      );
    });
    return () => {
      animation.stop();
      // The slot has either been emptied or taken over by the newest screen.
      // Either way it is done fading and must be handed back opaque.
      opacity.setValue(1);
    };
  }, [outgoing, fading, pass, opacities]);

  return (
    <View style={styles.root}>
      <Animated.View
        pointerEvents={active === 0 ? 'auto' : 'none'}
        accessibilityElementsHidden={active !== 0}
        importantForAccessibility={
          active === 0 ? 'auto' : 'no-hide-descendants'
        }
        style={[
          styles.slot,
          { opacity: opacities[0], zIndex: active === 0 ? 0 : 1 },
        ]}
      >
        {active === 0 ? children : outgoing}
      </Animated.View>
      <Animated.View
        pointerEvents={active === 1 ? 'auto' : 'none'}
        accessibilityElementsHidden={active !== 1}
        importantForAccessibility={
          active === 1 ? 'auto' : 'no-hide-descendants'
        }
        style={[
          styles.slot,
          { opacity: opacities[1], zIndex: active === 1 ? 0 : 1 },
        ]}
      >
        {active === 1 ? children : outgoing}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Both slots fill the same rect for their whole life, so a screen's geometry
  // never changes when the other slot takes over — anything measured mid-fade
  // (a tutorial spotlight anchor) reads the same numbers it always did.
  slot: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
