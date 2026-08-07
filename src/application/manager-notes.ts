import {
  CUP_SETTLEMENT_WEEKS,
  SEASON_WEEKS,
  cupRoundNameWith,
  isStoryYouthUnlocked,
  type GameState,
  type NationalCupRoundLabel,
} from '../game';
import { copyFor, type CopyFn } from '../i18n';
import type { ManagerNoteViewModel } from '../ui/models';

/**
 * The season calendar, told on the weeks it matters.
 *
 * Windows, cup rounds and the season boundary are pinned to week numbers, so a
 * player who does not already know the calendar only discovers them by finding
 * a screen closed. These notes put the whole beat on the desk in full — no
 * title to open and close, because there is no decision underneath. They sit
 * apart from the "needs your call" alerts and never take one of the three
 * weekly inbox slots.
 */

/**
 * Copy needs the window edges as numbers, which `isTransferWindowOpen` only
 * exposes as a predicate. A test walks every week of the season against that
 * predicate so these three can never drift away from the rule they describe.
 */
const PRESEASON_WINDOW_LAST_WEEK = 4;
const MIDSEASON_WINDOW_FIRST_WEEK = 17;
const MIDSEASON_WINDOW_LAST_WEEK = 18;

/**
 * English copy, for every caller that has not threaded a locale through yet —
 * the same parameter-with-a-default shape `view-models.ts` uses, and for the
 * same reason: a pure module cannot reach React context. Built once, because
 * `copyFor` spreads the whole English catalog into a fresh object and these
 * notes are rebuilt on every home-screen render.
 */
let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

export function managerNotes(
  state: GameState,
  t: CopyFn = englishCopy(),
): ManagerNoteViewModel[] {
  if (state.phase !== 'manage') return [];
  return [
    ...transferWindowNotes(state, t),
    ...cupRoundNotes(state, t),
    ...seasonEndNotes(state, t),
  ];
}

function transferWindowNotes(state: GameState, t: CopyFn): ManagerNoteViewModel[] {
  // Legacy careers have no market screen, so the window is not a thing there.
  if (state.market === undefined) return [];
  const academyOpen = isStoryYouthUnlocked(state);

  if (state.week === 1) {
    return [{
      id: 'note:transfer-window-open',
      title: t('managerNotes.windowOpenTitle', { lastWeek: PRESEASON_WINDOW_LAST_WEEK }),
      detail: t('managerNotes.windowOpenDetail', {
        preseasonLastWeek: PRESEASON_WINDOW_LAST_WEEK,
        midseasonFirstWeek: MIDSEASON_WINDOW_FIRST_WEEK,
        midseasonLastWeek: MIDSEASON_WINDOW_LAST_WEEK,
        // Glued rather than authored with a leading space: no catalog entry
        // carries edge whitespace, and a translator cannot be asked to keep it.
        academy: academyOpen ? ` ${t('managerNotes.windowOpenAcademy')}` : '',
      }),
    }];
  }

  if (state.week === PRESEASON_WINDOW_LAST_WEEK) {
    return [{
      id: 'note:preseason-windows-closing',
      title: academyOpen
        ? t('managerNotes.windowsClosingTitle')
        : t('managerNotes.windowClosingTitle'),
      detail: academyOpen
        ? t('managerNotes.windowsClosingDetail', { week: MIDSEASON_WINDOW_FIRST_WEEK })
        : t('managerNotes.windowClosingDetail', { week: MIDSEASON_WINDOW_FIRST_WEEK }),
    }];
  }

  if (state.week === MIDSEASON_WINDOW_FIRST_WEEK) {
    return [{
      id: 'note:midseason-window-open',
      title: t('managerNotes.midseasonWindowOpenTitle', {
        firstWeek: MIDSEASON_WINDOW_FIRST_WEEK,
        lastWeek: MIDSEASON_WINDOW_LAST_WEEK,
      }),
      detail: t('managerNotes.midseasonWindowOpenDetail'),
    }];
  }

  if (state.week === MIDSEASON_WINDOW_LAST_WEEK) {
    return [{
      id: 'note:midseason-window-closing',
      title: t('managerNotes.windowClosingTitle'),
      detail: t('managerNotes.midseasonWindowClosingDetail'),
    }];
  }

  return [];
}

