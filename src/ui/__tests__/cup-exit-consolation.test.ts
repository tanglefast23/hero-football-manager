import { readFileSync } from 'fs';
import { join } from 'path';
import { beatMoment } from '../bert-beat-moments';
import type { BriefingBeat } from '../bert-briefing-beats';

const app = () => readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

/** The two lines, as beats, so the pairing can be read the way he delivers it. */
const BEATS: BriefingBeat[] = [
  { text: 'The cup run is over.', focus: 'assistant', kind: 'body', pageIndex: 0 },
  { text: 'We can slay these giants.', focus: 'assistant', kind: 'body', pageIndex: 1 },
];

describe('Bert on the first cup exit', () => {
  it('walks on over the full-time report, and only there', () => {
    const source = app();

    // The report is where the manager is standing when the run ends. Waiting
    // for the office would deliver the consolation a screen too late, after
    // they had already clicked past the defeat.
    expect(source).toContain("store.screen === 'postmatch'");
    expect(source).toContain('store.postMatch?.result.cupExit === true');
  });

  it('says it once a career and never again', () => {
    const source = app();

    expect(source).toContain("hasAssistantGuideMilestone(store.career, 'first-cup-exit-seen')");
    expect(source).toContain("store.completeGuideMilestone('first-cup-exit-seen')");
    // Losing a knockout tie is the ordinary shape of this competition. He
    // explains that once; a gaffer who says it every season is a nag.
    expect(source).toContain('cupExitConsolationVisible');
  });

  it('holds the screen the way every other briefing does', () => {
    const source = app();

    // Without this the tab rail's keyboard shortcuts stay live under a
    // full-screen overlay that is already swallowing the mouse.
    expect(source).toMatch(/guideOverlayVisible = \([^)]*\|\| cupExitConsolationVisible/s);
  });

  it('carries the two lines the defeat was written for', () => {
    const source = app();

    expect(source).toContain('The cup run is over. But that’s understandable.');
    expect(source).toContain(
      'You’re playing against the very best teams and leagues. We can slay these giants in the future!',
    );
  });

  it('winces at the news, then leans in for the rally', () => {
    // Two beats, two faces: sympathy delivered by the face that then promises
    // giants would read as a man who did not mean either half.
    expect(beatMoment('first-cup-exit', BEATS, 0)).toBe('bad-news');
    expect(beatMoment('first-cup-exit', BEATS, 1)).toBe('encouraging');
  });
});
