import type { ReactNode } from 'react';
import { assistantBeatsEntry } from './entries/assistant-beats';
import { awardsCeremonyEntry } from './entries/awards-ceremony';
import { boardUltimatumEntry } from './entries/board-ultimatum';
import { careerEventsEntry } from './entries/career-events';
import { cupGiantKillingEntry } from './entries/cup-giant-killing';
import { endgameCelebrationEntry } from './entries/endgame';
import { fulltimeReportEntry } from './entries/fulltime-report';
import { hallOfFameEntry } from './entries/hall-of-fame';
import { playerRequestsEntry } from './entries/player-requests';
import { promotionTransitionEntry } from './entries/promotion-transition';
import { retirementLegacyEntry } from './entries/retirement-legacy';
import type { DevHarnessRoutableEntry } from './route';

/**
 * One reviewable feature in the dev harness.
 *
 * `cases` is the only axis the harness itself owns, and the only one an
 * address can name. It is for the *inputs* a feature can be fed — the states
 * worth a bookmark and a screenshot. Anything a reviewer flips while looking
 * at one of those states (a jump, a speed, a motion toggle) belongs to the
 * entry, drawn by whatever `render` returns; folding those into `cases` would
 * multiply out into a menu nobody can read.
 *
 * `render` is handed a case id the harness has already checked against
 * `cases`, so an entry may narrow it without re-validating.
 */
export interface DevHarnessEntry extends DevHarnessRoutableEntry {
  /** URL-safe and stable: it is half of a bookmark. */
  readonly id: string;
  /** The menu section this sits under, e.g. 'Season'. */
  readonly group: string;
  readonly title: string;
  /** One line: what you are looking at. Shown on the menu row. */
  readonly summary: string;
  readonly cases: readonly DevHarnessCase[];
  readonly render: (caseId: string) => ReactNode;
}

export interface DevHarnessCase {
  readonly id: string;
  readonly label: string;
  /** What this case is for, if the label cannot carry it. */
  readonly note?: string;
}

/**
 * Every feature the harness can show, in menu order.
 *
 * A plain array on purpose: adding a feature is one import and one line here.
 * Nothing registers itself, so this file is the whole answer to "what is in
 * the harness".
 */
export const DEV_HARNESS_ENTRIES: readonly DevHarnessEntry[] = Object.freeze([
  // Ordered so the menu reads as a career does: what happens during a season,
  // then what closes one, then the two ends of the whole climb.
  fulltimeReportEntry,
  careerEventsEntry,
  playerRequestsEntry,
  boardUltimatumEntry,
  cupGiantKillingEntry,
  promotionTransitionEntry,
  retirementLegacyEntry,
  awardsCeremonyEntry,
  endgameCelebrationEntry,
  hallOfFameEntry,
  assistantBeatsEntry,
]);
