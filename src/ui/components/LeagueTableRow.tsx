import { memo, useEffect, useRef } from 'react';
import { Animated, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import { LEAGUE_ROW_SETTLE_MS } from '../league-table-motion';

/**
 * One standings row, and the slide that shows where it came from.
 *
 * `rowsMoved` is how many places the club moved since the player last opened
 * the table (positive = dropped). The row is drawn in its NEW place and offset
 * back to the old one for a moment, so the table settles into its order in
 * front of the player instead of arriving pre-sorted. Only transform and
 * opacity are animated, so this runs on the native driver.
 *
 * The animated wrapper carries no `className` — NativeWind drops those on
 * Animated components — so every child keeps its own styling and this adds
 * only motion.
 */
export const LeagueTableRow = memo(function LeagueTableRow({
  rowsMoved,
  rowHeight,
  reduceMotion,
  standingsKey,
  onLayout,
  style,
  children,
}: {
  rowsMoved: number;
  rowHeight: number;
  reduceMotion: boolean;
  /**
   * Identifies the standings being shown. The slide plays once per set of
   * standings, not once per mount: a week advanced while the table is on
   * screen has to move the rows too, and the row height arriving from the
   * first layout pass must not replay a slide that already ran.
   */
  standingsKey: string;
  onLayout?: (event: LayoutChangeEvent) => void;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  const slide = useRef(new Animated.Value(0)).current;
  const playedKey = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (reduceMotion || rowsMoved === 0 || rowHeight <= 0) {
      slide.setValue(0);
      return undefined;
    }
    if (playedKey.current === standingsKey) return undefined;
    playedKey.current = standingsKey;
    // Start where the club used to sit, then travel to where this week put it.
    slide.setValue(-rowsMoved * rowHeight);
    const animation = Animated.spring(slide, {
      toValue: 0,
      damping: 15,
      stiffness: 140,
      mass: 0.9,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, rowHeight, rowsMoved, slide, standingsKey]);

  return (
    <Animated.View
      onLayout={onLayout}
      style={[style, { transform: [{ translateY: slide }] }]}
    >
      {children}
    </Animated.View>
  );
});

export { LEAGUE_ROW_SETTLE_MS };
