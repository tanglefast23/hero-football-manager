import { readFileSync } from 'fs';
import { join } from 'path';

describe('first training guidance', () => {
  it('guides the full roster, then the stat picker, without a Bert briefing', () => {
    const source = readFileSync(join(process.cwd(), 'src/ui/screens/SquadTrainingScreen.tsx'), 'utf8');
    const homeSource = readFileSync(join(process.cwd(), 'src/ui/screens/ClubHomeScreen.tsx'), 'utf8');
    const guideContent = readFileSync(join(process.cwd(), 'content/assistant-guide.json'), 'utf8');

    // Instant training: one guided beat — tap any +, the drill happens now.
    expect(source).toContain('const guidePlayers = guideTraining;');
    expect(source).toContain("'relative mt-20 border-4 border-blue-dark bg-blue-light p-1'");
    expect(source).toContain('label="Tap +"');
    expect(source).toContain('detail="Train a player"');
    expect(source).toContain('onTouchStart={rememberPlayerGuideTouch}');
    expect(source).toContain('onTouchMove={dismissPlayerGuideAfterDrag}');
    expect(source).toContain('{guidePlayers && !playerGuideDismissed ? (');
    expect(source).toContain('setDrillPickerOpen(true)');
    expect(source).not.toContain('slotNumber');
    expect(source).not.toContain('label="Tap the number"');
    // Position is a labelled, sortable column again — "Pos" fits the role cell
    // where the old spelled-out "Role" did not. The label reads from the
    // catalog now, so every locale has to pick a short form that fits; i18n
    // gate 8b measures each one against this column.
    expect(source).toContain("<SquadSortHeader label={t('col.squad.role')} sortKey=\"role\"");
    // Condition is still a sortable column, now spelled out and sharing its
    // width with the row cell beneath it.
    expect(source).toContain('sortKey="condition"');
    expect(source).toContain('columnStyle={columns.condition}');
    // The train column keeps its width to hold the + buttons in line, but has
    // no header label to clip.
    expect(source).toContain('<View className={ROSTER_TRAIN_COLUMN_CLASS} />');
    expect(source).toContain('ellipsizeMode="clip"');
    // The cue points at one button, not fifteen: only the rookie the manager
    // built glows, and it keeps glowing until it is actually pressed.
    expect(source).toContain('player.id === viewModel.createdPlayerId');
    expect(source).toContain('&& !trainingCueUsed');
    expect(source).toContain('setTrainingCueUsed(true);');
    expect(source).not.toContain('const glowAssignmentButton = guidePlayers && player.injuryWeeks === 0;');
    expect(source).toContain('glowAssignmentButton ? styles.assignmentButtonGlow : null');
    expect(source).toContain('assignmentButtonGlow:');
    expect(source).toContain("boxShadow: '0 0 12px 4px rgba(237, 181, 74, 0.9)'");
    expect(homeSource).toContain('detail="Build the facility"');
    expect(guideContent).toContain(
      `"Let's build a Training Pitch which gives us more Training Points every week."`,
    );
    expect(guideContent).not.toContain('"id": "squad-intro"');
  });

  it('warns about condition on the third drill of the career, pointing at the column header', () => {
    const source = readFileSync(join(process.cwd(), 'src/ui/screens/SquadTrainingScreen.tsx'), 'utf8');
    const store = readFileSync(join(process.cwd(), 'src/application/store.ts'), 'utf8');

    // Not the first drill: on a full-energy squad the warning is noise until the
    // manager has watched the number fall a couple of times.
    expect(source).toContain('const CONDITION_WARNING_DRILL = 3;');
    // Keyed to the drill that landed, not to the career total, so it fires once
    // and cannot re-fire on a re-render or a reload.
    expect(source).toContain('if (lastDrillResult?.totalDrillsRun !== CONDITION_WARNING_DRILL) return;');
    expect(source).toContain('setConditionCuePlayerId(lastDrillResult.playerId);');
    // The drill popup covers the roster, so the cue waits for it to close.
    expect(source).toContain('conditionCuePlayerId={drillPickerOpen ? null : conditionCuePlayerId}');
    // It points at the CONDITION header, not at a row: the lesson is about the
    // column, and hanging it off a row reserved 78px of blank space inside the
    // register to make room for it.
    expect(source).toContain('tutorialCue={conditionCueShowing ? (');
    expect(source).toContain("left: '50%',");
    expect(source).toContain('marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2');
    expect(source).toContain('label="Condition"');
    expect(source).toContain("detail=\"Too low and they risk injury. You're okay for now.\"");
    expect(source).toContain('const conditionCueShowing = conditionCuePlayerId !== null;');
    // Global tap cleanup retires short-lived warnings, not the persistent
    // Quick Train lesson. That lesson ends only when an attribute is tapped.
    expect(source).not.toContain('guideQuickTrainRef');
    expect(source).not.toContain('quickTrainCueDismissed');
    expect(source).toContain('guideQuickTrain={guideQuickTrain}');
    // The table, not a row, carries the cue and the space above it.
    expect(source).toContain('conditionCueShowing || guideOverallSort');
    expect(source).toContain("? 'relative mt-20 border-2 border-ink bg-white'");
    expect(source).not.toContain('guideConciergePlayer || showConditionCue');
    expect(source).not.toContain('conditionCueRightOffset');
    // The count comes off the resolved state, which is what the save persists.
    expect(store).toContain('totalDrillsRun: next.totalInstantDrills ?? 0,');
  });

  it('skips the Bert briefing modal and shows a second bouncing cue on the grid after tapping Training Pitch', () => {
    const finances = readFileSync(join(process.cwd(), 'src/ui/screens/ClubFinancesScreen.tsx'), 'utf8');
    const targets = readFileSync(join(process.cwd(), 'src/ui/concierge-targets.ts'), 'utf8');

    // No Bert briefing sequence is used for first-facility
    expect(finances).not.toContain('first-facility');
    expect(finances).not.toContain('AssistantGuideOverlay');

    // Only Training Pitch advances the guide and scrolls the grid into view
    expect(finances).toContain('scrollFacilityGuideTargetIntoView');
    expect(finances).toContain("guidedFacilityPhase === 'grid'");
    expect(finances).toContain('guidedFirstFacilityAllowsBuildType(entry.type)');
    expect(finances).toContain("entry.type === 'training-pitch'");
    expect(finances).toContain('label="Tap here"');
    expect(finances).toContain('detail="Training Pitch"');
    expect(finances).not.toContain('detail="Choose Training Pitch"');

    // Second cue only appears once phase is 'grid'
    expect(finances).toContain("guidedFacilityPhase === 'grid'");
    expect(finances).toContain('detail="Tap any + square"');
    expect(finances).toContain('left: facilityGridWidth / facilities.width / 2');
    expect(finances).not.toContain('glowing square');

    // Phase helper switches on selection
    expect(targets).toContain('guidedFirstFacilityPhase');
  });

  it('gives the condition lesson once per career, not once per player', () => {
    const modal = readFileSync(join(process.cwd(), 'src/ui/TrainingDrillModal.tsx'), 'utf8');
    const guide = readFileSync(join(process.cwd(), 'src/game/assistant-guide.ts'), 'utf8');

    // One lesson total. After Bert has explained the gamble, a red-lined squad
    // is the manager's own call, so the flag lives on the career and survives
    // a reload rather than resetting with the popup.
    expect(guide).toContain("'condition-warning-seen'");
    expect(guide).toContain("'condition-warning-seen': 'guide:bert:condition-warning-seen'");
    expect(modal).toContain("if (energyBand(condition) === 'red' && !conditionWarningSeen)");
    expect(modal).toContain('onConditionWarningShown?.();');
    // The old per-player ref must be gone, or the lesson repeats down the squad.
    expect(modal).not.toContain('redWarnedRef');
  });
});
