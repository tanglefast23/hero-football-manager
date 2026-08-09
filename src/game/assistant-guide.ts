import type { AssistantMode, GameState } from './types';
import { highestDivisionReached } from './promotion-progression';

/**
 * Whether Bert is teaching this career.
 *
 * This is the only comparison against the persisted mode. Keeping the decision
 * here makes every teaching surface discoverable by searching for this helper.
 */
export function assistantTeaches(
  state: Pick<GameState, 'assistantMode'>,
): boolean {
  return (state.assistantMode ?? 'teacher') === 'teacher';
}

export type { AssistantMode };

export const M2_ASSISTANT_GUIDE_SEQUENCE_IDS = [
  'head-coach-market',
  'head-coach-hire',
  'coaching-office',
  'assistant-coach-hire',
  'facility-placement',
  'facility-upgrade',
  'facility-adjacency',
  'scout-mission',
  'scout-report',
  'roster-cap',
  'transfer-list',
  'transfer-bid',
  'transfer-negotiation',
  'youth-intake',
  'national-cup',
  'division-leaders',
  'sponsor-desk',
  'sponsor-desk-continuity',
  'sponsor-buzz',
  'player-requests',
  'first-injury',
  'first-emergency-loan',
  'first-transfer-request',
  'retirement',
  'club-legacy',
  'board-ultimatum',
  'board-protection',
] as const;

export type AssistantInboxGuideSequenceId =
  (typeof M2_ASSISTANT_GUIDE_SEQUENCE_IDS)[number];

export type AssistantGuideSequenceId =
  | 'management-intro'
  | 'desk-intro'
  /** Delivered by the season review, not the weekly desk — see the milestone. */
  | 'expired-contract'
  | AssistantInboxGuideSequenceId;

export type AssistantGuideMilestone =
  | 'intro-complete'
  | 'first-training-complete'
  | 'desk-intro-complete'
  | 'first-week-advanced'
  /** Bert explains the condition gamble once per career, then stays out of it. */
  | 'condition-warning-seen'
  /** Bert explains the first Below Peak starter on matchday once per career. */
  | 'match-condition-warning-seen'
  /** The Quick Train lesson: tap an attribute to train it. Shown once. */
  | 'quick-train-seen'
  /** The Week 12 roster lesson: tap a column header to sort. Shown once. */
  | 'squad-sort-seen'
  /**
   * Why a scouted player cannot be signed today. Said once, the first time the
   * manager is holding reports with the registration desk shut — the report is
   * the permission to negotiate, and the window is when negotiating is allowed.
   */
  | 'transfer-window-seen'
  /** One concise discovery line per secret facility pairing. */
  | 'facility-combo-gym-dorm-seen'
  | 'facility-combo-fan-shop-stadium-seen'
  | 'facility-combo-medical-training-pitch-seen'
  /**
   * Bert takes the sting out of the first Cup exit, then never mentions it
   * again — being knocked out is the ordinary shape of a knockout competition,
   * and a gaffer who consoles you every season is a nag.
   */
  | 'first-cup-exit-seen'
  /**
   * The first crowd the club ever wins. Two beats, one per screen: the
   * congratulations on the desk, then the ledger he walks you to. Held apart so
   * a career that closes between them resumes on the board it still owes.
   */
  | 'first-fans-seen'
  | 'first-fans-ledger-seen'
  /**
   * The first expired contract the season review ever puts in front of the
   * manager. Every season ends with this queue, and the three doors out of it —
   * release, sign at the ask, talk the ask down — are the only place in the
   * game where walking away is one of the buttons. Said once, on the screen
   * that is asking.
   */
  | 'expired-contract-seen';

type AssistantInboxProductAlertPriority = 'urgent' | 'normal';

interface AssistantInboxProductAlert {
  readonly id: string;
  readonly priority: AssistantInboxProductAlertPriority;
  /** One-shot notices stay queued across save/load until a weekly slot opens. */
  readonly oneShot?: boolean;
}

interface AssistantInboxWeekOptions {
  /** Newly relevant firsts. Queuing the same sequence repeatedly is harmless. */
  readonly dueGuideSequenceIds?: readonly AssistantInboxGuideSequenceId[];
  /**
   * Guides that stay queued this week instead of being delivered — for beats the
   * player cannot action yet. They are not consumed, so they arrive in the first
   * week that clears them.
   */
  readonly heldGuideSequenceIds?: readonly AssistantInboxGuideSequenceId[];
  /** Live product alerts. Urgent items outrank guides; normal items follow them. */
  readonly productAlerts?: readonly AssistantInboxProductAlert[];
}

