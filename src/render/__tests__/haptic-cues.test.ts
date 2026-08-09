import { hapticCueForEvent } from '../haptic-cues';

describe('match haptic cues', () => {
  it('distinguishes controlled and rival hero moments for either side', () => {
    expect(hapticCueForEvent({ t: 1, kind: 'POWER_READY', player: 4 }, 0)).toBe(
      'zone',
    );
    expect(
      hapticCueForEvent({ t: 1, kind: 'POWER_READY', player: 15 }, 0),
    ).toBeNull();
    expect(
      hapticCueForEvent(
        {
          t: 2,
          kind: 'POWER_FIRED',
          player: 15,
          power: 'SUPER_SPEED',
          strength: 0.85,
        },
        1,
      ),
    ).toBe('power');
    expect(
      hapticCueForEvent(
        {
          t: 2,
          kind: 'POWER_FIRED',
          player: 4,
          power: 'SUPER_SPEED',
          strength: 1,
        },
        1,
      ),
    ).toBe('rival-power');
  });

  it('uses different goal feedback for scoring and conceding', () => {
    expect(hapticCueForEvent({ t: 3, kind: 'GOAL', by: 7, team: 0 }, 0)).toBe(
      'goal',
    );
    expect(hapticCueForEvent({ t: 3, kind: 'GOAL', by: 18, team: 1 }, 0)).toBe(
      'conceded',
    );
  });

  it('makes both Gust beats tangible for the owning team', () => {
    expect(
      hapticCueForEvent(
        { t: 4, kind: 'GUST_REDIRECT', player: 2, from: 12, to: 0 },
        0,
      ),
    ).toBe('power');
    expect(
      hapticCueForEvent(
        { t: 5, kind: 'GUST_PUNT', player: 2, from: 0, to: 9 },
        1,
      ),
    ).toBe('rival-power');
  });
});
