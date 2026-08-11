import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { midseasonTrainingViewModel } from '../../../application/midseason-training';
import { homeViewModel } from '../../../application/view-models';
import { acceptMidseasonTraining, type GameState } from '../../../game';
import type { DivisionLevel } from '../../../game/pyramid';
import {
  MidseasonTrainingCaptainWalkOn,
  MidseasonTrainingDecisionCard,
} from '../../MidseasonTrainingPrompt';
import { MidseasonTrainingCelebrationScreen } from '../../screens/MidseasonTrainingCelebrationScreen';
import { ClubHomeScreen } from '../../screens/ClubHomeScreen';
import { DevHarnessButton } from '../DevHarnessControls';
import { devHarnessCareerAtWeek } from '../career';
import type { DevHarnessEntry } from '../registry';

type TrainingStage = 'walk-on' | 'card' | 'celebration' | 'done';

function careerForDivision(division: DivisionLevel): GameState {
  const base = devHarnessCareerAtWeek(1, 19, 20260811);
  if (base.m2 === undefined) throw new Error('harness career has no pyramid');
  const userClub = base.m2.pyramid.divisions
    .flatMap((entry) => entry.clubs)
    .find((club) => club.id === base.userClubId);
  if (userClub === undefined) throw new Error('harness club has no division');
  return {
    ...base,
    week: 19,
    trainingPoints: division === 1 ? 125 : 37,
    m2: {
      ...base.m2,
      pyramid: {
        ...base.m2.pyramid,
        divisions: base.m2.pyramid.divisions.map((entry) => ({
          ...entry,
          clubs: [
            ...entry.clubs.filter((club) => club.id !== base.userClubId),
            ...(entry.level === division ? [userClub] : []),
          ],
        })),
      },
    },
  };
}

export function MidseasonTrainingReel({
  division,
}: {
  readonly division: DivisionLevel;
}) {
  const [run, setRun] = useState(0);
  const [state, setState] = useState<GameState>(() =>
    careerForDivision(division),
  );
  const [stage, setStage] = useState<TrainingStage>('walk-on');
  const viewModel = useMemo(() => midseasonTrainingViewModel(state), [state]);

  const reset = () => {
    setState(careerForDivision(division));
    setStage('walk-on');
    setRun((value) => value + 1);
  };

  return (
    <View style={styles.root}>
      {stage === 'walk-on' || stage === 'card' ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <ClubHomeScreen
            viewModel={homeViewModel(state)}
            onOpenFixture={() => {}}
            onOpenAlert={() => {}}
            onOpenLeague={() => {}}
            onProtectBoardCandidate={() => {}}
          />
        </View>
      ) : null}
      {stage === 'walk-on' ? (
        <MidseasonTrainingCaptainWalkOn
          key={`walk-on:${run}`}
          viewModel={viewModel}
          onDone={() => setStage('card')}
        />
      ) : null}
      {stage === 'card' ? (
        <MidseasonTrainingDecisionCard
          viewModel={viewModel}
          onYes={() => {
            setState((career) => acceptMidseasonTraining(career));
            setStage('celebration');
          }}
          onNo={() => {
            setStage('done');
          }}
        />
      ) : null}
      {stage === 'celebration' ? (
        <MidseasonTrainingCelebrationScreen
          key={`celebration:${run}`}
          viewModel={viewModel}
          onContinue={() => setStage('done')}
        />
      ) : null}
      {stage === 'done' ? (
        <View style={styles.done}>
          <Text style={styles.doneTitle}>HOME</Text>
          <DevHarnessButton
            label="REPLAY FLOW"
            hint="Replay the Week 19 team training flow"
            onPress={reset}
          />
        </View>
      ) : null}
    </View>
  );
}

export const midseasonTrainingEntry: DevHarnessEntry = Object.freeze({
  id: 'midseason-training',
  group: 'Season',
  title: 'Week 19 team training',
  summary: 'Captain request, all-TP choice, and full-squad training payoff.',
  cases: Object.freeze([
    {
      id: 'd5',
      label: 'D5 · +1',
      note: '37 TP · the opening division reward',
    },
    {
      id: 'd1',
      label: 'D1 · +5',
      note: '125 TP · the maximum division reward',
    },
  ]),
  render: (caseId: string) => (
    <MidseasonTrainingReel key={caseId} division={caseId === 'd1' ? 1 : 5} />
  ),
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f1ea' },
  done: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
  },
  doneTitle: {
    color: '#241f2e',
    fontFamily: 'HFMSilkscreen_700Bold',
    fontSize: 20,
    textAlign: 'center',
  },
});
