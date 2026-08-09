import { StyleSheet, View } from 'react-native';
import type { TutorialAnchorLayout } from './tutorial-cue-position';

/**
 * The dimmed screen behind a briefing, with an optional lit cutout.
 *
 * Four opaque panes around a hole rather than one pane with a mask: React
 * Native has no cross-platform cut-out, and four rectangles are exact at any
 * anchor without a second drawing layer.
 */
export function TutorialSpotlight({
  anchor,
  viewportWidth,
  viewportHeight,
}: {
  anchor?: TutorialAnchorLayout | null;
  viewportWidth: number;
  viewportHeight: number;
}) {
  if (!anchor) {
    return (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.dimPane]}
      />
    );
  }

  const padding = 4;
  const left = Math.max(0, anchor.x - padding);
  const top = Math.max(0, anchor.y - padding);
  const right = Math.min(viewportWidth, anchor.x + anchor.width + padding);
  const bottom = Math.min(viewportHeight, anchor.y + anchor.height + padding);
  const spotlightHeight = Math.max(0, bottom - top);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[styles.dimPane, { left: 0, top: 0, right: 0, height: top }]}
      />
      <View
        style={[
          styles.dimPane,
          { left: 0, top, width: left, height: spotlightHeight },
        ]}
      />
      <View
        style={[
          styles.dimPane,
          { left: right, top, right: 0, height: spotlightHeight },
        ]}
      />
      <View
        style={[styles.dimPane, { left: 0, top: bottom, right: 0, bottom: 0 }]}
      />
    </View>
  );
}

/**
 * The tab rail, ringed as one object.
 *
 * Stepping tab by tab turned one instruction into five beats and dimmed four
 * doors the player was being told to look at, so the whole rail is the subject.
 * The tip that used to float above this ring in a card is now spoken by Bert —
 * the ring says where, he says what.
 */
export function NavigationRing({ anchor }: { anchor: TutorialAnchorLayout }) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.navTourRing,
        {
          left: anchor.x,
          top: anchor.y,
          width: anchor.width,
          height: anchor.height,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dimPane: {
    position: 'absolute',
    backgroundColor: 'rgba(36,31,46,0.6)',
  },
  navTourRing: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#edb54a',
    borderRadius: 4,
  },
});
