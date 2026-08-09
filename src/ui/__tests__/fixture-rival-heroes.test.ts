import { readFileSync } from 'fs';
import { join } from 'path';

describe('match-day rival hero report', () => {
  it('names every rival hero and shows the hero portrait', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/screens/FixtureMatchDayScreen.tsx'),
      'utf8',
    );

    expect(source).toContainSource('fixture.opponentHeroes.map((hero) =>');
    expect(source).toContainSource('playerId={hero.id}');
    expect(source).toContainSource('role={hero.role}');
    expect(source).toContainSource('lookId={hero.lookId}');
    expect(source).toContainSource('{hero.name}');
  });
});
