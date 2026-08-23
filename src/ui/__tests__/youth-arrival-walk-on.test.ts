import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RUNNER_UP_CEREMONY_LINES,
  WINNER_CEREMONY_LINES,
} from '../award-ceremony-lines';
import {
  MAX_ARRIVAL_LINE_LENGTH,
  arrivalLine,
  rookieArrivalLine,
  youthArrivalLines,
} from '../player-arrival-lines';

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), 'utf8');

/** Doubled from twenty, which halves how often a career hears a line twice. */
const YOUTH_POOL_SIZE = 40;

// The pools are catalog lookups now, so the English a player reads is resolved
// rather than declared. Everything below still asserts against those sentences.
const ROOKIE_ARRIVAL_LINE = rookieArrivalLine();
const YOUTH_ARRIVAL_LINES = youthArrivalLines();

/** The ids the academy actually issues — see youthIntakeOffers in youth-intake.ts. */
function youthIds(seasons: number, offersPerIntake: number): string[] {
  const ids: string[] = [];
  for (let season = 1; season <= seasons; season += 1) {
    for (let index = 1; index <= offersPerIntake; index += 1)
      ids.push(`youth-s${season}-${index}`);
  }
  return ids;
}

describe('youth arrival walk-on', () => {
  it('introduces automatic season-refill players together in one shared bubble', () => {
    const appSource = source('App.tsx');
    const walkOnSource = source('src/ui/PlayerWalkOnWelcome.tsx');

    expect(appSource).toContain('<AcademyGroupWalkOnWelcome');
    expect(appSource).toContain('academy-promotion:s${store.career.season}');
    expect(appSource).toContain("'permanent'");
    expect(walkOnSource).toContain('players.map((player)');
    expect(walkOnSource).toContain("t('academyArrival.thanks')");
  });

  it('sends academy graduates to the walk-on and keeps the receipt for transfers', () => {
    const appSource = source('App.tsx');

    // Anyone the manager picked one at a time walks on; only bought players get
    // the framed card.
    expect(appSource).toContain("playerSigning.source !== 'transfer'");
    expect(appSource).toContain('<PlayerWalkOnWelcome');
    expect(appSource).toContain("playerSigning.source === 'transfer' ? (");

    // The dead academy branches are gone rather than left unreachable.
    const receiptSource = source('src/ui/PlayerSigningOverlay.tsx');
    expect(receiptSource).not.toContain("player.source === 'academy'");
  });

  it('holds the bubble long enough to read the line', () => {
    // The pool runs to a full sentence; the fixed 2.4s the rookie's four words
    // needed would walk a graduate off mid-read.
    const walkOnSource = source('src/ui/PlayerWalkOnWelcome.tsx');
    expect(walkOnSource).toContain('line.length * MS_PER_CHARACTER');
  });

  it('offers forty distinct lines that fit one speech bubble', () => {
    expect(YOUTH_ARRIVAL_LINES).toHaveLength(YOUTH_POOL_SIZE);
    expect(new Set(YOUTH_ARRIVAL_LINES).size).toBe(YOUTH_POOL_SIZE);
    for (const line of YOUTH_ARRIVAL_LINES) {
      expect(line.trim()).toBe(line);
      expect(line.length).toBeGreaterThan(0);
      expect(line.length).toBeLessThanOrEqual(MAX_ARRIVAL_LINE_LENGTH);
    }
  });

  it('never puts the same words in a walk-on and on the rostrum', () => {
    // One player can do both in a career: sign in week 1 and take a board at
    // the end of the season. A line shared between the pools is a copy-paste.
    const ceremony = [...WINNER_CEREMONY_LINES, ...RUNNER_UP_CEREMONY_LINES];
    expect(
      YOUTH_ARRIVAL_LINES.filter((line) => ceremony.includes(line)),
    ).toEqual([]);
    expect(ceremony).not.toContain(ROOKIE_ARRIVAL_LINE);
  });

  it('keeps the rookie on their own line whoever they are', () => {
    expect(arrivalLine({ playerId: 'rookie-1', source: 'rookie' })).toBe(
      ROOKIE_ARRIVAL_LINE,
    );
    expect(arrivalLine({ playerId: 'youth-s1-1', source: 'rookie' })).toBe(
      ROOKIE_ARRIVAL_LINE,
    );
    expect(YOUTH_ARRIVAL_LINES).not.toContain(ROOKIE_ARRIVAL_LINE);
  });

  it('gives a graduate the same line every time it is asked', () => {
    // The overlay recomputes this on every window resize, so a line that was
    // rolled rather than derived would change under the player mid-walk.
    for (const id of youthIds(3, 6)) {
      const line = arrivalLine({ playerId: id, source: 'academy' });
      expect(YOUTH_ARRIVAL_LINES).toContain(line);
      expect(arrivalLine({ playerId: id, source: 'academy' })).toBe(line);
    }
  });

  it('spreads the real academy ids across the pool', () => {
    // Intake ids are sequential and nearly identical, which is exactly where a
    // weak hash buckets everyone onto one line. Twenty seasons of six offers
    // must reach most of the doubled pool, and no single intake may repeat
    // itself — two prospects walking on the same week is where a manager would
    // actually catch the repeat.
    const seasons = 20;
    const ids = youthIds(seasons, 6);
    const lines = ids.map((id) =>
      arrivalLine({ playerId: id, source: 'academy' }),
    );
    expect(new Set(lines).size).toBeGreaterThanOrEqual(25);

    for (let season = 0; season < seasons; season += 1) {
      const intake = lines.slice(season * 6, season * 6 + 6);
      expect(new Set(intake).size).toBe(intake.length);
    }
  });
});
