import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  BRACKET_FIRST_ROUND,
  NARROW_BAND_COLUMNS,
  cupBracketBands,
  COLUMN_GAP,
  COLUMN_WIDTH,
  cupBracketConnectors,
  cupBracketLayout,
} from '../cup-bracket';
import type { M2CupFixtureViewModel, M2CupRoundViewModel } from '../m2-league-models';

function fixture(home: string, away: string, played = false): M2CupFixtureViewModel {
  return {
    id: `${home}-${away}`,
    roundLabel: 'Round of 32',
    homeClubName: home,
    awayClubName: away,
    scoreLabel: played ? '2-1' : '',
    status: played ? 'PLAYED' : 'SCHEDULED',
    ...(played ? { winnerName: home } : {}),
    involvesUserClub: false,
    userWon: false,
    playableNow: false,
  };
}

function round(
  number: number,
  label: string,
  fixtures: readonly M2CupFixtureViewModel[],
  matchCount = fixtures.length,
): M2CupRoundViewModel {
  return {
    round: number,
    label,
    matchCount,
    completedCount: fixtures.filter(f => f.status === 'PLAYED').length,
    statusLabel: '',
    drawn: fixtures.length > 0,
    active: false,
    fixtures,
    byes: [],
  };
}

describe('cup bracket layout', () => {
  const rounds = [
    round(1, 'Play-in', [fixture('A', 'B')]),
    round(2, 'Round of 32', [fixture('A', 'B'), fixture('C', 'D'), fixture('E', 'F'), fixture('G', 'H')]),
    round(3, 'Round of 16', [], 2),
    round(4, 'Quarter-final', [], 1),
  ];

  it('opens at the Round of 32, not the play-in', () => {
    // The play-in is 18 scrappy ties; nobody reads that as a tree.
    expect(BRACKET_FIRST_ROUND).toBe(2);
    const layout = cupBracketLayout(rounds);
    expect(layout.columns.map(column => column.round)).toEqual([2, 3, 4]);
  });

  it('halves the ties each round even before a round is drawn', () => {
    // An undrawn round still needs its slots, or the tree would collapse as the
    // cup progresses and re-expand once the draw lands.
    const layout = cupBracketLayout(rounds);
    expect(layout.columns.map(column => column.ties.length)).toEqual([4, 2, 1]);
    expect(layout.columns[1].ties.every(tie => tie.placeholder)).toBe(true);
  });

  it('centres a tie on the pair that feeds it, so connectors run straight', () => {
    const layout = cupBracketLayout(rounds);
    const [first, second] = layout.columns;
    const pairMidpoint = (first.ties[0].centreY + first.ties[1].centreY) / 2;
    expect(second.ties[0].centreY).toBeCloseTo(pairMidpoint, 5);
  });

  it('spaces columns by one gap and reports the full size', () => {
    const layout = cupBracketLayout(rounds);
    expect(layout.columns[1].left - layout.columns[0].left).toBe(COLUMN_WIDTH + COLUMN_GAP);
    expect(layout.width).toBe(3 * COLUMN_WIDTH + 2 * COLUMN_GAP);
    expect(layout.height).toBeGreaterThan(0);
  });

  it('draws one elbow per pair', () => {
    const connectors = cupBracketConnectors(cupBracketLayout(rounds));
    // 4 -> 2 is two elbows, 2 -> 1 is one more.
    expect(connectors).toHaveLength(3);
    for (const connector of connectors) {
      expect(connector.toX).toBeGreaterThan(connector.fromX);
      expect(connector.upperY).toBeLessThan(connector.lowerY);
      expect(connector.midY).toBeGreaterThanOrEqual(connector.upperY);
      expect(connector.midY).toBeLessThanOrEqual(connector.lowerY);
    }
  });

  it('carries the result through so a played tie can be styled', () => {
    const played = [round(2, 'Round of 32', [fixture('A', 'B', true), fixture('C', 'D')])];
    const [column] = cupBracketLayout(played).columns;
    expect(column.ties[0]).toMatchObject({ played: true, scoreLabel: '2-1', winnerName: 'A' });
    expect(column.ties[1].played).toBe(false);
  });

  it('is empty rather than broken before the cup exists', () => {
    expect(cupBracketLayout([])).toEqual({ columns: [], width: 0, height: 0 });
    expect(cupBracketConnectors({ columns: [], width: 0, height: 0 })).toEqual([]);
  });
});

