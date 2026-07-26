import { readFileSync } from 'fs';
import { join } from 'path';

describe('bottom navigation guide', () => {
  const source = readFileSync(join(process.cwd(), 'src/ui/AssistantGuideOverlay.tsx'), 'utf8');

  it('rings the whole bar and centres a single tip above it', () => {
    expect(source).toContain("if (page.focus === 'navigation')");
    expect(source).toContain('<NavigationGuidePage');
    expect(source).toContain('tip={page.body[0]}');
    expect(source).toContain('styles.navTourRing');
    expect(source).toContain('width: anchor.width');
    expect(source).toContain('const barCenter = anchor.x + anchor.width / 2');
    expect(source).toContain('styles.navTourCard');
    expect(source).toContain('styles.navigationCalloutArrow');
    expect(source).toContain('>▼</Text>');
    expect(source).not.toContain('detail="The bottom rail"');
  });

  it('never steps tab by tab or dims a single tab', () => {
    expect(source).not.toContain('useState');
    expect(source).not.toContain('navTourDim');
    expect(source).not.toContain('navTourDot');
  });

  it('does not render Bert or a bouncing cue on the navigation page', () => {
    const start = source.indexOf('function NavigationGuidePage');
    const end = source.indexOf('function TutorialSpotlight');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const navigationPageSource = source.slice(start, end);
    expect(navigationPageSource).not.toContain('BertFullBody');
    expect(navigationPageSource).not.toContain('TutorialTapCue');
    expect(navigationPageSource).not.toContain('Animated');
  });
});
