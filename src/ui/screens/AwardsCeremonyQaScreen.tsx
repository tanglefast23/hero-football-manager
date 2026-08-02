import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
} from '../awards-ceremony-qa';
import { awardCeremonyStages } from '../awards-ceremony-stage';
import { AwardsCeremonyScreen } from './AwardsCeremonyScreen';

/**
 * Developer-only reel for the division awards ceremony.
 *
 * The ceremony plays once a season, at a boundary a running career takes a full
 * season to reach, and Jest runs with no DOM — so sprite placement, bubble
 * wrapping and whether the skip control survives the full-screen speech overlay
 * had never been seen by anybody. This drives the REAL `AwardsCeremonyScreen`
 * against fabricated podiums; it renders none of the ceremony itself, so what
 * the reel shows is what a career shows.
 *
 * The controls overlay the ceremony rather than sitting above it in a column.
 * The speech bubble places itself against the WINDOW height, so a ceremony
 * given a shorter container would misplace its own bubble and the reel would
 * report a fault it invented. Hide the panel to see the layout untouched.
 */
export function AwardsCeremonyQaScreen() {
  const [caseId, setCaseId] = useState<AwardsCeremonyQaCaseId>('mixed');
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
          <View style={styles.row}>
            <Text style={styles.rowLabel}>CASE</Text>
            {AWARDS_CEREMONY_QA_CASES.map(entry => (
              <QaButton
                key={entry.id}
                label={entry.label}
                hint={`Show the ${entry.label} ceremony`}
                selected={entry.id === caseId}
                onPress={() => setCaseId(entry.id)}
              />
            ))}
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>OPEN</Text>
            {targets.map(entry => (
              <QaButton
                key={entry.id}
                label={entry.code}
                hint={`Open the ceremony on ${entry.label}`}
                selected={entry.id === target}
                onPress={() => setTarget(entry.id)}
              />
            ))}
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>MOTION</Text>
            <QaButton
              label="Full"
              hint="Play the walk-on and the prize count-up in full"
              selected={!reduceMotion}
              onPress={() => setReduceMotion(false)}
            />
            <QaButton
              label="Reduced"
              hint="Reduce motion, which parks the walk-on and shows the prize total at once"
              selected={reduceMotion}
              onPress={() => setReduceMotion(true)}
            />
            <QaButton label="Replay" hint="Restart this ceremony" onPress={replay} />
            <QaButton
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
          <QaButton
            label="QA ▴"
            hint="Show the review controls"
            onPress={() => setControlsVisible(true)}
          />
        </View>
      )}
    </View>
  );
}

function QaButton({
  label,
  hint,
  selected = false,
  onPress,
}: {
  readonly label: string;
  readonly hint: string;
  readonly selected?: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint}
      accessibilityState={{ selected }}
      onPress={onPress}
      // Static styles only, and the height among them: a function-form style on
      // a Pressable drops layout properties on iOS and collapses it to nothing.
      style={selected ? styles.buttonSelected : styles.button}
    >
      <Text style={selected ? styles.buttonTextSelected : styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

/**
 * 44pt tall and explicitly so: a function-form style on a Pressable drops
 * layout properties on iOS, so the height can never live in a pressed-state
 * callback. Narrow enough that all five jump buttons hold one row.
 */
const BUTTON_BASE = {
  minHeight: 44,
  minWidth: 52,
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 2,
  paddingHorizontal: 6,
  paddingVertical: 8,
} as const;

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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  rowLabel: {
    width: 42,
    color: '#edb54a',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 8,
  },
  button: {
    ...BUTTON_BASE,
    borderColor: '#5d526e',
    backgroundColor: '#3a3350',
  },
  buttonSelected: {
    ...BUTTON_BASE,
    borderColor: '#edb54a',
    backgroundColor: '#edb54a',
  },
  buttonText: {
    color: '#f4f1ea',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 9,
    textAlign: 'center',
  },
  buttonTextSelected: {
    color: '#241f2e',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 9,
    textAlign: 'center',
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
