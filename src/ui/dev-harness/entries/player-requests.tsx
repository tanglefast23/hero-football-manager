import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { playerRequestViewModel } from '../../../application/player-request-view-model';
import { squadTrainingViewModel } from '../../../application/view-models';
import { loadLaunchContent } from '../../../content/load';
import { playerLoyalty } from '../../../game/loyalty';
import {
  advancePlayerRequests,
  resolvePlayerRequest,
  starQualifiers,
  STAR_FAME_THRESHOLD,
  weightForPlayer,
} from '../../../game/player-requests';
import { SEASON_WEEKS, type GameState } from '../../../game/types';
import { PlayerRequestDecisionCard } from '../../PlayerRequestDecisionCard';
import { PlayerRequestWalkOn } from '../../PlayerRequestWalkOn';
import { SquadTrainingScreen } from '../../screens/SquadTrainingScreen';
import type { SquadSort } from '../../squad-sort';
import { devHarnessCareerAtWeek } from '../career';
import {
  DevHarnessButton,
  devHarnessControlStyles,
} from '../DevHarnessControls';
import type { DevHarnessEntry } from '../registry';

/**
 * The dressing room asking for things — shipped in PR #57, never looked at.
 *
 * Three surfaces, all driven here by the real `playerRequestViewModel`: the
 * Requests tab with its pending card and its ledger, the asking player's
 * walk-on, and the decision card that prices both answers. Granting and
 * refusing go through the shipped `resolvePlayerRequest`, so the loyalty and
 * morale the panel below reports are the ones the career would keep.
 *
 * The whole `SquadTrainingScreen` is rendered, not just `SquadRequestsPanel`.
 * The panel alone is a section label and one card — about a third of a phone —
 * and floated on the harness's own cream it read as an unfinished screen rather
 * than as a sparse tab. What a manager actually sees around it is the Squad
 * room heading and the Drills/Requests tab row that the panel is one half of,
 * so those are here, drawn by the shipped screen off the shipped
 * `squadTrainingViewModel`. `initialSquadTab` is the one thing the reel asks of
 * it: an address should land on the tab it names.
 *
 * Two things had to be arranged rather than waited for.
 *
 * The catalog: `createLaunchCareerSetup` never puts `playerRequestRules` on a
 * career — only the store does, at `store.ts`, and reconciliation does for old
 * saves. So a career built the way this harness builds one has no catalog at
 * all and `advancePlayerRequests` returns on its first line forever. It is
 * supplied here the same way the store supplies it.
 *
 * The wait: even with the catalog, a request needs its cadence to elapse, and
 * the harness career stops on a management week rather than running the weekly
 * settlement that draws one. So the weeks are stepped forward through the real
 * `advancePlayerRequests` — the one call settlement makes — until the state a
 * case wants exists. Nothing about who asks, what they want or what it costs is
 * chosen here; all of it comes out of the seeded draw.
 */

const REQUEST_SEED = 23;
/**
 * Requests open at S2 W5, but the star case needs a star: on this seed the
 * first-team regulars cross the 200-fame star threshold in season 6, at 210.
 * Season 3 was enough back when the threshold was 50 and fame capped at 99.
 */
const REQUEST_SEASON = 6;
const REQUEST_WEEK = 2;
/** Weeks of drawing before a case gives up. The longest wanted state lands well inside it. */
const STEP_BUDGET = 80;

type RequestStage = 'tab' | 'walk-on' | 'card';

interface RequestCase {
  readonly id: string;
  readonly label: string;
  readonly note: string;
}

/**
 * Declared above the entry, not below it: `cases` reads this while the module
 * is still evaluating, and a `const` below would still be in its temporal dead
 * zone. TypeScript cannot see that through the arrow function, so the only
 * symptom is a blank bundle at runtime.
 *
 * There is deliberately no "several pending" case: `playerRequests.pending` is
 * a single optional record, so the game can only ever hold one open ask.
 */
const REQUEST_CASES: readonly RequestCase[] = Object.freeze([
  {
    id: 'star',
    label: 'Star',
    note: 'A first-team name asks · double weight, and a price off their wage',
  },
  {
    id: 'squad',
    label: 'Squad',
    note: 'A reserve asks · base weight, and a much smaller ask',
  },
  {
    id: 'last-week',
    label: 'Last week',
    note: 'Already warned once · one week left before the silence answers for you',
  },
  {
    id: 'broke',
    label: 'Broke',
    note: 'A money ask past the books · the only state that disables Grant',
  },
  {
    id: 'quiet',
    label: 'Quiet',
    note: 'Nobody waiting · the empty docket and the ledger of what lapsed',
  },
]);