interface AssistantInboxWeekPlan {
  readonly state: GameState;
  readonly season: number;
  readonly week: number;
  readonly productAlertIds: readonly string[];
  readonly guideSequenceIds: readonly AssistantInboxGuideSequenceId[];
  readonly deferredProductAlertIds: readonly string[];
  readonly deferredGuideSequenceIds: readonly AssistantInboxGuideSequenceId[];
}

const MAX_ASSISTANT_INBOX_ITEMS_PER_WEEK = 3;

const FLAG_BY_MILESTONE: Readonly<Record<AssistantGuideMilestone, string>> = {
  'intro-complete': 'guide:bert:intro-complete',
  'first-training-complete': 'guide:bert:first-training-complete',
  'desk-intro-complete': 'guide:bert:desk-intro-complete',
  'first-week-advanced': 'guide:bert:first-week-advanced',
  'condition-warning-seen': 'guide:bert:condition-warning-seen',
  'match-condition-warning-seen': 'guide:bert:match-condition-warning-seen',
  'quick-train-seen': 'guide:bert:quick-train-seen',
  'squad-sort-seen': 'guide:bert:squad-sort-seen',
  'transfer-window-seen': 'guide:bert:transfer-window-seen',
  'facility-combo-gym-dorm-seen': 'guide:bert:facility-combo-gym-dorm-seen',
  'facility-combo-fan-shop-stadium-seen':
    'guide:bert:facility-combo-fan-shop-stadium-seen',
  'facility-combo-medical-training-pitch-seen':
    'guide:bert:facility-combo-medical-training-pitch-seen',
  'first-cup-exit-seen': 'guide:bert:first-cup-exit-seen',
  'first-fans-seen': 'guide:bert:first-fans-seen',
  'first-fans-ledger-seen': 'guide:bert:first-fans-ledger-seen',
  'expired-contract-seen': 'guide:bert:expired-contract-seen',
};

const MILESTONE_BY_SEQUENCE: Readonly<
  Partial<Record<AssistantGuideSequenceId, AssistantGuideMilestone>>
> = {
  'management-intro': 'intro-complete',
  'desk-intro': 'desk-intro-complete',
  // The three screen-delivered sequences all record completion as a milestone.
  // Only the inbox ones carry a per-sequence flag, because only they have a
  // queue that has to stop re-offering them.
  'expired-contract': 'expired-contract-seen',
};

const M2_SEQUENCE_IDS = new Set<string>(M2_ASSISTANT_GUIDE_SEQUENCE_IDS);
const SEQUENCE_COMPLETE_PREFIX = 'guide:bert:sequence-complete:';
const INBOX_QUEUED_PREFIX = 'guide:bert:inbox:queued:';
const INBOX_DELIVERED_PREFIX = 'guide:bert:inbox:delivered:';
const INBOX_ADVISOR_SUPPRESSED_PREFIX = 'guide:bert:inbox:advisor-suppressed:';
const INBOX_PENDING_PRODUCT_PREFIX = 'guide:bert:inbox:pending-product:';
const INBOX_ACKNOWLEDGED_PRODUCT_PREFIX =
  'guide:bert:inbox:acknowledged-product:';
const INBOX_DISMISSED_PRODUCT_PREFIX = 'guide:bert:inbox:dismissed-product:';
const INBOX_PERMANENTLY_DISMISSED_PRODUCT_PREFIX =
  'guide:bert:inbox:permanently-dismissed-product:';
const SPONSOR_DESK_FIRST_DELIVERY_PREFIX =
  'guide:bert:sponsor-desk:first-delivered:';
const MAX_PERSISTED_ONE_SHOT_PRODUCT_FLAGS = 24;
const SPONSOR_DESK_INTRO_SEQUENCE_IDS = [
  'sponsor-desk',
  'sponsor-desk-continuity',
] as const satisfies readonly AssistantInboxGuideSequenceId[];

export function hasAssistantGuideMilestone(
  state: Pick<GameState, 'eventFlags'>,
  milestone: AssistantGuideMilestone,
): boolean {
  return state.eventFlags.includes(FLAG_BY_MILESTONE[milestone]);
}

export const SQUAD_SORT_HINT_WEEK = 12;

