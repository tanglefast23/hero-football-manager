import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  boardFinanceBriefing,
  clubFinancesViewModel,
  homeProductAlerts,
  homeViewModel,
} from '../../../application/view-models';
import { loadLaunchContent } from '../../../content';
import { M2_ASSISTANT_GUIDE_SEQUENCE_IDS, completeAssistantGuideSequence } from '../../../game/assistant-guide';
import {
  BOARD_ULTIMATUM_WEEKS,
  applyBoardForcedSaleConsequences,
  boardForcedSaleAtDeadline,
  createBoardUltimatum,
  protectBoardUltimatumPlayer,
  targetMetResolution,
} from '../../../game/board-ultimatum';
import { difficultyRules } from '../../../game/difficulty';
import type { BoardUltimatumState, GameState } from '../../../game/types';
import { BertBriefingWalkOn } from '../../BertBriefingWalkOn';
import { ClubFinancesScreen } from '../../screens/ClubFinancesScreen';
import { ClubHomeScreen } from '../../screens/ClubHomeScreen';
import { DevHarnessButton, devHarnessControlStyles } from '../DevHarnessControls';
import { devHarnessCareerAtWeek } from '../career';
import type { DevHarnessEntry } from '../registry';

/**
 * The fail-soft economy, as the dev harness shows it.
 *
 * Reaching any of this in play means nearly bankrupting a club over several
 * seasons, so the escalation nobody has watched is the one that exists to stop
 * a career ending badly: a warning while the balance is red, then the one
 * emergency loan, then a four-week ultimatum with four named players on the
 * block, then a forced sale at the deadline — and a cash floor underneath all
 * of it that the board tops the balance back up to, for ever.
 *
 * Every state here is built by the SHIPPED engine functions from a real seeded
 * career: `createBoardUltimatum` picks the candidates, `boardForcedSaleAtDeadline`
 * picks the victim and the buyer, `applyBoardForcedSaleConsequences` moves him,
 * `targetMetResolution` closes the intervention. The only thing fabricated is
 * the club's cash and the negative-week counter — the two numbers a real career
 * would have arrived at by losing money, which is the part that takes seasons.
 * The screen is the real `ClubHomeScreen` fed by the real `homeViewModel`, and
 * PROTECT is wired to the real `protectBoardUltimatumPlayer`, so a tap here is
 * the tap a manager makes.
 */

export type BoardUltimatumCaseId =
  | 'warning'
  | 'loan'
  | 'ultimatum'
  | 'survived'
  | 'forced-sale';

export interface BoardUltimatumOptions {
  /** Weeks left on the deadline. Only an active ultimatum reads it. */
  readonly weeksRemaining: number;
  /**
   * Clears the career's own unrelated inbox rows (transfer requests, injuries,
   * Bert's firsts). The board's rows used to be built LAST in
   * `homeProductAlerts`, so on a busy desk they were the ones that fell off and
   * this toggle was the difference between seeing the escalation and seeing
   * nothing. They are built first now, and the three time-critical ones are
   * scheduled urgent, so the toggle measures rather than rescues: both settings
   * must show the same warning, deadline and verdict. The loan row is the
   * deliberate exception — it queues like any ordinary notice, because the
   * balance it reports is on the finances screen every week regardless.
   */
  readonly quietDesk: boolean;
}

/**
 * A career at season 2, week 6: far enough in that wages are real and the
 * season-one subsidy has expired, early enough that a reviewer waits ~50ms.
 */
function baseCareer(): GameState {
  return devHarnessCareerAtWeek(2, 6);
}

/** Cash deep enough in the red to be alarming, still above the board's floor. */
function redCash(state: GameState): number {
  return Math.ceil(difficultyRules(state).cashFloor / 2);
}

function withCash(state: GameState, cash: number): GameState {
  return {
    ...state,
    clubs: state.clubs.map(club => (
      club.id === state.userClubId ? { ...club, cash } : club
    )),
  };
}

/**
 * A desk with nothing on it but the board.
 *
 * The seeded career is played by a manager who never intervenes, so by season 2
 * it is carrying transfer requests, injuries, an unbuilt training pitch and
 * every one of Bert's firsts — none of which a manager who had been playing
 * would still have, and all of which used to outrank the board for the three
 * inbox rows a week.
 */
function withQuietDesk(state: GameState): GameState {
  const cleared: GameState = {
    ...state,
    players: state.players.map(player => (
      player.clubId === state.userClubId
        ? { ...player, transferRequested: false, injuryWeeks: 0 }
        : player
    )),
    facilities: { ...state.facilities, trainingGroundBuilt: true },
  };
  return M2_ASSISTANT_GUIDE_SEQUENCE_IDS.reduce(
    (next, sequenceId) => completeAssistantGuideSequence(next, sequenceId),
    cleared,
  );
}

