import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { seasonEndViewModel } from '../../../application/view-models';
import { loadLaunchContent } from '../../../content/load';
import { leagueStandings, startNextSeason } from '../../../game/career';
import { currentUserDivision } from '../../../game/m2-career';
import {
  divisionAfterFinish,
  divisionTierLabel,
  type DivisionLevel,
} from '../../../game/pyramid';
import { releaseCareerPlayer, renewCareerPlayer } from '../../../game/squad';
import type { GameState } from '../../../game/types';
import { SeasonEndScreen } from '../../screens/SeasonEndScreen';
import { devHarnessCareerAtSeasonEnd } from '../career';
import { DevHarnessButton, devHarnessControlStyles } from '../DevHarnessControls';
import type { DevHarnessEntry } from '../registry';

/**
 * One career, five rungs of the ladder.
 *
 * `divisionAfterFinish` sends the top two up and the bottom two down and closes
 * both ends of the pyramid, and `resolvePromotionAndRelegation` applies that to
 * every division at once — but the only thing a player ever sees of it is the
 * season review and the division they wake up in. Neither had been looked at
 * for a relegation or for a D1 title, because reaching either takes a career.
 *
 * Every case is the SAME seeded club at a different season boundary, so the
 * five chips read as one club's story rather than five unrelated fixtures:
 * seed 23 goes up twice, settles, falls out of the National Championship, and
 * eventually wins the Global League. The seasons were measured, not guessed.
 */

/** Fixed: this one club's history is what the five cases are cut from. */
const LADDER_SEED = 23;

interface PromotionCase {
  readonly id: string;
  readonly label: string;
  readonly note: string;
  /** The season boundary this case opens at. */
  readonly season: number;
}

/**
 * Declared above the entry, not below it: `cases` reads this while the module
 * is still evaluating, and a `const` below would still be in its temporal dead
 * zone. TypeScript cannot see that through the arrow function, so the only
 * symptom is a blank bundle at runtime.
 */
const PROMOTION_CASES: readonly PromotionCase[] = Object.freeze([
  {
    id: 'first-up',
    label: 'First up',
    note: 'S1 · won D5 · the first taste of the ladder, and the only one that opens a new tier',
    season: 1,
  },
  {
    id: 'promoted',
    label: 'Up again',
    note: 'S2 · runner-up in D4 · promoted a second time, one rung higher',
    season: 2,
  },
  {
    id: 'safe',
    label: 'Safe',
    note: 'S5 · seventh in D3 · neither end of the table, the season most seasons are',
    season: 5,
  },
  {
    id: 'relegated',
    label: 'Down',
    note: 'S7 · bottom of D2 · the drop, which no reviewer had seen',
    season: 7,
  },
  {
    id: 'champions',
    label: 'Champions',
    note: 'S20 · won D1 · the top of the pyramid, where first place moves nobody',
    season: 20,
  },
]);

const CASE_BY_ID = new Map(PROMOTION_CASES.map(entry => [entry.id, entry]));

