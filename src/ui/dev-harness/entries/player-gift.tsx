import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { loadLaunchContent } from '../../../content';
import deCatalog from '../../../../content/i18n/de.json';
import viCatalog from '../../../../content/i18n/vi.json';
import { givePlayerGift } from '../../../game/player-gifts';
import type { GameState } from '../../../game/types';
import {
  copyFor,
  LocaleProvider,
  registerCatalog,
  type Locale,
} from '../../../i18n';
import { squadTrainingViewModel } from '../../../application/view-models';
import type { PlayerGiftCelebrationViewModel } from '../../models';
import { SquadTrainingScreen } from '../../screens/SquadTrainingScreen';
import type { SquadSort } from '../../squad-sort';
import { devHarnessCareerAtWeek } from '../career';
import type { DevHarnessEntry } from '../registry';

// Dev-only review cases load these catalogs without changing the saved language.
registerCatalog('de', deCatalog);
registerCatalog('vi', viCatalog);

function PlayerGiftReel({ locale }: { locale: Locale }) {
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
