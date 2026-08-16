import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadLaunchContent } from '../../../content/load';
import type { AssistantGuideFocus } from '../../../content/schemas';
import { beatMoment } from '../../bert-beat-moments';
import { briefingBeats } from '../../bert-briefing-beats';
import { BertBriefingWalkOn } from '../../BertBriefingWalkOn';
import {
  DevHarnessButton,
  devHarnessControlStyles,
} from '../DevHarnessControls';
import type { DevHarnessEntry } from '../registry';

/**
 * Bert's twenty-nine briefings, on demand.
 *
 * Each one fires exactly once per career on its own trigger, and several of the
 * triggers are years deep — a retirement, the board's ultimatum, the legacy
 * choice. Most of this copy has not been read aloud since it was written, and
 * the walk-on has never been watched against most of it: the bubble wrapping,
 * the spotlight moving mid-sentence, and above all whether the face he wears
 * suits the line he is saying.
 *
 * Twenty-nine chips would be an index, not a set of bookmarks, so the cases are
 * the six areas of the game he teaches and the sequence picker lives inside the
 * entry. Anything a reviewer flips while standing in one area — which sequence,
 * whether the measured anchors are supplied — is an entry control.
 */

/**
 * Sequences with an authored expression run in `bert-beat-moments.ts`.
 *
 * Mirrored rather than imported because the map itself is private to that
 * module, and the interesting fact — this sequence is wearing whatever the
 * fallback happened to give it — is exactly what a reviewer needs printed on
 * screen. `assistant-beats.test.ts` fails if the two lists drift apart.
 */
const AUTHORED_EXPRESSION_RUNS: readonly string[] = Object.freeze([
  'management-intro',
  'desk-intro',
  'green-bull-training',
  'coach-speech',
  'expired-contract',
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
  'player-requests',
  'first-injury',
  'first-emergency-loan',
  'first-transfer-request',
  'retirement',
  'club-legacy',
  'board-ultimatum',
  'board-protection',
  'division-leaders',
  'sponsor-desk',
  'sponsor-desk-continuity',
  'sponsor-buzz',
  'scout-report-unaffordable',
  // The last eight are authored the same way but have no content sequence: they
  // are one-off remarks App.tsx hands him as a custom message, so the reel
  // cannot play them. They belong here all the same — this list is a claim
  // about what has been authored, not about what is reachable from the reel.
  'inbox-duty-reminder',
  'first-cup-exit',
  'first-scout-favor',
  'first-fans',
  'first-fans-ledger',
  'board-financial-warning',
  'board-emergency-loan',
  'facility-error',
]);

/** Short enough for a 52pt chip; the note line carries the full id. */
const SEQUENCE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  'management-intro': 'INTRO',
  'desk-intro': 'DESK',
  'green-bull-training': 'GREEN',
  'coach-speech': 'SPEECH',
  'expired-contract': 'RENEW',
  'head-coach-market': 'COACHES',
  'head-coach-hire': 'HEAD',
  'coaching-office': 'OFFICE',
  'assistant-coach-hire': 'ASSIST',
  'facility-placement': 'PLACE',
  'facility-upgrade': 'UPGRADE',
  'facility-adjacency': 'EDGES',
  'scout-mission': 'MISSION',
  'scout-report': 'REPORT',
  'scout-report-unaffordable': 'NO CASH',
  'roster-cap': 'CAP',
  'transfer-list': 'LIST',
  'transfer-bid': 'BID',
  'transfer-negotiation': 'TALKS',
  'youth-intake': 'YOUTH',
  'national-cup': 'CUP',
  'division-leaders': 'LEADERS',
  'player-requests': 'ASKS',
  'first-injury': 'INJURY',
  'first-emergency-loan': 'LOAN',
  'first-transfer-request': 'WANTOUT',
  retirement: 'RETIRE',
  'club-legacy': 'LEGACY',
  'board-ultimatum': 'WARNING',
  'board-protection': 'PROTECT',
  'sponsor-desk': 'DEALS',
  'sponsor-desk-continuity': 'SAFE',
  'sponsor-buzz': 'BUZZ',
});

