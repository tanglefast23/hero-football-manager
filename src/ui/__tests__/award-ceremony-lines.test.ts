import { loadLaunchContent, parseLaunchContent } from '../../content';
import { AwardCeremonyLinesSchema } from '../../content/schemas';
import type { LaunchContent } from '../../content/schemas';
import {
  RUNNER_UP_CEREMONY_LINES,
  WINNER_CEREMONY_LINES,
  awardCeremonySpeeches,
  type AwardCeremonySpeaker,
} from '../award-ceremony-lines';
import { MAX_ARRIVAL_LINE_LENGTH } from '../player-arrival-lines';

/** The depth the de-dup probe is sized against, and the schema's pinned length. */
const AWARD_CEREMONY_POOL_SIZE = 30;

function cloneContent(content: LaunchContent): LaunchContent {
  return JSON.parse(JSON.stringify(content)) as LaunchContent;
}

/**
 * Four winners whose keys all hash onto the last line of the pool in season 7,
 * found by search rather than by hope: a de-dup test built on inputs that
 * happen not to collide asserts nothing. Listed in ceremony reveal order, so
 * the keeper claims line 29 and the other three must probe past the end.
 */
const COLLIDING_SEASON = 7;
const COLLIDING_WINNERS: AwardCeremonySpeaker[] = [
  { category: 'saves', winnerPlayerId: 'p_26' },
  { category: 'tacklesWon', winnerPlayerId: 'p_29' },
  { category: 'passesCompleted', winnerPlayerId: 'p_17' },
  { category: 'goals', winnerPlayerId: 'p_110' },
];

