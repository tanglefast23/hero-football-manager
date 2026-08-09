import { useEffect, useRef } from 'react';
import { Animated, type ViewStyle } from 'react-native';

/**
 * How long the screen has to sit still before the primary action offers itself.
 *
 * Short enough to catch a player who has finished reading and is deciding, long
 * enough that it never fires while they are still working. A player mid-thought
 * should not be nagged; a player who has stopped should be shown the way on.
 */
export const IDLE_ATTRACT_DELAY_MS = 4_000;
const BREATH_MS = 1_150;
/** Barely more than a shift in weight — an invitation, not a demand. */
const BREATH_SCALE = 1.025;

/**
 * Breathes its child once the screen has been still for a while.
 *
 * `restartKey` is the pulse's reset: give it something that changes whenever
 * the player does anything (the week, the tab, the objective) and the attract
 * goes back to waiting. When `active` is false — the control is disabled, the
 * player is mid-tutorial, or motion is reduced — nothing animates at all and
 * the child renders untouched.
 *
 * Style-only on purpose: NativeWind drops `className` on animated components,
 * so everything visual stays on the child.
 */
export function IdleAttract({
  active,
  restartKey,
  style,
  children,
}: {
  active: boolean;
  restartKey: string | number;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    breath.setValue(0);
    if (!active) return undefined;
    let loop: Animated.CompositeAnimation | undefined;
    const timer = setTimeout(() => {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(breath, {
            toValue: 1,
            duration: BREATH_MS,
            useNativeDriver: true,
          }),
          Animated.timing(breath, {
            toValue: 0,
            duration: BREATH_MS,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    }, IDLE_ATTRACT_DELAY_MS);
    return () => {
      clearTimeout(timer);
      loop?.stop();
      breath.setValue(0);
    };
  }, [active, breath, restartKey]);

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [
            {
              scale: breath.interpolate({
                inputRange: [0, 1],
                outputRange: [1, BREATH_SCALE],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