interface BeatGroup {
  readonly id: string;
  readonly label: string;
  readonly note: string;
  readonly sequenceIds: readonly string[];
}

/**
 * Declared above the entry, not below it: `cases` reads this while the module
 * is still evaluating, and a `const` below would still be in its temporal dead
 * zone. TypeScript cannot see that through the arrow function, so the only
 * symptom is a blank bundle at runtime.
 *
 * Grouped by the part of the game each briefing teaches, because that is the
 * axis a wrong face shows up on: the market beats should all read as business
 * and the late-career ones should not.
 */
const BEAT_GROUPS: readonly BeatGroup[] = Object.freeze([
  {
    id: 'opening',
    label: 'Opening',
    note: 'The two briefings every career starts with, spotlight and all',
    sequenceIds: ['management-intro', 'desk-intro'],
  },
  {
    id: 'backroom',
    label: 'Backroom',
    note: 'Coaches, sponsors, the office and the ground the club is built on',
    sequenceIds: [
      'head-coach-market',
      'head-coach-hire',
      'coaching-office',
      'assistant-coach-hire',
      'facility-placement',
      'facility-upgrade',
      'facility-adjacency',
      'sponsor-desk',
      'sponsor-desk-continuity',
      'sponsor-buzz',
    ],
  },
  {
    id: 'market',
    label: 'Market',
    note: 'Scouting, the roster cap and the whole transfer counter',
    sequenceIds: [
      'scout-mission',
      'scout-report',
      'scout-report-unaffordable',
      'roster-cap',
      'transfer-list',
      'transfer-bid',
      'transfer-negotiation',
      'youth-intake',
    ],
  },
  {
    id: 'competition',
    label: 'Cups',
    note: 'The two competition explainers, both of them two beats long',
    sequenceIds: ['national-cup', 'division-leaders'],
  },
  {
    id: 'dressing-room',
    label: 'Squad',
    note: 'Requests, injuries, the loan, and a player asking for the door',
    sequenceIds: [
      'player-requests',
      'green-bull-training',
      'coach-speech',
      'first-injury',
      'first-emergency-loan',
      'first-transfer-request',
    ],
  },
  {
    id: 'late',
    label: 'Late',
    note: 'Season-end and years in: renewals, retirements, legacy, and the board losing patience',
    sequenceIds: [
      // Grouped with the other season-end beats rather than with the opening
      // pair it sits beside in the content file: a reviewer checking renewal
      // copy is checking the review screen, and retirement is the next card on
      // it.
      'expired-contract',
      'retirement',
      'club-legacy',
      'board-ultimatum',
      'board-protection',
    ],
  },
]);

const GROUP_BY_ID = new Map(BEAT_GROUPS.map((group) => [group.id, group]));