describe('award ceremony lines', () => {
  it('ships two pools of thirty distinct lines that fit one speech bubble', () => {
    for (const pool of [WINNER_CEREMONY_LINES, RUNNER_UP_CEREMONY_LINES]) {
      expect(pool).toHaveLength(AWARD_CEREMONY_POOL_SIZE);
      expect(new Set(pool).size).toBe(AWARD_CEREMONY_POOL_SIZE);
      for (const line of pool) {
        expect(line.trim()).toBe(line);
        expect(line.length).toBeGreaterThan(0);
        expect(line.length).toBeLessThanOrEqual(MAX_ARRIVAL_LINE_LENGTH);
      }
    }
    // A winner's line and a runner-up's line are answers to opposite questions;
    // one appearing in both pools is a copy-paste, not a choice.
    const shared = WINNER_CEREMONY_LINES.filter(line => RUNNER_UP_CEREMONY_LINES.includes(line));
    expect(shared).toEqual([]);
  });

  it('validates the pools where the game loads them, not only in this test', () => {
    const content = loadLaunchContent();
    expect(content.awardCeremonyLines.winner).toEqual([...WINNER_CEREMONY_LINES]);
    expect(content.awardCeremonyLines.runnerUp).toEqual([...RUNNER_UP_CEREMONY_LINES]);

    const shortPool = cloneContent(content);
    shortPool.awardCeremonyLines.winner.pop();
    expect(() => parseLaunchContent(shortPool)).toThrow();

    const duplicateLine = cloneContent(content);
    duplicateLine.awardCeremonyLines.runnerUp[1] = duplicateLine.awardCeremonyLines.runnerUp[0];
    expect(() => parseLaunchContent(duplicateLine)).toThrow(/runner-up ceremony lines must be unique/);

    const paragraph = cloneContent(content);
    paragraph.awardCeremonyLines.winner[0] = 'x'.repeat(MAX_ARRIVAL_LINE_LENGTH + 1);
    expect(() => parseLaunchContent(paragraph)).toThrow();
    expect(() => AwardCeremonyLinesSchema.parse(paragraph.awardCeremonyLines)).toThrow();
  });

  it('gives a winner the same line every time it is asked', () => {
    // The ceremony holds a speaking sprite across taps and rotations, and
    // re-renders on both. A rolled line would change mid-sentence.
    const speakers: AwardCeremonySpeaker[] = [{ category: 'goals', winnerPlayerId: 'p_401' }];
    const first = awardCeremonySpeeches(speakers, 3)[0].winnerLine;

    expect(WINNER_CEREMONY_LINES).toContain(first);
    for (let repeat = 0; repeat < 5; repeat += 1) {
      expect(awardCeremonySpeeches(speakers, 3)[0].winnerLine).toBe(first);
    }
  });

  it('moves the same winner onto a different line in a different season', () => {
    const speakers: AwardCeremonySpeaker[] = [{ category: 'saves', winnerPlayerId: 'p_26' }];
    const seventh = awardCeremonySpeeches(speakers, 7)[0].winnerLine;
    const eighth = awardCeremonySpeeches(speakers, 8)[0].winnerLine;

    expect(seventh).not.toBe(eighth);
    // A key that barely moves with the season would repeat a career's worth of
    // ceremonies onto one line.
    const decade = Array.from({ length: 10 }, (unused, index) => (
      awardCeremonySpeeches(speakers, index + 1)[0].winnerLine
    ));
    expect(new Set(decade).size).toBeGreaterThanOrEqual(5);
  });

  it('never lets two winners in one ceremony deliver the same line', () => {
    // Proof the fixture bites: alone, each of the four draws the identical line.
    const solo = COLLIDING_WINNERS.map(
      speaker => awardCeremonySpeeches([speaker], COLLIDING_SEASON)[0].winnerLine,
    );
    expect(new Set(solo).size).toBe(1);
    expect(solo[0]).toBe(WINNER_CEREMONY_LINES[AWARD_CEREMONY_POOL_SIZE - 1]);

    const ceremony = awardCeremonySpeeches(COLLIDING_WINNERS, COLLIDING_SEASON);
    const lines = ceremony.map(beat => beat.winnerLine);
    expect(new Set(lines).size).toBe(COLLIDING_WINNERS.length);
    // The claimed line is the last in the pool, so the other three can only be
    // served by a probe that wraps around the end.
    expect(lines[0]).toBe(WINNER_CEREMONY_LINES[AWARD_CEREMONY_POOL_SIZE - 1]);
    expect(lines.slice(1)).toEqual(WINNER_CEREMONY_LINES.slice(0, 3));
  });

  it('resolves the whole ceremony at once, in the order the beats are given', () => {
    const first = awardCeremonySpeeches(COLLIDING_WINNERS, COLLIDING_SEASON);
    const second = awardCeremonySpeeches(COLLIDING_WINNERS, COLLIDING_SEASON);

    expect(first).toEqual(second);
    expect(first.map(beat => beat.category)).toEqual([
      'saves',
      'tacklesWon',
      'passesCompleted',
      'goals',
    ]);
  });

  it('speaks for a runner-up only when the ceremony names one', () => {
    const speeches = awardCeremonySpeeches([
      { category: 'saves', winnerPlayerId: 'p_26' },
      { category: 'goals', winnerPlayerId: 'p_110', runnerUpPlayerId: 'p_88' },
    ], 4);

    expect(speeches[0].runnerUpLine).toBeUndefined();
    expect(RUNNER_UP_CEREMONY_LINES).toContain(speeches[1].runnerUpLine);
    // The two pools are drawn separately: a runner-up never borrows the mood of
    // a winner's line.
    expect(WINNER_CEREMONY_LINES).not.toContain(speeches[1].runnerUpLine);
  });

  it('de-duplicates runner-up lines the same way it de-duplicates winners', () => {
    const speeches = awardCeremonySpeeches(COLLIDING_WINNERS.map(speaker => ({
      ...speaker,
      runnerUpPlayerId: speaker.winnerPlayerId,
    })), COLLIDING_SEASON);
    const runnerUpLines = speeches.map(beat => beat.runnerUpLine);

    expect(new Set(runnerUpLines).size).toBe(COLLIDING_WINNERS.length);
    expect(runnerUpLines[0]).toBe(RUNNER_UP_CEREMONY_LINES[AWARD_CEREMONY_POOL_SIZE - 1]);
  });
});