/** The loan the board writes, on the terms `resolveFinancialSafety` writes them. */
function outstandingLoan(state: GameState, remainingWeeks: number) {
  const rules = difficultyRules(state);
  return {
    originalAmount: rules.emergencyLoanAmount,
    remainingBalance: Math.ceil(rules.emergencyLoanAmount * 1.1),
    repaymentStartsSeason: state.season + 1,
    remainingWeeks,
  };
}

/**
 * The ultimatum the board would issue against this squad, on this week.
 *
 * Throws rather than rendering a career without one: `createBoardUltimatum`
 * declines when fewer than three players could leave without breaking the
 * lineup, and a silently ultimatum-free reel would be reviewed as if the
 * feature had nothing to show.
 */
function issuedUltimatum(state: GameState): BoardUltimatumState {
  const ultimatum = createBoardUltimatum(state);
  if (ultimatum === undefined) {
    throw new Error('the board ultimatum reel has fewer than three sellable players');
  }
  return ultimatum;
}

/** One state of the escalation, built by the engine that owns it. */
export function boardUltimatumCareer(
  caseId: BoardUltimatumCaseId,
  options: BoardUltimatumOptions,
): GameState {
  const base = options.quietDesk ? withQuietDesk(baseCareer()) : baseCareer();
  const rules = difficultyRules(base);
  const broke = withCash(base, redCash(base));

  if (caseId === 'warning') {
    return {
      ...broke,
      financialSafety: { consecutiveNegativeWeeks: 1, emergencyLoanUsed: false },
    };
  }

  if (caseId === 'loan') {
    // The loan lands in the same week's ledger, so the balance it produces is
    // the hole plus the loan — usually back in the black, which is why the
    // warning row disappears the moment the board pays.
    return {
      ...withCash(base, redCash(base) + rules.emergencyLoanAmount),
      financialSafety: {
        consecutiveNegativeWeeks: 0,
        emergencyLoanUsed: true,
        loan: outstandingLoan(base, 30),
      },
    };
  }

  if (caseId === 'ultimatum') {
    return {
      ...broke,
      financialSafety: {
        consecutiveNegativeWeeks: rules.negativeWeeksBeforeIntervention,
        emergencyLoanUsed: true,
        loan: outstandingLoan(base, 24),
        boardUltimatum: {
          ...issuedUltimatum(broke),
          weeksRemaining: options.weeksRemaining,
        },
      },
    };
  }

  if (caseId === 'survived') {
    // Target met means the balance came back above the target on its own, so
    // the club is solvent again and the intervention closes with the squad
    // intact. The target is the only number the board ever asks for.
    return {
      ...withCash(base, 4_200),
      financialSafety: {
        consecutiveNegativeWeeks: 0,
        emergencyLoanUsed: true,
        loan: outstandingLoan(base, 24),
        latestBoardResolution: targetMetResolution(base, issuedUltimatum(broke)),
      },
    };
  }

  const ultimatum = { ...issuedUltimatum(broke), weeksRemaining: 1 };
  const atDeadline: GameState = {
    ...broke,
    financialSafety: {
      consecutiveNegativeWeeks: rules.negativeWeeksBeforeIntervention,
      emergencyLoanUsed: true,
      loan: outstandingLoan(base, 24),
      boardUltimatum: ultimatum,
    },
  };
  const resolution = boardForcedSaleAtDeadline(atDeadline, ultimatum);
  if (resolution === undefined) {
    throw new Error('the board ultimatum reel found no buyer for a forced sale');
  }
  // The engine credits the fee through the weekly ledger rather than inside
  // `applyBoardForcedSaleConsequences`, so the reel adds it the same way the
  // ledger would: the hole, plus what the sale raised.
  return {
    ...withCash(applyBoardForcedSaleConsequences(atDeadline, resolution), redCash(base) + resolution.fee),
    financialSafety: {
      consecutiveNegativeWeeks: 0,
      emergencyLoanUsed: true,
      loan: outstandingLoan(base, 24),
      latestBoardResolution: resolution,
    },
  };
}

