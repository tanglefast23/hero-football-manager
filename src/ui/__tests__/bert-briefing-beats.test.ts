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

  it('leaves CTA objectives to the tooltip and progression layer', () => {
    const beats = briefingBeats(guide, 'head-coach-market');
    const objective = guide.sequences
      .find(s => s.id === 'head-coach-market')
      ?.pages[0].objective;

    expect(objective).toBeDefined();
    expect(beats.map(beat => beat.text)).not.toContain(objective);
    expect(beats.every(beat => beat.kind === 'body')).toBe(true);
  });

  it('emits only body beats for a page with no objective', () => {
    const beats = briefingBeats(guide, 'desk-intro');
    expect(beats.every(beat => beat.kind === 'body')).toBe(true);
  });

  it('includes a division-leaders beat pointing at the leaders tab', () => {
    const beat = guide.sequences.find(sequence => sequence.id === 'division-leaders');
    expect(beat).toBeDefined();
    expect(beat?.destination).toBe('league-leaders');
    expect(beat?.pages.length).toBeGreaterThan(0);
    expect(beat?.pages.every(page => page.focus === 'division-leaders')).toBe(true);
  });

  it('routes what that beat carries to the League screen leaders board', () => {
    const beat = guide.sequences.find(sequence => sequence.id === 'division-leaders')!;
    const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');
    // The briefing hands its last page's focus to the concierge on its way out,
    // which is what picks the board once the destination has picked the tab.
    const focus = beat.pages[beat.pages.length - 1].focus;

    // Read out of the content rather than typed here, so renaming either value
    // fails this instead of quietly pointing Bert at nothing.
    expect(app).toMatch(
      new RegExp(`destination === '${beat.destination}'[\\s\\S]{0,40}?\\?\\s*'league'`),
    );
    expect(app).toMatch(new RegExp(`conciergeFocus === '${focus}'[\\s\\S]{0,40}?\\?\\s*'leaders'`));
  });

  it('lets Bert explain the cup page instead of pointing a tap cue at it', () => {
    const league = readFileSync(
      join(process.cwd(), 'src/ui/screens/M2LeagueScreen.tsx'),
      'utf8',
    );
    const beats = briefingBeats(guide, 'national-cup');

    // The cue said "Tap here" over a bracket with nothing tappable in it, and
    // the tap only bounced the manager back to the top of the page.
    expect(league).not.toContain('TutorialTapCue');
    expect(beats).toHaveLength(2);
    expect(beats[1].text).toContain('scores come in live');
    expect(beats.every(beat => beat.focus === 'national-cup')).toBe(true);
  });

  it('carries every paragraph of every page, in order', () => {
    for (const sequence of guide.sequences) {
      const expected = sequence.pages.flatMap(page => [
        ...page.body,
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

  it('holds the first and last focus across edge transitions', () => {
    expect(beatFocus(beats, -1)).toBe('assistant');
    expect(beatFocus(beats, beats.length)).toBe('navigation');
  });

  it('has nothing to light when there are no beats', () => {
    expect(beatFocus([], 0)).toBeUndefined();
  });
});
