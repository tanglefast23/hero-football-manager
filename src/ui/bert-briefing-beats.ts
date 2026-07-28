import type {
  AssistantGuideContent,
  AssistantGuideFocus,
} from '../content/schemas';

/**
 * A briefing sequence, flattened into the beats Bert speaks.
 *
 * The framed window showed a whole page at once and stepped page by page. A
 * briefing says one thing at a time, so a sequence has to become a flat list —
 * one beat per explanatory paragraph. Page objectives remain in the content
 * for tutorial progression, but the tooltip already presents the next action.
 *
 * Beats are structured rather than two arrays kept in lockstep: the spotlight
 * needs the focus and the voice needs the text; a pair of parallel arrays is
 * one careless `filter` away from misaligning them.
 */
export interface BriefingBeat {
  readonly text: string;
  readonly focus: AssistantGuideFocus;
  readonly kind: 'body';
  /** Which page it came from, for the concierge handoff on completion. */
  readonly pageIndex: number;
}

/**
 * The schema allows 4 pages of up to 2 paragraphs, so no sequence can exceed
 * this. Real content peaks at five beats (`management-intro`); the other 23
 * flatten to two or fewer.
 */
export const MAX_BRIEFING_BEATS = 8;

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
  });
  return beats;
}

/**
 * The focus that should be lit while a given beat shows.
 *
 * Clamp out-of-range indices so a transition at either edge keeps the nearest
 * meaningful focus instead of flashing the spotlight off.
 */
export function beatFocus(
  beats: readonly BriefingBeat[],
  index: number,
): AssistantGuideFocus | undefined {
  if (beats.length === 0) return undefined;
  const clamped = Math.min(Math.max(index, 0), beats.length - 1);
  return beats[clamped].focus;
}
