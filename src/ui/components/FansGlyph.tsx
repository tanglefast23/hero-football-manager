import { View } from 'react-native';
import {
  FINANCE_SPRITE_CELL,
  financeSpriteRuns,
  type FinanceSpriteId,
} from '../finance-pixel-art';

/**
 * The HUD's supporter mark: two of the cheering fans from the Financial
 * Report's crowd, standing close enough to overlap.
 *
 * Two rather than one because a lone figure reads as a player, and the same
 * pair the surge banner cheers with keeps one visual language for "the people
 * in the stands". Drawn as plain run-length Views rather than a Skia canvas:
 * this rides in the persistent shell on every screen, so it must cost nothing
 * to keep mounted, and at this size the runs are a few dozen rectangles.
 */

const SCALE = 1;
/**
 * Columns the front fan is shifted by — five columns of the two 16x16 cells
 * share space. 7 is the tightest shift that keeps both outlines: at 6 the two
 * heads' top rows merge into one bar and the pair reads as a single blob, and
 * a spot that eats the outline kills the silhouette at this size.
 */
const OVERLAP_COLUMNS = 7;
const PAIR: readonly FinanceSpriteId[] = ['fan-cheer-b', 'fan-cheer-d'];

export const FANS_GLYPH_WIDTH = (FINANCE_SPRITE_CELL + OVERLAP_COLUMNS) * SCALE;
export const FANS_GLYPH_HEIGHT = FINANCE_SPRITE_CELL * SCALE;

export function FansGlyph() {
  return (
    <View
      // Decorative: the chip's own accessibility label already says "Fans".
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: FANS_GLYPH_WIDTH, height: FANS_GLYPH_HEIGHT }}
    >
      {PAIR.map((spriteId, index) => (
        <View
          key={spriteId}
          style={{
            position: 'absolute',
            left: index * OVERLAP_COLUMNS * SCALE,
            top: 0,
            width: FINANCE_SPRITE_CELL * SCALE,
            height: FINANCE_SPRITE_CELL * SCALE,
          }}
        >
          {financeSpriteRuns(spriteId).map(run => (
            <View
              key={run.id}
              style={{
                position: 'absolute',
                left: run.x * SCALE,
                top: run.y * SCALE,
                width: run.width * SCALE,
                height: SCALE,
                backgroundColor: run.color,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
