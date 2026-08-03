import { useM1Store } from '../store';
import { DEFAULT_CREATION_RATINGS } from '../../game';
import { outstandingInboxDuties } from '../assistant-guide';

/**
 * The desk gate, from the button's side.
 *
 * `assistant-guide.test.ts` covers which duties qualify; this covers what a
 * manager actually experiences when they press Advance Week with one still
 * open — the week stays put and Bert is the one who says why, rather than the
 * button quietly doing nothing.
 */
describe('the opening weeks hold Advance Week for an unfinished desk', () => {
  beforeEach(() => {
    useM1Store.setState(useM1Store.getInitialState(), true);
    useM1Store.getState().startNewCareer(123);
    useM1Store.getState().completePlayerCreation({
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
  });

  it('lets the opening week go, then refuses the one carrying a duty', () => {
    // Week 1 is never walled: the training pitch is due from the first morning
    // and is deliberately not a blocking duty.
    expect(useM1Store.getState().career?.week).toBe(1);
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBe(2);
    expect(useM1Store.getState().inboxDutyReminder).toBeNull();

    // The new week opens on its review; Advance Week is only reachable once
    // that has been read.
    useM1Store.getState().continueWeekReview();
    expect(useM1Store.getState().screen).toBe('management');

    const weekTwo = useM1Store.getState().career!;
    expect(outstandingInboxDuties(weekTwo)).toContain('youth-intake');

    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBe(2);
    expect(useM1Store.getState().inboxDutyReminder).toContain('youth-intake');
    // A refusal is not an error: nothing has gone wrong, the manager is simply
    // being told the desk is not finished.
    expect(useM1Store.getState().error).toBeNull();
  });

  it('sends Bert away without moving the week', () => {
    useM1Store.getState().advanceCareer();
    useM1Store.getState().continueWeekReview();
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().inboxDutyReminder).not.toBeNull();

    useM1Store.getState().dismissInboxDutyReminder();
    expect(useM1Store.getState().inboxDutyReminder).toBeNull();
    expect(useM1Store.getState().career?.week).toBe(2);
  });
});
