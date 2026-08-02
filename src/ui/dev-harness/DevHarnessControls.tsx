import { Pressable, StyleSheet, Text } from 'react-native';

/**
 * The one control the harness and its entries are drawn with.
 *
 * Deliberately not `SfxPressable`: the harness must add no audio cue. The
 * management SFX table is index-addressed by eight tests, and a cue added
 * anywhere but the end of it breaks them all.
 */
export function DevHarnessButton({
  label,
  hint,
  selected = false,
  onPress,
}: {
  readonly label: string;
  readonly hint: string;
  readonly selected?: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint}
      accessibilityState={{ selected }}
      onPress={onPress}
      // Static styles only, and the height among them: a function-form style on
      // a Pressable drops layout properties on iOS and collapses it to nothing.
      style={selected ? styles.buttonSelected : styles.button}
    >
      <Text style={selected ? styles.buttonTextSelected : styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

/**
 * 44pt tall and explicitly so: a function-form style on a Pressable drops
 * layout properties on iOS, so the height can never live in a pressed-state
 * callback. Narrow enough that all five board jumps hold one row at 375pt.
 */
const BUTTON_BASE = {
  minHeight: 44,
  minWidth: 52,
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 2,
  paddingHorizontal: 6,
  paddingVertical: 8,
} as const;

const styles = StyleSheet.create({
  button: {
    ...BUTTON_BASE,
    borderColor: '#5d526e',
    backgroundColor: '#3a3350',
  },
  buttonSelected: {
    ...BUTTON_BASE,
    borderColor: '#edb54a',
    backgroundColor: '#edb54a',
  },
  buttonText: {
    color: '#f4f1ea',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 9,
    textAlign: 'center',
  },
  buttonTextSelected: {
    color: '#241f2e',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 9,
    textAlign: 'center',
  },
});

/** Row geometry shared by the harness bar and every entry's own panel. */
export const devHarnessControlStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  rowLabel: {
    width: 42,
    color: '#edb54a',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 8,
  },
});
