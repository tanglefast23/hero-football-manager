import { DEFAULT_CREATION_RATINGS } from '../../game';
import { useM1Store } from '../store';

function start(mode: 'teacher' | 'advisor') {
  useM1Store.setState(useM1Store.getInitialState(), true);
  useM1Store.getState().startNewCareer(123, mode);
  useM1Store.getState().completePlayerCreation({
    name: 'Jo Rook',
    ratings: DEFAULT_CREATION_RATINGS,
  });
}

describe('Advisor lifts only Bert gates', () => {
  it('lifts the intro-guarded training and home-desk blocks explicitly', () => {
    start('advisor');
    useM1Store.getState().completeGuideMilestone('intro-complete');
    useM1Store.getState().setActiveTab('squad');

    useM1Store.getState().advanceCareer();

    expect(useM1Store.getState().career).toMatchObject({ week: 2, assistantMode: 'advisor' });
    expect(useM1Store.getState().error).toBeNull();
  });

  it('leaves those same opening safeguards unchanged for Teacher', () => {
    start('teacher');
    useM1Store.getState().completeGuideMilestone('intro-complete');
    useM1Store.getState().setActiveTab('squad');

    useM1Store.getState().advanceCareer();

    expect(useM1Store.getState().career?.week).toBe(1);
    expect(useM1Store.getState().error).toContain('Train a player');
  });

  it('does not hold Advisor on the week-two youth duty', () => {
    start('advisor');
    useM1Store.getState().advanceCareer();
    useM1Store.getState().continueWeekReview();
    useM1Store.getState().advanceCareer();

    expect(useM1Store.getState().career?.week).toBe(3);
    expect(useM1Store.getState().inboxDutyReminder).toBeNull();
  });
});

describe('changing Bert mid-career', () => {
  it('does nothing when no career is loaded', () => {
    useM1Store.setState(useM1Store.getInitialState(), true);

    useM1Store.getState().setAssistantMode('advisor');

    expect(useM1Store.getState().career).toBeNull();
    expect(useM1Store.getState().error).toBeNull();
  });

  it('clears a live duty refusal immediately when Teacher becomes Advisor', () => {
    start('teacher');
    useM1Store.getState().advanceCareer();
    useM1Store.getState().continueWeekReview();
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().inboxDutyReminder).toContain('youth-intake');

    useM1Store.getState().setAssistantMode('advisor');

    expect(useM1Store.getState().career?.assistantMode).toBe('advisor');
    expect(useM1Store.getState().inboxDutyReminder).toBeNull();
  });

  it('removes only Advisor suppression flags when Teacher returns', () => {
    start('advisor');
    useM1Store.getState().reconcileAssistantInbox();
    const hidden = useM1Store.getState().career!;
    expect(hidden.eventFlags.some(flag => flag.includes('advisor-suppressed'))).toBe(true);
    expect(hidden.eventFlags.some(flag => flag.includes('inbox:queued'))).toBe(true);

    useM1Store.getState().setAssistantMode('teacher');

    const resumed = useM1Store.getState().career!;
    expect(resumed.eventFlags.some(flag => flag.includes('advisor-suppressed'))).toBe(false);
    expect(resumed.eventFlags.some(flag => flag.includes('inbox:queued'))).toBe(true);
  });
});
