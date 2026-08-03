import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { briefingMoments } from '../bert-beat-moments';
import type { BriefingBeat } from '../bert-briefing-beats';
import { BERT_MOMENTS } from '../bert-poses';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const app = read('App.tsx');

/**
 * The crowd is the first thing the club earns that is not money, and until now
 * nothing said so. Bert congratulates the manager on the desk, explains what
 * fans pay for, and walks them to the ledger to show them where it lands.
 */
describe("Bert's first-fans lesson", () => {
  it('waits for a crowd the club actually won', () => {
    expect(app).toContain('hasEverGainedFans(store.career)');
    expect(app).toContain("!hasAssistantGuideMilestone(store.career, 'first-fans-seen')");
  });

  it('congratulates on the desk and tours the ledger, never the other way round', () => {
    // The desk beat is home-tab only; the ledger beat needs the Finances board
    // showing AND the desk beat already banked, so the two cannot swap places.
    expect(app).toMatch(/fansLessonVisible = [\s\S]{0,200}store\.activeTab === 'home'/);
    expect(app).toMatch(/fansLedgerTourVisible = [\s\S]{0,200}store\.activeTab === 'club'/);
    expect(app).toMatch(/fansLedgerTourVisible = [\s\S]{0,300}clubOfficeTab === 'finances'/);
    expect(app).toMatch(
      /fansLedgerTourVisible = [\s\S]{0,400}hasAssistantGuideMilestone\(store\.career, 'first-fans-seen'\)/,
    );
  });

  it('takes the manager to the ledger itself rather than telling them to go', () => {
    expect(app).toMatch(
      /completeGuideMilestone\('first-fans-seen'\);[\s\S]{0,200}setClubOfficeTab\('finances'\);[\s\S]{0,120}setActiveTab\('club'\)/,
    );
  });

  it('banks each beat separately so a closed career resumes on the half it owes', () => {
    expect(app).toContain("store.completeGuideMilestone('first-fans-seen')");
    expect(app).toContain("store.completeGuideMilestone('first-fans-ledger-seen')");
  });

  it('holds the rest of the screen while he is talking', () => {
    expect(app).toMatch(/guideOverlayVisible = \([\s\S]{0,400}\|\| fansLessonVisible/);
    expect(app).toMatch(/guideOverlayVisible = \([\s\S]{0,400}\|\| fansLedgerTourVisible/);
  });

  it('names both bills and income, because half the page is good news', () => {
    expect(app).toContain('every bill the club owes');
    expect(app).toContain('the money coming in');
  });

  /** The owner's rule: the face is chosen for the line, never left to the fallback run. */
  it('wears an authored face on each beat', () => {
    // Both beats are authored in App.tsx as a custom message, so they carry the
    // shape the walk-on builds for one rather than a content page's focus.
    const twoBeats: BriefingBeat[] = [0, 1].map(pageIndex => ({
      text: `beat ${pageIndex}`,
      focus: 'money',
      kind: 'body',
      pageIndex,
    }));
    const desk = briefingMoments('first-fans', twoBeats);
    const ledger = briefingMoments('first-fans-ledger', twoBeats);

    expect(desk).toEqual(['celebrating', 'explaining']);
    expect(ledger).toEqual(['listing', 'encouraging']);
    // Good news opens delighted; the ledger opens flat. The two beats must not
    // arrive wearing the same face as each other.
    expect(BERT_MOMENTS[desk[0]].expression).toBe('delighted');
    expect(BERT_MOMENTS[ledger[0]].expression).not.toBe(BERT_MOMENTS[desk[0]].expression);
  });
});
