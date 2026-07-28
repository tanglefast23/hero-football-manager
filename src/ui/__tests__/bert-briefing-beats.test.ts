import { readFileSync } from 'fs';
import { join } from 'path';
import type { AssistantGuideContent } from '../../content/schemas';
import { MAX_BRIEFING_BEATS, beatFocus, briefingBeats } from '../bert-briefing-beats';

const guide = JSON.parse(
  readFileSync(join(process.cwd(), 'content/assistant-guide.json'), 'utf8'),
) as AssistantGuideContent;

describe('briefing beats', () => {
  it('flattens every shipped sequence without throwing', () => {
    for (const sequence of guide.sequences) {
      expect(briefingBeats(guide, sequence.id).length).toBeGreaterThan(0);
    }
  });

  it('returns nothing for a sequence that does not exist', () => {
    expect(briefingBeats(guide, 'no-such-sequence')).toEqual([]);
  });

  it('never exceeds what the schema can produce', () => {
    for (const sequence of guide.sequences) {
      expect(briefingBeats(guide, sequence.id).length).toBeLessThanOrEqual(MAX_BRIEFING_BEATS);
    }
  });

  it('gives the three-page intro one flat run of beats', () => {
    const beats = briefingBeats(guide, 'management-intro');
    // One entrance, not three: all three pages' copy in a single list. Two
    // paragraphs, two paragraphs, one — the longest sequence in the game.
    expect(beats).toHaveLength(5);
    expect(beats.map(beat => beat.pageIndex)).toEqual([0, 0, 1, 1, 2]);
    expect(beats.map(beat => beat.focus)).toEqual([
      'assistant', 'assistant', 'money', 'money', 'navigation',
    ]);
    expect(beats.every(beat => beat.kind === 'body')).toBe(true);
  });

  it('is the longest sequence in shipped content', () => {
    const longest = Math.max(
      ...guide.sequences.map(sequence => briefingBeats(guide, sequence.id).length),
    );
    expect(longest).toBe(5);
  });

  it('puts a page objective last within its page', () => {
    const beats = briefingBeats(guide, 'head-coach-market');
    const objectives = beats.filter(beat => beat.kind === 'objective');
    expect(objectives).toHaveLength(1);
    expect(beats.at(-1)).toBe(objectives[0]);
    expect(objectives[0].text).toBe(
      guide.sequences.find(s => s.id === 'head-coach-market')?.pages[0].objective,
    );
  });

  it('emits only body beats for a page with no objective', () => {
    const beats = briefingBeats(guide, 'desk-intro');
    expect(beats.every(beat => beat.kind === 'body')).toBe(true);
  });

  it('carries every paragraph of every page, in order', () => {
    for (const sequence of guide.sequences) {
      const expected = sequence.pages.flatMap(page => [
        ...page.body,
        ...(page.objective === undefined ? [] : [page.objective]),
      ]);
      expect(briefingBeats(guide, sequence.id).map(beat => beat.text)).toEqual(expected);
    }
  });
});

describe('beat focus', () => {
  const beats = briefingBeats(guide, 'management-intro');

  it('follows the active beat', () => {
    expect(beatFocus(beats, 0)).toBe('assistant');
    expect(beatFocus(beats, 2)).toBe('money');
    expect(beatFocus(beats, 4)).toBe('navigation');
  });

  it('holds the first and last focus across the entrance and exit walks', () => {
    // No beat is active while he is travelling; falling back to a plain dim
    // would flash the cutout off and on around every briefing.
    expect(beatFocus(beats, -1)).toBe('assistant');
    expect(beatFocus(beats, beats.length)).toBe('navigation');
  });

  it('has nothing to light when there are no beats', () => {
    expect(beatFocus([], 0)).toBeUndefined();
  });
});
