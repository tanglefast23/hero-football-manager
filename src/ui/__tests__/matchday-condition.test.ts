import { readFileSync } from 'fs';
import { join } from 'path';
import type { LineupPlayerViewModel } from '../models';
import {
  matchdayConditionStatus,
  matchdayConditionWarningCopy,
  matchdayConditionWarningPlayer,
} from '../matchday-condition';

const ROOT = join(__dirname, '..', '..', '..');

function player(id: string, condition: number): LineupPlayerViewModel {
  return {
    id,
    name: id === 'jojo' ? 'Jojo' : id,
    role: 'FWD',
    shirtNumber: 9,
    isHero: false,
    overall: 50,
    condition,
  };
}

describe('matchday condition guidance', () => {
  it('uses the agreed player-facing condition bands at their exact boundaries', () => {
    expect(matchdayConditionStatus(81)).toBeNull();
    expect(matchdayConditionStatus(80)).toEqual({ kind: 'below-peak', label: 'Below peak' });
    expect(matchdayConditionStatus(50)).toEqual({ kind: 'below-peak', label: 'Below peak' });
    expect(matchdayConditionStatus(49)).toEqual({ kind: 'fatigued', label: 'Fatigued' });
    expect(matchdayConditionStatus(30)).toEqual({ kind: 'fatigued', label: 'Fatigued' });
    expect(matchdayConditionStatus(29)).toEqual({ kind: 'exhausted', label: 'Exhausted' });
  });

  it('warns strictly below 70 and names the lowest-condition starter', () => {
    expect(matchdayConditionWarningPlayer([player('jojo', 70)])).toBeNull();
    expect(matchdayConditionWarningPlayer([
      player('jojo', 68),
      player('tired-teammate', 42),
      player('fresh-teammate', 100),
    ])?.id).toBe('tired-teammate');
  });

  it('uses the approved Bert copy with the affected player name', () => {
    expect(matchdayConditionWarningCopy('Jojo')).toBe(
      'Boss, Jojo’s legs are heavy after all that training. He’ll start below his best and tire sooner today. Repeated drills build skill, but don’t overtrain players you need at their peak.',
    );
  });

  it('wires persistent one-time guidance and visible labels into matchday', () => {
    const app = readFileSync(join(ROOT, 'App.tsx'), 'utf8');
    const screen = readFileSync(join(ROOT, 'src/ui/screens/FixtureMatchDayScreen.tsx'), 'utf8');

    expect(app).toContain("'match-condition-warning-seen'");
    expect(app).toContain('matchdayConditionWarningPlayer(matchday.lineup)');
    expect(app).toContain('<MatchdayConditionWarning');
    expect(screen).toContain('<MatchdayConditionStamp condition={player.condition}');
  });
});
