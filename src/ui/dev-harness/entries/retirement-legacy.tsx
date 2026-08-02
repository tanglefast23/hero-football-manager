import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clubLegacyViewModel, homeViewModel } from '../../../application/view-models';
import { M2_ASSISTANT_GUIDE_SEQUENCE_IDS, completeAssistantGuideSequence } from '../../../game/assistant-guide';
import {
  nextPendingClubLegend,
  reconcilePendingClubLegends,
  resolveNextClubLegendLegacy,
} from '../../../game/legacy-career';
import { resolveM2CareerPlayerLifecycle } from '../../../game/m2-career';
import { generatedClubPower } from '../../../game/power-catalog';
import { isClubLegend, retirementAnnouncementAge } from '../../../game/pyramid';
import type { CareerPlayer, GameState } from '../../../game/types';
import { careerRosterCapacity, userCareerRosterCount } from '../../../game/youth-intake';
import { ClubHomeScreen } from '../../screens/ClubHomeScreen';
import { ClubLegacyScreen } from '../../screens/ClubLegacyScreen';
import { DevHarnessButton, devHarnessControlStyles } from '../DevHarnessControls';
import { devHarnessCareerAtWeek } from '../career';
import type { DevHarnessEntry } from '../registry';

/**
 * Retirement and the club legacy, as the dev harness shows it.
 *
 * A player announces a final season, plays it, retires, and — if he stayed long
 * enough and got famous enough — becomes a legacy decision. The first of those
 * needs a squad old enough to be ageing out and the last needs five seasons at
 * one club, so the whole arc has had almost no exposure.
 *
 * Both halves are built by the SHIPPED lifecycle: `resolveM2CareerPlayerLifecycle`
 * decides who announces and who retires, `retirementAnnouncementAge` supplies the
 * age it happens at, `isClubLegend` decides who is owed a legacy, and the
 * screens are the real `ClubHomeScreen` desk and the real `ClubLegacyScreen`
 * fed by their own view-model builders. What the reel fabricates is ages: the
 * one input a career spends seasons accumulating.
 *
 * The legacy choice is wired to the real `resolveNextClubLegendLegacy`, so
 * "Join the staff" and "Mentor a prospect" do here exactly what they do in a
 * career — including refusing, which is worth seeing.
 */

export type RetirementLegacyCaseId =
  | 'announcement'
  | 'hero-farewell'
  | 'generation'
  | 'legacy-one'
  | 'legacy-queue'
  | 'legacy-empty';

export interface RetirementLegacyOptions {
  /**
   * Clears the career's own unrelated inbox rows. The desk shows three items a
   * week; retirement notices are built near the end of `homeProductAlerts` and
   * carry the quieter tone, so on a busy desk they are the rows that fall off.
   */
  readonly quietDesk: boolean;
}

/** The queue length each legacy case stands up. */
const LEGACY_QUEUE_SIZES: Readonly<Record<string, number>> = Object.freeze({
  'legacy-one': 1,
  'legacy-queue': 3,
});

/** Old enough to be a legend by tenure and fame, on the shipped thresholds. */
const LEGEND_SEASONS_AT_CLUB = 6;
const LEGEND_FAME = 82;

/** Young enough that nobody announces unless the reel asked them to. */
const UNREMARKABLE_AGE = 24;

/**
 * Season 2, so the desk has a previous season for a notice to have been made
 * in: `homeProductAlerts` only shows announcements from `season - 1`.
 */
function baseCareer(): GameState {
  return devHarnessCareerAtWeek(2, 2);
}

function userRoster(state: GameState): CareerPlayer[] {
  return state.players.filter(player => player.clubId === state.userClubId);
}

function announcementAge(state: GameState, player: CareerPlayer): number {
  return retirementAnnouncementAge(
    { id: player.id, personality: player.personality ?? 'Professional' },
    state.careerSeed,
  );
}

/**
 * A desk with nothing on it but the farewell, so the notice is visible at all.
 *
 * The seeded career is played by a manager who never intervenes, so by season 2
 * it is carrying transfer requests, injuries, an unbuilt training pitch and
 * every one of Bert's firsts — none of which a manager who had been playing
 * would still have, and all of which outrank a retirement notice for the three
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

/** The club's hero, made one: a launch career ships without a single power. */
function asHero(state: GameState, player: CareerPlayer): CareerPlayer {
  return {
    ...player,
    power: generatedClubPower(state.userClubId, 0, player.role),
    powerTier: 2,
    licensed: true,
  };
}

/**
 * The squad on the last day of the previous season, with `count` players one
 * year short of their own retirement age and everybody else safely young.
 *
 * Ages are set rather than waited for. Who announces, when, and what the notice
 * says all stay with the engine — the reel only decides how many.
 */
