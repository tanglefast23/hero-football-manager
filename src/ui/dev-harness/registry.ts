import type { ReactNode } from 'react';
import { assistantBeatsEntry } from './entries/assistant-beats';
import { contractRenewalEntry } from './entries/contract-renewal';
import { awardsCeremonyEntry } from './entries/awards-ceremony';
import { boardUltimatumEntry } from './entries/board-ultimatum';
import { careerEventsEntry } from './entries/career-events';
import { clubBusinessEntry } from './entries/club-business';
import { cupGiantKillingEntry } from './entries/cup-giant-killing';
import { cupMismatchWarningEntry } from './entries/cup-mismatch-warning';
import { endgameCelebrationEntry } from './entries/endgame';
import { financialReportEntry } from './entries/financial-report';
import { fulltimeReportEntry } from './entries/fulltime-report';
import { hallOfFameEntry } from './entries/hall-of-fame';
import { playerRequestsEntry } from './entries/player-requests';
import { promotionTransitionEntry } from './entries/promotion-transition';
import { retirementLegacyEntry } from './entries/retirement-legacy';
import { rivalHeroIntroEntry } from './entries/rival-hero-intro';
import { seasonPodiumEntry } from './entries/season-podium';
import { squadSortHintEntry } from './entries/squad-sort-hint';
import { liveMatchControlsEntry } from './entries/live-match-controls';
import { matchVfxEntry } from './entries/match-vfx';
import { midseasonTrainingEntry } from './entries/midseason-training';
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
  rivalHeroIntroEntry,
  financialReportEntry,
  clubBusinessEntry,
  careerEventsEntry,
  playerRequestsEntry,
  liveMatchControlsEntry,
  matchVfxEntry,
  midseasonTrainingEntry,
  squadSortHintEntry,
  boardUltimatumEntry,
  cupMismatchWarningEntry,
  cupGiantKillingEntry,
  promotionTransitionEntry,
  retirementLegacyEntry,
  // The order a season closes in: the podium, then the boards.
  seasonPodiumEntry,
  awardsCeremonyEntry,
  endgameCelebrationEntry,
  hallOfFameEntry,
  assistantBeatsEntry,
  contractRenewalEntry,
]);
