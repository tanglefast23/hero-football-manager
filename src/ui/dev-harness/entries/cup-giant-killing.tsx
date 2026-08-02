import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadLaunchContent } from '../../../content/load';
import {
  completeCupGiantKillingCelebration,
  cupGiantKillingCelebration,
  queueCupGiantKillingCelebration,
} from '../../../game/cup-giant-killing';
import type { NationalCupFixture } from '../../../game/pyramid';
import type { GameState } from '../../../game/types';
import { BertBriefingWalkOn } from '../../BertBriefingWalkOn';
import { devHarnessCareerAtWeek } from '../career';
import { DevHarnessButton, devHarnessControlStyles } from '../DevHarnessControls';
import type { DevHarnessEntry } from '../registry';

/**
 * The Cup upset, which needs an upset.
 *
 * A club only sees this by drawing a side from a higher division in the
 * National Cup and then beating it, so the two-division-and-worse copy — the
 * one that claims a result like this happens once or twice in a hundred tries —
 * is among the least-seen strings in the game. The queue behind it has been
 * seen by nobody at all: celebrations are appended to
 * `pendingCupGiantKillingCelebrations` and dismissed one at a time, and a Cup
 * weekend can produce more than one.
 *
 * The state is a REAL career in its first season, so the divisions come from
 * the Cup's own frozen draw seeding rather than from anything typed here, and
 * the celebration is built by the shipped `cupGiantKillingCelebration`. Only
 * the fixture — seven fields naming two clubs — is fabricated, because the
 * seeded career's own draw cannot be made to produce a chosen gap on demand.
 */

/** Season 1 of this career, where the club is still in D5 and everyone is above it. */
const UPSET_SEED = 23;
const UPSET_SEASON = 1;
const UPSET_WEEK = 6;
/** Late enough to read as a giant-killing rather than a play-in round. */
const UPSET_ROUND = 4;

interface UpsetCase {
  readonly id: string;
  readonly label: string;
  readonly note: string;
  /** Opponent divisions, in the order they should queue. */
  readonly opponentDivisions: readonly number[];
}

/**
 * Declared above the entry, not below it: `cases` reads this while the module
 * is still evaluating, and a `const` below would still be in its temporal dead
 * zone. TypeScript cannot see that through the arrow function, so the only
 * symptom is a blank bundle at runtime.
 */
const UPSET_CASES: readonly UpsetCase[] = Object.freeze([
  {
    id: 'one-division',
    label: 'One up',
    note: 'D5 beats D4 · the smaller upset, and the only one with its own copy',
    opponentDivisions: [4],
  },
  {
    id: 'giant-killing',
    label: 'Giant',
    note: 'D5 beats D1 · the widest gap the pyramid allows',
    opponentDivisions: [1],
  },
  {
    id: 'queued',
    label: 'Queue',
    note: 'Three upsets waiting at once · first in, first watched',
    opponentDivisions: [4, 3, 1],
  },
]);

const CASE_BY_ID = new Map(UPSET_CASES.map(entry => [entry.id, entry]));

/** A club from `division` in this Cup's frozen draw seeding, never the user's. */
function opponentInDivision(state: GameState, division: number): string | undefined {
  const cup = state.m2?.nationalCups.find(candidate => candidate.season === UPSET_SEASON);
  const seeds = cup?.seedDivisionByClubId;
  if (seeds === undefined) return undefined;
  return Object.keys(seeds).find(clubId => (
    clubId !== state.userClubId && seeds[clubId] === division
  ));
}

function upsetFixture(state: GameState, opponentClubId: string): NationalCupFixture {
  return {
    id: `dev-harness-upset-${opponentClubId}`,
    season: UPSET_SEASON,
    round: UPSET_ROUND,
    // The club is at home for its own famous night.
    homeClubId: state.userClubId,
    awayClubId: opponentClubId,
    matchSeed: 1,
    status: 'played',
  };
}

/** The career with every upset this case asks for already queued behind it. */
function queuedCareer(caseId: string): GameState {
  const base = devHarnessCareerAtWeek(UPSET_SEASON, UPSET_WEEK, UPSET_SEED);
  const upsetCase = CASE_BY_ID.get(caseId) ?? UPSET_CASES[0];
  let state = base;
  for (const division of upsetCase.opponentDivisions) {
    const opponentClubId = opponentInDivision(base, division);
    if (opponentClubId === undefined) continue;
    state = queueCupGiantKillingCelebration(
      state,
      cupGiantKillingCelebration(state, upsetFixture(base, opponentClubId), base.userClubId),
    );
  }
  return state;
}

