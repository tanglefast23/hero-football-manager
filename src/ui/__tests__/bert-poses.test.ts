import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BERT_EXPRESSIONS,
  BERT_MOMENTS,
  BERT_POSTURES,
  bertExpressionParts,
  bertHeadOffset,
  bertPostureHidesFace,
  bertPostureLean,
  bertPostureParts,
  type BertExpressionId,
  type BertMomentId,
  type BertPostureId,
} from '../bert-poses';
import { briefingMoments, beatMoment } from '../bert-beat-moments';
import type { BriefingBeat } from '../bert-briefing-beats';

const EXPRESSION_IDS = Object.keys(BERT_EXPRESSIONS) as BertExpressionId[];
const POSTURE_IDS = Object.keys(BERT_POSTURES) as BertPostureId[];
const MOMENT_IDS = Object.keys(BERT_MOMENTS) as BertMomentId[];

function beats(count: number): BriefingBeat[] {
  return Array.from({ length: count }, (_, index) => ({
    text: `beat ${index}`,
    focus: 'assistant' as const,
    kind: 'body' as const,
    pageIndex: 0,
  }));
}

describe('bert pose set', () => {
  it('ships thirty expressions, thirty postures and thirty pairings', () => {
    expect(EXPRESSION_IDS).toHaveLength(30);
    expect(POSTURE_IDS).toHaveLength(30);
    expect(MOMENT_IDS).toHaveLength(30);
  });

  it('draws every expression and posture without a missing part', () => {
    for (const id of EXPRESSION_IDS) {
      const parts = bertExpressionParts(id);
      expect(parts.length).toBeGreaterThan(0);
      for (const rect of parts) {
        expect(rect.width).toBeGreaterThan(0);
        expect(rect.height).toBeGreaterThan(0);
        expect(rect.color).toMatch(/^#[0-9a-f]{6}$/i);
        // Exactly one anchor per axis, or the rectangle is stretched between
        // two edges instead of placed at one.
        expect([rect.left, rect.right].filter(value => value !== undefined)).toHaveLength(1);
        expect([rect.top, rect.bottom].filter(value => value !== undefined)).toHaveLength(1);
      }
    }
    for (const id of POSTURE_IDS) {
      expect(bertPostureParts(id).length).toBeGreaterThan(0);
    }
  });

  it('keeps both eyes clear of the nose in every expression', () => {
    // The shipped StyleSheet paints the nose AFTER the eyes, which clips three
    // of the far eye's five pixels and hides a sideways glance completely.
    // Painting order is the fix, so assert the order rather than the geometry.
    for (const id of EXPRESSION_IDS) {
      const parts = bertExpressionParts(id);
      const nose = parts.findIndex(rect => rect.top === 48 && rect.width === 25);
      const darkest = parts.findIndex(rect => rect.color === '#241f2e');
      expect(nose).toBeGreaterThanOrEqual(0);
      expect(darkest).toBeGreaterThan(nose);
    }
  });

  it('reuses the authored geometry for the neutral standing pairing', () => {
    // Guards against the pose data and the StyleSheet drifting apart: the
    // rectangles below are read straight out of the component.
    const source = readFileSync(join(process.cwd(), 'src/ui/BertFullBody.tsx'), 'utf8');
    const parts = [
      ...bertPostureParts('stand'),
      ...bertExpressionParts('neutral'),
    ];
    const authored = [
      "bertJacket: { position: 'absolute', left: 23, top: 88, width: 60, height: 51",
      "bertTie: { position: 'absolute', left: 49, top: 96, width: 9, height: 35",
      "bertHeadFace: { position: 'absolute', left: 24, top: 27, width: 58, height: 48",
    ];
    for (const line of authored) expect(source).toContain(line);

    expect(parts).toContainEqual(expect.objectContaining({ left: 23, top: 88, width: 60, height: 51 }));
    expect(parts).toContainEqual(expect.objectContaining({ left: 49, top: 96, width: 9, height: 35 }));
    expect(parts).toContainEqual(expect.objectContaining({ left: 24, top: 27, width: 58, height: 48 }));
  });

  it('only hides the face for the pose that turns his back', () => {
    const hidden = POSTURE_IDS.filter(bertPostureHidesFace);
    expect(hidden).toEqual(['walk-off']);
  });

  it('seats the head on the shoulder for the rebuilt postures', () => {
    // Regression: the lying pose left the head floating above the collar.
    expect(bertHeadOffset('lie-prop')).toEqual({ x: 22, y: 40 });
    expect(bertHeadOffset('sit-slump').y).toBeGreaterThan(bertHeadOffset('sit-edge').y);
    expect(bertHeadOffset('stand')).toEqual({ x: 0, y: 0 });
  });

  it('leans only the postures that mean to', () => {
    expect(bertPostureLean('stand')).toBe(0);
    expect(bertPostureLean('lean-in')).toBeLessThan(0);
    expect(bertPostureLean('lean-back')).toBeGreaterThan(0);
  });
});

describe('briefing moment selection', () => {
  it('gives every beat a look', () => {
    expect(briefingMoments('management-intro', beats(5))).toHaveLength(5);
    expect(briefingMoments('unknown-sequence', beats(3))).toHaveLength(3);
    expect(briefingMoments('management-intro', beats(0))).toEqual([]);
  });

  it('never repeats a face on the same body back to back', () => {
    for (const sequenceId of ['management-intro', 'unknown-sequence', 'desk-intro']) {
      const moments = briefingMoments(sequenceId, beats(8));
      for (let index = 1; index < moments.length; index += 1) {
        const previous = BERT_MOMENTS[moments[index - 1]];
        const current = BERT_MOMENTS[moments[index]];
        if (previous.expression === current.expression) {
          expect(current.posture).not.toBe(previous.posture);
        }
      }
    }
  });

  it('does not deliver the needling second line warmly', () => {
    // "Took a high-school team all the way to the national championship, did
    // you? Very impressive." is a dig, and a warm face makes it read as praise.
    const [, second] = briefingMoments('management-intro', beats(5));
    expect(BERT_MOMENTS[second].expression).toBe('sceptical');
  });

  it('extends past an authored run rather than freezing on its last look', () => {
    const authoredLength = briefingMoments('roster-cap', beats(1)).length;
    expect(authoredLength).toBe(1);
    const extended = briefingMoments('roster-cap', beats(4));
    expect(extended).toHaveLength(4);
    expect(new Set(extended).size).toBeGreaterThan(1);
  });

  it('clamps a beat index at either edge', () => {
    const sequence = beats(3);
    expect(beatMoment('management-intro', sequence, -2)).toBe(beatMoment('management-intro', sequence, 0));
    expect(beatMoment('management-intro', sequence, 99)).toBe(beatMoment('management-intro', sequence, 2));
    expect(beatMoment('management-intro', [], 0)).toBeUndefined();
  });
});
