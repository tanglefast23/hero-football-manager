import { readFileSync } from 'fs';
import { join } from 'path';

describe('first training guidance', () => {
  it('guides the full roster, then the full drill list, without a Bert briefing', () => {
    const source = readFileSync(join(process.cwd(), 'src/ui/screens/SquadTrainingScreen.tsx'), 'utf8');
    const homeSource = readFileSync(join(process.cwd(), 'src/ui/screens/ClubHomeScreen.tsx'), 'utf8');
    const guideContent = readFileSync(join(process.cwd(), 'content/assistant-guide.json'), 'utf8');

    expect(source).toContain("const guidePlayers = guideTraining && viewModel.assignedPlayerIds.length === 0;");
    expect(source).toContain("const guideDrills = guideTraining");
    expect(source).toContain("'relative border-4 border-blue-dark bg-blue-light p-1'");
    expect(source).toContain('label="Tap in here"');
    expect(source).toContain('detail="Add up to 3 players."');
    expect(source).toContain('detail="Add up to 3 drills."');
    expect(source).toContain('const glowAssignmentButton = guidePlayers && !isAssigned;');
    expect(source).toContain('glowAssignmentButton ? styles.assignmentButtonGlow : null');
    expect(source).toContain('assignmentButtonGlow:');
    expect(source).toContain("boxShadow: '0 0 12px 4px rgba(237, 181, 74, 0.9)'");
    expect(source).not.toContain('detail="Add one player"');
    expect(source).not.toContain('detail="Pick a drill"');
    expect(source).toContain('>{drill.gainLabel}</Text>');
    expect(source).not.toContain('{drill.focusLabel} · {drill.gainLabel}');
    expect(homeSource).toContain('detail="Build the facility"');
    expect(guideContent).not.toContain('"id": "squad-intro"');
  });

  it('skips the Bert briefing modal and shows a second bouncing cue on the grid after tapping Training Pitch', () => {
    const finances = readFileSync(join(process.cwd(), 'src/ui/screens/ClubFinancesScreen.tsx'), 'utf8');
    const targets = readFileSync(join(process.cwd(), 'src/ui/concierge-targets.ts'), 'utf8');

    // No Bert briefing sequence is used for first-facility
    expect(finances).not.toContain('first-facility');
    expect(finances).not.toContain('AssistantGuideOverlay');

    // Immediately scrolls grid into view on Training Pitch tap
    expect(finances).toContain('scrollFacilityGuideTargetIntoView');
    expect(finances).toContain("guidedFacilityPhase === 'grid'");

    // Second cue only appears once phase is 'grid'
    expect(finances).toContain("guidedFacilityPhase === 'grid'");
    expect(finances).toContain('detail="Tap where you’d like to build the Training Grounds"');

    // Phase helper switches on selection
    expect(targets).toContain('guidedFirstFacilityPhase');
  });
});
