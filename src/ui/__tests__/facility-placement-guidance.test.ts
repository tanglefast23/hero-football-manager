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
    expect(source).toContainSource('styles.facilityPlacementHelperAnchor');
    expect(source).toContainSource('styles.facilityPlacementHelper');
    expect(source).toMatchSource(
      /facilityPlacementHelper: \{[\s\S]*?width: 144,[\s\S]*?opacity: 0\.5,/,
    );
    const english = JSON.parse(
      readFileSync(join(process.cwd(), 'content/i18n/en.json'), 'utf8'),
    ) as { strings: Record<string, string> };
    expect(english.strings['clubFinances.buildHere']).toBe('Tap Any + grid');
    expect(source).toMatchSource(
      /facilityPlacementHelperAnchor: \{[\s\S]*?top: 0,[\s\S]*?right: 0,[\s\S]*?bottom: 0,[\s\S]*?left: 0,[\s\S]*?alignItems: 'center',[\s\S]*?justifyContent: 'center',/,
    );
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

  it('blocks the wrong Week 3 build at the card and again in the store', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/screens/ClubFinancesScreen.tsx'),
      'utf8',
    );
    const appSource = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');
    const storeSource = readFileSync(
      join(process.cwd(), 'src/application/store.ts'),
      'utf8',
    );

    expect(source).toContainSource('const requiredBuildChoiceBlocked =');
    expect(source).toContainSource(
      'onRequiredBuildTypeBlocked?.(requiredBuildType);',
    );
    expect(appSource).toContainSource(
      "store.notifyInboxDutyBlocked('coaching-office')",
    );
    expect(appSource).toContainSource(
      't(`${inboxDutyCopyStem(store.inboxDutyReminder[0])}.body`)',
    );
    const english = JSON.parse(
      readFileSync(join(process.cwd(), 'content/i18n/en.json'), 'utf8'),
    ) as { strings: Record<string, string> };
    expect(english.strings['inboxDuty.coachingOffice.body']).toContain(
      'You need to build the Coaching Office this week.',
    );
    expect(storeSource).toContainSource(
      "outstandingInboxDuties(career).includes('coaching-office')",
    );
    expect(storeSource).toContainSource(
      "inboxDutyReminder: ['coaching-office']",
    );
  });

  it('starts new construction without a second acknowledgement modal', () => {
    const appSource = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

    expect(appSource).toContainSource(
      'const showStartedFacilityProject = useCallback((showNotice = true)',
    );
    expect(appSource).toContainSource('if (!showNotice) return;');
    expect(appSource).toMatchSource(
      /buildClubFacilityWithFeedback[\s\S]*?showStartedFacilityProject\(false\)/,
    );
    expect(appSource).toMatchSource(
      /upgradeClubFacilityWithFeedback[\s\S]*?showStartedFacilityProject\(\)/,
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

  it('lets Bert deliver every facility refusal instead of a red error bar', () => {
    const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');
    const store = readFileSync(
      join(process.cwd(), 'src/application/store.ts'),
      'utf8',
    );

    expect(app).toContainSource('const facilityErrorBertVisible =');
    expect(app).toContainSource('store.error && !facilityErrorBertVisible');
    expect(app).toContainSource('sequenceId="facility-error"');
    expect(app).toContainSource('customMessage={{ body: store.error! }}');
    expect(app).toContainSource('onDone={store.clearError}');
    expect(store.match(/facilityTransactionErrorCopy,/g)).toHaveLength(5);

    for (const locale of ['en', 'de', 'es', 'fr', 'id', 'pt-BR', 'vi']) {
      const catalog = JSON.parse(
        readFileSync(
          join(process.cwd(), `content/i18n/${locale}.json`),
          'utf8',
        ),
      ) as { strings: Record<string, string> };
      expect(
        Object.keys(catalog.strings).filter((key) =>
          key.startsWith('facilityError.'),
        ),
      ).toHaveLength(15);
    }
  });
});
