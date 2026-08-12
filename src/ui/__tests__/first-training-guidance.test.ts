import { readFileSync } from 'fs';
import { join } from 'path';

describe('first training guidance', () => {
  it('guides the full roster, then the stat picker, without a Bert briefing', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/screens/SquadTrainingScreen.tsx'),
      'utf8',
    );
    const homeSource = readFileSync(
      join(process.cwd(), 'src/ui/screens/ClubHomeScreen.tsx'),
      'utf8',
    );
    const guideContent = readFileSync(
      join(process.cwd(), 'content/assistant-guide.json'),
      'utf8',
    );
    const appSource = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

    // Instant training: one guided beat — tap any +, the drill happens now.
    expect(source).toContainSource('const guidePlayers = guideTraining;');
    expect(source).toContainSource(
      "'relative border-4 border-blue-dark bg-blue-light p-1'",
    );
    expect(source).toContainSource("label={t('squadTraining.tapHere')}");
    expect(source).toContainSource("detail={t('squadTraining.trainAPlayer')}");
    expect(source).toContainSource('onTouchStart={rememberPlayerGuideTouch}');
    expect(source).toContainSource('onTouchMove={dismissPlayerGuideAfterDrag}');
    expect(source).toContainSource(
      '{glowAssignmentButton && !playerGuideDismissed ? (',
    );
    expect(source).toContainSource('setDrillPickerOpen(true)');
    expect(appSource).toContainSource(
      'if (assistantObjectiveTargetTab === tab)',
    );
    expect(appSource).toContainSource(
      'skipNextGuidanceDismissRef.current = true;',
    );
    expect(source).not.toContainSource('slotNumber');
    expect(source).not.toContainSource('label="Tap the number"');
    // Position is a labelled, sortable column again — "Pos" fits the role cell
    // where the old spelled-out "Role" did not. The label reads from the
    // catalog now, so every locale has to pick a short form that fits; i18n
    // gate 8b measures each one against this column.
    expect(source).toContainSource(
      '<SquadSortHeader label={t(\'col.squad.role\')} sortKey="role"',
    );
    // Condition is still a sortable column, now spelled out and sharing its
    // width with the row cell beneath it.
    expect(source).toContainSource('sortKey="condition"');
    expect(source).toContainSource('columnStyle={columns.condition}');
    // The train column keeps its width to hold the + buttons in line, but has
    // no header label to clip.
    expect(source).toContainSource(
      '<View className={ROSTER_TRAIN_COLUMN_CLASS} />',
    );
    expect(source).toContainSource('ellipsizeMode="clip"');
    // The cue points at one button, not fifteen: only the rookie the manager
    // built glows, and it keeps glowing until it is actually pressed.
    expect(source).toContainSource('player.id === viewModel.createdPlayerId');
    expect(source).toContainSource('&& !trainingCueUsed');
    expect(source).toContainSource('setTrainingCueUsed(true);');
    expect(source).toContainSource('onSelectPlayer(playerId);');
    expect(source).toContainSource('setDrillPickerOpen(true);');
    expect(source).toContainSource(
      '(glowAssignmentButton && !playerGuideDismissed)',
    );
    expect(source).not.toContainSource(
      'const glowAssignmentButton = guidePlayers && player.injuryWeeks === 0;',
    );
    expect(source).toContainSource(
      'glowAssignmentButton ? styles.assignmentButtonGlow : null',
    );
    expect(source).toContainSource('assignmentButtonGlow:');
    expect(source).toContainSource(
      "boxShadow: '0 0 12px 4px rgba(237, 181, 74, 0.9)'",
    );
    expect(homeSource).toContainSource(
      "detail={t('clubHome.buildTheFacility')}",
    );
    expect(guideContent).toContainSource(
      `"Let's build a Training Pitch which gives us more Training Points every week."`,
    );
    expect(guideContent).not.toContainSource('"id": "squad-intro"');
  });

  it('warns about condition on the third drill of the career, pointing at the column header', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/screens/SquadTrainingScreen.tsx'),
      'utf8',
    );
    const store = readFileSync(
      join(process.cwd(), 'src/application/store.ts'),
      'utf8',
    );

    // Not the first drill: on a full-energy squad the warning is noise until the
    // manager has watched the number fall a couple of times.
    expect(source).toContainSource('const CONDITION_WARNING_DRILL = 3;');
    // Keyed to the drill that landed, not to the career total, so it fires once
    // and cannot re-fire on a re-render or a reload.
    expect(source).toContainSource(
      'if (lastDrillResult?.totalDrillsRun !== CONDITION_WARNING_DRILL) return;',
    );
    expect(source).toContainSource(
      'setConditionCuePlayerId(lastDrillResult.playerId);',
    );
    // The drill popup covers the roster, so the cue waits for it to close.
    expect(source).toContainSource(
      'conditionCuePlayerId={drillPickerOpen ? null : conditionCuePlayerId}',
    );
    // It points at the CONDITION header, not at a row: the lesson is about the
    // column, and hanging it off a row reserved 78px of blank space inside the
    // register to make room for it.
    expect(source).toContainSource('tutorialCue={conditionCueShowing ? (');
    expect(source).toContainSource("left: '50%',");
    expect(source).toContainSource('marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2');
    expect(source).toContainSource("label={t('col.squad.conditionLong')}");
    expect(source).toContainSource("detail={t('squadTraining.tooLowAndThey')}");
    expect(source).toContainSource(
      'const conditionCueShowing = conditionCuePlayerId !== null && !showSortHint;',
    );
    // Global tap cleanup retires short-lived warnings, not the persistent
    // Quick Train lesson. That lesson ends only when an attribute is tapped.
    expect(source).not.toContainSource('guideQuickTrainRef');
    expect(source).not.toContainSource('quickTrainCueDismissed');
    expect(source).toContainSource('guideQuickTrain={guideQuickTrain}');
    // The table, not a row, carries the cue and the space above it.
    expect(source).toContainSource('conditionCueShowing || showSortHint');
    expect(source).toContainSource(
      "? 'relative mt-20 border-2 border-ink bg-white'",
    );
    expect(source).not.toContainSource(
      'guideConciergePlayer || showConditionCue',
    );
    expect(source).not.toContainSource('conditionCueRightOffset');
    // The count comes off the resolved state, which is what the save persists.
    expect(store).toContainSource(
      'totalDrillsRun: next.totalInstantDrills ?? 0,',
    );
  });

  it('skips the Bert briefing modal and shows a second bouncing cue on the grid after tapping Training Pitch', () => {
    const finances = readFileSync(
      join(process.cwd(), 'src/ui/screens/ClubFinancesScreen.tsx'),
      'utf8',
    );
    const targets = readFileSync(
      join(process.cwd(), 'src/ui/concierge-targets.ts'),
      'utf8',
    );

    // No Bert briefing sequence is used for first-facility
    expect(finances).not.toContainSource('first-facility');
    expect(finances).not.toContainSource('AssistantGuideOverlay');

    // Only Training Pitch advances the guide and scrolls the grid into view
    expect(finances).toContainSource('scrollFacilityGuideTargetIntoView');
    expect(finances).toContainSource("guidedFacilityPhase === 'grid'");
    expect(finances).toContainSource(
      'guidedFirstFacilityAllowsBuildType(entry.type)',
    );
    expect(finances).toContainSource("entry.type === 'training-pitch'");
    expect(finances).toContainSource("label={t('clubFinances.tapHere')}");
    expect(finances).toContainSource(
      "detail={t('clubFinances.trainingPitchCue')}",
    );
    expect(finances).not.toContainSource('detail="Choose Training Pitch"');

    // Second cue only appears once phase is 'grid'
    expect(finances).toContainSource("guidedFacilityPhase === 'grid'");
    expect(finances).toContainSource(
      "detail={t('clubFinances.placeYourBuilding')}",
    );
    expect(finances).toContainSource(
      'left: facilityGridWidth / facilities.width / 2',
    );
    expect(finances).not.toContainSource('glowing square');

    // Phase helper switches on selection
    expect(targets).toContainSource('guidedFirstFacilityPhase');
  });

  it('gives the condition lesson once per career, not once per player', () => {
    const modal = readFileSync(
      join(process.cwd(), 'src/ui/TrainingDrillModal.tsx'),
      'utf8',
    );
    const guide = readFileSync(
      join(process.cwd(), 'src/game/assistant-guide.ts'),
      'utf8',
    );

    // One lesson total. After Bert has explained the gamble, a red-lined squad
    // is the manager's own call, so the flag lives on the career and survives
    // a reload rather than resetting with the popup.
    expect(guide).toContainSource("'condition-warning-seen'");
    expect(guide).toContainSource(
      "'condition-warning-seen': 'guide:bert:condition-warning-seen'",
    );
    expect(modal).toContainSource(
      "if (energyBand(condition) === 'red' && !conditionWarningSeen)",
    );
    expect(modal).toContainSource('onConditionWarningShown?.();');
    // The old per-player ref must be gone, or the lesson repeats down the squad.
    expect(modal).not.toContainSource('redWarnedRef');
  });
});
