import { View } from 'react-native';
import { CLUB_CREST_GRID, clubCrestRuns } from '../club-crest-art';

export function ClubCrest({
  clubName,
  size = 16,
}: {
  clubName: string;
  size?: 16 | 24 | 32;
}) {
  const pixel = size / CLUB_CREST_GRID;
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
    >
      {clubCrestRuns(clubName).map((run) => (
        <View
          key={run.id}
          style={{
            position: 'absolute',
            left: run.x * pixel,
            top: run.y * pixel,
            width: run.width * pixel,
            height: pixel,
            backgroundColor: run.color,
          }}
        />
      ))}
    </View>
  );
}
