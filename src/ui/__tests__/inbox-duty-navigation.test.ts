import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const app = read('App.tsx');
const store = read('src/application/store.ts');

/**
 * The blue desk jobs hold the opening weeks open, and for three of them the
 * hold used to be a wall: a refused tab press left the manager standing on a
 * board that could not do the job Bert then walked on to demand.
 *
 * The rule now is that a guard moves the manager rather than pinning them.
 * Every case below is one way a career reached a page it could not leave.
 */
describe('the blue inbox job navigation guard', () => {
  it('never leaves a tab press where the job is not', () => {
    // Home is the desk and always opens; the job's own board opens with the
    // reminder. Neither branch may simply return without moving the manager.
    expect(store).toContainSource('function inboxDutyNavigationLanding');
    expect(store).toMatchSource(
      /if \(requestedTab === 'home'\) \{\s*return \{\s*activeTab: 'home',/,
    );
    expect(store).toMatchSource(
      /return \{\s*activeTab: inboxDutyTargetTab\(dutyId\),[\s\S]{0,200}inboxDutyReminder: \[dutyId\],/,
    );
  });

  it('opens every outstanding job board, not only the focused one', () => {
    // Week one hands out the pitch and the head coach together and wants both.
    expect(store).toContainSource(
      'duties.find((duty) => inboxDutyTargetTab(duty) === requestedTab)',
    );
    // Youth and the coach desk share the Market tab, so a press on the board
    // the manager is already standing on must not hand them to the other job.
    expect(store).toMatchSource(
      /const dutyOnRequestedTab =\s*inboxDutyTargetTab\(dutyId\) === requestedTab\s*\? dutyId/,
    );
  });

  it('carries the manager to the board in the same act as focusing it', () => {
    // Focus and navigation as two steps let anything in between — a guide the
    // same press completed — turn the second one into a refusal.
    expect(store).toMatchSource(
      /focusInboxDuty\(dutyId\) \{[\s\S]{0,900}activeTab: inboxDutyTargetTab\(dutyId\),/,
    );
  });

  it('reads focus against the live duty list, never the stored one', () => {
    // A job the club can no longer pay for, place or fit is over. Left focused
    // it kept Advance Week grey and the tab bar shut behind a job nobody owed.
    expect(store).toContainSource('function liveInboxDuty(');
    expect(store).toContainSource(
      "if (focus.mode === 'focused' && duties.includes(focus.dutyId))",
    );
    expect(app).toContainSource(
      'outstandingDuties.includes(store.inboxDutyFocus.dutyId)',
    );
  });

  it('never focuses the Cup job its own press completes', () => {
    expect(app).toContainSource(
      "const completedByThisPress = alert?.guideSequenceId === 'national-cup';",
    );
    expect(app).toContainSource(
      'if (alert?.mustDoDutyId !== undefined && !completedByThisPress) {',
    );
  });

  it('takes the manager to the job when Advance Week is refused', () => {
    // A flash on the tab rail was the whole reply, and for the two later jobs
    // — the assistant coach and the Hero Cup — there was not even that.
    expect(app).toMatchSource(
      /if \(advanceWeekGuidanceBlocked\) \{[\s\S]{0,600}store\.focusInboxDuty\(blockingInboxDuty\);/,
    );
  });

  it('lands each screen on the board the job is on', () => {
    // A tab is not a page: Club reopens on whichever board was last up, and the
    // ledger is the wrong one to arrive at while Bert is asking for a build.
    expect(app).toMatchSource(
      /focusedInboxDutyId === 'facility-placement' \|\|\s*focusedInboxDutyId === 'coaching-office'\s*\) \{\s*setClubOfficeTab\('facility'\);/,
    );
    // League is the same story, minus the briefing that used to carry the focus.
    expect(app).toContainSource("focusedInboxDutyId === 'national-cup'");
    // Market already pulls itself to the job's section.
    expect(app).toMatchSource(
      /lockedSection=\{\s*focusedInboxDutyId === 'head-coach-market' \|\|/,
    );
  });
});
