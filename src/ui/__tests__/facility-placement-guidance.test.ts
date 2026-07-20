import { readFileSync } from 'fs';
import { join } from 'path';

describe('first facility placement guidance', () => {
  it('moves from the Training Grounds build card to the top-left grid cell', () => {
    const source = readFileSync(join(process.cwd(), 'src/ui/screens/ClubFinancesScreen.tsx'), 'utf8');
    const appSource = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

    expect(source).toContain('detail="Build Training Grounds"');
    expect(source).toContain('detail="Training Grounds · top left"');
    expect(source).toContain('scrollRef.current?.scrollTo({ y: targetY, animated: true });');
    expect(source).toContain('disabled={!placementActive || !guideAllowsCell}');
    expect(appSource).toContain("conciergeFocus === 'facility-grid'");
    expect(appSource).toContain('!guidedFirstFacilityAllowsPlacement(type, x, y)');
  });
});
