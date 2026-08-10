import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MatchScreen } from '../../../render/MatchScreen';
import type { DevHarnessEntry } from '../registry';

/**
 * Live match with Formation / Playstyle / Energy Use controls visible.
 * Used for App Store "Coach Live" screenshot.
 */
export const liveMatchControlsEntry: DevHarnessEntry = {
  id: 'live-match-controls',
  group: 'Match',
  title: 'Live Match Controls',
  summary: 'Formation, Playstyle, Energy Use HUD',
  cases: [
    { id: 'mid-match', label: 'Mid Match', note: 'Controls clearly visible' },
  ],
  render: () => <LiveMatchControlsReel />,
};

function LiveMatchControlsReel() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingTop: insets.top, flex: 1 }}>
      <MatchScreen
        seed={20260893}
        controlledTeam={0}
        onOpenSettings={() => {}}
        onDone={() => {}}
      />
    </View>
  );
}
