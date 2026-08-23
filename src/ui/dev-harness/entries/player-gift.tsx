import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { loadLaunchContent } from '../../../content';
import { givePlayerGift } from '../../../game/player-gifts';
import type { GameState } from '../../../game/types';
import {
  copyFor,
  ensureCatalog,
  LocaleProvider,
  type Locale,
} from '../../../i18n';
import { squadTrainingViewModel } from '../../../application/view-models';
import type { PlayerGiftCelebrationViewModel } from '../../models';
import { SquadTrainingScreen } from '../../screens/SquadTrainingScreen';
import type { SquadSort } from '../../squad-sort';
import { devHarnessCareerAtWeek } from '../career';
import type { DevHarnessEntry } from '../registry';

function PlayerGiftReel({ locale }: { locale: Locale }) {
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

  return ready ? <LoadedPlayerGiftReel locale={locale} /> : null;
}

function LoadedPlayerGiftReel({ locale }: { locale: Locale }) {
  const initial = useMemo(() => devHarnessCareerAtWeek(1, 12), []);
  const firstPlayer = initial.players.find(
    (player) => player.clubId === initial.userClubId,
  )!;
  const [career, setCareer] = useState<GameState>(() => ({
    ...initial,
    players: initial.players.map((player) =>
      player.id === firstPlayer.id ? { ...player, morale: 60 } : player,
    ),
    clubs: initial.clubs.map((club) =>
      club.id === initial.userClubId ? { ...club, cash: 1_000_000 } : club,
    ),
  }));
  const [result, setResult] = useState<PlayerGiftCelebrationViewModel | null>(
    null,
  );
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

  return (
    <LocaleProvider value={locale}>
      <View style={{ flex: 1, backgroundColor: '#f4f1ea' }}>
        <SquadTrainingScreen
          viewModel={viewModel}
          selectedPlayerId={firstPlayer.id}
          onSelectPlayer={() => {}}
          onTrainDrill={() => {}}
          onTrainDrillBatch={() => {}}
          onBuyDrillUpgrade={() => {}}
          onGiftPlayer={(playerId) => {
            const gift = givePlayerGift(career, playerId);
            const player = gift.state.players.find(
              (candidate) => candidate.id === playerId,
            )!;
            setCareer(gift.state);
            setResult({
              sequence: (result?.sequence ?? 0) + 1,
              playerId,
              playerName: player.name,
              role: player.role,
              lookId: player.lookId,
              cost: gift.cost,
              moraleGain: gift.moraleGain,
            });
          }}
          lastPlayerGiftResult={result}
          onClearPlayerGiftResult={() => setResult(null)}
          lastDrillResult={null}
          trainingPoints={career.trainingPoints}
          squadSort={squadSort}
          onChangeSquadSort={setSquadSort}
          initialScrollY={1_100}
        />
      </View>
    </LocaleProvider>
  );
}

export const playerGiftEntry: DevHarnessEntry = Object.freeze({
  id: 'player-gift',
  group: 'Squad',
  title: 'Player gift',
  summary: 'The real Player File action and its four-beat morale celebration.',
  cases: Object.freeze(
    (['en', 'de', 'vi'] as const).map((locale) =>
      Object.freeze({
        id: locale,
        label: locale.toUpperCase(),
        note: 'Tap the gift action, then tap each celebration beat',
      }),
    ),
  ),
  render: (caseId: string) => <PlayerGiftReel locale={caseId as Locale} />,
});
