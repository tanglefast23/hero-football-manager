import { readFileSync } from 'fs';
import { join } from 'path';

describe('first facility placement guidance', () => {
  it('moves from the Training Grounds build card to a freely chosen grid cell', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/screens/ClubFinancesScreen.tsx'),
      'utf8',
    );
    const appSource = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

    expect(source).toContainSource("label={t('clubFinances.tapHere')}");
    expect(source).toContainSource(
      "detail={t('clubFinances.trainingPitchCue')}",
    );
    expect(source).toContainSource(
      "detail={t('clubFinances.placeYourBuilding')}",
    );
    expect(source).toContainSource(
      'left: facilityGridWidth / facilities.width / 2',
    );
    expect(source).toMatchSource(
      /detail=\{t\('clubFinances\.placeYourBuilding'\)\}[\s\S]*?left: facilityGridWidth \/ facilities\.width \/ 2,[\s\S]*?bottom: '100%',/,
    );
    expect(source).not.toContainSource('glowing square');
    expect(source).not.toContainSource('Training Grounds · top left');
    expect(source).toMatchSource(
      /const scrollFacilityGuideTargetIntoView = useCallback\([\s\S]*?scrollRef\.current\?\.scrollTo\(\{[\s\S]*?y: targetY,[\s\S]*?animated: !reduceMotion,[\s\S]*?\}\);[\s\S]*?\},\s*\[guidedFirstFacility, reduceMotion\],?\s*\);/,
    );
    expect(source).toContainSource(
      'disabled={!placementActive || !guideAllowsCell}',
    );
    expect(source).toContainSource('key={`facility-cell-${x}-${y}`}');
    expect(source).toContainSource("position: 'absolute',");
    expect(source).toContainSource('const FACILITY_PLACEMENT_PLUS_SIZE = 16;');
    expect(source).toContainSource(
      'const FACILITY_PLACEMENT_PLUS_THICKNESS = 4;',
    );
    // The + overlay is a sibling of the cell Pressable (never a child): a
    // function-styled SfxPressable lays out children at zero height on
    // native, so the drawn plus must live at cell level.
    expect(source).toMatchSource(
      /\/>\s*\{buildable \? \(\s*<View\s*pointerEvents="none"[\s\S]*?alignItems: 'center',[\s\S]*?justifyContent: 'center',[\s\S]*?width: FACILITY_PLACEMENT_PLUS_SIZE,[\s\S]*?height: FACILITY_PLACEMENT_PLUS_THICKNESS,/,
    );
    expect(appSource).toContainSource(
      "visibleConciergeFocus === 'facility-grid'",
    );
    expect(appSource).toContainSource(
      '!guidedFirstFacilityAllowsPlacement(type, x, y)',
    );
  });

  it('reveals the placement grid with a helper after every build choice', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/screens/ClubFinancesScreen.tsx'),
      'utf8',
    );

    expect(source).toMatchSource(
      /const revealFacilityPlacement = useCallback\([\s\S]*?setFacilityPlacementHelperVisible\(true\);[\s\S]*?if \(guidedFirstFacility\) return;[\s\S]*?if \(layoutMode !== 'single' \|\| facilityPlacementTargetRef\.current === null\) return;[\s\S]*?scrollToTarget\(\s*scrollRef,\s*scrollViewportRef,\s*facilityPlacementTargetRef,\s*latestScrollOffsetRef\.current,\s*12,\s*!reduceMotion,\s*\);\s*focusGuideTarget\(facilityPlacementFocusRef\.current\);[\s\S]*?\}, \[guidedFirstFacility, layoutMode, reduceMotion\]\);/,
    );
    expect(source).toContainSource("{t('clubFinances.buildHere')}");
    expect(source).toContainSource('ref={facilityPlacementFocusRef}');
    expect(source).toContainSource('accessibilityRole="header"');
    expect(source).toContainSource('{...guideHeadingProps()}');
    expect(source).toContainSource('pointerEvents="none"');
    expect(source).toContainSource('styles.facilityPlacementHelper');
    expect(source).toContainSource('rounded-full');
    expect(source).toContainSource('styles.guidedFacilityGlow');
    expect(source).toContainSource('border-gold-dark bg-gold-light');
    expect(source).toContainSource(
      'onPointerMove={dismissFacilityPlacementHelper}',
    );
    expect(source).toContainSource(
      'onTouchStart={dismissFacilityPlacementHelper}',
    );
    expect(source).toContainSource(
      'onPress={() => {\n                            dismissFacilityPlacementHelper();',
    );
    expect(source).toMatchSource(
      /if \(Platform\.OS === 'web'\) \{[\s\S]*?\.focus\?\.\(\{ preventScroll: true \}\);\s*return;\s*\}\s*const handle = findNodeHandle\(target\);/,
    );
    expect(source).toContainSource('accessibilityLiveRegion="polite"');
    expect(source).toContainSource('revealFacilityPlacement();');
    expect(source).not.toContainSource(
      "detail={t('clubFinances.thenTapAPlusSquare')}",
    );
    expect(source).toContainSource('showBuildPlacementHelper={');
    expect(source).toContainSource(
      'selectedBuildType !== null && facilityPlacementHelperVisible',
    );
    expect(source).not.toMatchSource(
      /showBuildPlacementHelper=\{[\s\S]*?layoutMode === 'single'/,
    );
    expect(source).toContainSource(
      'if (nextBuildType !== null) {\n                        revealFacilityPlacement();',
    );
  });

  it('keeps the hover helper above the full grid and inside its horizontal edges', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/screens/ClubFinancesScreen.tsx'),
      'utf8',
    );

    expect(source).not.toMatchSource(
      /<Pressable[\s\S]*?tip=\{[\s\S]*?clubFinances\.buildHereColumnRow/,
    );
    expect(source).toContainSource('styles.facilityPlacementHoverTip');
    expect(source).not.toContainSource('hoveredCell');
    expect(source).toContainSource('placementActive && previewCell');
    expect(source).toContainSource('top: 8');
    expect(source).toContainSource('left: 8');
    expect(source).toContainSource('width: 176');
    expect(source).toContainSource('zIndex: 100');
    expect(source).toContainSource('elevation: 30');
    expect(source).toMatchSource(
      /placementActive \|\|[\s\S]*?overflow-visible/,
    );
  });

  it('scrolls coaching-office guidance to its build card without a grounds tooltip', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/screens/ClubFinancesScreen.tsx'),
      'utf8',
    );

    expect(source).toContainSource(
      'const coachingOfficeBuildTargetRef = useRef<View>(null);',
    );
    expect(source).toContainSource("guideFocus !== 'coaching-office'");
    expect(source).toContainSource('coachingOfficeBuildTargetRef,');
    expect(source).toContainSource(
      "ref={entry.type === 'coaching-office' ? coachingOfficeBuildTargetRef : undefined}",
    );
    expect(source).toContainSource(
      "onLayout={entry.type === 'coaching-office' ? scrollToCoachingOffice : undefined}",
    );
    expect(source).toMatchSource(
      /guideFocus !== 'facility-grid'\s*&& guideFocus !== 'coaching-office' \? \(/,
    );
  });

  it('points at the Coaching Office when the inbox asks for one', () => {
    const finances = readFileSync(
      join(process.cwd(), 'src/ui/screens/ClubFinancesScreen.tsx'),
      'utf8',
    );

    // The viewport already scrolled the card into view, but nothing said which
    // of the eight cards to press.
    expect(finances).toContainSource(
      "guideFocus === 'coaching-office' && entry.type === 'coaching-office'",
    );
    expect(finances).toContainSource(
      "detail={t('clubFinances.coachingOfficeCue')}",
    );
    expect(finances).toContainSource('styles.guidedFacilityGlow');
    expect(finances).toContainSource('border-gold-dark bg-gold-light/25');
    // Same gold as the first-training Train button, and it reserves the room
    // above itself so the arrow lands in a gap, not over the row above.
    expect(finances).toContainSource(
      "boxShadow: '0 0 12px 4px rgba(237, 181, 74, 0.9)'",
    );
    expect(finances).toContainSource("'relative mt-20 w-[48%]'");
  });
});
