import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AWARDS_CEREMONY_QA_CASES,
  awardsCeremonyQaLookIds,
  awardsCeremonyQaNote,
  awardsCeremonyQaStageIndex,
  awardsCeremonyQaTargets,
  awardsCeremonyQaViewModel,
  type AwardsCeremonyQaCaseId,
  type AwardsCeremonyQaTargetId,
} from '../../awards-ceremony-qa';
import { awardCeremonyStages } from '../../awards-ceremony-stage';
import { AwardsCeremonyScreen } from '../../screens/AwardsCeremonyScreen';
import { DevHarnessButton, devHarnessControlStyles } from '../DevHarnessControls';
import type { DevHarnessEntry } from '../registry';

/**
 * The division awards ceremony, as the dev harness shows it.
 *
 * The ceremony plays once a season, at a boundary a running career takes a
 * full season to reach, and Jest runs with no DOM — so sprite placement,
 * bubble wrapping and whether the skip control survives the full-screen speech
 * overlay had never been seen by anybody. This drives the REAL
 * `AwardsCeremonyScreen` against fabricated podiums; it renders none of the
 * ceremony itself, so what the reel shows is what a career shows.
 *
 * The controls overlay the ceremony rather than sitting above it in a column.
 * The speech bubble places itself against the WINDOW height, so a ceremony
 * given a shorter container would misplace its own bubble and the reel would
 * report a fault it invented. Hide the panel to see the layout untouched.
 *
 * Case, jump and motion divide up like this: the four cases are four different
 * *seasons* — they change the podiums the ceremony is built from, which is the
 * state worth bookmarking, so the harness owns them and puts them in the URL.
 * The board jump and the motion toggle change nothing about the ceremony, only
 * where you are standing in it; all twenty combinations of case and jump are
 * reachable from any one of them in a tap, so they stay local controls here.
 */
export function AwardsCeremonyReel({
  caseId,
  caseControls,
}: {
  readonly caseId: AwardsCeremonyQaCaseId;
  /**
   * An extra first row inside the control panel. The standalone
   * `EXPO_PUBLIC_AWARDS_CEREMONY_QA` reel puts its own case picker here; under
   * the harness the case picker lives in the harness bar instead, and nothing
   * is passed.
   */
  readonly caseControls?: ReactNode;
}) {
  const [target, setTarget] = useState<AwardsCeremonyQaTargetId>('saves');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [runKey, setRunKey] = useState(0);
  const insets = useSafeAreaInsets();

  const viewModel = useMemo(() => awardsCeremonyQaViewModel(caseId), [caseId]);
  const lookIds = useMemo(() => awardsCeremonyQaLookIds(viewModel), [viewModel]);
  const targets = useMemo(() => awardsCeremonyQaTargets(viewModel), [viewModel]);
  const stageCount = useMemo(() => awardCeremonyStages(viewModel).length, [viewModel]);
  const initialStageIndex = awardsCeremonyQaStageIndex(viewModel, target);

  const replay = useCallback(() => setRunKey(key => key + 1), []);

  return (
    <View style={styles.root}>
      <AwardsCeremonyScreen
        // The ceremony reads its opening stage once, so every control that
        // changes where it opens has to bring a new instance with it.
        key={`${caseId}:${target}:${reduceMotion}:${runKey}`}
        viewModel={viewModel}
        lookIds={lookIds}
        reduceMotion={reduceMotion}
        initialStageIndex={initialStageIndex}
        onComplete={replay}
      />

      {controlsVisible ? (
        <View style={[styles.panel, { paddingBottom: insets.bottom + 12 }]}>
          {caseControls}

          <View style={devHarnessControlStyles.row}>
            <Text style={devHarnessControlStyles.rowLabel}>OPEN</Text>
            {targets.map(entry => (
              <DevHarnessButton
                key={entry.id}
                label={entry.code}
                hint={`Open the ceremony on ${entry.label}`}
                selected={entry.id === target}
                onPress={() => setTarget(entry.id)}
              />
            ))}
          </View>

          <View style={devHarnessControlStyles.row}>
            <Text style={devHarnessControlStyles.rowLabel}>MOTION</Text>
            <DevHarnessButton
              label="Full"
              hint="Play the walk-on and the prize count-up in full"
              selected={!reduceMotion}
              onPress={() => setReduceMotion(false)}
            />
            <DevHarnessButton
              label="Reduced"
              hint="Reduce motion, which parks the walk-on and shows the prize total at once"
              selected={reduceMotion}
              onPress={() => setReduceMotion(true)}
            />
            <DevHarnessButton label="Replay" hint="Restart this ceremony" onPress={replay} />
            <DevHarnessButton
              label="Hide"
              hint="Hide the review controls"
              onPress={() => setControlsVisible(false)}
            />
          </View>

          <Text style={styles.note}>{awardsCeremonyQaNote(viewModel, target)}</Text>
          <Text style={styles.stageLine}>
            OPENS AT STAGE {initialStageIndex + 1} / {stageCount}
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
 * Declared above the entry, not below it: the entry's `cases` read this while
 * the module is still evaluating, and a `const` below would still be in its
 * temporal dead zone. TypeScript cannot see that through the arrow function,
 * so the only symptom is a blank bundle at runtime.
 */
const CASE_NOTES: Readonly<Record<AwardsCeremonyQaCaseId, string>> = Object.freeze({
  mixed: 'Every walk-on rule at once, one board each',
  sweep: 'All four boards won · the prize taper at full stretch',
  thin: 'One name, two names, and a board nobody registered',
  barren: 'Four full boards, nothing won · the prize states the barren season',
});

/**
 * The cases are the four fabricated seasons the reel already carried, kept at
 * their own ids so an address written against the reel keeps meaning what it
 * meant. `barren` reads 'Nothing' on screen because that is what it is.
 */
export const awardsCeremonyEntry: DevHarnessEntry = Object.freeze({
  id: 'awards-ceremony',
  group: 'Season',
  title: 'Division awards',
  summary: 'End-of-season ceremony: four boards, one walk-on each, then the prize.',
  cases: Object.freeze(AWARDS_CEREMONY_QA_CASES.map(entry => Object.freeze({
    id: entry.id,
    label: entry.label,
    note: CASE_NOTES[entry.id],
  }))),
  render: (caseId: string) => (
    <AwardsCeremonyReel caseId={caseId as AwardsCeremonyQaCaseId} />
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
  stageLine: {
    color: '#9a95a4',
    fontFamily: 'HFMSilkscreen_700Bold',
    fontSize: 9,
  },
});
