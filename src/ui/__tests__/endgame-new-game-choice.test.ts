import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(
  join(process.cwd(), 'src/ui/screens/EndgameCelebrationScreen.tsx'),
  'utf8',
);

describe('the true-ending exit choice', () => {
  it('asks about a new game and keeps both exits out of season-end screens', () => {
    expect(source).toContain('<NewGameChoice');
    expect(source).toContain('onStartNewGame={startNewGameOnce}');
    expect(source).toContain('onReturnToTitle={returnToTitleOnce}');
    expect(source).toContain("t('endgameCelebration.newGame.title')");
  });
});