/** Eligible from Season 1 Week 12 until the first completed Squad-screen tap. */
export function shouldShowSquadSortHint(
  state: Pick<GameState, 'eventFlags' | 'season' | 'week'>,
): boolean {
  if (hasAssistantGuideMilestone(state, 'squad-sort-seen')) return false;
  return (
    state.season > 1 ||
    (state.season === 1 && state.week >= SQUAD_SORT_HINT_WEEK)
  );
}

export function completeAssistantGuideMilestone(
  state: GameState,
  milestone: AssistantGuideMilestone,
): GameState {
  const flag = FLAG_BY_MILESTONE[milestone];
  if (state.eventFlags.includes(flag)) return state;
  return { ...state, eventFlags: [...state.eventFlags, flag] };
}

export function hasAssistantGuideSequenceCompleted(
  state: Pick<GameState, 'eventFlags'>,
  sequenceId: AssistantGuideSequenceId,
): boolean {
  if (isSponsorDeskIntroSequenceId(sequenceId)) {
    return SPONSOR_DESK_INTRO_SEQUENCE_IDS.some((candidate) =>
      state.eventFlags.includes(sequenceCompletionFlag(candidate)),
    );
  }
  const milestone = MILESTONE_BY_SEQUENCE[sequenceId];
  return milestone === undefined
    ? state.eventFlags.includes(sequenceCompletionFlag(sequenceId))
    : hasAssistantGuideMilestone(state, milestone);
}

export function completeAssistantGuideSequence(
  state: GameState,
  sequenceId: AssistantGuideSequenceId,
): GameState {
  if (
    isSponsorDeskIntroSequenceId(sequenceId) &&
    hasAssistantGuideSequenceCompleted(state, sequenceId)
  ) {
    return state;
  }
  const milestone = MILESTONE_BY_SEQUENCE[sequenceId];
  if (milestone !== undefined)
    return completeAssistantGuideMilestone(state, milestone);
  if (
    sequenceId === 'facility-placement' &&
    !state.facilities.trainingGroundBuilt
  ) {
    return state;
  }
  const flag = sequenceCompletionFlag(sequenceId);
  if (state.eventFlags.includes(flag)) return state;
  return { ...state, eventFlags: [...state.eventFlags, flag] };
}

/**
 * Persists relevant firsts in insertion order. Completion wins over stale queue
 * flags, so old saves and repeated application reconciliation stay idempotent.
 */
export function queueAssistantGuideSequences(
  state: GameState,
  sequenceIds: readonly AssistantInboxGuideSequenceId[],
): GameState {
  let eventFlags = state.eventFlags;
  for (const sequenceId of sequenceIds) {
    assertM2SequenceId(sequenceId);
    if (hasAssistantGuideSequenceCompleted({ eventFlags }, sequenceId))
      continue;
    const flag = queuedSequenceFlag(sequenceId);
    if (eventFlags.includes(flag)) continue;
    if (eventFlags === state.eventFlags) eventFlags = [...eventFlags];
    eventFlags.push(flag);
  }
  return eventFlags === state.eventFlags ? state : { ...state, eventFlags };
}

export function queueAssistantGuideSequence(
  state: GameState,
  sequenceId: AssistantInboxGuideSequenceId,
): GameState {
  return queueAssistantGuideSequences(state, [sequenceId]);
}

/** Repairs guides that were exposed before their feature unlock. */
export function deferAssistantGuideSequencesUntilUnlock(
  state: GameState,
  sequenceIds: readonly AssistantInboxGuideSequenceId[],
): GameState {
  const ids = new Set(sequenceIds);
  for (const sequenceId of ids) assertM2SequenceId(sequenceId);
  const resetsSponsorDeskDelivery =
    ids.has('sponsor-desk') && ids.has('sponsor-desk-continuity');
  const nextFlags = state.eventFlags.filter((flag) => {
    if (
      resetsSponsorDeskDelivery &&
      flag.startsWith(SPONSOR_DESK_FIRST_DELIVERY_PREFIX)
    ) {
      return false;
    }
    for (const sequenceId of ids) {
      if (flag === queuedSequenceFlag(sequenceId)) return false;
      if (flag === sequenceCompletionFlag(sequenceId)) return false;
      if (
        flag.startsWith(INBOX_DELIVERED_PREFIX) &&
        flag.endsWith(`guide:${sequenceId}`)
      )
        return false;
    }
    return true;
  });
  return arraysEqual(nextFlags, state.eventFlags)
    ? state
    : { ...state, eventFlags: nextFlags };
}

