import type {
  AssistantGuideContent,
  AssistantGuideFocus,
} from '../content/schemas';

/**
 * A briefing sequence, flattened into the beats Bert speaks.
 *
 * The framed window showed a whole page at once and stepped page by page. A
 * walk-on says one thing at a time, so a sequence has to become a flat list —
 * one beat per paragraph, plus the page's objective if it has one.
 *
 * Beats are structured rather than two arrays kept in lockstep: the spotlight
 * needs the focus, the voice needs the text, the bubble needs to know an
 * objective from flavour, and a pair of parallel arrays is one careless
 * `filter` away from misaligning all three.
 */
export interface BriefingBeat {
  readonly text: string;
  readonly focus: AssistantGuideFocus;
  /** Objectives are styled apart — it is the one line stating the next move. */
  readonly kind: 'body' | 'objective';
  /** Which page it came from, for the concierge handoff on completion. */
  readonly pageIndex: number;
}

/**
 * The schema allows 4 pages of up to 2 paragraphs, each with an optional
 * objective, so no sequence can exceed this. Real content peaks at five beats
 * (`management-intro`); the other 23 flatten to two or fewer.
 */
export const MAX_BRIEFING_BEATS = 12;

export function briefingBeats(
  content: AssistantGuideContent,
  sequenceId: string,
): readonly BriefingBeat[] {
  const sequence = content.sequences.find(candidate => candidate.id === sequenceId);
  if (sequence === undefined) return [];

  const beats: BriefingBeat[] = [];
  sequence.pages.forEach((page, pageIndex) => {
    for (const paragraph of page.body) {
      beats.push({ text: paragraph, focus: page.focus, kind: 'body', pageIndex });
    }
    // Last within its page, so the instruction lands after the reasoning for it
    // rather than before.
    if (page.objective !== undefined) {
      beats.push({ text: page.objective, focus: page.focus, kind: 'objective', pageIndex });
    }
  });
  return beats;
}

/**
 * The focus that should be lit while a given beat shows.
 *
 * There is no active beat during the entrance and exit walks, so the first and
 * last beats' focus is held across them. Letting the spotlight fall back to a
 * plain dim for the length of a walk would flash the cutout off and on around
 * every briefing.
 */
export function beatFocus(
  beats: readonly BriefingBeat[],
  index: number,
): AssistantGuideFocus | undefined {
  if (beats.length === 0) return undefined;
  const clamped = Math.min(Math.max(index, 0), beats.length - 1);
  return beats[clamped].focus;
}
