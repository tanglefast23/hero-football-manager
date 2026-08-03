import { CUP_SETTLEMENT_WEEKS, SEASON_WEEKS, isStoryYouthUnlocked, type GameState } from '../game';
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

export function managerNotes(state: GameState): ManagerNoteViewModel[] {
  if (state.phase !== 'manage') return [];
  return [
    ...transferWindowNotes(state),
    ...cupRoundNotes(state),
    ...seasonEndNotes(state),
  ];
}

function transferWindowNotes(state: GameState): ManagerNoteViewModel[] {
  // Legacy careers have no market screen, so the window is not a thing there.
  if (state.market === undefined) return [];
  const academyOpen = isStoryYouthUnlocked(state);

  if (state.week === 1) {
    return [{
      id: 'note:transfer-window-open',
      title: `Manager's Note: Transfer window open, weeks 1-${PRESEASON_WINDOW_LAST_WEEK}`,
      detail: `A transfer window is the only stretch of the season when you are allowed to buy or sell players: Weeks 1-${PRESEASON_WINDOW_LAST_WEEK}, then Weeks ${MIDSEASON_WINDOW_FIRST_WEEK}-${MIDSEASON_WINDOW_LAST_WEEK}. Outside them the market refuses every bid, so the squad you have is the squad you keep.${academyOpen ? ' The academy intake closes on the same day as this one, so settle your squad now.' : ''}`,
    }];
  }

  if (state.week === PRESEASON_WINDOW_LAST_WEEK) {
    return [{
      id: 'note:preseason-windows-closing',
      title: academyOpen
        ? "Manager's Note: Transfer and youth windows close this week"
        : "Manager's Note: Transfer window closes this week",
      detail: academyOpen
        ? `Last week to sign, sell or take an academy prospect. Advance from here and both shut until the transfer window reopens in Week ${MIDSEASON_WINDOW_FIRST_WEEK}.`
        : `Last week to sign or sell. Advance from here and the market shuts until Week ${MIDSEASON_WINDOW_FIRST_WEEK}.`,
    }];
  }

  if (state.week === MIDSEASON_WINDOW_FIRST_WEEK) {
    return [{
      id: 'note:midseason-window-open',
      title: `Manager's Note: Transfer window reopens, weeks ${MIDSEASON_WINDOW_FIRST_WEEK}-${MIDSEASON_WINDOW_LAST_WEEK}`,
      detail: 'Two weeks to fix what the first half of the season exposed. The academy stays shut — this window is signings and sales only, and it is the last one before the season ends.',
    }];
  }

  if (state.week === MIDSEASON_WINDOW_LAST_WEEK) {
    return [{
      id: 'note:midseason-window-closing',
      title: "Manager's Note: Transfer window closes this week",
      detail: 'Last chance to change the squad this season. Whoever is on the books when you advance is who finishes the run-in.',
    }];
  }

  return [];
}

/**
 * Cup notes track the club's own run and stop the week it ends. A knocked-out
 * manager does not need a weekly bulletin about a competition they are watching
 * from the outside.
 */
function cupRoundNotes(state: GameState): ManagerNoteViewModel[] {
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
      title: `Manager's Note: Hero Cup bye through the ${round.label}`,
      detail: nextRoundLabel === undefined || nextRoundWeek === undefined
        ? 'You sit this round out and go straight through.'
        : `You sit this round out. Your run starts in Week ${nextRoundWeek} in the ${nextRoundLabel}.`,
    }];
  }

  const fixture = round.fixtures.find(candidate => (
    candidate.homeClubId === state.userClubId || candidate.awayClubId === state.userClubId
  ));
  if (fixture === undefined) return [];

  const opponentId = fixture.homeClubId === state.userClubId ? fixture.awayClubId : fixture.homeClubId;
  const opponent = state.clubs.find(club => club.id === opponentId)?.name ?? 'your opponent';
  const venue = fixture.homeClubId === state.userClubId ? 'at home' : 'away';
  return [{
    id: `note:cup-round:${round.number}`,
    title: `Manager's Note: Hero Cup ${round.label} this week`,
    detail: nextRoundLabel === undefined || nextRoundWeek === undefined
      ? `${opponent}, ${venue}. Win it and the Hero Cup is yours — the biggest prize money and the biggest crowd of the season.`
      : `${opponent}, ${venue}. Win and you reach the ${nextRoundLabel} in Week ${nextRoundWeek}, where the prize money and the fans both grow. Lose and your run is over — there is no second chance.`,
  }];
}

function seasonEndNotes(state: GameState): ManagerNoteViewModel[] {
  if (state.week !== SEASON_WEEKS) return [];
  return [{
    id: 'note:season-final-week',
    title: "Manager's Note: Final week of the season",
    detail: 'Advancing from here settles the table, promotion and relegation, and every contract that runs out. Spend what you were saving for this season before it becomes next season.',
  }];
}

function nextCupRoundLabel(label: string): string | undefined {
  const order = ['Play-in', 'Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final'];
  return order[order.indexOf(label) + 1];
}