export function pendingAssistantInboxGuideSequences(
  state: Pick<GameState, 'eventFlags'>,
): AssistantInboxGuideSequenceId[] {
  const pending: AssistantInboxGuideSequenceId[] = [];
  const seen = new Set<AssistantInboxGuideSequenceId>();
  for (const flag of state.eventFlags) {
    if (!flag.startsWith(INBOX_QUEUED_PREFIX)) continue;
    const sequenceId = flag.slice(INBOX_QUEUED_PREFIX.length);
    if (!isM2SequenceId(sequenceId) || seen.has(sequenceId)) continue;
    seen.add(sequenceId);
    if (!hasAssistantGuideSequenceCompleted(state, sequenceId))
      pending.push(sequenceId);
  }
  return pending;
}

/**
 * Restores every hidden Advisor guide to the ordinary queue.
 *
 * Suppression is separate from completion: changing back to Teacher is an
 * explicit request for the accepted backlog, so its queued flags stay intact.
 */
export function clearAdvisorAssistantInboxSuppressions(
  state: GameState,
): GameState {
  const eventFlags = state.eventFlags.filter(
    (flag) => !flag.startsWith(INBOX_ADVISOR_SUPPRESSED_PREFIX),
  );
  return arraysEqual(eventFlags, state.eventFlags)
    ? state
    : { ...state, eventFlags };
}

/** True until a one-shot notice has been scheduled, plus the week it is visible. */
export function isAssistantInboxOneShotProductVisible(
  state: Pick<GameState, 'eventFlags' | 'season' | 'week'>,
  alertId: string,
): boolean {
  const acknowledged = state.eventFlags.includes(
    acknowledgedProductFlag(alertId),
  );
  return (
    !acknowledged ||
    state.eventFlags.includes(
      productDeliveryFlag(state.season, state.week, alertId),
    )
  );
}

/** True after the manager has finished this product alert's talk this week. */
export function isAssistantInboxProductDismissedForCurrentWeek(
  state: Pick<GameState, 'eventFlags' | 'season' | 'week'>,
  alertId: string,
): boolean {
  return state.eventFlags.includes(
    dismissedProductFlag(state.season, state.week, alertId),
  );
}

/**
 * Removes a read product alert from this week's desk without hiding a genuinely
 * new occurrence next week. The flag lives in the career save, so leaving the
 * page or reopening the app cannot resurrect a conversation already finished.
 */
export function dismissAssistantInboxProductForCurrentWeek(
  state: GameState,
  alertId: string,
): GameState {
  validateCareerWeek(state.season, state.week);
  if (alertId.trim().length === 0) {
    throw new Error(
      'assistant inbox product alert IDs must be non-empty strings',
    );
  }
  const currentPrefix = inboxDismissalWeekPrefix(state.season, state.week);
  const flag = dismissedProductFlag(state.season, state.week, alertId);
  const eventFlags = state.eventFlags.filter(
    (existing) =>
      !existing.startsWith(INBOX_DISMISSED_PRODUCT_PREFIX) ||
      existing.startsWith(currentPrefix),
  );
  if (!eventFlags.includes(flag)) eventFlags.push(flag);
  return arraysEqual(eventFlags, state.eventFlags)
    ? state
    : { ...state, eventFlags };
}

/** True after a one-time product lesson has completed its final hand-off. */
export function isAssistantInboxProductPermanentlyDismissed(
  state: Pick<GameState, 'eventFlags'>,
  alertId: string,
): boolean {
  return state.eventFlags.includes(permanentlyDismissedProductFlag(alertId));
}

/** Retires a product lesson for the rest of this career. */
export function dismissAssistantInboxProductPermanently(
  state: GameState,
  alertId: string,
): GameState {
  if (alertId.trim().length === 0) {
    throw new Error(
      'assistant inbox product alert IDs must be non-empty strings',
    );
  }
  const flag = permanentlyDismissedProductFlag(alertId);
  if (state.eventFlags.includes(flag)) return state;
  return { ...state, eventFlags: [...state.eventFlags, flag] };
}

/**
 * Produces the persisted weekly inbox tranche. At most three items are visible:
 * urgent product alerts first, then Bert firsts, then ordinary product notices.
 * A fourth guide remains queued for a later week even if this week's three are
 * opened immediately. Newly arriving urgent alerts may displace a guide.
 */
