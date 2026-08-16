import { readFileSync } from 'fs';
import { join } from 'path';
import { portraitPixelRuns, portraitSpriteRows } from '../pixel-portrait-model';
import { requirePixelSheets } from '../../render/sprites/pixel-sheets';

describe('web pixel portraits', () => {
  it('renders the story player look as ordinary vector paths without a WebGL canvas', () => {
    const { portraits } = requirePixelSheets();
    const rows = portraitSpriteRows(portraits, 'f95:rest');
    expect(
      portraitPixelRuns(portraits, rows, 'f95:rest').length,
    ).toBeGreaterThan(100);

    const source = readFileSync(
      join(process.cwd(), 'src/ui/components/PixelPortrait.web.tsx'),
      'utf8',
    );
    expect(source).toContain('<svg');
    expect(source).toContain('<path');
    expect(source).not.toContain('@shopify/react-native-skia');
    expect(source).not.toContain('<Canvas');
    expect(source).toContain('scale = PIXEL_PORTRAIT_SCALE');
    // Literal cell, not the sheet's: the sheet is a lazy chunk on web, and a
    // portrait that sized itself from it would reflow the roster on arrival.
    expect(source).toContain('width={PORTRAIT_CELL.w * pixel}');
    expect(source).toContain('height={PORTRAIT_CELL.h * pixel}');
  });
});
