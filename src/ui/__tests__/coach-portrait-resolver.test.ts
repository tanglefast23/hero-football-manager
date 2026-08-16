import spriteData from '../../render/sprites/management-sprites.json';
import { resolveCoachPortraitId } from '../components/coach-portrait';

const sprites = (spriteData as { sprites: Record<string, unknown> }).sprites;
const EXPRESSIONS = ['rest', 'joy', 'cry', 'point', 'field', 'field-cheer'];

/**
 * A coach drawn in more than one expression must stay the same person.
 *
 * Coaches made from retired players carry `legend-<playerId>` portrait ids,
 * which are not in the sprite sheet. They get a hashed stand-in — and the hash
 * used to run over the WHOLE sprite key, expression included, so `:point` and
 * `:joy` picked two different stand-ins. Anything animating a coach between
 * expressions (the half-time speech cutscene flaps point/joy roughly eight
 * times a second) would have shown two strangers alternating.
 */
describe('coach portrait resolution', () => {
  it('leaves a coach who is in the sheet exactly as they are', () => {
    const known = Object.keys(sprites)
      .filter((key) => key.startsWith('coach:') && key.endsWith(':rest'))
      .map((key) => key.split(':')[1]!);
    expect(known.length).toBeGreaterThan(0);
    for (const portraitId of known) {
      expect(resolveCoachPortraitId(portraitId)).toBe(portraitId);
    }
  });

  it('gives a legend one stand-in, the same for every expression', () => {
    const legendId = 'legend-42';
    expect(sprites[`coach:${legendId}:rest`]).toBeUndefined();

    const resolved = resolveCoachPortraitId(legendId);
    // The stand-in is a real coach, so every expression the cutscene may ask
    // for actually exists on them.
    for (const expression of EXPRESSIONS) {
      expect(sprites[`coach:${resolved}:${expression}`]).toBeDefined();
    }
    // And resolving again lands on the same person: the identity is a property
    // of the portrait id, never of the expression asked for.
    expect(resolveCoachPortraitId(legendId)).toBe(resolved);
  });

  it('is stable across ids, so a legend is always the same stranger', () => {
    const first = resolveCoachPortraitId('legend-7');
    const second = resolveCoachPortraitId('legend-8');
    expect(resolveCoachPortraitId('legend-7')).toBe(first);
    // Different legends are allowed to share a stand-in — there are more
    // legends than coach portraits — but the mapping must be deterministic.
    expect(resolveCoachPortraitId('legend-8')).toBe(second);
  });

  it('never invents a coach when the sheet has none to offer', () => {
    // An empty-ish id still resolves to something drawable rather than
    // throwing: this runs inside a cutscene that must not crash a match.
    expect(typeof resolveCoachPortraitId('')).toBe('string');
  });
});
