import type { ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SfxPressable as Pressable } from '../components/SfxPressable';

interface PowerArtQaScreenProps {
  readonly index: number;
  readonly total: number;
  readonly name: string;
  readonly description: string;
  readonly category: 'attack' | 'defense' | 'keeper';
  readonly tier: 'starter' | 'standard';
  readonly preview: ReactNode;
  readonly onPrevious: () => void;
  readonly onReplay: () => void;
  readonly onNext: () => void;
}

/** Developer-only approval reel for reviewing one production power effect. */
export function PowerArtQaScreen({
  index,
  total,
  name,
  description,
  category,
  tier,
  preview,
  onPrevious,
  onReplay,
  onNext,
}: PowerArtQaScreenProps) {
  const { width, height } = useWindowDimensions();
  const compact = height < 760 || width < 680;
  const stageWidth = Math.min(width - (compact ? 24 : 72), 920);
  const stageHeight = Math.min(
    Math.round(stageWidth * (compact ? 0.6 : 0.52)),
    compact ? 390 : 520,
  );
  const counter = `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
      <View pointerEvents="none" style={styles.skyGlow} />
      <View pointerEvents="none" style={styles.pitchStripeOne} />
      <View pointerEvents="none" style={styles.pitchStripeTwo} />

      <View style={[styles.content, compact ? styles.contentCompact : null]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>MATCH DAY HEROES · POWER REEL</Text>
            <Text style={[styles.title, compact ? styles.titleCompact : null]}>{name}</Text>
          </View>
          <View style={styles.counterPlate}>
            <Text style={styles.counterLabel}>ART REVIEW</Text>
            <Text style={styles.counter}>{counter}</Text>
          </View>
        </View>

        <View
          accessibilityLabel={`${name} animation preview. ${description}`}
          style={[styles.stageFrame, { width: stageWidth, height: stageHeight }]}
        >
          <View pointerEvents="none" style={styles.stageCornerTop} />
          <View pointerEvents="none" style={styles.stageCornerBottom} />
          <View style={styles.stage}>{preview}</View>
          <View pointerEvents="none" style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>PRODUCTION FX</Text>
          </View>
        </View>

        <View style={[styles.infoRail, { width: stageWidth }]}>
          <View style={styles.tags}>
            <Text style={[styles.tag, styles.tagPrimary]}>{category.toUpperCase()}</Text>
            <Text style={styles.tag}>{tier.toUpperCase()}</Text>
          </View>
          <Text numberOfLines={compact ? 3 : 2} style={styles.description}>{description}</Text>
        </View>

        <View style={[styles.navigation, { width: stageWidth }]}>
          <ReviewButton label="◂ PREVIOUS" accessibilityLabel="Show previous power" onPress={onPrevious} />
          <ReviewButton label="↻ REPLAY" accessibilityLabel={`Replay ${name} animation`} onPress={onReplay} hero />
          <ReviewButton label="NEXT ▸" accessibilityLabel="Show next power" onPress={onNext} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function ReviewButton({
  label,
  accessibilityLabel,
  hero = false,
  onPress,
}: {
  readonly label: string;
  readonly accessibilityLabel: string;
  readonly hero?: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.navigationButton,
        hero ? styles.navigationButtonHero : null,
        pressed ? styles.navigationPressed : null,
      ]}
    >
      <Text style={[styles.navigationText, hero ? styles.navigationTextHero : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#121019',
    overflow: 'hidden',
  },
  skyGlow: {
    position: 'absolute',
    top: -220,
    left: '12%',
    width: '76%',
    height: 430,
    borderRadius: 220,
    backgroundColor: '#33215c',
    opacity: 0.72,
    transform: [{ scaleX: 1.4 }],
  },
  pitchStripeOne: {
    position: 'absolute',
    left: '-15%',
    bottom: -170,
    width: '75%',
    height: 380,
    backgroundColor: '#173c2a',
    opacity: 0.5,
    transform: [{ rotate: '-11deg' }],
  },
  pitchStripeTwo: {
    position: 'absolute',
    right: '-20%',
    bottom: -190,
    width: '82%',
    height: 420,
    backgroundColor: '#205238',
    opacity: 0.34,
    transform: [{ rotate: '9deg' }],
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingVertical: 24,
  },
  contentCompact: {
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  header: {
    width: '100%',
    maxWidth: 920,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 14,
  },
  eyebrow: {
    color: '#d9ff60',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 12,
    letterSpacing: 1,
  },
  title: {
    color: '#f7f0dc',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 38,
    lineHeight: 43,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  titleCompact: {
    fontSize: 25,
    lineHeight: 30,
  },
  counterPlate: {
    minWidth: 112,
    backgroundColor: '#d94f52',
    borderColor: '#f7f0dc',
    borderWidth: 2,
    paddingHorizontal: 10,
    paddingVertical: 7,
    transform: [{ rotate: '1deg' }],
  },
  counterLabel: {
    color: '#24131b',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 9,
    textAlign: 'center',
  },
  counter: {
    color: '#ffffff',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 17,
    textAlign: 'center',
  },
  stageFrame: {
    backgroundColor: '#f7f0dc',
    borderColor: '#08070b',
    borderWidth: 4,
    padding: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 10, height: 12 },
    shadowOpacity: 0.52,
    shadowRadius: 0,
  },
  stage: {
    flex: 1,
    backgroundColor: '#1b492d',
    borderColor: '#d94f52',
    borderWidth: 3,
    overflow: 'hidden',
  },
  stageCornerTop: {
    position: 'absolute',
    zIndex: 2,
    right: -4,
    top: -4,
    width: 58,
    height: 16,
    backgroundColor: '#d9ff60',
  },
  stageCornerBottom: {
    position: 'absolute',
    zIndex: 2,
    left: -4,
    bottom: -4,
    width: 92,
    height: 13,
    backgroundColor: '#d94f52',
  },
  liveBadge: {
    position: 'absolute',
    zIndex: 4,
    top: 15,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#121019dd',
    borderColor: '#f7f0dc',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  liveDot: {
    width: 8,
    height: 8,
    backgroundColor: '#d94f52',
  },
  liveText: {
    color: '#f7f0dc',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 9,
  },
  infoRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 14,
  },
  tags: {
    flexDirection: 'row',
    gap: 6,
  },
  tag: {
    color: '#d7cfe4',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 9,
    borderColor: '#5d526e',
    borderWidth: 2,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  tagPrimary: {
    color: '#121019',
    backgroundColor: '#d9ff60',
    borderColor: '#d9ff60',
  },
  description: {
    flex: 1,
    color: '#e7e0d6',
    fontSize: 14,
    lineHeight: 20,
  },
  navigation: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 15,
  },
  navigationButton: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#30283d',
    borderColor: '#08070b',
    borderBottomWidth: 5,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderTopWidth: 3,
    paddingHorizontal: 8,
    paddingVertical: 11,
  },
  navigationButtonHero: {
    backgroundColor: '#d94f52',
  },
  navigationPressed: {
    borderBottomWidth: 2,
    transform: [{ translateY: 3 }],
  },
  navigationText: {
    color: '#f7f0dc',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 12,
    textAlign: 'center',
  },
  navigationTextHero: {
    color: '#ffffff',
  },
});