export function CupGiantKillingReel({ caseId }: { readonly caseId: string }) {
  const content = useMemo(() => loadLaunchContent().assistantGuide, []);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [state, setState] = useState<GameState>(() => queuedCareer(caseId));
  const [reduceMotion, setReduceMotion] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const pending = state.pendingCupGiantKillingCelebrations ?? [];
  const celebration = pending[0];

  const replay = useCallback(() => setState(queuedCareer(caseId)), [caseId]);
  const dismiss = useCallback(() => setState(current => (
    (current.pendingCupGiantKillingCelebrations ?? []).length === 0
      ? current
      : completeCupGiantKillingCelebration(current)
  )), []);

  const opponentName = useMemo(() => {
    if (celebration === undefined) return undefined;
    const opponentClubId = celebration.fixtureId.replace('dev-harness-upset-', '');
    return state.m2?.pyramid.divisions
      .flatMap(division => division.clubs)
      .find(club => club.id === opponentClubId)?.name ?? opponentClubId;
  }, [celebration, state.m2]);

  // The tab rail is measured in the real app and is the floor he walks along.
  // There is none here, so plausible geometry stands in for it.
  const navigationAnchor = { x: 0, y: Math.max(0, height - 84), width, height: 72 };

  return (
    <View style={styles.root}>
      {celebration === undefined ? (
        <View style={styles.emptyStage}>
          <Text style={styles.emptyText}>QUEUE EMPTY</Text>
        </View>
      ) : (
        <BertBriefingWalkOn
          // Same key the app uses: one instance per celebration, so dismissing
          // the head of the queue starts the next one from its first frame.
          key={celebration.fixtureId}
          content={content}
          customMessage={celebration}
          navigationAnchor={navigationAnchor}
          reduceMotion={reduceMotion}
          onDone={dismiss}
        />
      )}

      {controlsVisible ? (
        <View style={[styles.panel, { paddingBottom: insets.bottom + 12 }]}>
          <View style={devHarnessControlStyles.row}>
            <Text style={devHarnessControlStyles.rowLabel}>QUEUE</Text>
            <DevHarnessButton
              label="Next"
              hint="Dismiss the celebration at the head of the queue"
              onPress={dismiss}
            />
            <DevHarnessButton label="Replay" hint="Queue this case again" onPress={replay} />
            <DevHarnessButton
              label="Motion"
              hint="Play the walk-on in full"
              selected={!reduceMotion}
              onPress={() => setReduceMotion(false)}
            />
            <DevHarnessButton
              label="Reduced"
              hint="Reduce motion, which parks the walk-on"
              selected={reduceMotion}
              onPress={() => setReduceMotion(true)}
            />
            <DevHarnessButton
              label="Hide"
              hint="Hide the review controls"
              onPress={() => setControlsVisible(false)}
            />
          </View>

          <Text style={styles.note}>
            {celebration === undefined
              ? 'Nothing left to watch · Replay queues this case again'
              : `Beat ${opponentName} · ${celebration.divisionGap} division${celebration.divisionGap === 1 ? '' : 's'} up · ${pending.length} waiting`}
          </Text>
          {celebration === undefined ? null : (
            <Text style={styles.stageLine}>{celebration.title}</Text>
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
 * Three cases, because the copy only knows three things: a one-division upset,
 * everything wider than that, and more than one of them at once. Dismissing,
 * replaying and reduced motion are all things done while standing in one of
 * those, so they stay here.
 */
export const cupGiantKillingEntry: DevHarnessEntry = Object.freeze({
  id: 'cup-giant-killing',
  group: 'Cup',
  title: 'Cup giant-killing',
  summary: 'The celebration for beating a bigger club, including two arriving back to back.',
  cases: Object.freeze(UPSET_CASES.map(entry => Object.freeze({
    id: entry.id,
    label: entry.label,
    note: entry.note,
  }))),
  render: (caseId: string) => <CupGiantKillingReel caseId={caseId} />,
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#241f2e' },
  emptyStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#5d526e',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 12,
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
  stageLine: {
    color: '#9a95a4',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 9,
  },
});
