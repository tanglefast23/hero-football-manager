import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), 'utf8');

describe('first player request tutorial', () => {
  it('opens the Requests page while Bert explains the waiting request', () => {
    const app = source('App.tsx');
    const squad = source('src/ui/screens/SquadTrainingScreen.tsx');

    expect(app).toMatchSource(
      /<SquadTrainingScreen[\s\S]*?guideFocus=\{[\s\S]*?activeGuideFocus[\s\S]*?assistantSequence\?\.pages\[0\]\?\.focus/,
    );
    expect(squad).toMatchSource(
      /guideFocus === 'squad-requests'[\s\S]*?requestViewModel\?\.pending !== undefined[\s\S]*?setSquadTab\('requests'\)/,
    );
  });

  it('does not queue the tutorial from the calendar alone', () => {
    const guide = source('src/application/assistant-guide.ts');

    expect(guide).toContainSource(
      "if (state.playerRequests?.pending !== undefined) {\n    due.push('player-requests');",
    );
    expect(guide).not.toContainSource('state.week >= requestTuning.startWeek');
  });

  it('routes a later Home reminder to the actionable Requests page', () => {
    const app = source('App.tsx');

    expect(app).toContainSource("alertId === 'player-request-waiting'");
    expect(app).toMatchSource(
      /alertId === 'player-request-waiting'[\s\S]*?setConciergeFocus\('squad-requests'\)[\s\S]*?store\.setActiveTab\('squad'\)/,
    );
    expect(app).toMatchSource(
      /initialSquadTab=\{[\s\S]*?conciergeFocus === 'squad-requests'[\s\S]*?\? 'requests' : 'drills'[\s\S]*?\}/,
    );
  });
});