/** What the reel is measuring, in the numbers the escalation is made of. */
export function boardUltimatumNote(state: GameState): string {
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  const safety = state.financialSafety;
  const ultimatum = safety?.boardUltimatum;
  const produced = homeProductAlerts(state).filter(alert => isBoardAlertId(alert.id));
  const deskRows = homeViewModel(state).alerts;
  const onDesk = deskRows.filter(alert => isBoardAlertId(alert.id));
  return [
    `Cash ${club?.cash ?? 0}`,
    `red weeks ${safety?.consecutiveNegativeWeeks ?? 0}/${difficultyRules(state).negativeWeeksBeforeIntervention}`,
    safety?.loan === undefined ? 'no loan' : `loan owes ${safety.loan.remainingBalance}`,
    ultimatum === undefined
      ? 'no deadline'
      : `target ${ultimatum.targetCash} · ${ultimatum.candidates.length} on the block`
        + (ultimatum.protectedPlayerId === undefined ? ' · none protected' : ' · one protected'),
    // The measurement the reel exists to take. It read 0/n on every busy desk.
    // The three time-critical rows must now read n/n whatever else the week is
    // carrying; the loan row may queue, because the balance it used to be the
    // only copy of is on the finances screen. The second number is what that
    // bought: how many of the week's three slots the board is holding.
    `board rows ${onDesk.length}/${produced.length} on the desk`,
    `board holds ${onDesk.length}/${deskRows.length} slots`,
  ].join(' · ');
}

function isBoardAlertId(alertId: string): boolean {
  return alertId === 'financial-warning'
    || alertId === 'emergency-loan'
    || alertId === 'board-ultimatum'
    || alertId.startsWith('board-resolution');
}

/** The countdown values worth a tap: issued, mid-way, and the last week. */
const COUNTDOWN_WEEKS: readonly number[] = Object.freeze([BOARD_ULTIMATUM_WEEKS, 2, 1]);

export function BoardUltimatumReel({ caseId }: { readonly caseId: BoardUltimatumCaseId }) {
  const [weeksRemaining, setWeeksRemaining] = useState(2);
  const [quietDesk, setQuietDesk] = useState(true);
  const [guideBoard, setGuideBoard] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  /**
   * What tapping a board money row does, played out here rather than described.
   *
   * The desk row is clipped to two lines, so the reel could show that the board
   * had spoken but never what it said. These two follow the real flow: Bert
   * reads the whole message, and the loan then opens the Facility board with
   * the money-making buildings lit.
   */
  const [openedBoardAlertId, setOpenedBoardAlertId] = useState<string | null>(null);
  const [incomeFacilityTour, setIncomeFacilityTour] = useState(false);
  // Every tap the manager can make lands here, applied by the real reducer on
  // top of the built state. Cleared whenever an option rebuilds the career.
  const [played, setPlayed] = useState<GameState | undefined>(undefined);
  const [failure, setFailure] = useState<string | undefined>(undefined);
  const insets = useSafeAreaInsets();

  const guideContent = useMemo(() => loadLaunchContent().assistantGuide, []);
  const built = useMemo(
    () => boardUltimatumCareer(caseId, { weeksRemaining, quietDesk }),
    [caseId, quietDesk, weeksRemaining],
  );
  const state = played ?? built;
  const viewModel = useMemo(() => homeViewModel(state), [state]);
  const note = useMemo(() => boardUltimatumNote(state), [state]);

  const briefing = openedBoardAlertId === null
    ? undefined
    : boardFinanceBriefing(state, openedBoardAlertId);

  const rebuild = useCallback((change: () => void) => {
    setPlayed(undefined);
    setFailure(undefined);
    setOpenedBoardAlertId(null);
    setIncomeFacilityTour(false);
    change();
  }, []);

  const protectCandidate = useCallback((playerId: string) => {
    try {
      setPlayed(protectBoardUltimatumPlayer(state, playerId));
      setFailure(undefined);
    } catch (error) {
      setFailure((error as Error).message);
    }
  }, [state]);

  return (
    <View style={styles.root}>
      {incomeFacilityTour ? (
        <ClubFinancesScreen
          viewModel={clubFinancesViewModel(state)}
          activeTab="facility"
          onSelectTab={() => {}}
          onBuildTrainingGround={() => {}}
          guideFocus="income-facilities"
        />
      ) : (
        <ClubHomeScreen
          viewModel={viewModel}
          onOpenFixture={() => {}}
          onOpenAlert={setOpenedBoardAlertId}
          onOpenLeague={() => {}}
          onProtectBoardCandidate={protectCandidate}
          guideBoard={guideBoard}
        />
      )}

      {briefing === undefined || openedBoardAlertId === null ? null : (
        <BertBriefingWalkOn
          key={openedBoardAlertId}
          content={guideContent}
          sequenceId={openedBoardAlertId === 'emergency-loan'
            ? 'board-emergency-loan'
            : 'board-financial-warning'}
          customMessage={briefing}
          onDone={() => {
            const wasLoan = openedBoardAlertId === 'emergency-loan';
            setOpenedBoardAlertId(null);
            if (wasLoan) setIncomeFacilityTour(true);
          }}
        />
      )}

      {controlsVisible ? (
        <View style={[styles.panel, { paddingBottom: insets.bottom + 12 }]}>
          <View style={devHarnessControlStyles.row}>
            <Text style={devHarnessControlStyles.rowLabel}>WEEKS</Text>
            {COUNTDOWN_WEEKS.map(weeks => (
              <DevHarnessButton
                key={weeks}
                label={`${weeks}`}
                hint={`Set the deadline to ${weeks} week${weeks === 1 ? '' : 's'} remaining`}
                selected={weeks === weeksRemaining}
                onPress={() => rebuild(() => setWeeksRemaining(weeks))}
              />
            ))}
            <DevHarnessButton
              label="Reset"
              hint="Drop the protected player and rebuild this state"
              onPress={() => rebuild(() => {})}
            />
          </View>

          <View style={devHarnessControlStyles.row}>
            <Text style={devHarnessControlStyles.rowLabel}>DESK</Text>
            <DevHarnessButton
              label="Quiet"
              hint="Clear the career's unrelated inbox rows so the board's own rows are visible"
              selected={quietDesk}
              onPress={() => rebuild(() => setQuietDesk(true))}
            />
            <DevHarnessButton
              label="Busy"
              hint="Leave the career's transfer requests and injuries on the desk"
              selected={!quietDesk}
              onPress={() => rebuild(() => setQuietDesk(false))}
            />
            <DevHarnessButton
              label="Bert"
              hint="Show Bert's tap cue over the board panel"
              selected={guideBoard}
              onPress={() => setGuideBoard(current => !current)}
            />
            <DevHarnessButton
              label="Hide"
              hint="Hide the review controls"
              onPress={() => setControlsVisible(false)}
            />
          </View>

          <Text style={styles.note}>{note}</Text>
          {failure === undefined ? null : (
            <Text style={styles.failure}>REFUSED · {failure}</Text>
          )}
        </View>
      ) : (
        <View style={[styles.showRow, { paddingBottom: insets.bottom + 12 }]}>
          <DevHarnessButton
            label="QA ▴"
            hint="Show the review controls"
            onPress={() => setControlsVisible(true)}
          />
        </View>
      )}
    </View>
  );
}

