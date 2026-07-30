import { readFileSync } from 'fs';
import { join } from 'path';
import { portraitPixelRuns, portraitSpriteRows } from '../pixel-portrait-model';

describe('web pixel portraits', () => {
  it('renders the story player look as ordinary vector paths without a WebGL canvas', () => {
    const rows = portraitSpriteRows('f95:rest');
    expect(portraitPixelRuns(rows, 'f95:rest').length).toBeGreaterThan(100);

    const source = readFileSync(join(process.cwd(), 'src/ui/components/PixelPortrait.web.tsx'), 'utf8');
    expect(source).toContain('<svg');
    expect(source).toContain('<path');
    expect(source).not.toContain('@shopify/react-native-skia');
    expect(source).not.toContain('<Canvas');
    expect(source).toContain('scale = PIXEL_PORTRAIT_SCALE');
    expect(source).toContain('width={portraitSheet.cell.w * pixel}');
    expect(source).toContain('height={portraitSheet.cell.h * pixel}');
  });
});
