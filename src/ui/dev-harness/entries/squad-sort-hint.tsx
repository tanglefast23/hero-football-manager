import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { loadLaunchContent } from '../../../content';
import { squadTrainingViewModel } from '../../../application/view-models';
import { SquadTrainingScreen } from '../../screens/SquadTrainingScreen';
import type { SquadSort } from '../../squad-sort';
import { DevHarnessButton, devHarnessControlStyles } from '../DevHarnessControls';
import { devHarnessCareerAtWeek } from '../career';
import type { DevHarnessEntry } from '../registry';

function SquadSortHintReel() {
  const career = useMemo(() => devHarnessCareerAtWeek(1, 12), []);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>();
  const [squadSort, setSquadSort] = useState<SquadSort | null>(null);
  const [hintVisible, setHintVisible] = useState(true);
  const dismissFrameRef = useRef<number | null>(null);
  const viewModel = useMemo(
    () => squadTrainingViewModel(career, loadLaunchContent(), selectedPlayerId),
    [career, selectedPlayerId],
  );

  // Mirrors ManagementShell: let the tapped control finish before removing the
  // cue and the vertical room reserved for it.
  const dismissHintAfterPress = useCallback(() => {
    if (!hintVisible || dismissFrameRef.current !== null) return;
    dismissFrameRef.current = requestAnimationFrame(() => {
      dismissFrameRef.current = null;
      setHintVisible(false);
    });
  }, [hintVisible]);

  useEffect(() => () => {
    if (dismissFrameRef.current !== null) cancelAnimationFrame(dismissFrameRef.current);
  }, []);

  return (
    <View
      style={styles.root}
      onPointerUp={dismissHintAfterPress}
      onTouchEnd={dismissHintAfterPress}
    >
      <SquadTrainingScreen
        viewModel={viewModel}
        selectedPlayerId={selectedPlayerId}
        onSelectPlayer={setSelectedPlayerId}
        onTrainDrill={() => {}}
        onTrainDrillBatch={() => {}}
        onBuyDrillUpgrade={() => {}}
        lastDrillResult={null}
        trainingPoints={career.trainingPoints}
        squadSort={squadSort}
        onChangeSquadSort={setSquadSort}
        showSortHint={hintVisible}
      />
      {!hintVisible ? (
        <View style={[devHarnessControlStyles.row, styles.reset]}>
          <DevHarnessButton
            label="Show hint"
            hint="Re-arm the one-time Week 12 cue for another review"
            onPress={() => setHintVisible(true)}
          />
        </View>
      ) : null}
    </View>
  );
}

export const squadSortHintEntry: DevHarnessEntry = Object.freeze({
  id: 'squad-sort-hint',
  group: 'Squad',
  title: 'Sortable-column hint',
  summary: 'The Week 12 pointer above Overall, dismissed by the next completed tap.',
  cases: Object.freeze([
    Object.freeze({ id: 'week-12', label: 'Week 12', note: 'First eligible Squad visit · tap anywhere to dismiss' }),
  ]),
  render: () => <SquadSortHintReel />,
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f1ea' },
  reset: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    zIndex: 30,
  },
});
