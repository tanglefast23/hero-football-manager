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
    expect(source).not.toContain('detail="Add one player"');
    expect(source).not.toContain('detail="Pick a drill"');
    expect(source).toContain('>{drill.gainLabel}</Text>');
    expect(source).not.toContain('{drill.focusLabel} · {drill.gainLabel}');
    expect(homeSource).toContain('detail="Build the facility"');
    expect(guideContent).not.toContain('"id": "squad-intro"');
  });
});