/**
 * Cup notes track the club's own run and stop the week it ends. A knocked-out
 * manager does not need a weekly bulletin about a competition they are watching
 * from the outside.
 */
function cupRoundNotes(state: GameState, t: CopyFn): ManagerNoteViewModel[] {
  const cup = state.m2?.nationalCups.find(candidate => candidate.season === state.season);
  if (cup === undefined || cup.championClubId !== undefined) return [];
  const round = cup.rounds.find(candidate => (
    CUP_SETTLEMENT_WEEKS[candidate.number - 1] === state.week
  ));
  if (round === undefined) return [];

  const nextRoundWeek = CUP_SETTLEMENT_WEEKS[round.number];
  const nextRoundLabel = nextCupRoundLabel(round.label);

  if (round.byeClubIds.includes(state.userClubId)) {
    return [{
      id: `note:cup-bye:${round.number}`,
      title: t('managerNotes.cupByeTitle', { round: cupRoundNameWith(round.label, t) }),
      detail: nextRoundLabel === undefined || nextRoundWeek === undefined
        ? t('managerNotes.cupByeFinalDetail')
        : t('managerNotes.cupByeDetail', {
            week: nextRoundWeek,
            round: cupRoundNameWith(nextRoundLabel, t),
          }),
    }];
  }

  const fixture = round.fixtures.find(candidate => (
    candidate.homeClubId === state.userClubId || candidate.awayClubId === state.userClubId
  ));
  if (fixture === undefined) return [];

  const opponentId = fixture.homeClubId === state.userClubId ? fixture.awayClubId : fixture.homeClubId;
  const opponent = state.clubs.find(club => club.id === opponentId)?.name
    ?? t('managerNotes.opponentFallback');
  // Name the ground rather than trailing "at home" after the opponent, which
  // reads as the opponent being the home side.
  const venue = fixture.homeClubId === state.userClubId
    ? t('managerNotes.venueHome')
    : t('managerNotes.venueAway');
  const opening = t('managerNotes.cupFixtureOpening', { opponent, venue });
  return [{
    id: `note:cup-round:${round.number}`,
    title: t('managerNotes.cupRoundTitle', { round: cupRoundNameWith(round.label, t) }),
    detail: nextRoundLabel === undefined || nextRoundWeek === undefined
      ? t('managerNotes.cupFinalDetail', { opening })
      : t('managerNotes.cupRoundDetail', {
          opening,
          round: cupRoundNameWith(nextRoundLabel, t),
          week: nextRoundWeek,
        }),
  }];
}

function seasonEndNotes(state: GameState, t: CopyFn): ManagerNoteViewModel[] {
  if (state.week !== SEASON_WEEKS) return [];
  return [{
    id: 'note:season-final-week',
    title: t('managerNotes.seasonFinalWeekTitle'),
    detail: t('managerNotes.seasonFinalWeekDetail'),
  }];
}

/**
 * NOT copy. `label` is the round name persisted on the cup record, and this
 * finds the next one by matching against it — a translated entry here would
 * stop matching and every note would claim the club had reached the final.
 * The labels are data, and data stays English; `cupRoundNameWith` turns the
 * one it returns into a word the player reads, at the interpolation.
 */
const CUP_ROUND_ORDER: readonly NationalCupRoundLabel[] = [
  'Play-in', 'Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final',
];

function nextCupRoundLabel(label: NationalCupRoundLabel): NationalCupRoundLabel | undefined {
  return CUP_ROUND_ORDER[CUP_ROUND_ORDER.indexOf(label) + 1];
}