export function PromotionTransitionReel({ caseId }: { readonly caseId: string }) {
  const season = CASE_BY_ID.get(caseId)?.season ?? PROMOTION_CASES[0].season;
  const content = useMemo(loadLaunchContent, []);
  const insets = useSafeAreaInsets();

  // The career is the expensive part — a season of simulated weeks each — so it
  // is read once per case and cached for the life of the bundle by `career.ts`.
  // Everything the controls do afterwards works on this local copy.
  const [state, setState] = useState<GameState>(() => devHarnessCareerAtSeasonEnd(season, LADDER_SEED));
  const [term, setTerm] = useState<1 | 2 | 3>(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [transitionNote, setTransitionNote] = useState<string>();

  const viewModel = useMemo(
    () => seasonEndViewModel(state, content, term),
    [content, state, term],
  );

  const division: DivisionLevel = state.m2 === undefined ? 5 : currentUserDivision(state.m2);
  const finalPosition = useMemo(() => (
    leagueStandings(state).find(row => row.clubId === state.userClubId)?.position ?? 0
  ), [state]);
  // The pyramid's own rule, printed beside the screen that is meant to be
  // saying the same thing. Where they disagree the screen is wrong.
  const nextDivision = divisionAfterFinish(division, finalPosition);

  const reset = useCallback(() => {
    setState(devHarnessCareerAtSeasonEnd(season, LADDER_SEED));
    setTransitionNote(undefined);
  }, [season]);

  const release = useCallback(() => {
    const playerId = viewModel.expiredContract?.playerId;
    if (playerId === undefined) return;
    try {
      setState(current => releaseCareerPlayer(current, playerId));
      setTransitionNote(undefined);
    } catch (error) {
      setTransitionNote(`Release refused: ${(error as Error).message}`);
    }
  }, [viewModel.expiredContract?.playerId]);

  /**
   * The transition itself, not a mock of it.
   *
   * Contracts first, because the season cannot roll over with a squad half out
   * of contract — which is also why the review's own Continue is disabled until
   * the queue is empty. Then `startNextSeason` runs, which is what actually
   * calls `resolvePromotionAndRelegation`, and the division it lands in is the
   * answer the whole entry exists to check.
   */
  const runTransition = useCallback(() => {
    try {
      let renewed = state;
      for (const player of state.players.filter(candidate => (
        candidate.clubId === state.userClubId && candidate.contractSeasonsRemaining === 0
      ))) {
        renewed = renewCareerPlayer(renewed, player.id, 4, 1);
      }
      const next = startNextSeason(renewed);
      const landed: DivisionLevel = next.m2 === undefined ? 5 : currentUserDivision(next.m2);
      setTransitionNote(
        `Transition ran · now season ${next.season} week ${next.week} in ${divisionTierLabel(landed)}`,
      );
    } catch (error) {
      setTransitionNote(`Transition refused: ${(error as Error).message}`);
    }
  }, [state]);

  const movement = nextDivision === division
    ? `stays in ${divisionTierLabel(division)}`
    : `${divisionTierLabel(division)} → ${divisionTierLabel(nextDivision)}`;

  return (
    <View style={styles.root}>
      <SeasonEndScreen
        viewModel={viewModel}
        onSelectContractTerm={(_playerId, selected) => setTerm(selected)}
        // Unreachable on the shipped screen — `seasonEndViewModel` hard-codes
        // `requiresNegotiation: true`, so the direct Renew button and the
        // contract-length picker beside it are dead code. Wired anyway, and
        // guarded, so that if the flag ever comes back the reel can drive it.
        onRenewContract={playerId => {
          try {
            setState(current => renewCareerPlayer(current, playerId, 4, term));
          } catch (error) {
            setTransitionNote(`Renewal refused: ${(error as Error).message}`);
          }
        }}
        onReleaseContract={release}
        // The agent meeting is the transfer-market negotiation, a feature of its
        // own with three rounds and pitch cards. Driving it here would make this
        // entry a second market reel; it is deliberately inert.
        onStartRenewal={() => setTransitionNote('Renewal talks are the market negotiation, not this reel')}
        onSubmitRenewalOffer={() => {}}
        onCloseRenewal={() => {}}
        onPrimaryAction={runTransition}
        onOpenSettings={() => {}}
      />

      {controlsVisible ? (
        <View style={[styles.panel, { paddingBottom: insets.bottom + 12 }]}>
          <View style={devHarnessControlStyles.row}>
            <Text style={devHarnessControlStyles.rowLabel}>LADDER</Text>
            <Text style={styles.note}>
              #{finalPosition} of 10 · {movement}
            </Text>
          </View>

          <View style={devHarnessControlStyles.row}>
            <Text style={devHarnessControlStyles.rowLabel}>QUEUE</Text>
            <DevHarnessButton
              label="Release"
              hint="Let the expired contract at the head of the queue leave"
              onPress={release}
            />
            <DevHarnessButton
              label="Run"
              hint="Renew everyone and run the real season transition"
              onPress={runTransition}
            />
            <DevHarnessButton label="Reset" hint="Reload this season boundary" onPress={reset} />
            <DevHarnessButton
              label="Hide"
              hint="Hide the review controls"
              onPress={() => setControlsVisible(false)}
            />
          </View>

          <Text style={styles.note}>
            {viewModel.expiredContract === undefined
              ? 'No expired contracts · the review can continue'
              : `${viewModel.expiredContract.remainingExpiredCount} expired contracts · continue is blocked`}
          </Text>
          {transitionNote === undefined ? null : (
            <Text style={styles.stageLine}>{transitionNote.toUpperCase()}</Text>
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
 * Five seasons of one club, and nothing else.
 *
 * A case here is a finish — the input the whole screen is derived from. The
 * expired-contract queue, the contract term and the transition itself are all
 * things a reviewer does while standing in one of these five, so they are the
 * entry's own controls rather than five more chips.
 */
export const promotionTransitionEntry: DevHarnessEntry = Object.freeze({
  id: 'promotion-transition',
  group: 'Season',
  title: 'Promotion and relegation',
  summary: 'The season review that says which way the club just moved, and the transition that moves it.',
  cases: Object.freeze(PROMOTION_CASES.map(entry => Object.freeze({
    id: entry.id,
    label: entry.label,
    note: entry.note,
  }))),
  render: (caseId: string) => <PromotionTransitionReel caseId={caseId} />,
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
    flexShrink: 1,
    color: '#d7cfe4',
    fontSize: 12,
    lineHeight: 17,
  },
  stageLine: {
    color: '#9a95a4',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 9,
  },
});
