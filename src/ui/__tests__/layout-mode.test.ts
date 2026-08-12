import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TITLE_MASCOT_MIN_HEIGHT,
  TWO_COLUMN_MIN_WIDTH,
  layoutModeForWidth,
  titleMascotFits,
} from '../layout/layout-mode';

describe('layoutModeForWidth', () => {
  it('keeps phones and portrait tablets single-column', () => {
    expect(layoutModeForWidth(390)).toBe('single'); // iPhone
    expect(layoutModeForWidth(834)).toBe('single'); // iPad portrait
    expect(layoutModeForWidth(1032)).toBe('single'); // 13-inch iPad portrait
    expect(layoutModeForWidth(TWO_COLUMN_MIN_WIDTH - 1)).toBe('single');
    expect(layoutModeForWidth(956)).toBe('single'); // iPhone Pro Max landscape web
  });

  it('flows desktop-width viewports into two columns', () => {
    expect(layoutModeForWidth(TWO_COLUMN_MIN_WIDTH)).toBe('twoColumn');
    expect(layoutModeForWidth(1280)).toBe('twoColumn');
    expect(layoutModeForWidth(1194)).toBe('twoColumn'); // 11-inch iPad landscape
    expect(layoutModeForWidth(1376)).toBe('twoColumn'); // 13-inch iPad landscape
  });
});

describe('titleMascotFits', () => {
  it('drops the mascot on the screens its overhang cannot clear', () => {
    // Measured on device: an SE overlapped the wordmark by ~76pt, a 956pt Pro
    // Max cleared the copy by ~79pt.
    expect(titleMascotFits(667)).toBe(false); // iPhone SE / iPhone 8
    expect(titleMascotFits(736)).toBe(false); // iPhone 8 Plus
    expect(titleMascotFits(812)).toBe(false); // iPhone X / 13 mini
    expect(titleMascotFits(TITLE_MASCOT_MIN_HEIGHT - 1)).toBe(false);
  });

  it('keeps it on the screens with room to spare', () => {
    expect(titleMascotFits(TITLE_MASCOT_MIN_HEIGHT)).toBe(true);
    expect(titleMascotFits(852)).toBe(true); // iPhone 15
    expect(titleMascotFits(956)).toBe(true); // iPhone 17 Pro Max
    expect(titleMascotFits(1194)).toBe(true); // iPad
  });

  it('is what the title screen actually gates the scene on', () => {
    // A predicate nothing reads is the most common defect in this codebase.
    const screen = readFileSync(
      join(process.cwd(), 'src/ui/screens/TitleLandingScreen.tsx'),
      'utf8',
    );
    expect(screen).toContain(
      'const showMascot = isWide || titleMascotFits(height);',
    );
    expect(screen).toContain('{showMascot ? (');
    expect(screen).toContain('<TitlePlayerPopScene reduceMotion={reduceMotion} />');
    expect(screen).toContain('showMascot={showMascot}');
  });
});
