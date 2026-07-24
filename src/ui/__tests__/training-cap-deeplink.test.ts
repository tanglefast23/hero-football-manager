import { readFileSync } from 'fs';
import { join } from 'path';

describe('training cap inbox deep link', () => {
  it('routes a tapped cap letter to the squad tab and opens the drill popup', () => {
    const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

    expect(app).toContain("alertId.startsWith('training-cap:')");
    expect(app).toContain('store.selectPlayer(alert.playerId)');
    expect(app).toContain("setDrillFocusToken(current => (current ?? 0) + 1)");
    expect(app).toContain('drillPickerRequestToken={drillFocusToken ?? undefined}');
  });

  it('opens the popup on each new request token', () => {
    const screen = readFileSync(
      join(process.cwd(), 'src/ui/screens/SquadTrainingScreen.tsx'),
      'utf8',
    );

    expect(screen).toContain('drillPickerRequestToken?: number');
    expect(screen).toContain("if (drillPickerRequestToken === undefined) return;");
    expect(screen).toContain('setDrillPickerOpen(true);\n  }, [drillPickerRequestToken]);');
  });
});
