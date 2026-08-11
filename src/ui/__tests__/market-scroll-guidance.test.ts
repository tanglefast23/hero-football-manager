import { readFileSync } from 'fs';
import { join } from 'path';

describe('market scroll guidance', () => {
  it('dismisses the request-bids cue when the player starts dragging the market', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/screens/MarketScreen.tsx'),
      'utf8',
    );

    expect(source).toContainSource('onScrollBeginDrag={handleScrollBeginDrag}');
    expect(source).toContainSource("if (guideFocus === 'transfer-list') {");
    expect(source).toContainSource("dismissScrollGuide('transfer-list');");
    expect(source).toContainSource('onScroll={handleScroll}');
    expect(source).toContainSource('guideFocus={visibleGuideFocus}');
  });

  it('keeps the scout cue until a real downward scroll reveals the South America action', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/screens/MarketScreen.tsx'),
      'utf8',
    );

    expect(source).toContainSource('MIN_GUIDE_SCROLL_DISTANCE = 24');
    expect(source).toContainSource("choice.region === 'SOUTH_AMERICA'");
    expect(source).toContainSource(
      'const targetFullyVisible = targetY >= viewportY',
    );
    expect(source).toContainSource(
      "if (targetFullyVisible) dismissScrollGuide('scout-mission');",
    );
  });

  it('routes every market inbox destination to its exact docket section', () => {
    const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');
    const market = readFileSync(
      join(process.cwd(), 'src/ui/screens/MarketScreen.tsx'),
      'utf8',
    );

    expect(app).toContainSource("destination === 'youth-intake'");
    expect(app).toContainSource("destination === 'market-scouting'");
    expect(app).toContainSource("destination === 'market-transfers'");
    expect(app).toContainSource("destination === 'coach-market'");
    expect(app).toContainSource(
      'requestedSection={marketSectionRequest?.section}',
    );
    expect(market).toContainSource("requestedSection === 'YOUTH'");
    expect(market).toContainSource("requestedSection === 'SCOUT'");
    expect(market).toContainSource("requestedSection === 'TRANSFERS'");
    expect(market).toContainSource("requestedSection === 'COACHES'");
    expect(market).not.toContainSource("if (layoutMode !== 'single') return;");
  });

  it('opens Deals before Bert explains transfer listings', () => {
    const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');
    const market = readFileSync(
      join(process.cwd(), 'src/ui/screens/MarketScreen.tsx'),
      'utf8',
    );

    expect(app).toContainSource(
      'activeGuideFocus ??\n              assistantSequence?.pages[0]?.focus',
    );
    expect(market).toMatchSource(
      /guideFocus === 'transfer-list'[\s\S]*?setSection\('TRANSFERS'\)/,
    );
  });

  it('lands the assistant-coach inbox action on the Coaches hiring page', () => {
    const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');
    const market = readFileSync(
      join(process.cwd(), 'src/ui/screens/MarketScreen.tsx'),
      'utf8',
    );

    expect(app).toMatchSource(
      /destination === 'coach-market'\s*\?\s*'COACHES'/,
    );
    expect(app).toMatchSource(
      /destination === 'coach-market'[\s\S]*?\?\s*'market'/,
    );
    expect(market).toMatchSource(
      /guideFocus === 'assistant-coach-hire'[\s\S]*?setSection\('COACHES'\)/,
    );
  });
});
