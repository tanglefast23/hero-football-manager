import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ENERGY_FILL_COLORS,
  energyUseAccessibility,
  energyUseLabel,
  energyBand,
  summarizeTeamEnergy,
} from '../match-energy-ui';
import {
  AWAY_KIT_COLOR,
  HOME_KIT_COLOR,
  HOME_KIT_COLOR_SAFE,
} from '../team-kit-ui';

/** WCAG 2.1 relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

const sourceOf = (path: string) =>
  readFileSync(join(process.cwd(), path), 'utf8');

describe('match energy UI', () => {
  test('uses the same three visible energy bands at their exact boundaries', () => {
    expect(energyBand(100)).toBe('green');
    expect(energyBand(61)).toBe('green');
    expect(energyBand(60)).toBe('amber');
    expect(energyBand(31)).toBe('amber');
    expect(energyBand(30)).toBe('red');
    expect(energyBand(0)).toBe('red');
  });

  test('summarizes team energy and counts current players at 40 or below', () => {
    expect(summarizeTeamEnergy([100, 61, 60, 41, 40, 30, 0])).toEqual({
      average: 47,
      tiredCount: 3,
    });
    expect(summarizeTeamEnergy([])).toEqual({ average: 0, tiredCount: 0 });
  });

  test('keeps exact labels and explains the consequence of each effort choice', () => {
    expect(energyUseLabel('SAVE_ENERGY')).toBe('SAVE ENERGY');
    expect(energyUseLabel('BALANCED')).toBe('BALANCED');
    expect(energyUseLabel('ALL_OUT')).toBe('ALL OUT');
    expect(energyUseAccessibility('SAVE_ENERGY')).toContain('conserve energy');
    expect(energyUseAccessibility('BALANCED')).toContain('normal movement');
    expect(energyUseAccessibility('ALL_OUT')).toContain('higher energy cost');
  });
});

describe('energy fill colours', () => {
  test('never repeats a kit colour, so the bar cannot vanish into the possession card', () => {
    const kits = [HOME_KIT_COLOR, HOME_KIT_COLOR_SAFE, AWAY_KIT_COLOR];
    for (const fill of Object.values(ENERGY_FILL_COLORS)) {
      expect(kits).not.toContain(fill);
    }
    // The two exact matches that hid the bar: amber on the color-safe home kit
    // and red on the default one.
    expect(ENERGY_FILL_COLORS.amber).not.toBe(HOME_KIT_COLOR_SAFE);
    expect(ENERGY_FILL_COLORS.red).not.toBe(HOME_KIT_COLOR);
  });

  test('reads against the dark track behind every bar', () => {
    for (const fill of Object.values(ENERGY_FILL_COLORS)) {
      expect(contrastRatio(fill, '#3a3350')).toBeGreaterThan(3);
      expect(contrastRatio(fill, '#16121f')).toBeGreaterThan(3);
    }
  });

  test('frames the possession-card track in ink so any kit still shows an edge', () => {
    expect(sourceOf('src/render/match-screen-styles.ts')).toMatch(
      /energyTrack: \{[^}]*borderColor: KIT_PANEL_BORDER_COLOR/,
    );
  });

  test('drives every energy bar from the one table', () => {
    for (const path of [
      'src/render/match-screen-styles.ts',
      'src/render/MatchControlRail.tsx',
      'src/render/FirstMatchCoachingModal.tsx',
    ]) {
      const source = sourceOf(path);
      expect(source).toContain('ENERGY_FILL_COLORS');
      // No surface may re-declare a band fill as its own literal again.
      expect(source).not.toMatch(/energyFill\w*: \{ backgroundColor: '#/);
    }
  });
});