export function AssistantBeatsReel({ caseId }: { readonly caseId: string }) {
  const group = GROUP_BY_ID.get(caseId) ?? BEAT_GROUPS[0];
  const content = useMemo(() => loadLaunchContent().assistantGuide, []);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [sequenceId, setSequenceId] = useState(group.sequenceIds[0]);
  const [anchored, setAnchored] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [runKey, setRunKey] = useState(0);
  const [focus, setFocus] = useState<AssistantGuideFocus>();

  const beats = useMemo(
    () => briefingBeats(content, sequenceId),
    [content, sequenceId],
  );
  const replay = useCallback(() => setRunKey((key) => key + 1), []);
  // Stable, or the walk-on's focus effect would report into a new callback on
  // every render and never settle.
  const reportFocus = useCallback(
    (next: AssistantGuideFocus | undefined) => setFocus(next),
    [],
  );

  /**
   * The money chip and the tab rail are MEASURED in the real app, and the
   * spotlight is the reason the money beat works at all. There is no rail here
   * to measure, so plausible geometry is supplied instead — a chip in the top
   * right, a rail across the foot — and the toggle takes it away again for a
   * reviewer who wants to see the walk-on with nothing lit.
   */
  const moneyAnchor = anchored
    ? {
        x: Math.max(12, width - 132),
        y: insets.top + 8,
        width: 120,
        height: 36,
      }
    : null;
  const navigationAnchor = anchored
    ? { x: 0, y: Math.max(0, height - 84), width, height: 72 }
    : null;

  const moments = beats.map(
    (_, index) => beatMoment(sequenceId, beats, index) ?? '—',
  );
  const authored = AUTHORED_EXPRESSION_RUNS.includes(sequenceId);

  return (
    <View style={styles.root}>
      <BertBriefingWalkOn
        // The briefing reads its beats once and walks them; every control that
        // changes what he says has to bring a new instance with it.
        key={`${sequenceId}:${anchored}:${reduceMotion}:${runKey}`}
        content={content}
        sequenceId={sequenceId}
        moneyAnchor={moneyAnchor}
        navigationAnchor={navigationAnchor}
        reduceMotion={reduceMotion}
        onFocusChange={reportFocus}
        onDone={replay}
      />

      {controlsVisible ? (
        <View style={[styles.panel, { paddingBottom: insets.bottom + 12 }]}>
          <View style={devHarnessControlStyles.row}>
            <Text style={devHarnessControlStyles.rowLabel}>BEAT</Text>
            {group.sequenceIds.map((id) => (
              <DevHarnessButton
                key={id}
                label={SEQUENCE_LABELS[id] ?? id}
                hint={`Play the ${id} briefing`}
                selected={id === sequenceId}
                onPress={() => setSequenceId(id)}
              />
            ))}
          </View>

          <View style={devHarnessControlStyles.row}>
            <Text style={devHarnessControlStyles.rowLabel}>STAGE</Text>
            <DevHarnessButton
              label="Lit"
              hint="Supply the measured money chip and tab rail the spotlight needs"
              selected={anchored}
              onPress={() => setAnchored(true)}
            />
            <DevHarnessButton
              label="Bare"
              hint="Withhold the anchors, so nothing is lit and he stands on the fallback floor"
              selected={!anchored}
              onPress={() => setAnchored(false)}
            />
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
              label="Replay"
              hint="Start this briefing again"
              onPress={replay}
            />
            <DevHarnessButton
              label="Hide"
              hint="Hide the review controls"
              onPress={() => setControlsVisible(false)}
            />
          </View>

          <Text style={styles.note}>
            {sequenceId} · {beats.length} beat{beats.length === 1 ? '' : 's'} ·
            lit: {focus ?? 'nothing'}
          </Text>
          <Text style={styles.stageLine}>
            {authored ? 'AUTHORED LOOKS' : 'DEFAULT RUN — NO AUTHORED LOOKS'} ·{' '}
            {moments.join(' ▸ ')}
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
 * Six areas, twenty-nine briefings.
 *
 * A case is the area; which of its briefings is playing is where you happen to
 * be standing inside it, and every one of them is a tap away from every other.
 */
export const assistantBeatsEntry: DevHarnessEntry = Object.freeze({
  id: 'assistant-beats',
  group: 'Guidance',
  title: "Bert's briefings",
  summary:
    'All 29 briefing sequences, grouped by what they teach, with the look he wears on each beat.',
  cases: Object.freeze(
    BEAT_GROUPS.map((group) =>
      Object.freeze({
        id: group.id,
        label: group.label,
        note: group.note,
      }),
    ),
  ),
  render: (caseId: string) => <AssistantBeatsReel caseId={caseId} />,
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
  stageLine: {
    color: '#9a95a4',
    fontFamily: 'HFMSilkscreen_700Bold',
    fontSize: 9,
  },
});
