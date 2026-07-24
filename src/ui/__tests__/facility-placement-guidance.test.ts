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
    expect(source).toContain('const FACILITY_PLACEMENT_PLUS_SIZE = 16;');
    expect(source).toContain('const FACILITY_PLACEMENT_PLUS_THICKNESS = 4;');
    // The + overlay is a sibling of the cell Pressable (never a child): a
    // function-styled SfxPressable lays out children at zero height on
    // native, so the drawn plus must live at cell level.
    expect(source).toMatch(
      /\/>\s*\{buildable \? \(\s*<View\s*pointerEvents="none"[\s\S]*?alignItems: 'center',[\s\S]*?justifyContent: 'center',[\s\S]*?width: FACILITY_PLACEMENT_PLUS_SIZE,[\s\S]*?height: FACILITY_PLACEMENT_PLUS_THICKNESS,/,
    );
    expect(appSource).toContain("conciergeFocus === 'facility-grid'");
    expect(appSource).toContain('!guidedFirstFacilityAllowsPlacement(type, x, y)');
  });

  it('scrolls coaching-office guidance to its build card without a grounds tooltip', () => {
    const source = readFileSync(join(process.cwd(), 'src/ui/screens/ClubFinancesScreen.tsx'), 'utf8');

    expect(source).toContain('const coachingOfficeBuildTargetRef = useRef<View>(null);');
    expect(source).toContain("guideFocus !== 'coaching-office'");
    expect(source).toContain('coachingOfficeBuildTargetRef,');
    expect(source).toContain(
      "ref={entry.type === 'coaching-office' ? coachingOfficeBuildTargetRef : undefined}",
    );
    expect(source).toContain(
      "onLayout={entry.type === 'coaching-office' ? scrollToCoachingOffice : undefined}",
    );
    expect(source).toMatch(
      /guideFocus !== 'facility-grid'\s*&& guideFocus !== 'coaching-office' \? \(/,
    );
  });
});
