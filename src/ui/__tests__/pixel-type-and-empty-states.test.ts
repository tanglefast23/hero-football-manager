import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

function uiFiles(): string[] {
  const out = execFileSync('find', ['src/ui', '-name', '*.tsx'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  return out.trim().split('\n').filter(line => line.length > 0);
}

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

/** Every quoted string on a line, so a className can be inspected class-by-class. */
function stringLiterals(line: string): string[] {
  return line.match(/(["'`])(?:\\.|(?!\1)[\s\S])*?\1/g) ?? [];
}

/**
 * Silkscreen ships one weight per family file, so `font-bold` on top of
 * `font-mono` (Silkscreen_400Regular) asks the platform to synthesize a bold
 * face — which smears a 1-bit bitmap font. `font-pixel` is the real bold cut.
 *
 * The survivors are glyph-only nodes whose character Silkscreen does not
 * contain (⌂ ▦ ⇄ ≡ ⚙ ★ ⌖ ▣ ○ - →). Those already fall back to the system face,
 * where `font-bold` is genuine weight rather than a synthetic smear, so
 * stripping it there would only thin them out.
 */
describe('pixel type discipline', () => {
  const GLYPH_FALLBACK_EXCEPTIONS = new Set([
    'src/ui/ManagementShell.tsx',
    'src/ui/SettingsOverlay.tsx',
    'src/ui/screens/MarketScreen.tsx',
    'src/ui/screens/CharacterCreationScreen.tsx',
    'src/ui/screens/FixtureMatchDayScreen.tsx',
    'src/ui/screens/ClubHomeScreen.tsx',
  ]);

  it('never asks a single-weight pixel font for a bold cut', () => {
    const offenders: string[] = [];
    for (const file of uiFiles()) {
      if (GLYPH_FALLBACK_EXCEPTIONS.has(file)) continue;
      readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
        for (const literal of stringLiterals(line)) {
          if (/\bfont-mono\b/.test(literal) && /\bfont-bold\b/.test(literal)) {
            offenders.push(`${file}:${index + 1} ${literal}`);
          }
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('keeps font-pixel free of a redundant font-bold', () => {
    const offenders: string[] = [];
    for (const file of uiFiles()) {
      readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
        for (const literal of stringLiterals(line)) {
          if (/\bfont-pixel\b/.test(literal) && /\bfont-bold\b/.test(literal)) {
            offenders.push(`${file}:${index + 1} ${literal}`);
          }
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('exposes the three type voices from the art bible, display by default', () => {
    const source = read('src/ui/components/PixelText.tsx');
    expect(source).toContain("display: 'font-pixel'");
    expect(source).toContain("data: 'font-mono'");
    expect(source).toContain("body: ''");
    expect(source).toContain("variant = 'display'");
    // The face is applied via className only. Mixing className and style for
    // one visual property lets either win unpredictably on native.
    expect(source).not.toMatch(/fontFamily\s*:/);
  });

  it('routes short uppercase labels through PixelText instead of the OS font', () => {
    // A <Text> with `uppercase` and no font family renders in SF Pro / Roboto.
    const offenders: string[] = [];
    for (const file of uiFiles()) {
      const source = readFileSync(file, 'utf8');
      if (/fontFamily/.test(source)) continue; // StyleSheet path names Silkscreen itself
      for (const tag of source.match(/<Text(?:\s[^>]*?)?\/?>/gs) ?? []) {
        if (/\buppercase\b/.test(tag) && !/\bfont-(mono|pixel|sans)\b/.test(tag)) {
          offenders.push(`${file} ${tag.replace(/\s+/g, ' ').slice(0, 100)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * The recurring bug shape: a section heading or a table header row lives
 * outside the `.map()`, so an empty collection strands the heading above blank
 * space. Each list below must gate on its own length.
 */
describe('list empty states', () => {
  it('promotes EmptyDocket to a shared component rather than a private one', () => {
    expect(read('src/ui/components/EmptyDocket.tsx')).toContain('export function EmptyDocket');
    const market = read('src/ui/screens/MarketScreen.tsx');
    expect(market).toContain("import { EmptyDocket } from '../components/EmptyDocket'");
    expect(market).not.toContain('function EmptyDocket(');
  });

  it.each([
    ['src/ui/screens/MarketScreen.tsx', 'viewModel.scouting.choices.length === 0'],
    ['src/ui/screens/MarketScreen.tsx', 'listing.bids.length === 0'],
    ['src/ui/screens/MarketScreen.tsx', 'viewModel.cards.length === 0'],
    ['src/ui/screens/ClubFinancesScreen.tsx', 'viewModel.ledger.length === 0'],
    ['src/ui/screens/ClubFinancesScreen.tsx', 'viewModel.recentTransactions.length === 0'],
    ['src/ui/screens/ClubHomeScreen.tsx', 'viewModel.table.length === 0'],
    ['src/ui/screens/ClubHomeScreen.tsx', 'viewModel.form.length === 0'],
    ['src/ui/screens/LeagueTableScreen.tsx', 'viewModel.rows.length === 0'],
    ['src/ui/screens/SquadTrainingScreen.tsx', 'sortedPlayers.length === 0'],
  ])('%s guards %s', (file, guard) => {
    expect(read(file)).toContain(guard);
  });
});
