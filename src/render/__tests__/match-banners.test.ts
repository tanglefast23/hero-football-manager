import {
  appendBannerNewestFour,
  goalBannerPresentation,
  wastedPowerBannerTiming,
  wastedPowerTickerLane,
} from '../match-banners';

interface TestBanner {
  readonly id: string;
  readonly text: string;
  readonly subject?: 'formation' | 'mentality' | 'energy' | 'power-wasted';
}

const banner = (
  id: string,
  text: string,
  subject?: TestBanner['subject'],
): TestBanner => (subject === undefined ? { id, text } : { id, text, subject });

describe('appendBannerNewestFour', () => {
  it('reserves the lightning and gold goal treatment for our powered goals', () => {
    expect(goalBannerPresentation(true, 0, 0)).toEqual({
      icon: '⚡',
      tone: 'gold',
    });
    expect(goalBannerPresentation(false, 0, 0)).toEqual({
      icon: '⚽',
      tone: 'blue',
    });
    expect(goalBannerPresentation(false, 1, 0)).toEqual({
      icon: '⚽',
      tone: 'red',
    });
  });

  it('replaces the optimistic tap banner when the sim confirms the same control', () => {
    const tapped = appendBannerNewestFour<TestBanner>(
      [],
      banner('mentality-input:120', 'PLAYSTYLE · ATTACK', 'mentality'),
    );

    const confirmed = appendBannerNewestFour(
      tapped,
      banner('mentality:121', 'PLAYSTYLE · ATTACK', 'mentality'),
    );

    expect(confirmed).toEqual([
      banner('mentality:121', 'PLAYSTYLE · ATTACK', 'mentality'),
    ]);
  });

  it('keeps separate coaching controls visible at the same time', () => {
    const banners = [
      banner('formation:10', '4-3-3 · WIDE', 'formation'),
      banner('mentality:11', 'PLAYSTYLE · ATTACK', 'mentality'),
      banner('energy:12', 'ENERGY USE · ALL OUT', 'energy'),
    ].reduce<TestBanner[]>(
      (list, entry) => appendBannerNewestFour(list, entry),
      [],
    );

    expect(banners.map((entry) => entry.subject)).toEqual([
      'formation',
      'mentality',
      'energy',
    ]);
  });

  it('still stacks unsubjected event banners so every goal keeps its own tile', () => {
    const banners = [
      banner('goal:1', 'GOAL! Jace Strike'),
      banner('goal:2', 'GOAL! Eli Spray'),
    ].reduce<TestBanner[]>(
      (list, entry) => appendBannerNewestFour(list, entry),
      [],
    );

    expect(banners).toHaveLength(2);
  });

  it('keeps repeated wasted-power events distinct', () => {
    const banners = [
      banner('waste:1', 'WASTED POWER', 'power-wasted'),
      banner('waste:2', 'WASTED POWER', 'power-wasted'),
    ].reduce<TestBanner[]>(
      (list, entry) => appendBannerNewestFour(list, entry),
      [],
    );

    expect(banners.map((entry) => entry.id)).toEqual(['waste:1', 'waste:2']);
  });

  it('never shows more than the newest four banners', () => {
    const banners = ['a', 'b', 'c', 'd', 'e', 'f']
      .map((id) => banner(id, id.toUpperCase()))
      .reduce<TestBanner[]>(
        (list, entry) => appendBannerNewestFour(list, entry),
        [],
      );

    expect(banners.map((entry) => entry.id)).toEqual(['c', 'd', 'e', 'f']);
  });
});

describe('wastedPowerTickerLane', () => {
  it('waits behind a goal, half-time, or full-time line', () => {
    expect(wastedPowerTickerLane([{ lane: 0, size: 'big' }])).toBeNull();
  });

  it('runs repeated wasted-power lines one at a time', () => {
    expect(
      wastedPowerTickerLane([
        { lane: 0, size: 'big', subject: 'power-wasted' },
      ]),
    ).toBeNull();
  });

  it('uses the first free pair when only small lines are live', () => {
    expect(wastedPowerTickerLane([{ lane: 0 }, { lane: 3 }])).toBe(1);
  });
});

describe('wastedPowerBannerTiming', () => {
  it('uses sim ticks during play and wall clock only after full time', () => {
    expect(wastedPowerBannerTiming(30, 1, 1000, false)).toEqual({});
    expect(wastedPowerBannerTiming(30, 1, 1000, true)).toEqual({
      durationMs: 3000,
      expiresAtMs: 4000,
    });
  });
});