/** The catalog the store attaches at career creation, attached the same way. */
function withCatalog(state: GameState): GameState {
  return { ...state, playerRequestRules: loadLaunchContent().playerRequests };
}

/**
 * Steps the real weekly request draw until `stop` accepts the career.
 *
 * Only the request clock advances — no matches, no wages, no ageing — because
 * those change nothing a request reads except the wage the price is taken from,
 * and that is already whatever the seeded career made it.
 */
function steppedCareer(stop: (state: GameState) => boolean): GameState {
  let state = withCatalog(
    devHarnessCareerAtWeek(REQUEST_SEASON, REQUEST_WEEK, REQUEST_SEED),
  );
  for (let step = 0; step < STEP_BUDGET; step += 1) {
    state = advancePlayerRequests(state, true);
    if (stop(state)) return state;
    state =
      state.week >= SEASON_WEEKS
        ? { ...state, season: state.season + 1, week: 1 }
        : { ...state, week: state.week + 1 };
  }
  return state;
}

function askerWeight(state: GameState): number {
  const pending = state.playerRequests?.pending;
  const asker = state.players.find((player) => player.id === pending?.playerId);
  if (asker === undefined) return 0;
  const catalog = state.playerRequestRules;
  const qualifiers = starQualifiers(
    state.seasonStatLines ?? [],
    state.season,
    catalog?.tuning.starGoalRank ?? 2,
  );
  return weightForPlayer(
    asker,
    qualifiers,
    catalog?.tuning.starFameThreshold ?? STAR_FAME_THRESHOLD,
  );
}

function careerForCase(caseId: string): GameState {
  if (caseId === 'squad') {
    return steppedCareer((state) => askerWeight(state) === 1);
  }
  if (caseId === 'last-week') {
    return steppedCareer(
      (state) => state.playerRequests?.pending?.warned === true,
    );
  }
  if (caseId === 'broke') {
    // The one field this reel writes. Wage-multiple pricing tops out near a
    // couple of thousand against a five-figure balance, so a solvent club can
    // always say yes and the disabled Grant is unreachable by waiting.
    const state = steppedCareer(
      (item) =>
        item.playerRequests?.pending?.costAmount !== undefined &&
        // Not the first money ask, so this case shows a different request from
        // the three that open on one.
        (item.playerRequests?.history.length ?? 0) >= 1,
    );
    const cost = state.playerRequests?.pending?.costAmount ?? 0;
    return {
      ...state,
      clubs: state.clubs.map((club) =>
        club.id === state.userClubId
          ? { ...club, cash: Math.max(0, cost - 1) }
          : club,
      ),
    };
  }
  if (caseId === 'quiet') {
    return steppedCareer(
      (state) =>
        state.playerRequests?.pending === undefined &&
        (state.playerRequests?.history.length ?? 0) >= 3,
    );
  }
  return steppedCareer((state) => askerWeight(state) === 2);
}

