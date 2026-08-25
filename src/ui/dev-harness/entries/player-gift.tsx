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

type TransferRequestCase = 'withdrawn' | 'still-active';

function PlayerGiftReel({
  locale,
  transferRequestCase,
}: {
  locale: Locale;
  transferRequestCase?: TransferRequestCase;
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
    <LoadedPlayerGiftReel
      locale={locale}
      {...(transferRequestCase === undefined ? {} : { transferRequestCase })}
    />
  ) : null;
}

function LoadedPlayerGiftReel({
  locale,
  transferRequestCase,
}: {
  locale: Locale;
  transferRequestCase?: TransferRequestCase;
}) {
  const initial = useMemo(() => devHarnessCareerAtWeek(1, 12), []);
  const firstPlayer = initial.players.find(
    (player) => player.clubId === initial.userClubId,
  )!;
  const [career, setCareer] = useState<GameState>(() => ({
    ...initial,
    players: initial.players.map((player) => {
      if (player.id !== firstPlayer.id) return player;
      if (transferRequestCase === 'withdrawn') {
        return {
          ...player,
          morale: 25,
          personality: 'Fiery' as const,
          transferRequested: true,
        };
      }
      if (transferRequestCase === 'still-active') {
        return {
          ...player,
          morale: 25,
          personality: 'Greedy' as const,
          transferRequested: true,
        };
      }
      return { ...player, morale: 60 };
    }),
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
              ...(gift.transferRequestOutcome === undefined
                ? {}
                : { transferRequestOutcome: gift.transferRequestOutcome }),
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
  cases: Object.freeze([
    ...(['en', 'de', 'vi'] as const).map((locale) =>
      Object.freeze({
        id: locale,
        label: locale.toUpperCase(),
        note: 'Tap the gift action, then tap each celebration beat',
      }),
    ),
    Object.freeze({
      id: 'withdrawn',
      label: 'Request withdrawn',
      note: 'A Fiery player reaches the exact withdrawal threshold',
    }),
    Object.freeze({
      id: 'still-active',
      label: 'Request stays active',
      note: 'A Greedy player rises from 25 to 45, below the target of 50',
    }),
  ]),
  render: (caseId: string) => {
    const transferRequestCase =
      caseId === 'withdrawn' || caseId === 'still-active' ? caseId : undefined;
    return (
      <PlayerGiftReel
        locale={transferRequestCase === undefined ? (caseId as Locale) : 'en'}
        {...(transferRequestCase === undefined ? {} : { transferRequestCase })}
      />
    );
  },
});
