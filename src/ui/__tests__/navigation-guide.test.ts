import { readFileSync } from 'fs';
import { join } from 'path';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('bottom navigation guide', () => {
  const ring = source('src/ui/TutorialSpotlight.tsx');
  const walkOn = source('src/ui/BertBriefingWalkOn.tsx');

  it('rings the whole bar as one object', () => {
    expect(ring).toContain('export function NavigationRing');
    expect(ring).toContain('navTourRing');
    expect(ring).toContain('width: anchor.width');
    expect(ring).toContain('height: anchor.height');
  });

  it('never steps tab by tab or dims a single tab', () => {
    // Stepping the rail turned one instruction into five beats and dimmed four
    // doors the player was being told to look at.
    expect(ring).not.toContain('navTourDim');
    expect(ring).not.toContain('navTourDot');
    expect(ring).not.toContain('useState');
  });

  it('lets Bert speak the tip instead of floating a card over the rail', () => {
    // The ring says where; he says what. The card that used to hold the tip is
    // gone, along with its callout arrow and its own "tap to continue" line.
    expect(ring).not.toContain('navTourCard');
    expect(ring).not.toContain('navigationCalloutArrow');
    expect(ring).not.toContain('▼');
    expect(ring).not.toContain('Tap anywhere to continue');
  });

  it('draws the ring only while the navigation beat is speaking', () => {
    expect(walkOn).toContain("focus === 'navigation' && navigationAnchor");
    expect(walkOn).toContain('<NavigationRing anchor={navigationAnchor} />');
  });

  it('keeps the whole navigation bar lit during its beat', () => {
    expect(walkOn).toContain("focus === 'navigation'");
    expect(walkOn).toContain('? navigationAnchor');
    expect(walkOn).toContain('anchor={spotlightAnchor}');
  });

  it('keeps the ring non-interactive so the whole screen stays the button', () => {
    expect(ring).toContain('pointerEvents="none"');
  });
});
