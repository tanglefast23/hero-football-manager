import { readFileSync } from 'fs';
import { join } from 'path';
import {
  AWAY_KIT_COLOR,
  HOME_KIT_COLOR,
  HOME_KIT_COLOR_SAFE,
  KIT_PANEL_BORDER_COLOR,
  KIT_PANEL_TEXT_COLOR,
  teamKitColor,
} from '../team-kit-ui';

const matchSource = () => readFileSync(join(process.cwd(), 'src/render/MatchScreen.tsx'), 'utf8');
const railSource = () => readFileSync(join(process.cwd(), 'src/render/MatchControlRail.tsx'), 'utf8');

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

describe('match team kit colours', () => {
  it('gives home the amber/red pairing and away the blue', () => {
    expect(teamKitColor(0, true)).toBe(HOME_KIT_COLOR_SAFE);
    expect(teamKitColor(0, false)).toBe(HOME_KIT_COLOR);
    // Away never changes: color-safe mode remaps only the home kit.
    expect(teamKitColor(1, true)).toBe(AWAY_KIT_COLOR);
    expect(teamKitColor(1, false)).toBe(AWAY_KIT_COLOR);
  });

  it('separates the color-safe pairing by lightness, not hue alone', () => {
    // The point of color-safe kits is that the two teams stay apart even when
    // hue is unavailable, so amber must be clearly the lighter of the pair.
    expect(luminance(HOME_KIT_COLOR_SAFE)).toBeGreaterThan(luminance(AWAY_KIT_COLOR) * 1.8);
    expect(contrastRatio(HOME_KIT_COLOR_SAFE, AWAY_KIT_COLOR)).toBeGreaterThan(1.7);

    // The default red/blue pairing is close in lightness — which is exactly
    // why color-safe mode exists and defaults to on.
    expect(contrastRatio(HOME_KIT_COLOR, AWAY_KIT_COLOR)).toBeLessThan(1.3);

    expect(teamKitColor(0, true)).not.toBe(teamKitColor(1, true));
    expect(teamKitColor(0, false)).not.toBe(teamKitColor(1, false));
  });

  it('reads ink copy on every kit panel, which cream could not', () => {
    // The default (color-safe) pairing clears WCAG AA for body text...
    expect(contrastRatio(KIT_PANEL_TEXT_COLOR, HOME_KIT_COLOR_SAFE)).toBeGreaterThan(4.5);
    expect(contrastRatio(KIT_PANEL_TEXT_COLOR, AWAY_KIT_COLOR)).toBeGreaterThan(4.5);
    // ...and the opt-out red still clears the 3:1 floor for bold copy.
    expect(contrastRatio(KIT_PANEL_TEXT_COLOR, HOME_KIT_COLOR)).toBeGreaterThan(3);

    // Cream on amber is the case that forced the flip to ink.
    expect(contrastRatio('#f4f1ea', HOME_KIT_COLOR_SAFE)).toBeLessThan(2);
  });

  it('frames the panel in ink so a bright kit holds its edge on the pitch', () => {
    expect(KIT_PANEL_BORDER_COLOR).toBe('#241f2e');
    for (const kit of [HOME_KIT_COLOR, HOME_KIT_COLOR_SAFE, AWAY_KIT_COLOR]) {
      expect(contrastRatio(KIT_PANEL_BORDER_COLOR, kit)).toBeGreaterThan(3);
    }
  });

  it('drives the possession card and the fallback sprite tint from one source', () => {
    const source = matchSource();

    expect(source).toContain('{ backgroundColor: teamKitColor(carrier.team, colorSafeKits) }');
    // skColor is the interning wrapper around Skia.Color (the Atlas tint table
    // resolves 25 colours a tick); the point of this assertion is that the
    // fallback tint still comes from teamKitColor rather than a second literal.
    expect(source).toContain('skColor(teamKitColor(');
    // No second copy of the kit literals left behind in the screen.
    expect(source).not.toContain("colorSafeKits ? '#edb54a' : '#d94f52'");
  });

  it('colors both scoreboard team codes from their matching kits', () => {
    const source = matchSource();
    const rail = railSource();

    expect(source).toContain('const homeKitColor = teamKitColor(0, colorSafeKits);');
    expect(source).toContain('const awayKitColor = teamKitColor(1, colorSafeKits);');
    expect(source).toContain('<Text style={{ color: homeKitColor }}>{homeCode}</Text>');
    expect(source).toContain('<Text style={{ color: awayKitColor }}>{awayCode}</Text>');
    expect(source).toContain('homeColor={homeKitColor}');
    expect(source).toContain('awayColor={awayKitColor}');
    expect(rail).toContain('<Text style={{ color: homeColor }}>{homeCode}</Text>');
    expect(rail).toContain('<Text style={{ color: awayColor }}>{awayCode}</Text>');
  });
});
