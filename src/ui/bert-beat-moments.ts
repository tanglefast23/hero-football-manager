import type { BertMomentId } from './bert-poses';
import { BERT_MOMENTS } from './bert-poses';
import type { BriefingBeat } from './bert-briefing-beats';

/**
 * Which of Bert's thirty looks plays on each beat of a briefing.
 *
 * Authored rather than inferred. A keyword classifier over the copy would be
 * guessing at tone from vocabulary — "cup" is exciting, "wage" is grim — and
 * gets the interesting cases exactly backwards, because the copy that needs a
 * warning face rarely contains a warning word. These are read and matched.
 *
 * Sequences absent from this map fall through to `defaultMoments`, which is
 * shaped by the same rules rather than repeating one face down the sequence.
 */
const AUTHORED: Record<string, readonly BertMomentId[]> = {
  // "So. You're the new manager." / "Took a high-school team all the way to the
  // national championship, did you? Very impressive." — the second line is
  // needling, not admiring, so it must not be delivered warmly.
  'management-intro': ['hello', 'sizing-you-up', 'warning-money', 'shrugging', 'pointing-out'],
  'desk-intro': ['pointing-out', 'encouraging'],
  'head-coach-market': ['explaining'],
  'head-coach-hire': ['listing'],
  'coaching-office': ['pointing-out'],
  'assistant-coach-hire': ['listing'],
  'facility-placement': ['explaining'],
  'facility-upgrade': ['listing'],
  'facility-adjacency': ['confiding'],
  'scout-mission': ['explaining'],
  'scout-report': ['listing'],
  // The squad is full and someone has to go — bad news, not instruction.
  'roster-cap': ['bad-news'],
  'transfer-list': ['explaining'],
  'transfer-bid': ['hold-on'],
  'transfer-negotiation': ['listing'],
  'youth-intake': ['encouraging'],
  // The format is the good news; the second beat just points at the page that
  // will carry the scores, so it lands as instruction rather than more fanfare.
  'national-cup': ['celebrating', 'pointing-out'],
  // Dressing-room gossip, then he points at the tab that will carry it.
  'player-requests': ['confiding', 'pointing-out'],
};

/**
 * The fallback run, in order. Deliberately not one repeated face: a briefing
 * opens by addressing you, explains the thing, then points at what to do.
 */
const DEFAULT_RUN: readonly BertMomentId[] = [
  'explaining',
  'pointing-out',
  'listing',
  'encouraging',
];

function defaultMoments(count: number): BertMomentId[] {
  return Array.from({ length: count }, (_, index) => DEFAULT_RUN[index % DEFAULT_RUN.length]);
}

/**
 * Never let the same face land twice in a row wearing the same body.
 *
 * The owner's rule: a repeated expression is fine when it genuinely fits, but
 * it has to be carried on a different posture so the two beats still read as
 * two beats. Authoring can and does repeat a face; this is what keeps the
 * repeat from also repeating the pose.
 */
function varyRepeats(moments: readonly BertMomentId[]): BertMomentId[] {
  const varied: BertMomentId[] = [];
  moments.forEach((moment, index) => {
    const previous = varied[index - 1];
    if (previous === undefined || BERT_MOMENTS[previous].expression !== BERT_MOMENTS[moment].expression) {
      varied.push(moment);
      return;
    }
    const alternative = (Object.keys(BERT_MOMENTS) as BertMomentId[]).find(candidate => (
      BERT_MOMENTS[candidate].expression === BERT_MOMENTS[moment].expression
      && BERT_MOMENTS[candidate].posture !== BERT_MOMENTS[previous].posture
    ));
    varied.push(alternative ?? moment);
  });
  return varied;
}

/** The look for every beat of a sequence, in order. */
export function briefingMoments(
  sequenceId: string,
  beats: readonly BriefingBeat[],
): BertMomentId[] {
  if (beats.length === 0) return [];
  const authored = AUTHORED[sequenceId];
  const chosen = authored === undefined
    ? defaultMoments(beats.length)
    // Authored runs are matched to the copy as it stood. Copy outlives its
    // pairing, so a longer sequence extends with the fallback rather than
    // silently reusing the last look for everything after it.
    : [...authored.slice(0, beats.length), ...defaultMoments(Math.max(0, beats.length - authored.length))];
  return varyRepeats(chosen);
}

/** The look for one beat; clamped so an edge transition keeps the nearest. */
export function beatMoment(
  sequenceId: string,
  beats: readonly BriefingBeat[],
  index: number,
): BertMomentId | undefined {
  const moments = briefingMoments(sequenceId, beats);
  if (moments.length === 0) return undefined;
  return moments[Math.min(Math.max(index, 0), moments.length - 1)];
}
