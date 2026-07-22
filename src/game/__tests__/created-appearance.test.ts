import { CREATED_PLAYER_LOOK_COUNT, createdAppearanceLookId } from '../player-appearance';

describe('created player appearance packing', () => {
  it('packs ten hairstyles and four kit accents per skin tone', () => {
    expect(CREATED_PLAYER_LOOK_COUNT).toBe(240);
    expect(createdAppearanceLookId({ skinTone: 0, hairstyle: 0, kitAccent: 0 })).toBe('c000');
    expect(createdAppearanceLookId({ skinTone: 0, hairstyle: 9, kitAccent: 3 })).toBe('c039');
    expect(createdAppearanceLookId({ skinTone: 1, hairstyle: 0, kitAccent: 0 })).toBe('c040');
    expect(createdAppearanceLookId({ skinTone: 5, hairstyle: 9, kitAccent: 3 })).toBe('c239');
  });

  it('gives every combination a distinct look id', () => {
    const ids = new Set<string>();
    for (let skinTone = 0; skinTone < 6; skinTone += 1) {
      for (let hairstyle = 0; hairstyle < 10; hairstyle += 1) {
        for (let kitAccent = 0; kitAccent < 4; kitAccent += 1) {
          ids.add(createdAppearanceLookId({
            skinTone: skinTone as 0,
            hairstyle: hairstyle as 0,
            kitAccent: kitAccent as 0,
          }));
        }
      }
    }
    expect(ids.size).toBe(240);
  });
});
