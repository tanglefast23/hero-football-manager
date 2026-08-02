import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ManagementSprite } from './ManagementSprite';
import type { CelebrationCoachViewModel } from '../models';

/**
 * The hired staff, stood out on the grass for a celebration.
 *
 * They go beside Bert wherever he is in the scene — he is the manager's other
 * constant, and the two of them read as the bench watching the club they built.
 * Where he is absent the caller places this row beside the players instead; the
 * component only stages the staff, it does not decide the mark.
 *
 * Drawn with `ManagementSprite` rather than through the Skia atlas the squad
 * uses: coaches live in their own sheet with their own palette, and the atlas
 * is built for the kit-coloured player cells. Two figures is not a batch worth
 * the merge.
 *
 * An empty list renders nothing — a club running no staff must leave no gap.
 */
export function CelebrationCoachRow({
  coaches,
  spriteWidth,
  style,
}: {
  readonly coaches: readonly CelebrationCoachViewModel[];
  readonly spriteWidth: number;
  readonly style?: StyleProp<ViewStyle>;
}) {
  if (coaches.length === 0) return null;
  return (
    <View pointerEvents="none" style={[styles.row, style]}>
      {coaches.map(coach => (
        <ManagementSprite
          key={coach.id}
          spriteKey={coach.spriteKey}
          width={spriteWidth}
          accessibilityLabel={coach.name}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Bottom-aligned so a coach stands ON the grass line rather than floating to
  // the centre of whatever box the scene hands this row.
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
});