function agedForAnnouncement(
  state: GameState,
  count: number,
  makeHero: boolean,
): GameState {
  const roster = userRoster(state);
  const announcing = new Set(roster.slice(0, count).map(player => player.id));
  const heroId = makeHero ? roster[0]?.id : undefined;
  const previousSeasonSquad = roster.map(player => {
    const aged: CareerPlayer = {
      ...player,
      age: announcing.has(player.id)
        ? announcementAge(state, player) - 1
        : UNREMARKABLE_AGE,
    };
    return player.id === heroId ? asHero(state, aged) : aged;
  });
  const lifecycle = resolveM2CareerPlayerLifecycle(
    previousSeasonSquad,
    state.season - 1,
    state.careerSeed,
  );
  return {
    ...state,
    players: [
      ...lifecycle.activePlayers,
      ...state.players.filter(player => player.clubId !== state.userClubId),
    ],
    retirementAnnouncements: lifecycle.announcements,
  };
}

/**
 * A queue of retired club legends waiting on their legacy.
 *
 * The active roster is left alone on purpose. A real transition removes the
 * retirees and refills the squad to the same role targets in the same step, so
 * the roster this screen opens over is full either way — and inventing academy
 * players here would only misreport the one number the legacy choice reads.
 */
function withRetiredLegends(state: GameState, count: number): GameState {
  const roster = userRoster(state);
  const legends = roster.slice(0, count).map((player, index) => {
    const retiring: CareerPlayer = {
      ...player,
      age: announcementAge(state, player) + 1,
      // Announced in a season already gone: that is what makes the lifecycle
      // retire a player rather than announce him again.
      retirementAnnouncementSeason: state.season - 1,
      seasonsAtClub: LEGEND_SEASONS_AT_CLUB,
      fame: LEGEND_FAME,
    };
    return index === 0 ? asHero(state, retiring) : retiring;
  });
  const lifecycle = resolveM2CareerPlayerLifecycle(legends, state.season, state.careerSeed);
  return {
    ...state,
    retiredPlayers: lifecycle.retiredPlayers,
    pendingLegacyPlayerIds: lifecycle.retiredPlayers
      .filter(player => isClubLegend({
        seasonsAtClub: player.seasonsAtClub ?? 0,
        fame: player.fame ?? 0,
      }))
      .map(player => player.id),
  };
}

/** One state of the arc, built by the lifecycle that owns it. */
export function retirementLegacyCareer(
  caseId: RetirementLegacyCaseId,
  options: RetirementLegacyOptions,
): GameState {
  const base = options.quietDesk ? withQuietDesk(baseCareer()) : baseCareer();

  if (caseId === 'announcement') return agedForAnnouncement(base, 1, false);
  if (caseId === 'hero-farewell') return agedForAnnouncement(base, 1, true);
  if (caseId === 'generation') return agedForAnnouncement(base, 7, true);
  if (caseId === 'legacy-empty') return base;
  return withRetiredLegends(base, LEGACY_QUEUE_SIZES[caseId] ?? 1);
}

export function isLegacyCase(caseId: RetirementLegacyCaseId): boolean {
  return caseId.startsWith('legacy-');
}

/** What the reel is measuring: how much of this arrived, and how much showed. */
export function retirementLegacyNote(
  caseId: RetirementLegacyCaseId,
  state: GameState,
): string {
  if (isLegacyCase(caseId)) {
    const queued = state.pendingLegacyPlayerIds?.length ?? 0;
    return [
      `Queue ${queued}`,
      `retired on file ${state.retiredPlayers?.length ?? 0}`,
      `roster ${userCareerRosterCount(state)}/${careerRosterCapacity(state)}`,
    ].join(' · ');
  }
  const announced = state.retirementAnnouncements?.length ?? 0;
  const onDesk = homeViewModel(state).alerts
    .filter(alert => alert.id.startsWith('retirement-announcement-'))
    .length;
  return `Announced ${announced} · ${onDesk} on the desk · desk holds 3 rows a week`;
}

/** The queue the legacy screen has no picture for: no legend, no screen. */
function EmptyLegacyPanel({ reason }: { readonly reason: string }) {
  return (
    <View style={styles.emptyRoot}>
      <Text style={styles.emptyTitle}>NO LEGACY SCREEN</Text>
      <Text style={styles.emptyBody}>
        An empty queue is not a state this screen has. The store routes to
        management whenever `nextPendingClubLegend` returns nothing, and the
        view-model builder refuses outright:
      </Text>
      <Text style={styles.emptyQuote}>{reason}</Text>
      <Text style={styles.emptyBody}>
        Nothing in the game shows a club its retired players once their legacy
        is chosen, so this is where the arc ends.
      </Text>
    </View>
  );
}

