import { View } from 'react-native';
import { FORMATION_LAYOUTS, type FormationId } from '../../sim/tactics';
import { useCopy } from '../../i18n';

export function FormationDiagram({
  formation,
  inverted = false,
  compact = false,
}: {
  formation: FormationId;
  inverted?: boolean;
  compact?: boolean;
}) {
  const t = useCopy();
  const width = compact ? 48 : 66;
  const height = compact ? 62 : 84;
  const dot = compact ? 5 : 7;
  const points = [[0.5, 0.94] as const, ...FORMATION_LAYOUTS[formation]];
  return (
    <View
      accessibilityLabel={t('formation.a11y.diagram', { formation })}
      style={{ width, height, borderWidth: 1, borderColor: inverted ? '#f4f1ea66' : '#241f2e55', backgroundColor: inverted ? '#3f8a4a' : '#78a875' }}
    >
      <View style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: '#f4f1ea55' }} />
      <View style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, backgroundColor: '#f4f1ea55' }} />
      {points.map(([x, y], index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            left: x * width - dot / 2,
            top: y * height - dot / 2,
            width: dot,
            height: dot,
            borderRadius: dot,
            borderWidth: index === 0 ? 1 : 0,
            borderColor: inverted ? '#241f2e' : '#f4f1ea',
            backgroundColor: index === 0 ? '#edb54a' : '#f4f1ea',
          }}
        />
      ))}
    </View>
  );
}
