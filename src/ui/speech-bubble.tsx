import { StyleSheet, View } from 'react-native';

/**
 * One speech bubble look for every character who talks to the manager.
 *
 * Bert's walk-on bubble set the shape — a thick pixel outline, a hard offset
 * shadow with no blur, and a drawn tail rather than a typed ▼ — and the
 * touchline gaffer was drawing his own thinner, flatter, tail-less version of
 * the same idea. Two bubbles that are nearly the same read as a mistake, so the
 * paint lives here and both import it.
 *
 * Only the paint. Placement stays with the caller: Bert's bubble is positioned
 * absolutely and carried across by a transform for reasons documented at its
 * call site, and the report's bubble is an ordinary block in a column.
 */
export const SPEECH_BUBBLE_FONT_SIZE = 15;
export const SPEECH_BUBBLE_LINE_HEIGHT = 21;

/** How far the tail's point sits below the bubble's bottom edge. */
const TAIL_HEIGHT = 16;
const TAIL_HALF_WIDTH = 10;
/** The fill triangle rides up over the outline to punch out the tail's mouth. */
const TAIL_FILL_INSET = 7;

export const speechBubbleStyles = StyleSheet.create({
  /** Border, fill, padding and shadow — spread this into a positioned style. */
  box: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 3,
    borderColor: '#241f2e',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    // The pixel-art drop shadow the rest of the UI uses: one hard offset, no blur.
    shadowColor: '#241f2e',
    shadowOffset: { width: 5, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  text: {
    color: '#241f2e',
    fontSize: SPEECH_BUBBLE_FONT_SIZE,
    lineHeight: SPEECH_BUBBLE_LINE_HEIGHT,
    fontWeight: 'bold',
  },
  // Two stacked triangles: the dark one is the bubble's border, the white one
  // sits a few pixels up to punch the border line out of the tail's mouth.
  tailBorder: {
    position: 'absolute',
    bottom: -TAIL_HEIGHT,
    width: 0,
    height: 0,
    borderLeftWidth: TAIL_HALF_WIDTH,
    borderRightWidth: TAIL_HALF_WIDTH,
    borderTopWidth: TAIL_HEIGHT,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#241f2e',
  },
  tailFill: {
    position: 'absolute',
    bottom: -(TAIL_HEIGHT - TAIL_FILL_INSET),
    width: 0,
    height: 0,
    borderLeftWidth: TAIL_FILL_INSET,
    borderRightWidth: TAIL_FILL_INSET,
    borderTopWidth: TAIL_HEIGHT - 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#ffffff',
  },
});

/**
 * The tail, pointing down at whoever is speaking.
 *
 * `left` is where the point should land, measured from the bubble's left edge —
 * the speaker's centre, not the bubble's, so a bubble that has slid sideways to
 * stay on screen still points at the right person.
 *
 * Returns the two triangles bare, with no wrapper: they are absolutely
 * positioned against the bubble, and a wrapper View would become the box they
 * measure from and drop them at the end of the text instead.
 */
export function SpeechBubbleTail({ left }: { left: number }) {
  return (
    <>
      <View style={[speechBubbleStyles.tailBorder, { left: left - TAIL_HALF_WIDTH }]} />
      <View style={[speechBubbleStyles.tailFill, { left: left - TAIL_FILL_INSET }]} />
    </>
  );
}
