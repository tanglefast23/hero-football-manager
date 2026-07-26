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
    expect(source).not.toContain('<SquadSortHeader label="Role"');
    // Condition is still a sortable column, now spelled out and sharing its
    // width with the row cell beneath it.
    expect(source).toContain('sortKey="condition" sort={squadSort} widthClass={conditionColumnWidth}');
    // The train column keeps its width to hold the + buttons in line, but has
    // no header label to clip.
    expect(source).toContain('<View className="w-14" />');
    expect(source).toContain('ellipsizeMode="clip"');
    expect(source).toContain('const glowAssignmentButton = guidePlayers && player.injuryWeeks === 0;');
    expect(source).toContain('glowAssignmentButton ? styles.assignmentButtonGlow : null');
    expect(source).toContain('assignmentButtonGlow:');
    expect(source).toContain("boxShadow: '0 0 12px 4px rgba(237, 181, 74, 0.9)'");
    expect(homeSource).toContain('detail="Build the facility"');
    expect(guideContent).not.toContain('"id": "squad-intro"');
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
});