/**
 * Declared above the entry, not below it: the entry's `cases` read this while
 * the module is still evaluating, and a `const` below would still be in its
 * temporal dead zone. TypeScript cannot see that through the arrow function,
 * so the only symptom is a blank bundle at runtime.
 */
const CASES: readonly { id: BoardUltimatumCaseId; label: string; note: string }[] = Object.freeze([
  {
    id: 'warning',
    label: 'Warning',
    note: 'First week in the red · transfers and building locked, nothing sold yet',
  },
  {
    id: 'loan',
    label: 'Loan',
    note: 'The one emergency loan, drawn · repayments begin next season',
  },
  {
    id: 'ultimatum',
    label: 'Deadline',
    note: 'Four names on the block, one protectable · tap a row to protect',
  },
  {
    id: 'survived',
    label: 'Survived',
    note: 'Target met · the intervention closes with the squad intact',
  },
  {
    id: 'forced-sale',
    label: 'Sold',
    note: 'Deadline missed · a player left, the academy promoted his replacement',
  },
]);

/**
 * The cases are the five states of the escalation, because each one is a
 * different set of inputs to the same desk and each is worth a bookmark. The
 * countdown, the desk noise and Bert's cue are dials inside one of them, so
 * they stay local: all of them are one tap away from any case.
 */
export const boardUltimatumEntry: DevHarnessEntry = Object.freeze({
  id: 'board-ultimatum',
  group: 'Season',
  title: 'Board ultimatum',
  summary: 'Fail-soft economy: warning, one loan, a four-week deadline, then a forced sale.',
  cases: Object.freeze(CASES.map(entry => Object.freeze({
    id: entry.id,
    label: entry.label,
    note: entry.note,
  }))),
  render: (caseId: string) => (
    <BoardUltimatumReel caseId={caseId as BoardUltimatumCaseId} />
  ),
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#241f2e' },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    gap: 6,
    borderTopWidth: 3,
    borderTopColor: '#edb54a',
    backgroundColor: 'rgba(18,16,25,0.94)',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  showRow: {
    position: 'absolute',
    left: 12,
    bottom: 0,
    zIndex: 30,
  },
  note: {
    color: '#d7cfe4',
    fontSize: 12,
    lineHeight: 17,
  },
  failure: {
    color: '#edb54a',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 9,
  },
});
