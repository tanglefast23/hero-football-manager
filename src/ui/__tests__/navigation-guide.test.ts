import { readFileSync } from 'fs';
import { join } from 'path';

describe('bottom navigation guide', () => {
  const source = readFileSync(join(process.cwd(), 'src/ui/AssistantGuideOverlay.tsx'), 'utf8');

  it('renders a stepped one-tab-at-a-time spotlight tour', () => {
    expect(source).toContain("if (page.focus === 'navigation')");
    expect(source).toContain('<NavigationGuidePage');
    expect(source).toContain('const [step, setStep] = useState(0)');
    expect(source).toContain('styles.navTourRing');
    expect(source).toContain('styles.navTourCard');
    expect(source).toContain('styles.navigationCalloutArrow');
    expect(source).toContain('>▼</Text>');
    expect(source).not.toContain('detail="The bottom rail"');
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
