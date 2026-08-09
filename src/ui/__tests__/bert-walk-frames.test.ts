import { readFileSync } from 'fs';
import { join } from 'path';
import {
  BERT_SPRITE_SIZE,
  BERT_WALK_FRAMES,
  BERT_WALK_PARTS,
  BERT_WALK_STEP_MS,
} from '../bert-walk-frames';

describe('bert walk frames', () => {
  it('holds exactly two frames at the rookie run cadence', () => {
    expect(BERT_WALK_FRAMES).toHaveLength(2);
    // Same value as PlayerRunSprite's STEP_MS. The two characters share the
    // onboarding week and must not move at different speeds.
    const runSprite = readFileSync(
      join(process.cwd(), 'src/render/PlayerRunSprite.tsx'),
      'utf8',
    );
    expect(runSprite).toContain(`const STEP_MS = ${BERT_WALK_STEP_MS}`);
  });

  it('opens on the authored pose, so the walk can hand him back unchanged', () => {
    const [standing] = BERT_WALK_FRAMES;
    expect(standing.bodyDy).toBe(0);
    for (const part of BERT_WALK_PARTS) {
      expect(standing.parts[part].dy).toBe(0);
      expect(standing.parts[part].dh ?? 0).toBe(0);
    }
  });

  it('names the same parts in every frame, so none can drift', () => {
    for (const frame of BERT_WALK_FRAMES) {
      expect(Object.keys(frame.parts).sort()).toEqual(
        [...BERT_WALK_PARTS].sort(),
      );
    }
  });

  it('moves only in whole pixels', () => {
    for (const frame of BERT_WALK_FRAMES) {
      expect(Number.isInteger(frame.bodyDy)).toBe(true);
      for (const part of BERT_WALK_PARTS) {
        expect(Number.isInteger(frame.parts[part].dy)).toBe(true);
        expect(Number.isInteger(frame.parts[part].dh ?? 0)).toBe(true);
      }
    }
  });

  it('keeps every offset small enough to stay inside the sprite box', () => {
    // A limb that travelled further than its own height would leave the figure.
    for (const frame of BERT_WALK_FRAMES) {
      expect(Math.abs(frame.bodyDy)).toBeLessThanOrEqual(4);
      for (const part of BERT_WALK_PARTS) {
        expect(Math.abs(frame.parts[part].dy)).toBeLessThan(
          BERT_SPRITE_SIZE.height / 4,
        );
        expect(Math.abs(frame.parts[part].dh ?? 0)).toBeLessThan(
          BERT_SPRITE_SIZE.height / 4,
        );
      }
    }
  });

  it('lifts one foot and plants the other', () => {
    const [, step] = BERT_WALK_FRAMES;
    // The lifting leg shortens by exactly what it rises, so the hip stays put.
    expect(step.parts.leftLeg.dy).toBe(step.parts.leftLeg.dh);
    expect(step.parts.leftShoe.dy).toBe(step.parts.leftLeg.dy);
    // The planted leg stretches against the body's lift so its foot does not float.
    expect(step.parts.rightLeg.dy).toBe(-step.bodyDy);
    expect(step.parts.rightLeg.dh).toBe(-step.bodyDy);
    expect(step.parts.rightShoe.dy).toBe(-step.bodyDy);
  });

  it('keeps the ground shadow on the ground while the body bobs', () => {
    const [, step] = BERT_WALK_FRAMES;
    expect(step.parts.groundShadow.dy).toBe(-step.bodyDy);
  });

  it('swings the arms in opposition', () => {
    const [, step] = BERT_WALK_FRAMES;
    expect(step.parts.leftArm.dy).toBe(-step.parts.rightArm.dy);
    expect(step.parts.leftArm.dy).not.toBe(0);
    // Hands travel with the arm they hang from.
    expect(step.parts.leftHand.dy).toBe(step.parts.leftArm.dy);
    expect(step.parts.rightHand.dy).toBe(step.parts.rightArm.dy);
  });

  it('rotates nothing, because the pixel grid forbids half-pixels', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/bert-walk-frames.ts'),
      'utf8',
    );
    expect(source).not.toContain('rotate');
  });
});
