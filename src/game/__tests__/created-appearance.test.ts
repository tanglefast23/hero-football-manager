import {
  CREATED_PLAYER_LOOK_COUNT,
  createdAppearanceLookId,
} from '../player-appearance';

describe('created player appearance packing', () => {
  it('keeps the original accents stable and appends no-accent looks', () => {
    expect(CREATED_PLAYER_LOOK_COUNT).toBe(300);
    expect(
      createdAppearanceLookId({ skinTone: 0, hairstyle: 0, kitAccent: 0 }),
    ).toBe('c000');
    expect(
      createdAppearanceLookId({ skinTone: 0, hairstyle: 9, kitAccent: 3 }),
    ).toBe('c039');
    expect(
      createdAppearanceLookId({ skinTone: 1, hairstyle: 0, kitAccent: 0 }),
    ).toBe('c040');
    expect(
      createdAppearanceLookId({ skinTone: 5, hairstyle: 9, kitAccent: 3 }),
    ).toBe('c239');
    expect(
      createdAppearanceLookId({ skinTone: 0, hairstyle: 0, kitAccent: 4 }),
    ).toBe('c240');
    expect(
      createdAppearanceLookId({ skinTone: 5, hairstyle: 9, kitAccent: 4 }),
    ).toBe('c299');
  });

  it('gives every combination a distinct look id', () => {
    const ids = new Set<string>();
    for (let skinTone = 0; skinTone < 6; skinTone += 1) {
      for (let hairstyle = 0; hairstyle < 10; hairstyle += 1) {
        for (let kitAccent = 0; kitAccent < 5; kitAccent += 1) {
          ids.add(
            createdAppearanceLookId({
              skinTone: skinTone as 0,
              hairstyle: hairstyle as 0,
              kitAccent: kitAccent as 0,
            }),
          );
        }
      }
    }
    expect(ids.size).toBe(300);
  });
});
