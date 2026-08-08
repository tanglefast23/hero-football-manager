import { readFileSync } from 'fs';
import { join } from 'path';

describe('first facility placement guidance', () => {
  it('moves from the Training Grounds build card to a freely chosen grid cell', () => {
    const source = readFileSync(join(process.cwd(), 'src/ui/screens/ClubFinancesScreen.tsx'), 'utf8');
    const appSource = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

    expect(source).toContain("label={t('clubFinances.tapHere')}");
    expect(source).toContain("detail={t('clubFinances.trainingPitchCue')}");
    expect(source).toContain("detail={t('clubFinances.placeYourBuilding')}");
    expect(source).toContain('left: facilityGridWidth / facilities.width / 2');
    expect(source).toMatch(
      /detail=\{t\('clubFinances\.placeYourBuilding'\)\}[\s\S]*?left: facilityGridWidth \/ facilities\.width \/ 2,[\s\S]*?bottom: '100%',/,
    );
    expect(source).not.toContain('glowing square');
    expect(source).not.toContain('Training Grounds · top left');
    expect(source).toMatch(
      /const scrollFacilityGuideTargetIntoView = useCallback\([\s\S]*?scrollRef\.current\?\.scrollTo\(\{ y: targetY, animated: !reduceMotion \}\);[\s\S]*?\}, \[guidedFirstFacility, reduceMotion\]\);/,
    );
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
    expect(appSource).toContain("visibleConciergeFocus === 'facility-grid'");
    expect(appSource).toContain('!guidedFirstFacilityAllowsPlacement(type, x, y)');
  });

  it('reveals the placement grid with a helper after any mobile build choice', () => {
    const source = readFileSync(join(process.cwd(), 'src/ui/screens/ClubFinancesScreen.tsx'), 'utf8');

    expect(source).toMatch(
      /const revealMobileFacilityPlacement = useCallback\([\s\S]*?if \(layoutMode !== 'single' \|\| facilityPlacementTargetRef\.current === null\) return;[\s\S]*?scrollToTarget\(\s*scrollRef,\s*scrollViewportRef,\s*facilityPlacementTargetRef,\s*latestScrollOffsetRef\.current,\s*12,\s*!reduceMotion,\s*\);\s*focusGuideTarget\(facilityPlacementFocusRef\.current\);[\s\S]*?\}, \[layoutMode, reduceMotion\]\);/,
    );
    expect(source).toContain("{t('clubFinances.placeYourBuilding')}");
    expect(source).toContain('ref={facilityPlacementFocusRef}');
    expect(source).toContain('accessibilityRole="header"');
    expect(source).toContain('{...guideHeadingProps()}');
    expect(source).toMatch(
      /if \(Platform\.OS === 'web'\) \{[\s\S]*?\.focus\?\.\(\{ preventScroll: true \}\);\s*return;\s*\}\s*const handle = findNodeHandle\(target\);/,
    );
    expect(source).toContain('accessibilityLiveRegion="polite"');
    expect(source).toContain('revealMobileFacilityPlacement();');
    expect(source).toContain('nextBuildType !== null && !guidedFirstFacility');
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

  it('points at the Coaching Office when the inbox asks for one', () => {
    const finances = readFileSync(join(process.cwd(), 'src/ui/screens/ClubFinancesScreen.tsx'), 'utf8');

    // The viewport already scrolled the card into view, but nothing said which
    // of the eight cards to press.
    expect(finances).toContain("guideFocus === 'coaching-office' && entry.type === 'coaching-office'");
    expect(finances).toContain("detail={t('clubFinances.coachingOfficeCue')}");
    expect(finances).toContain('styles.guidedFacilityGlow');
    expect(finances).toContain('border-gold-dark bg-gold-light/25');
    // Same gold as the first-training Train button, and it reserves the room
    // above itself so the arrow lands in a gap, not over the row above.
    expect(finances).toContain("boxShadow: '0 0 12px 4px rgba(237, 181, 74, 0.9)'");
    expect(finances).toContain("'relative mt-20 w-[48%]'");
  });
});
