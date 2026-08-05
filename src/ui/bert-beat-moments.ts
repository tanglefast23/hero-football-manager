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
  // He is physically in the way of the button, so the first beat is the hand
  // up rather than a pointed finger — he is not directing traffic, he is
  // stopping it. The second beat has to change the face as well as the words,
  // because a joke delivered by the look that just refused you reads as
  // sarcasm; `teasing` is the one that lands it as sympathy.
  'inbox-duty-reminder': ['hold-on', 'teasing'],
  // The format is the good news; the second beat just points at the page that
  // will carry the scores, so it lands as instruction rather than more fanfare.
  'national-cup': ['celebrating', 'pointing-out'],
  // The other end of the same competition. He takes the defeat on the chin
  // first — `bad-news` winces and sags, which is a man agreeing with you that
  // it hurt — and only then leans in to promise giants. Delivering the promise
  // on the wincing face would make it sound like he did not believe it, and
  // delivering the loss on the encouraging one would make him a salesman.
  'first-cup-exit': ['bad-news', 'encouraging'],
  // Dressing-room gossip, then he points at the tab that will carry it.
  'player-requests': ['confiding', 'pointing-out'],

  // The eight below were unauthored and fell through to DEFAULT_RUN. Seven are
  // a single page, so they never reached past its first face and every one of
  // them was delivered with `explaining` — the face for walking you through the
  // scouting screen. Every authored beat above teaches something; every beat
  // that was missed breaks something to you. That is not a coincidence, and it
  // is why they were the wrong ones to leave on the default.
  //
  // Each takes a distinct posture as well as a distinct face: they never share
  // a briefing, but they arrive in the same career, and a run of identical
  // shapes reads as one stock reaction to four different pieces of news.
  'first-injury': ['alarmed'],
  'first-emergency-loan': ['warning-money'],
  'first-transfer-request': ['disapproving'],
  // Gentle rather than grave. A career ending is sad, not a disaster, and
  // `bad-news` winces where `very-bad-news` would be covering its face.
  'retirement': ['bad-news'],
  // A legend's last decision is an honour to hand out, not a loss to absorb.
  'club-legacy': ['confiding'],
  // The board's four-week deadline, which is the hardest thing it ever says.
  'board-ultimatum': ['warning-hard'],
  // There is a way out of the forced sale — he is stopping you to show you it.
  'board-protection': ['hold-on'],
  // The one piece of good news here: explain the boards, then send you after one.
  'division-leaders': ['explaining', 'encouraging'],

  // The two board money rows, said in full on the finances screen. Both open on
  // the number, harden on what the board does about it, and end pointing at the
  // only move that fixes it — a building that earns. The middle face is the
  // difference between the pair: the warning is a threat he is passing on, the
  // loan is a rescue that has already been spent, so `warning-hard` carries the
  // first and `pointing-up` carries the one detail that will not come again.
  'board-financial-warning': ['warning-money', 'warning-hard', 'pointing-out'],
  'board-emergency-loan': ['warning-money', 'pointing-up', 'pointing-out'],

  // Club Business arrives as three different moods: terms to compare, calm
  // reassurance that existing income is safe, then the good news that the club
  // is famous enough for Buzz. They are single-page briefings, so each needs a
  // deliberate first look rather than the generic `explaining` fallback.
  'sponsor-desk': ['listing'],
  'sponsor-desk-continuity': ['encouraging'],
  'sponsor-buzz': ['celebrating'],

  // The crowd is the first thing the club earns that is not money, so it opens
  // as a celebration and then turns into the lesson about what it pays for.
  'first-fans': ['celebrating', 'explaining'],
  // The ledger. He lets you in on the joke that only the smart ones read this
  // page, talks you into being one of them, then points at the way out.
  'first-fans-ledger': ['confiding', 'encouraging', 'pointing-out'],
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
