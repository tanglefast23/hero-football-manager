import { Text, View } from 'react-native';
import type {
  M2LeaderBoardViewModel,
  M2LeaderEntryViewModel,
  M2LeagueSubTab,
} from '../m2-league-models';
import { PaperPanel } from './Scorecard';
import { PixelText } from './PixelText';

/** The strip stays hidden while there is nothing to switch between. */
export function visibleSubTabs(available: readonly M2LeagueSubTab[]): M2LeagueSubTab[] {
  return available.length < 2 ? [] : [...available];
}

/**
 * Keeps the rendered tab inside what the career has actually unlocked.
 *
 * A selection outlives the state that offered it — the guide can point at a
 * board the week before it opens, and a tab chosen this season is still held
 * when a new one starts. Falling back to the league, which is always available,
 * is what stops that from rendering an empty page.
 */
export function resolveSubTab(
  available: readonly M2LeagueSubTab[],
  requested: M2LeagueSubTab,
): M2LeagueSubTab {
  return available.includes(requested) ? requested : 'league';
}

export function subTabLabel(tab: M2LeagueSubTab): string {
  return tab === 'league' ? 'LEAGUE' : tab === 'cup' ? 'CUP' : 'LEADERS';
}

/** Reads as "2. Gem Arrow, Quartz FC, 9 goals. Your player." */
export function leaderRowLabel(entry: M2LeaderEntryViewModel, metricLabel: string): string {
  const owner = entry.isUserPlayer ? ' Your player.' : '';
  return `${entry.position}. ${entry.playerName}, ${entry.clubName}, `
    + `${entry.value} ${metricLabel.toLowerCase()}.${owner}`;
}

/** One position's race: five names, the user's own highlighted. */
export function DivisionLeaderBoard({ board }: { board: M2LeaderBoardViewModel }) {
  return (
    <PaperPanel kicker={board.boardLabel} title={board.metricLabel}>
      {board.entries.length === 0 ? (
        <Text className="text-sm leading-5 text-ink/60">{board.emptyLabel}</Text>
      ) : (
        <View className="gap-2">
          {board.entries.map(entry => (
            <View
              key={entry.playerId}
              accessible
              accessibilityLabel={leaderRowLabel(entry, board.metricLabel)}
              className={entry.isUserPlayer
                ? 'min-h-11 flex-row items-center border-2 border-b-4 border-blue-dark bg-blue-light px-2 py-2'
                : 'min-h-11 flex-row items-center border-2 border-b-4 border-ink/40 bg-white px-2 py-2'}
            >
              <PixelText variant="data" className="w-7 text-base text-ink">{entry.position}</PixelText>
              <View className="min-w-0 flex-1 pr-2">
                <Text
                  className={entry.isUserPlayer ? 'text-base font-bold text-ink' : 'text-base text-ink'}
                  numberOfLines={1}
                >
                  {entry.playerName}
                </Text>
                <Text className="mt-0.5 text-sm text-ink/50" numberOfLines={1}>{entry.clubName}</Text>
              </View>
              <PixelText variant="data" className="text-base text-ink">{entry.value}</PixelText>
            </View>
          ))}
        </View>
      )}
    </PaperPanel>
  );
}