export function RetirementLegacyReel({ caseId }: { readonly caseId: RetirementLegacyCaseId }) {
  const [quietDesk, setQuietDesk] = useState(true);
  const [guided, setGuided] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  // Legacy choices are real transactions; each one lands here on top of the
  // built career so the queue advances the way it advances in a save.
  const [played, setPlayed] = useState<GameState | undefined>(undefined);
  const [failure, setFailure] = useState<string | undefined>(undefined);
  const insets = useSafeAreaInsets();

  const built = useMemo(
    () => retirementLegacyCareer(caseId, { quietDesk }),
    [caseId, quietDesk],
  );
  const state = played ?? built;
  const note = useMemo(() => retirementLegacyNote(caseId, state), [caseId, state]);
  const home = useMemo(() => homeViewModel(state), [state]);

  const rebuild = useCallback((change: () => void) => {
    setPlayed(undefined);
    setFailure(undefined);
    change();
  }, []);

  const choose = useCallback((choice: 'coach-candidate' | 'mentor-youth') => {
    try {
      const transaction = resolveNextClubLegendLegacy(state, choice);
      setPlayed(reconcilePendingClubLegends(transaction.state));
      setFailure(undefined);
    } catch (error) {
      setFailure((error as Error).message);
    }
  }, [state]);

  const legacy = isLegacyCase(caseId);
  const pending = legacy ? nextPendingClubLegend(state) : undefined;

  return (
    <View style={styles.root}>
      {!legacy ? (
        <ClubHomeScreen
          viewModel={home}
          onOpenFixture={() => {}}
          onOpenAlert={() => {}}
          onOpenLeague={() => {}}
          onProtectBoardCandidate={() => {}}
        />
      ) : pending === undefined ? (
        <EmptyLegacyPanel reason={emptyLegacyReason(state)} />
      ) : (
        <ClubLegacyScreen
          viewModel={clubLegacyViewModel(state)}
          onChoose={choose}
          onOpenSettings={() => {}}
          guided={guided}
        />
      )}

      {controlsVisible ? (
        <View style={[styles.panel, { paddingBottom: insets.bottom + 12 }]}>
          <View style={devHarnessControlStyles.row}>
            <Text style={devHarnessControlStyles.rowLabel}>DESK</Text>
            <DevHarnessButton
              label="Quiet"
              hint="Clear the career's unrelated inbox rows so the farewell notices are visible"
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
              hint="Show Bert's tap cue over the first legacy option"
              selected={guided}
              onPress={() => setGuided(current => !current)}
            />
            <DevHarnessButton
              label="Reset"
              hint="Undo the legacy choices and rebuild this state"
              onPress={() => rebuild(() => {})}
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

/** The builder's own refusal, quoted rather than paraphrased. */
export function emptyLegacyReason(state: GameState): string {
  try {
    clubLegacyViewModel(state);
    return 'clubLegacyViewModel returned a view model for an empty queue';
  } catch (error) {
    return (error as Error).message;
  }
}

/**
 * Declared above the entry, not below it: the entry's `cases` read this while
 * the module is still evaluating, and a `const` below would still be in its
 * temporal dead zone. TypeScript cannot see that through the arrow function,
 * so the only symptom is a blank bundle at runtime.
 */
const CASES: readonly { id: RetirementLegacyCaseId; label: string; note: string }[] = Object.freeze([
  {
    id: 'announcement',
    label: 'One',
    note: 'A single player announces his final season',
  },
  {
    id: 'hero-farewell',
    label: 'Hero',
    note: 'The club’s one hero announces · does the desk say so?',
  },
  {
    id: 'generation',
    label: 'Generation',
    note: 'A whole generation ages out at once · the desk holds three',
  },
  {
    id: 'legacy-one',
    label: 'Legend',
    note: 'One legend waiting on a legacy · the last decision',
  },
  {
    id: 'legacy-queue',
    label: 'Queue',
    note: 'Three legends queued, a hero first · choose to advance',
  },
  {
    id: 'legacy-empty',
    label: 'Empty',
    note: 'No legend pending · the screen has no empty state',
  },
]);

/**
 * The cases are six inputs: three squads of different ages, and three legacy
 * queues of different lengths. The desk toggle and Bert's cue are dials inside
 * one of them, so they stay local.
 */
export const retirementLegacyEntry: DevHarnessEntry = Object.freeze({
  id: 'retirement-legacy',
  group: 'Season',
  title: 'Retirement & legacy',
  summary: 'A final season announced, then the club legend’s last decision.',
  cases: Object.freeze(CASES.map(entry => Object.freeze({
    id: entry.id,
    label: entry.label,
    note: entry.note,
  }))),
  render: (caseId: string) => (
    <RetirementLegacyReel caseId={caseId as RetirementLegacyCaseId} />
  ),
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#241f2e' },
  emptyRoot: {
    flex: 1,
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: '#edb54a',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 12,
  },
  emptyBody: {
    color: '#d7cfe4',
    fontSize: 13,
    lineHeight: 19,
  },
  emptyQuote: {
    color: '#f4f1ea',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 9,
    lineHeight: 15,
  },
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
