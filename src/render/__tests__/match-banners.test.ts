import { appendBannerNewestFour } from '../match-banners';

interface TestBanner {
  readonly id: string;
  readonly text: string;
  readonly subject?: 'formation' | 'mentality' | 'energy';
}

const banner = (id: string, text: string, subject?: TestBanner['subject']): TestBanner =>
  subject === undefined ? { id, text } : { id, text, subject };

describe('appendBannerNewestFour', () => {
  it('replaces the optimistic tap banner when the sim confirms the same control', () => {
    const tapped = appendBannerNewestFour<TestBanner>(
      [],
      banner('mentality-input:120', 'PLAYSTYLE · ATTACK', 'mentality'),
    );

    const confirmed = appendBannerNewestFour(
      tapped,
      banner('mentality:121', 'PLAYSTYLE · ATTACK', 'mentality'),
    );

    expect(confirmed).toEqual([banner('mentality:121', 'PLAYSTYLE · ATTACK', 'mentality')]);
  });

  it('keeps separate coaching controls visible at the same time', () => {
    const banners = [
      banner('formation:10', '4-3-3 · WIDE', 'formation'),
      banner('mentality:11', 'PLAYSTYLE · ATTACK', 'mentality'),
      banner('energy:12', 'ENERGY USE · ALL OUT', 'energy'),
    ].reduce<TestBanner[]>((list, entry) => appendBannerNewestFour(list, entry), []);

    expect(banners.map(entry => entry.subject)).toEqual(['formation', 'mentality', 'energy']);
  });

  it('still stacks unsubjected event banners so every goal keeps its own tile', () => {
    const banners = [
      banner('goal:1', 'GOAL! Jace Strike'),
      banner('goal:2', 'GOAL! Eli Spray'),
    ].reduce<TestBanner[]>((list, entry) => appendBannerNewestFour(list, entry), []);

    expect(banners).toHaveLength(2);
  });

  it('never shows more than the newest four banners', () => {
    const banners = ['a', 'b', 'c', 'd', 'e', 'f']
      .map(id => banner(id, id.toUpperCase()))
      .reduce<TestBanner[]>((list, entry) => appendBannerNewestFour(list, entry), []);

    expect(banners.map(entry => entry.id)).toEqual(['c', 'd', 'e', 'f']);
  });
});
