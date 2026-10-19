import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useEffect } from 'react';
import { loadLaunchContent } from '../../../content';
import { trainPlayerInstantly } from '../../../game/training';
import type { TrainingDrillTier } from '../../../game/promotion-progression';
import type { GameState } from '../../../game/types';
import {
  copyFor,
  ensureCatalog,
  LocaleProvider,
  type Locale,
} from '../../../i18n';
import { squadTrainingViewModel } from '../../../application/view-models';
import type { DrillResultViewModel } from '../../models';
import { SquadTrainingScreen } from '../../screens/SquadTrainingScreen';
import type { SquadSort } from '../../squad-sort';
import { devHarnessCareerAtWeek } from '../career';
import type { DevHarnessEntry } from '../registry';

/**
 * Tier-4 finishing owned, 30 TP banked: the Tier 4 drill (26 TP) and the
 * Tier 2 drill (11 TP) are both affordable, so the confirm card's tier
 * picker has something real to choose between. Drills run the production
 * instant pipeline, not a stub.
 */
function TrainingTiersReel({
  locale,
  lowBank,
}: {
  locale: Locale;
  lowBank?: boolean;
}) {
  const [ready, setReady] = useState(locale === 'en');

  useEffect(() => {
    let active = true;
    setReady(locale === 'en');
    void ensureCatalog(locale).then(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [locale]);

  return ready ? (
    <LoadedTrainingTiersReel locale={locale} lowBank={lowBank} />
  ) : null;
}

function LoadedTrainingTiersReel({
  locale,
  lowBank,
}: {
  locale: Locale;
  lowBank?: boolean;
}) {
  const initial = useMemo(
    () =>
      ({
        ...devHarnessCareerAtWeek(1, 12),
        trainingPoints: lowBank === true ? 11 : 30,
        ownedTrainingTiers: { finishing: 4 },
      }) as GameState,
    [lowBank],
  );
  const firstPlayer = initial.players.find(
    (player) => player.clubId === initial.userClubId && player.role !== 'GK',
  )!;
  const [career, setCareer] = useState<GameState>(initial);
  const [result, setResult] = useState<DrillResultViewModel | null>(null);
  const [sequence, setSequence] = useState(0);
  const [squadSort, setSquadSort] = useState<SquadSort | null>(null);
  const viewModel = useMemo(
    () =>
      squadTrainingViewModel(
        career,
        loadLaunchContent(),
        firstPlayer.id,
        copyFor(locale),
      ),
    [career, firstPlayer.id, locale],
  );

  const runDrill = (playerId: string, pathId: string, tier?: number) => {
    const resolution = trainPlayerInstantly(
      career,
      playerId,
      pathId,
      tier as TrainingDrillTier | undefined,
    );
    const { state, ...rest } = resolution;
    const nextSequence = sequence + 1;
    setSequence(nextSequence);
    setCareer(state);
    setResult({
      ...rest,
      sequence: nextSequence,
      totalDrillsRun: state.totalInstantDrills ?? 0,
    });
  };

  const runDrillBatch = (
    playerId: string,
    pathId: string,
    runs: number,
    tier?: number,
  ) => {
    let next = career;
    let staged: DrillResultViewModel | null = null;
    let nextSequence = sequence;
    for (let run = 0; run < runs; run += 1) {
      const player = next.players.find(
        (candidate) => candidate.id === playerId,
      );
      if (player === undefined || player.injuryWeeks > 0) break;
      const { state, ...rest } = trainPlayerInstantly(
        next,
        playerId,
        pathId,
        tier as TrainingDrillTier | undefined,
      );
      next = state;
      nextSequence += 1;
      staged = {
        ...rest,
        sequence: nextSequence,
        totalDrillsRun: next.totalInstantDrills ?? 0,
      };
      if (rest.injury !== undefined || rest.displayedAfter >= 999) break;
    }
    if (staged === null) return;
    setSequence(nextSequence);
    setCareer(next);
    setResult(staged);
  };

  return (
    <LocaleProvider value={locale}>
      <View style={{ flex: 1, backgroundColor: '#f4f1ea' }}>
        <SquadTrainingScreen
          viewModel={viewModel}
          selectedPlayerId={firstPlayer.id}
          onSelectPlayer={() => {}}
          onTrainDrill={runDrill}
          onTrainDrillBatch={runDrillBatch}
          onBuyDrillUpgrade={() => {}}
          lastDrillResult={result}
          onClearDrillResult={() => setResult(null)}
          trainingPoints={career.trainingPoints}
          squadSort={squadSort}
          onChangeSquadSort={setSquadSort}
          initialScrollY={1_100}
        />
      </View>
    </LocaleProvider>
  );
}

export const trainingTiersEntry: DevHarnessEntry = Object.freeze({
  id: 'training-tiers',
  group: 'Squad',
  title: 'Training tiers',
  summary:
    'Tier 4 finishing owned with 30 TP: the confirm card offers every cheaper tier with its exact preview.',
  cases: Object.freeze([
    ...(['en', 'vi'] as const).map((locale) =>
      Object.freeze({
        id: locale,
        label: locale.toUpperCase(),
        note: 'Open the drills, pick Shooting, choose T2 in the confirm card, then train',
      }),
    ),
    Object.freeze({
      id: 'low-bank',
      label: 'Low bank',
      note: 'Tap Shooting with 11 TP: the row opens the chooser on T2 instead of refusing',
    }),
  ]),
  render: (caseId: string) =>
    caseId === 'low-bank' ? (
      <TrainingTiersReel locale="en" lowBank />
    ) : (
      <TrainingTiersReel locale={caseId as Locale} />
    ),
});
