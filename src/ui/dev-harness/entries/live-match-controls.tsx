import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MatchScreen } from '../../../render/MatchScreen';
import { powerMatchShowcaseHome } from '../../../render/power-match-showcase';
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
    {
      id: 'keeper-window',
      label: 'Keeper Window',
      note: 'Manual Elastic Keeper danger prompt and countdown',
    },
    {
      id: 'hero-power-tutorial',
      label: 'Hero Power Tutorial',
      note: 'First ARMED and FIRE pauses on the real control',
    },
  ],
  render: (caseId) => (
    <LiveMatchControlsReel
      keeper={caseId === 'keeper-window'}
      tutorial={caseId === 'hero-power-tutorial'}
    />
  ),
};

function LiveMatchControlsReel({
  keeper,
  tutorial,
}: {
  keeper: boolean;
  tutorial: boolean;
}) {
  const insets = useSafeAreaInsets();
  const power = tutorial ? 'GUST' : 'ELASTIC_KEEPER';

  return (
    <View style={{ paddingTop: insets.top, flex: 1 }}>
      <MatchScreen
        seed={20260893}
        home={keeper || tutorial ? powerMatchShowcaseHome(power) : undefined}
        powerMatchQa={keeper || tutorial ? { power, manual: true } : undefined}
        heroPowerTutorial={tutorial}
        controlledTeam={0}
        onOpenSettings={() => {}}
        onDone={() => {}}
      />
    </View>
  );
}
