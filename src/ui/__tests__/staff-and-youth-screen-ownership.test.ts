import { readFileSync } from 'fs';
import { join } from 'path';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('staff and youth screen ownership', () => {
  test('shows coaching staff only in Club with each coach rendered from one list', () => {
    const squad = source('src/ui/screens/SquadTrainingScreen.tsx');
    const club = source('src/ui/screens/ClubFinancesScreen.tsx');

    expect(squad).not.toContain('title="Coaching staff"');
    expect(squad).not.toContain('viewModel.coachingStaff');
    expect(club).toContain('title="Coaching staff"');
    expect(club).toContain('viewModel.coachingStaff.map(coach =>');
    expect(club).toContain('coach.effectLabels.map(effect =>');
    expect(club).toContain('onDismissCoach(coach.role)');
  });

  test('does not point at the first youth offer while preserving its Sign action', () => {
    const market = source('src/ui/screens/MarketScreen.tsx');

    expect(market).not.toContain('detail="Review this youth"');
    expect(market).toContain('accessibilityLabel={`Sign youth player ${offer.playerName}`}');
  });
});