export function scheduleAssistantInboxWeek(
  inputState: GameState,
  options: AssistantInboxWeekOptions = {},
): AssistantInboxWeekPlan {
  validateCareerWeek(inputState.season, inputState.week);
  const productAlerts = validateProductAlerts(options.productAlerts ?? []);
  const intrinsicallyHeld = intrinsicallyHeldGuideSequences(inputState);
  let state = pruneOldInboxDeliveryFlags(inputState);
  const previouslyPendingOneShots = pendingOneShotProductAlerts(state);
  state = queueAssistantGuideSequences(
    state,
    options.dueGuideSequenceIds ?? [],
  );
  state = queueOneShotProductAlerts(state, productAlerts);

  const held = [...(options.heldGuideSequenceIds ?? []), ...intrinsicallyHeld];
  const currentDeliveryPrefix = inboxDeliveryWeekPrefix(
    state.season,
    state.week,
  );
  const deliveredFlags = new Set(
    state.eventFlags.filter((flag) => flag.startsWith(currentDeliveryPrefix)),
  );
  const queuedGuides = pendingAssistantInboxGuideSequences(state)
    .filter((sequenceId) => !held.includes(sequenceId))
    .filter(
      (sequenceId) =>
        assistantTeaches(state) ||
        !state.eventFlags.includes(advisorSuppressedGuideFlag(sequenceId)) ||
        // Repeated reconciliation in the delivery week must see the same logical
        // desk. The suppression begins only when the next week opens.
        deliveredFlags.has(
          guideDeliveryFlag(state.season, state.week, sequenceId),
        ),
    );
  const effectiveProductAlerts = mergeProductAlerts([
    ...productAlerts
      .filter(
        (alert) =>
          alert.oneShot === true &&
          deliveredFlags.has(
            productDeliveryFlag(state.season, state.week, alert.id),
          ),
      )
      .map((alert) => ({ ...alert, priority: 'urgent' as const })),
    ...(deliveredFlags.size === 0
      ? previouslyPendingOneShots.map((alert) => ({
          ...alert,
          priority: 'urgent' as const,
        }))
      : []),
    ...productAlerts.filter(
      (alert) =>
        !alert.oneShot ||
        !state.eventFlags.includes(acknowledgedProductFlag(alert.id)) ||
        deliveredFlags.has(
          productDeliveryFlag(state.season, state.week, alert.id),
        ),
    ),
    ...pendingOneShotProductAlerts(state),
    ...(deliveredFlags.size === 0 ? [] : previouslyPendingOneShots),
  ]);
  const remainingNewSlots = Math.max(
    0,
    MAX_ASSISTANT_INBOX_ITEMS_PER_WEEK - deliveredFlags.size,
  );

  const urgentProducts = effectiveProductAlerts.filter(
    (alert) => alert.priority === 'urgent',
  );
  const normalProducts = effectiveProductAlerts.filter(
    (alert) => alert.priority === 'normal',
  );
  const activeDeliveredGuides = queuedGuides.filter((sequenceId) =>
    deliveredFlags.has(guideDeliveryFlag(state.season, state.week, sequenceId)),
  );
  const activeDeliveredProducts = effectiveProductAlerts.filter((alert) =>
    deliveredFlags.has(productDeliveryFlag(state.season, state.week, alert.id)),
  );

  const ordinaryUndelivered = [
    ...queuedGuides
      .filter(
        (sequenceId) =>
          !deliveredFlags.has(
            guideDeliveryFlag(state.season, state.week, sequenceId),
          ),
      )
      .map((sequenceId, order) => guideCandidate(sequenceId, order)),
    ...normalProducts
      .filter(
        (alert) =>
          !deliveredFlags.has(
            productDeliveryFlag(state.season, state.week, alert.id),
          ),
      )
      .map((alert, order) => productCandidate(alert, order)),
  ].slice(0, remainingNewSlots);

  const candidates = [
    ...urgentProducts.map((alert, order) => productCandidate(alert, order)),
    ...activeDeliveredGuides.map((sequenceId, order) =>
      guideCandidate(sequenceId, order),
    ),
    ...activeDeliveredProducts.map((alert, order) =>
      productCandidate(alert, order),
    ),
    ...ordinaryUndelivered,
  ];
  const uniqueCandidates = uniqueInboxCandidates(candidates).sort(
    (left, right) => left.rank - right.rank || left.order - right.order,
  );
  const selected = uniqueCandidates.slice(
    0,
    MAX_ASSISTANT_INBOX_ITEMS_PER_WEEK,
  );

  const deliveryFlags = selected.map((candidate) =>
    candidate.kind === 'guide'
      ? guideDeliveryFlag(state.season, state.week, candidate.id)
      : productDeliveryFlag(state.season, state.week, candidate.id),
  );
  state = appendMissingFlags(state, deliveryFlags);
  state = recordFirstSponsorDeskDelivery(state, selected);
  const selectedOneShots = selected.flatMap((candidate) => {
    if (candidate.kind !== 'product') return [];
    const alert = effectiveProductAlerts.find(
      (item) => item.id === candidate.id,
    );
    return alert?.oneShot ? [alert.id] : [];
  });
  state = acknowledgeOneShotProducts(state, selectedOneShots);

  const guideSequenceIds = selected.flatMap((candidate) =>
    candidate.kind === 'guide'
      ? [candidate.id as AssistantInboxGuideSequenceId]
      : [],
  );
  if (!assistantTeaches(state)) {
    state = appendMissingFlags(
      state,
      guideSequenceIds.map(advisorSuppressedGuideFlag),
    );
  }
  const productAlertIds = selected.flatMap((candidate) =>
    candidate.kind === 'product' ? [candidate.id] : [],
  );
  const selectedGuides = new Set(guideSequenceIds);
  const selectedProducts = new Set(productAlertIds);

  return {
    state,
    season: state.season,
    week: state.week,
    productAlertIds,
    guideSequenceIds,
    deferredProductAlertIds: effectiveProductAlerts
      .filter((alert) => !selectedProducts.has(alert.id))
      .map((alert) => alert.id),
    deferredGuideSequenceIds: queuedGuides.filter(
      (sequenceId) => !selectedGuides.has(sequenceId),
    ),
  };
}

