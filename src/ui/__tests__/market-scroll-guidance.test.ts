import { readFileSync } from 'fs';
import { join } from 'path';

describe('market scroll guidance', () => {
  it('dismisses the request-bids cue when the player starts dragging the market', () => {
    const source = readFileSync(join(process.cwd(), 'src/ui/screens/MarketScreen.tsx'), 'utf8');

    expect(source).toContain('onScrollBeginDrag={handleScrollBeginDrag}');
    expect(source).toContain("if (guideFocus === 'transfer-list') {");
    expect(source).toContain("dismissScrollGuide('transfer-list');");
    expect(source).toContain('onScroll={handleScroll}');
    expect(source).toContain('guideFocus={visibleGuideFocus}');
  });

  it('keeps the scout cue until a real downward scroll reveals the South America action', () => {
    const source = readFileSync(join(process.cwd(), 'src/ui/screens/MarketScreen.tsx'), 'utf8');

    expect(source).toContain('MIN_GUIDE_SCROLL_DISTANCE = 24');
    expect(source).toContain("choice.region === 'SOUTH_AMERICA'");
    expect(source).toContain('const targetFullyVisible = targetY >= viewportY');
    expect(source).toContain("if (targetFullyVisible) dismissScrollGuide('scout-mission');");
  });

  it('routes every market inbox destination to its exact docket section', () => {
    const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');
    const market = readFileSync(join(process.cwd(), 'src/ui/screens/MarketScreen.tsx'), 'utf8');

    expect(app).toContain("destination === 'youth-intake'");
    expect(app).toContain("destination === 'market-scouting'");
    expect(app).toContain("destination === 'market-transfers'");
    expect(app).toContain("destination === 'coach-market'");
    expect(app).toContain('requestedSection={marketSectionRequest?.section}');
    expect(market).toContain("requestedSection === 'YOUTH'");
    expect(market).toContain("requestedSection === 'SCOUT'");
    expect(market).toContain("requestedSection === 'TRANSFERS'");
    expect(market).toContain("requestedSection === 'COACHES'");
  });

  it('lands the assistant-coach inbox action on the Coaches hiring page', () => {
    const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');
    const market = readFileSync(join(process.cwd(), 'src/ui/screens/MarketScreen.tsx'), 'utf8');

    expect(app).toMatch(/destination === 'coach-market'\s*\?\s*'COACHES'/);
    expect(app).toMatch(/destination === 'coach-market'[\s\S]*?\?\s*'market'/);
    expect(market).toMatch(
      /guideFocus === 'assistant-coach-hire'[\s\S]*?setSection\('COACHES'\)/,
    );
  });
});
