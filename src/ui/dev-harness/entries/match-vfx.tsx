import { useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MatchScreen } from '../../../render/MatchScreen';
import type { MatchVfxKind } from '../../../render/match-vfx';
import {
  matchVfxShowcaseSeed,
  type MatchVfxQaConfig,
} from '../../../render/match-vfx-showcase';
import {
  DevHarnessButton,
  devHarnessControlStyles,
} from '../DevHarnessControls';
import type { DevHarnessEntry } from '../registry';

export const MATCH_VFX_CASES = [
  {
    id: 'slide-tackle',
    kind: 'slide-tackle',
    label: 'Slide Tackle',
    note: 'Large backward 15% dust trail · 80% phased turf above',
  },
  {
    id: 'standing-tackle',
    kind: 'standing-tackle',
    label: 'Standing Tackle',
    note: 'One compact contact burst for a real standing duel',
  },
  {
    id: 'dangerous-shot',
    kind: 'dangerous-shot',
    label: 'Dangerous Shot',
    note: 'Top-tier shot danger · burst, burning ball and scorch chord',
  },
  {
    id: 'save-impact',
    kind: 'save-impact',
    label: 'Save Impact',
    note: 'Directional glove impact and goalkeeper turf response',
  },
  {
    id: 'power-interruption',
    kind: 'power-interruption',
    label: 'Power Interrupted',
    note: 'A real won tackle breaks a visible power wind-up',
  },
] as const satisfies readonly {
  id: string;
  kind: MatchVfxKind;
  label: string;
  note: string;
}[];

type MatchVfxCaseId = (typeof MATCH_VFX_CASES)[number]['id'];

function caseFor(caseId: MatchVfxCaseId) {
  const found = MATCH_VFX_CASES.find((entry) => entry.id === caseId);
  if (found === undefined) throw new Error(`unknown match VFX case ${caseId}`);
  return found;
}

export function MatchVfxReel({ caseId }: { caseId: MatchVfxCaseId }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [runKey, setRunKey] = useState(0);
  const selected = caseFor(caseId);
  const qa = useMemo<MatchVfxQaConfig>(
    () => ({ kind: selected.kind }),
    [selected.kind],
  );
  const replay = () => setRunKey((current) => current + 1);
  const panelWidth = Math.min(480, Math.max(220, width - 140));

  return (
    <View style={styles.root}>
      <MatchScreen
        key={`${selected.kind}:${reduceMotion}:${runKey}`}
        seed={matchVfxShowcaseSeed(selected.kind)}
        matchVfxQa={qa}
        reduceMotion={reduceMotion}
        maximumSpeed={3}
        onOpenSettings={() => {}}
        onDone={() => {}}
      />

      {controlsVisible ? (
        <View
          style={[
            styles.panel,
            { bottom: insets.bottom + 10, width: panelWidth },
          ]}
        >
          <View style={devHarnessControlStyles.row}>
            <Text style={devHarnessControlStyles.rowLabel}>MOTION</Text>
            <DevHarnessButton
              label="Full"
              hint="Replay with all procedural particles"
              selected={!reduceMotion}
              onPress={() => {
                setReduceMotion(false);
                replay();
              }}
            />
            <DevHarnessButton
              label="Reduced"
              hint="Replay with a static causal effect mark"
              selected={reduceMotion}
              onPress={() => {
                setReduceMotion(true);
                replay();
              }}
            />
            <DevHarnessButton
              label="Replay"
              hint="Reset the match and replay this real event"
              onPress={replay}
            />
            <DevHarnessButton
              label="Hide"
              hint="Hide the effect review controls"
              onPress={() => setControlsVisible(false)}
            />
          </View>
          <Text style={styles.note}>
            {selected.label.toUpperCase()} · {selected.note}
          </Text>
        </View>
      ) : (
        <View style={[styles.showRow, { bottom: insets.bottom + 10 }]}>
          <DevHarnessButton
            label="QA ▾"
            hint="Show the effect review controls"
            onPress={() => setControlsVisible(true)}
          />
        </View>
      )}
    </View>
  );
}

export const matchVfxEntry: DevHarnessEntry = Object.freeze({
  id: 'match-vfx',
  group: 'Match',
  title: 'Procedural Match VFX',
  summary: 'Five real match events with production pitch and player context.',
  cases: Object.freeze(
    MATCH_VFX_CASES.map(({ id, label, note }) =>
      Object.freeze({ id, label, note }),
    ),
  ),
  render: (caseId: string) => (
    <MatchVfxReel caseId={caseId as MatchVfxCaseId} />
  ),
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#3f8a4a' },
  panel: {
    position: 'absolute',
    left: 10,
    zIndex: 40,
    gap: 6,
    borderWidth: 2,
    borderColor: '#edb54a',
    backgroundColor: 'rgba(18,16,25,0.94)',
    padding: 8,
  },
  showRow: {
    position: 'absolute',
    left: 10,
    zIndex: 40,
  },
  note: {
    color: '#d7cfe4',
    fontSize: 11,
    lineHeight: 16,
  },
});