/**
 * Buzz may share an unlock morning with managed sponsors, but it never talks
 * over the Sponsor Desk introduction. Delivery — not completion — starts the
 * one-logical-week gap, so ignoring Bert's card cannot block Buzz forever.
 */
function intrinsicallyHeldGuideSequences(
  state: GameState,
): AssistantInboxGuideSequenceId[] {
  if (state.season < 3 || highestDivisionReached(state) > 4) return [];
  if (wasSponsorDeskIntroDeliveredBeforeCurrentWeek(state)) return [];

  const hasDeliveryEvidence =
    sponsorDeskDeliveryWeeks(state.eventFlags).length > 0;
  if (
    !hasDeliveryEvidence &&
    hasAssistantGuideSequenceCompleted(state, 'sponsor-desk')
  ) {
    // A save from before delivery-week tracking can still prove the lesson was
    // completed. Treat that as historical rather than making Bert repeat it.
    return [];
  }
  return ['sponsor-buzz'];
}

/** True only when Sponsor Desk was delivered in an earlier logical week. */
export function wasSponsorDeskIntroDeliveredBeforeCurrentWeek(
  state: Pick<GameState, 'eventFlags' | 'season' | 'week'>,
): boolean {
  return sponsorDeskDeliveryWeeks(state.eventFlags).some(
    (delivery) =>
      delivery.season < state.season ||
      (delivery.season === state.season && delivery.week < state.week),
  );
}

function recordFirstSponsorDeskDelivery(
  state: GameState,
  selected: readonly InboxCandidate[],
): GameState {
  if (
    state.eventFlags.some((flag) =>
      flag.startsWith(SPONSOR_DESK_FIRST_DELIVERY_PREFIX),
    )
  ) {
    return state;
  }
  const delivered = selected.find(
    (candidate) =>
      candidate.kind === 'guide' && isSponsorDeskIntroSequenceId(candidate.id),
  );
  if (delivered === undefined) return state;
  return appendMissingFlags(state, [
    `${SPONSOR_DESK_FIRST_DELIVERY_PREFIX}s${state.season}:w${state.week}:guide:${delivered.id}`,
  ]);
}

function sponsorDeskDeliveryWeeks(
  eventFlags: readonly string[],
): { readonly season: number; readonly week: number }[] {
  const deliveries: { season: number; week: number }[] = [];
  for (const flag of eventFlags) {
    const match =
      /^(?:guide:bert:sponsor-desk:first-delivered:|guide:bert:inbox:delivered:)s(\d+):w(\d+):guide:(sponsor-desk|sponsor-desk-continuity)$/.exec(
        flag,
      );
    if (match === null) continue;
    deliveries.push({ season: Number(match[1]), week: Number(match[2]) });
  }
  return deliveries;
}

interface InboxCandidateBase {
  readonly rank: number;
  readonly order: number;
}

