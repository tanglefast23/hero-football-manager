import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../career';
import {
  buyCoachSpeech,
  coachSpeechBoost,
  coachSpeechOffer,
  coachSpeechUnlocked,
  coachSpeechUsedFlag,
  COACH_SPEECH_UNLOCK_WEEK,
  spendCoachSpeech,
} from '../coach-speech';
import { completeAssistantGuideSequence } from '../assistant-guide';
import { individualTrainingUsedFlag } from '../training';
import type { CoachCandidate } from '../market';
import type { DivisionLevel, PyramidClub } from '../pyramid';
import type { GameState } from '../types';

const HEAD_COACH: CoachCandidate = {
  id: 'coach-test',
  name: 'Thandi Mokoena',
  level: 1,
  personality: 'JOKER',
  specialties: ['ATTACK', 'MOTIVATOR'],
  weeklyWage: 300,
  requiredDivision: 5,
  requiredFame: 0,
  loyaltyDiscountPercent: 0,
};

/** A career sitting in `division`, in `week`, with a head coach and TP to spend. */
function career(
  division: DivisionLevel = 3,
  week = COACH_SPEECH_UNLOCK_WEEK,
): GameState {
  const base = createCareer(createLaunchCareerSetup(20260811));
  if (base.m2 === undefined) throw new Error('launch career has no pyramid');
  const userClub = base.m2.pyramid.divisions
    .flatMap((entry) => entry.clubs)
    .find((club) => club.id === base.userClubId);
  if (userClub === undefined) throw new Error('user pyramid club missing');

  return {
    ...base,
    week,
    trainingPoints: 40,
    market: { ...base.market!, headCoach: HEAD_COACH },
    m2: {
      ...base.m2,
      highestDivisionReached: division,
      pyramid: {
        ...base.m2.pyramid,
        divisions: base.m2.pyramid.divisions.map((entry) => ({
          ...entry,
          clubs: [
            ...entry.clubs.filter((club) => club.id !== base.userClubId),
            ...(entry.level === division ? [userClub as PyramidClub] : []),
          ],
        })),
      },
    },
  };
}

describe('head coach motivational speech', () => {
  it('unlocks in D3 from week 2, and never re-locks after that', () => {
    expect(coachSpeechUnlocked(career(4))).toBe(false);
    expect(coachSpeechUnlocked(career(3, 1))).toBe(false);
    expect(coachSpeechUnlocked(career(3, 2))).toBe(true);

    // Week 1 of a later season, lesson already delivered: still unlocked. A
    // bare `week >= 2` hid the button for one week every season.
    const laterSeason: GameState = {
      ...completeAssistantGuideSequence(career(3, 1), 'coach-speech'),
      season: 2,
    };
    expect(coachSpeechUnlocked(laterSeason)).toBe(true);
  });

  it('survives relegation, because the club reached D3 once', () => {
    const relegated = career(4);
    expect(
      coachSpeechUnlocked({
        ...relegated,
        m2: { ...relegated.m2!, highestDivisionReached: 3 },
      }),
    ).toBe(true);
  });

  it('doubles the midseason division gain: D3 +6, D2 +8, D1 +10', () => {
    expect(
      ([3, 2, 1] as const).map((division) =>
        coachSpeechBoost(career(division)),
      ),
    ).toEqual([6, 8, 10]);
  });

  it('costs every training point and banks exactly one speech', () => {
    const before = career();
    const offer = coachSpeechOffer(before);
    expect(offer?.blockedReason).toBeUndefined();
    expect(offer?.trainingPointsCost).toBe(40);

    const after = buyCoachSpeech(before);
    expect(after.trainingPoints).toBe(0);
    expect(after.coachSpeechBanked).toBe(true);
    expect(after.eventFlags).toContain(coachSpeechUsedFlag(1, 2));

    // A second tap the same week is refused, and changes nothing.
    expect(coachSpeechOffer(after)?.blockedReason).toBe('ALREADY_BANKED');
    expect(buyCoachSpeech(after)).toEqual(after);
  });

  it('refuses when TP was already spent this week, in either order', () => {
    const drilledFirst: GameState = {
      ...career(),
      eventFlags: [...career().eventFlags, individualTrainingUsedFlag(1, 2)],
    };
    expect(coachSpeechOffer(drilledFirst)?.blockedReason).toBe(
      'TRAINING_USED_THIS_WEEK',
    );
    expect(buyCoachSpeech(drilledFirst).coachSpeechBanked).toBeUndefined();

    // Speech first: the week's own flag closes the desk, and the drill flag is
    // deliberately left alone so Green Bull never claims individual training
    // was used when it was not.
    const spokeFirst = buyCoachSpeech(career());
    expect(spokeFirst.eventFlags).not.toContain(
      individualTrainingUsedFlag(1, 2),
    );

    // A fresh week reopens it once the bank is empty again.
    const nextWeek = spendCoachSpeech({ ...spokeFirst, week: 3 });
    expect(
      coachSpeechOffer({ ...nextWeek, trainingPoints: 12 })?.blockedReason,
    ).toBeUndefined();
  });

  it('refuses with no head coach and with no training points', () => {
    const noCoach = career();
    expect(
      coachSpeechOffer({
        ...noCoach,
        market: { ...noCoach.market!, headCoach: undefined },
      })?.blockedReason,
    ).toBe('NO_HEAD_COACH');
    expect(
      coachSpeechOffer({ ...career(), trainingPoints: 0 })?.blockedReason,
    ).toBe('NOT_ENOUGH_TP');
  });

  it('empties the bank when a match has used it', () => {
    const banked = buyCoachSpeech(career());
    expect(spendCoachSpeech(banked).coachSpeechBanked).toBe(false);
    // Spending an empty bank is a no-op, not a negative.
    expect(spendCoachSpeech(career())).toEqual(career());
  });
});
