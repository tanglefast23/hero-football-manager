import { readFileSync } from 'fs';
import { join } from 'path';

describe('first facility placement guidance', () => {
  it('moves from the Training Grounds build card to a freely chosen grid cell', () => {
    const source = readFileSync(join(process.cwd(), 'src/ui/screens/ClubFinancesScreen.tsx'), 'utf8');
    const appSource = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

    expect(source).toContain('label="Tap here"');
    expect(source).toContain('detail="Training Pitch"');
    expect(source).toContain('detail="Tap any + square"');
    expect(source).toContain('left: facilityGridWidth / facilities.width / 2');
    expect(source).toMatch(
      /detail="Tap any \+ square"[\s\S]*?left: facilityGridWidth \/ facilities\.width \/ 2,[\s\S]*?bottom: '100%',/,
    );
    expect(source).not.toContain('glowing square');
    expect(source).not.toContain('Training Grounds · top left');
    expect(source).toContain('scrollRef.current?.scrollTo({ y: targetY, animated: true });');
    expect(source).toContain('disabled={!placementActive || !guideAllowsCell}');
    expect(source).toContain('key={`facility-cell-${x}-${y}`}');
    expect(source).toContain("position: 'absolute',");
    expect(source).toContain("right: 0,\n                            bottom: 0,");
    expect(appSource).toContain("conciergeFocus === 'facility-grid'");
    expect(appSource).toContain('!guidedFirstFacilityAllowsPlacement(type, x, y)');
  });
});
