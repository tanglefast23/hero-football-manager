import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Canvas, Fill, Line, Rect } from '@shopify/react-native-skia';
import type { PowerId } from '../sim/types';
import { PowerEffectScene } from './PowerEffectScene';
import {
  powerEffectDescriptor,
  powerEffectFrame,
} from './power-effect-descriptors';

export interface PowerEffectPreviewProps {
  power: PowerId;
  /** Changing this value restarts the deterministic one-shot animation. */
  replayKey: string | number;
  width?: number;
  reduceMotion?: boolean;
}

/**
 * Developer art-review route. It renders the exact same PowerEffectScene used
 * over the live match, rather than separate mock artwork. Every replay is
 * deterministic and stops after its final beat.
 */
export function PowerEffectPreview({
  power,
  replayKey,
  width: requestedWidth,
  reduceMotion = false,
}: PowerEffectPreviewProps) {
  const viewport = useWindowDimensions();
  const width =
    requestedWidth ?? Math.min(520, Math.max(280, viewport.width - 32));
  const height = Math.round(width * 0.62);
  const descriptor = powerEffectDescriptor(power);
  const [elapsedMs, setElapsedMs] = useState(
    reduceMotion ? descriptor.durationMs * 0.76 : 0,
  );

  useEffect(() => {
    if (reduceMotion) {
      setElapsedMs(descriptor.durationMs * 0.76);
      return undefined;
    }
    let frame = 0;
    const startedAt = performance.now();
    setElapsedMs(0);
    const animate = (now: number) => {
      const elapsed = Math.min(descriptor.durationMs, now - startedAt);
      setElapsedMs(elapsed);
      if (elapsed < descriptor.durationMs)
        frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [descriptor.durationMs, power, reduceMotion, replayKey]);

  const timeline = powerEffectFrame(power, elapsedMs, reduceMotion);
  const progressWidth =
    `${Math.round(timeline.progress * 100)}%` as `${number}%`;
  const accessibilityLabel = `${descriptor.name}. ${descriptor.accessibilityLabel} ${timeline.beat.label}.`;
  const pitchStripeXs = useMemo(
    () => Array.from({ length: 7 }, (_, index) => (index * width) / 6),
    [width],
  );

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[styles.frame, { width }]}
    >
      <View style={styles.header}>
        <View
          style={[styles.colorChip, { backgroundColor: descriptor.primary }]}
        />
        <View style={styles.titleBlock}>
          <Text style={styles.kicker}>POWER EFFECT</Text>
          <Text style={styles.title}>{descriptor.name.toUpperCase()}</Text>
        </View>
        <Text style={[styles.beat, { color: descriptor.highlight }]}>
          {timeline.beat.label}
        </Text>
      </View>
      <View style={[styles.canvasFrame, { width: width - 12, height }]}>
        <Canvas style={{ width: width - 12, height }}>
          <Fill color="#265b30" />
          {pitchStripeXs.map((x, index) => (
            <Rect
              key={index}
              x={x}
              y={0}
              width={width / 12}
              height={height}
              color={index % 2 === 0 ? '#316b3d' : '#2b6339'}
              opacity={0.9}
            />
          ))}
          <Line
            p1={{ x: (width - 12) / 2, y: 0 }}
            p2={{ x: (width - 12) / 2, y: height }}
            color="#acd6ad"
            strokeWidth={1.5}
            opacity={0.5}
          />
          <PowerEffectScene
            power={power}
            elapsedMs={elapsedMs}
            width={width - 12}
            height={height}
            tier={3}
            reduceMotion={reduceMotion}
            showDemoActors
          />
        </Canvas>
      </View>
      <View style={styles.timeline}>
        {descriptor.beats.map((beat, index) => (
          <View key={beat.id} style={styles.timelineBeat}>
            <View
              style={[
                styles.timelineDot,
                index <= timeline.beatIndex
                  ? { backgroundColor: descriptor.primary }
                  : null,
              ]}
            />
            <Text
              style={[
                styles.timelineLabel,
                index === timeline.beatIndex
                  ? { color: descriptor.highlight }
                  : null,
              ]}
            >
              {beat.label}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: progressWidth, backgroundColor: descriptor.primary },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#16121f',
    borderRadius: 8,
    backgroundColor: '#241f2e',
  },
  header: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 3,
    borderBottomColor: '#16121f',
    backgroundColor: '#312641',
  },
  colorChip: {
    width: 9,
    height: 34,
    borderWidth: 2,
    borderColor: '#16121f',
  },
  titleBlock: {
    flex: 1,
  },
  kicker: {
    color: '#a99db7',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  title: {
    color: '#f4f1ea',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  beat: {
    maxWidth: '42%',
    textAlign: 'right',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  canvasFrame: {
    margin: 3,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#16121f',
    backgroundColor: '#265b30',
  },
  timeline: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 6,
  },
  timelineBeat: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timelineDot: {
    width: 6,
    height: 6,
    backgroundColor: '#62566f',
    borderRadius: 1,
  },
  timelineLabel: {
    flex: 1,
    color: '#897e94',
    fontSize: 7,
    fontWeight: '900',
  },
  progressTrack: {
    height: 5,
    backgroundColor: '#16121f',
  },
  progressFill: {
    height: 5,
  },
});
