import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Canvas, Fill, Group } from '@shopify/react-native-skia';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AwakeningCutsceneViewModel } from '../models';
import { AwakeningTriggerVisual } from './awakening-trigger-visuals/AwakeningTriggerVisual';

interface AwakeningArtQaScreenProps {
  index: number;
  total: number;
  title: string;
  callout: string;
  visual: AwakeningCutsceneViewModel['triggerVisual'];
  onPrevious: () => void;
  onNext: () => void;
}

/** Developer-only focused canvas for repeatable trigger-art screenshot review. */
export function AwakeningArtQaScreen({
  index,
  total,
  title,
  callout,
  visual,
  onPrevious,
  onNext,
}: AwakeningArtQaScreenProps) {
  const { width } = useWindowDimensions();
  const stageSize = Math.min(width - 32, 360);
  const center = stageSize / 2;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>AWAKENING ART QA · {String(index + 1).padStart(2, '0')}/{total}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={[styles.stage, { width: stageSize, height: stageSize }]}>
        <Canvas style={{ width: stageSize, height: stageSize }}>
          <Fill color="#3f8a4a" />
          <Group origin={{ x: center, y: center }} transform={[{ scale: 3 }]}>
            <AwakeningTriggerVisual visual={visual} x={center} y={center} />
          </Group>
        </Canvas>
      </View>

      <View style={styles.caption}>
        <Text style={styles.callout}>{callout}</Text>
        <Text style={styles.note}>3× inspection · nearest-neighbour pixels</Text>
      </View>

      <View style={styles.navigation}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous trigger artwork"
          onPress={onPrevious}
          style={({ pressed }) => [styles.navigationButton, pressed ? styles.navigationPressed : null]}
        >
          <Text style={styles.navigationText}>◂ PREVIOUS</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next trigger artwork"
          onPress={onNext}
          style={({ pressed }) => [styles.navigationButton, pressed ? styles.navigationPressed : null]}
        >
          <Text style={styles.navigationText}>NEXT ▸</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#17131f',
    paddingHorizontal: 16,
  },
  header: {
    width: '100%',
    paddingBottom: 14,
    paddingTop: 16,
  },
  eyebrow: {
    color: '#d94f52',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 13,
    letterSpacing: 1,
  },
  title: {
    color: '#f4f1ea',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 32,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  stage: {
    borderColor: '#d94f52',
    borderWidth: 3,
    overflow: 'hidden',
  },
  caption: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  callout: {
    color: '#d9ff60',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 17,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  note: {
    color: '#9a95a4',
    fontSize: 12,
    letterSpacing: 0.5,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  navigation: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 'auto',
    width: '100%',
  },
  navigationButton: {
    backgroundColor: '#9a63d6',
    borderBottomColor: '#5b3a91',
    borderColor: '#241f2e',
    borderWidth: 3,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 16,
  },
  navigationPressed: {
    borderBottomWidth: 1,
    transform: [{ translateY: 2 }],
  },
  navigationText: {
    color: '#ffffff',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 14,
    textAlign: 'center',
  },
});