describe('cup bracket rendering', () => {
  const bracket = readFileSync(join(process.cwd(), 'src/ui/components/CupBracket.tsx'), 'utf8');
  const league = readFileSync(join(process.cwd(), 'src/ui/screens/M2LeagueScreen.tsx'), 'utf8');

  it('replaces the stack of round cards with the tree', () => {
    expect(league).toContain('<CupBracket rounds={viewModel.cup.rounds}');
    // The round cards survive only where they still do work: the live round and
    // any tie the manager can actually play.
    expect(league).toContain('round.active || round.fixtures.some(fixture => fixture.playableNow)');
  });

  it('is drawn in the pixel-art idiom, not as a chart', () => {
    // Flat fills and 2px ink rules on whole pixels; nothing rounded or blurred.
    expect(bracket).toContain('const RULE = 2;');
    expect(bracket).toContain("const INK = '#241f2e'");
    expect(bracket).not.toContain('borderRadius');
    expect(bracket).not.toContain('shadowRadius');
  });

  it('paints connectors under the ties, not over them', () => {
    const connectorAt = bracket.indexOf('connectors.map');
    const tiesAt = bracket.indexOf('column.ties.map');
    expect(connectorAt).toBeGreaterThan(-1);
    expect(tiesAt).toBeGreaterThan(connectorAt);
  });

  it('marks the manager\'s own tie and greys out whoever went out', () => {
    expect(bracket).toContain('tie.involvesUserClub ? styles.tieUser : null');
    expect(bracket).toContain('sideBeaten');
    expect(bracket).toContain("textDecorationLine: 'line-through'");
  });

  it('scrolls sideways rather than shrinking names to nothing', () => {
    expect(bracket).toContain('horizontal');
    expect(bracket).toContain('showsHorizontalScrollIndicator={false}');
  });
});

describe('narrow bracket bands', () => {
  const full = [
    round(2, 'Round of 32', Array.from({ length: 16 }, (_u, i) => fixture(`H${i}`, `A${i}`))),
    round(3, 'Round of 16', [], 8),
    round(4, 'Quarter-final', [], 4),
    round(5, 'Semi-final', [], 2),
    round(6, 'Final', [], 1),
  ];

  it('wraps five columns into bands that each fit a phone', () => {
    // Five columns on a phone means scrolling sideways, which hides the shape a
    // bracket exists to show. Wrapping trades width for height instead.
    // Two columns is 324px and fits a 375pt phone. Three did not: the Final
    // fell off the right edge, which is the whole thing you came to see.
    expect(NARROW_BAND_COLUMNS).toEqual([2, 2]);
    const bands = cupBracketBands(full, NARROW_BAND_COLUMNS);
    expect(bands).toHaveLength(3);
    expect(bands[0].columns.map(c => c.label)).toEqual(['Round of 32', 'Round of 16']);
    expect(bands[1].columns.map(c => c.label)).toEqual(['Quarter-final', 'Semi-final']);
    expect(bands[2].columns.map(c => c.label)).toEqual(['Final']);
    // Every band fits without sideways scrolling.
    for (const band of bands) expect(band.width).toBeLessThanOrEqual(COLUMN_WIDTH * 2 + COLUMN_GAP);
  });

  it('gives each band its own height, so the later rounds are not 16 ties tall', () => {
    const [first, second, third] = cupBracketBands(full, NARROW_BAND_COLUMNS);
    expect(first.columns[0].ties).toHaveLength(16);
    expect(second.columns[0].ties).toHaveLength(4);
    expect(third.columns[0].ties).toHaveLength(1);
    expect(second.height).toBeLessThan(first.height);
    expect(third.height).toBeLessThan(second.height);
  });

  it('still halves within a band', () => {
    const [, second] = cupBracketBands(full, NARROW_BAND_COLUMNS);
    expect(second.columns.map(c => c.ties.length)).toEqual([4, 2]);
  });

  it('drops empty bands rather than rendering blank rows', () => {
    const early = [round(2, 'Round of 32', [fixture('A', 'B'), fixture('C', 'D')])];
    const bands = cupBracketBands(early, NARROW_BAND_COLUMNS);
    expect(bands).toHaveLength(1);
    expect(bands[0].columns.map(c => c.label)).toEqual(['Round of 32']);
  });

  it('crowns the winner on a plate rather than a lone Final column', () => {
    const bracket = readFileSync(join(process.cwd(), 'src/ui/components/CupBracket.tsx'), 'utf8');
    const league = readFileSync(join(process.cwd(), 'src/ui/screens/M2LeagueScreen.tsx'), 'utf8');
    expect(bracket).toContain('championName === undefined ? null : (');
    expect(bracket).toContain('Global Cup winners');
    expect(bracket).toContain('WINNERS FROM ABOVE');
    expect(league).toContain('championName={viewModel.cup.championName}');
    // The wide tree stays one band.
    expect(bracket).toContain("const narrow = useLayoutMode() !== 'twoColumn';");
  });
});