export function PlayerRequestsReel({ caseId }: { readonly caseId: string }) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<GameState>(() => careerForCase(caseId));
  const [stage, setStage] = useState<RequestStage>('tab');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [decision, setDecision] = useState<string>();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>();
  const [squadSort, setSquadSort] = useState<SquadSort | null>(null);

  const viewModel = useMemo(() => playerRequestViewModel(state), [state]);
  const squadViewModel = useMemo(
    () => squadTrainingViewModel(state, loadLaunchContent(), selectedPlayerId),
    [state, selectedPlayerId],
  );
  const pending = viewModel.pending;

  const reset = useCallback(() => {
    setState(careerForCase(caseId));
    setStage('tab');
    setDecision(undefined);
  }, [caseId]);

  const decide = useCallback(
    (resolution: 'GRANTED' | 'REFUSED') => {
      const open = state.playerRequests?.pending;
      const catalog = state.playerRequestRules;
      if (open === undefined || catalog === undefined) return;
      const before = state.players.find(
        (player) => player.id === open.playerId,
      );
      try {
        const settled = resolvePlayerRequest(state, catalog, resolution);
        const after = settled.players.find(
          (player) => player.id === open.playerId,
        );
        setState(settled);
        setStage('tab');
        setDecision(
          before === undefined || after === undefined
            ? resolution
            : `${resolution} · loyalty ${playerLoyalty(before, state.careerSeed)} → ${playerLoyalty(after, state.careerSeed)} · morale ${before.morale} → ${after.morale}`,
        );
      } catch (error) {
        setDecision(`Refused by the rules: ${(error as Error).message}`);
      }
    },
    [state],
  );

  const weight = askerWeight(state);

  return (
    <View style={styles.root}>
      {/* Full-bleed, like every other entry that opens a whole screen. The
          harness bar and the control panel are overlays with their own hide
          buttons; padding the screen out from under them would shrink it by
          more than half a phone and make the tab look tighter than it is. */}
      <View style={styles.tab}>
        <SquadTrainingScreen
          viewModel={squadViewModel}
          requestViewModel={viewModel}
          initialSquadTab="requests"
          onOpenRequest={() => setStage('walk-on')}
          selectedPlayerId={selectedPlayerId}
          onSelectPlayer={setSelectedPlayerId}
          onTrainDrill={() => {}}
          onTrainDrillBatch={() => {}}
          onBuyDrillUpgrade={() => {}}
          lastDrillResult={null}
          trainingPoints={state.trainingPoints}
          squadSort={squadSort}
          onChangeSquadSort={setSquadSort}
          reduceMotion={reduceMotion}
        />
      </View>

      {stage === 'walk-on' && pending !== undefined ? (
        <PlayerRequestWalkOn
          key={`${pending.requestId}:${pending.playerId}`}
          request={pending}
          reduceMotion={reduceMotion}
          onDone={() => setStage('card')}
        />
      ) : null}

      {stage === 'card' && pending !== undefined ? (
        <PlayerRequestDecisionCard
          request={pending}
          reduceMotion={reduceMotion}
          onGrant={() => decide('GRANTED')}
          onRefuse={() => decide('REFUSED')}
        />
      ) : null}

      {controlsVisible ? (
        <View style={[styles.panel, { paddingBottom: insets.bottom + 12 }]}>
          <View style={devHarnessControlStyles.row}>
            <Text style={devHarnessControlStyles.rowLabel}>STAGE</Text>
            <DevHarnessButton
              label="Tab"
              hint="Show the Requests tab"
              selected={stage === 'tab'}
              onPress={() => setStage('tab')}
            />
            <DevHarnessButton
              label="Walk-on"
              hint="Play the asking player's walk-on"
              selected={stage === 'walk-on'}
              onPress={() => setStage('walk-on')}
            />
            <DevHarnessButton
              label="Card"
              hint="Show the decision card"
              selected={stage === 'card'}
              onPress={() => setStage('card')}
            />
          </View>

          <View style={devHarnessControlStyles.row}>
            <Text style={devHarnessControlStyles.rowLabel}>ANSWER</Text>
            <DevHarnessButton
              label="Grant"
              hint="Grant the request for real"
              onPress={() => decide('GRANTED')}
            />
            <DevHarnessButton
              label="Refuse"
              hint="Refuse the request for real"
              onPress={() => decide('REFUSED')}
            />
            <DevHarnessButton
              label="Reset"
              hint="Redraw this case from the seeded career"
              onPress={reset}
            />
            <DevHarnessButton
              label="Reduced"
              hint="Reduce motion, which parks the walk-on"
              selected={reduceMotion}
              onPress={() => setReduceMotion((current) => !current)}
            />
            <DevHarnessButton
              label="Hide"
              hint="Hide the review controls"
              onPress={() => setControlsVisible(false)}
            />
          </View>

          <Text style={styles.note}>
            {pending === undefined
              ? `Nothing pending · ${viewModel.history.length} settled`
              : `${pending.playerName} · ×${weight} weight · grant ${pending.grantLabel} · refuse ${pending.refuseLabel} · ${pending.weeksToAnswer} wk left`}
          </Text>
          <Text style={styles.stageLine}>
            {decision ??
              `S${state.season} W${state.week} · ${viewModel.available ? 'TAB LIVE' : 'TAB NOT YET OPEN'}`}
          </Text>
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
 * Five cases, and every one of them is an input the feature reads: who asked,
 * how long they have been waiting, and whether the club can pay. Meeting them,
 * granting and refusing are what a reviewer does while standing in one of the
 * five, so those are controls here rather than five more chips.
 */
export const playerRequestsEntry: DevHarnessEntry = Object.freeze({
  id: 'player-requests',
  group: 'Squad',
  title: 'Player requests',
  summary:
    'The Requests tab, the asking player, and the card that prices both answers.',
  cases: Object.freeze(
    REQUEST_CASES.map((entry) =>
      Object.freeze({
        id: entry.id,
        label: entry.label,
        note: entry.note,
      }),
    ),
  ),
  render: (caseId: string) => <PlayerRequestsReel caseId={caseId} />,
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#241f2e' },
  tab: { flex: 1, backgroundColor: '#f4f1ea' },
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
  stageLine: {
    color: '#9a95a4',
    fontFamily: 'HFMSilkscreen_700Bold',
    fontSize: 9,
  },
});
