import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import { Canvas, Fill, Group } from '@shopify/react-native-skia';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AwakeningCutsceneViewModel } from '../models';
import { AwakeningTriggerVisual } from './awakening-trigger-visuals/AwakeningTriggerVisual';
import { useCopy, usePixelStyles, type LocaleFaces } from '../../i18n';

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
  const t = useCopy();
  const styles = usePixelStyles(makeStyles);
  const { width } = useWindowDimensions();
  const stageSize = Math.min(width - 32, 360);
  const center = stageSize / 2;

  return (
    <SafeAreaView
      style={styles.root}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>
          AWAKENING ART QA · {String(index + 1).padStart(2, '0')}/{total}
        </Text>
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
        <Text style={styles.note}>
          {t('awakeningArtQa.3InspectionNearest-neighbourPixels')}
        </Text>
      </View>

      <View style={styles.navigation}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('awakeningArtQa.a11y.previousTriggerArtwork')}
          onPress={onPrevious}
          style={({ pressed }) => [
            styles.navigationButton,
            pressed ? styles.navigationPressed : null,
          ]}
        >
          <Text style={styles.navigationText}>◂ PREVIOUS</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('awakeningArtQa.a11y.nextTriggerArtwork')}
          onPress={onNext}
          style={({ pressed }) => [
            styles.navigationButton,
            pressed ? styles.navigationPressed : null,
          ]}
        >
          <Text style={styles.navigationText}>NEXT ▸</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (faces: LocaleFaces) =>
  StyleSheet.create({
    root: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: '#16121f',
      paddingHorizontal: 16,
    },
    header: {
      width: '100%',
      paddingBottom: 14,
      paddingTop: 16,
    },
    eyebrow: {
      color: '#d94f52',
      fontFamily: faces.display,
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
      fontFamily: faces.display,
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
      backgroundColor: '#5a8fd6',
      borderBottomColor: '#3f6fb5',
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
      fontFamily: faces.display,
      fontSize: 14,
      textAlign: 'center',
    },
  });