type InboxCandidate = InboxCandidateBase &
  (
    | { readonly kind: 'guide'; readonly id: AssistantInboxGuideSequenceId }
    | { readonly kind: 'product'; readonly id: string }
  );

function guideCandidate(
  sequenceId: AssistantInboxGuideSequenceId,
  order: number,
): InboxCandidate {
  return { kind: 'guide', id: sequenceId, rank: 1, order };
}

function productCandidate(
  alert: AssistantInboxProductAlert,
  order: number,
): InboxCandidate {
  return {
    kind: 'product',
    id: alert.id,
    rank: alert.priority === 'urgent' ? 0 : 2,
    order,
  };
}

function uniqueInboxCandidates(
  candidates: readonly InboxCandidate[],
): InboxCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.kind}:${candidate.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function validateProductAlerts(
  alerts: readonly AssistantInboxProductAlert[],
): AssistantInboxProductAlert[] {
  const seen = new Set<string>();
  return alerts.map((alert) => {
    if (typeof alert.id !== 'string' || alert.id.trim().length === 0) {
      throw new Error(
        'assistant inbox product alert IDs must be non-empty strings',
      );
    }
    if (alert.priority !== 'urgent' && alert.priority !== 'normal') {
      throw new Error(
        `unknown assistant inbox product alert priority ${String(alert.priority)}`,
      );
    }
    if (seen.has(alert.id))
      throw new Error(`duplicate assistant inbox product alert ${alert.id}`);
    seen.add(alert.id);
    return { ...alert };
  });
}

function mergeProductAlerts(
  alerts: readonly AssistantInboxProductAlert[],
): AssistantInboxProductAlert[] {
  const byId = new Map<string, AssistantInboxProductAlert>();
  for (const alert of alerts)
    if (!byId.has(alert.id)) byId.set(alert.id, alert);
  return [...byId.values()];
}

function queueOneShotProductAlerts(
  state: GameState,
  alerts: readonly AssistantInboxProductAlert[],
): GameState {
  const additions = alerts
    .filter((alert) => alert.oneShot === true)
    .filter(
      (alert) => !state.eventFlags.includes(acknowledgedProductFlag(alert.id)),
    )
    .map(pendingProductFlag)
    .filter((flag) => !state.eventFlags.includes(flag));
  if (additions.length === 0) return state;
  const eventFlags = [...state.eventFlags, ...additions];
  return {
    ...state,
    eventFlags: boundFlags(eventFlags, INBOX_PENDING_PRODUCT_PREFIX),
  };
}

function pendingOneShotProductAlerts(
  state: Pick<GameState, 'eventFlags'>,
): AssistantInboxProductAlert[] {
  return state.eventFlags.flatMap((flag) => {
    if (!flag.startsWith(INBOX_PENDING_PRODUCT_PREFIX)) return [];
    const encoded = flag.slice(INBOX_PENDING_PRODUCT_PREFIX.length);
    const separator = encoded.indexOf(':');
    if (separator < 0) return [];
    const priority = encoded.slice(0, separator);
    if (priority !== 'urgent' && priority !== 'normal') return [];
    try {
      return [
        {
          id: decodeURIComponent(encoded.slice(separator + 1)),
          priority,
          oneShot: true,
        },
      ];
    } catch {
      return [];
    }
  });
}

function acknowledgeOneShotProducts(
  state: GameState,
  alertIds: readonly string[],
): GameState {
  if (alertIds.length === 0) return state;
  const pending = new Set(
    alertIds.map((id) =>
      pendingProductFlag({ id, priority: 'urgent', oneShot: true }),
    ),
  );
  const pendingNormal = new Set(
    alertIds.map((id) =>
      pendingProductFlag({ id, priority: 'normal', oneShot: true }),
    ),
  );
  let eventFlags = state.eventFlags.filter(
    (flag) => !pending.has(flag) && !pendingNormal.has(flag),
  );
  for (const id of alertIds) {
    const flag = acknowledgedProductFlag(id);
    if (!eventFlags.includes(flag)) eventFlags.push(flag);
  }
  eventFlags = boundFlags(eventFlags, INBOX_ACKNOWLEDGED_PRODUCT_PREFIX);
  return arraysEqual(eventFlags, state.eventFlags)
    ? state
    : { ...state, eventFlags };
}

function boundFlags(flags: readonly string[], prefix: string): string[] {
  const matching = flags.filter((flag) => flag.startsWith(prefix));
  if (matching.length <= MAX_PERSISTED_ONE_SHOT_PRODUCT_FLAGS)
    return [...flags];
  const discard = new Set(
    matching.slice(0, matching.length - MAX_PERSISTED_ONE_SHOT_PRODUCT_FLAGS),
  );
  return flags.filter((flag) => !discard.has(flag));
}

function arraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function pruneOldInboxDeliveryFlags(state: GameState): GameState {
  const currentPrefix = inboxDeliveryWeekPrefix(state.season, state.week);
  let eventFlags = state.eventFlags.filter(
    (flag) =>
      !flag.startsWith(INBOX_DELIVERED_PREFIX) ||
      flag.startsWith(currentPrefix),
  );
  eventFlags = boundFlags(eventFlags, INBOX_PENDING_PRODUCT_PREFIX);
  eventFlags = boundFlags(eventFlags, INBOX_ACKNOWLEDGED_PRODUCT_PREFIX);
  return arraysEqual(eventFlags, state.eventFlags)
    ? state
    : { ...state, eventFlags };
}

function appendMissingFlags(
  state: GameState,
  flags: readonly string[],
): GameState {
  const additions = flags.filter((flag) => !state.eventFlags.includes(flag));
  return additions.length === 0
    ? state
    : { ...state, eventFlags: [...state.eventFlags, ...additions] };
}

function sequenceCompletionFlag(sequenceId: AssistantGuideSequenceId): string {
  return `${SEQUENCE_COMPLETE_PREFIX}${sequenceId}`;
}

function queuedSequenceFlag(sequenceId: AssistantInboxGuideSequenceId): string {
  return `${INBOX_QUEUED_PREFIX}${sequenceId}`;
}

function advisorSuppressedGuideFlag(
  sequenceId: AssistantInboxGuideSequenceId,
): string {
  return `${INBOX_ADVISOR_SUPPRESSED_PREFIX}${sequenceId}`;
}

function inboxDeliveryWeekPrefix(season: number, week: number): string {
  return `${INBOX_DELIVERED_PREFIX}s${season}:w${week}:`;
}

function guideDeliveryFlag(
  season: number,
  week: number,
  sequenceId: AssistantInboxGuideSequenceId,
): string {
  return `${inboxDeliveryWeekPrefix(season, week)}guide:${sequenceId}`;
}

function productDeliveryFlag(
  season: number,
  week: number,
  alertId: string,
): string {
  return `${inboxDeliveryWeekPrefix(season, week)}product:${alertId}`;
}

function inboxDismissalWeekPrefix(season: number, week: number): string {
  return `${INBOX_DISMISSED_PRODUCT_PREFIX}s${season}:w${week}:`;
}

function dismissedProductFlag(
  season: number,
  week: number,
  alertId: string,
): string {
  return `${inboxDismissalWeekPrefix(season, week)}${encodeURIComponent(alertId)}`;
}

function permanentlyDismissedProductFlag(alertId: string): string {
  return `${INBOX_PERMANENTLY_DISMISSED_PRODUCT_PREFIX}${encodeURIComponent(alertId)}`;
}

function pendingProductFlag(alert: AssistantInboxProductAlert): string {
  return `${INBOX_PENDING_PRODUCT_PREFIX}${alert.priority}:${encodeURIComponent(alert.id)}`;
}

function acknowledgedProductFlag(alertId: string): string {
  return `${INBOX_ACKNOWLEDGED_PRODUCT_PREFIX}${encodeURIComponent(alertId)}`;
}

function validateCareerWeek(season: number, week: number): void {
  if (
    !Number.isSafeInteger(season) ||
    season < 1 ||
    !Number.isSafeInteger(week) ||
    week < 1
  ) {
    throw new Error(
      'assistant inbox scheduling requires a positive career season and week',
    );
  }
}

function assertM2SequenceId(
  sequenceId: string,
): asserts sequenceId is AssistantInboxGuideSequenceId {
  if (!isM2SequenceId(sequenceId))
    throw new Error(`unknown M2 assistant guide sequence ${sequenceId}`);
}

function isM2SequenceId(
  sequenceId: string,
): sequenceId is AssistantInboxGuideSequenceId {
  return M2_SEQUENCE_IDS.has(sequenceId);
}

function isSponsorDeskIntroSequenceId(
  sequenceId: string,
): sequenceId is (typeof SPONSOR_DESK_INTRO_SEQUENCE_IDS)[number] {
  return (
    sequenceId === 'sponsor-desk' || sequenceId === 'sponsor-desk-continuity'
  );
}
