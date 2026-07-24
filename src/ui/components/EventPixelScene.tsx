import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { Canvas, Rect } from '@shopify/react-native-skia';
import {
  EVENT_SPRITE_CELL,
  EVENT_SPRITE_SCALE,
  eventObjectIds,
  eventObjectLayout,
  eventSpriteRuns,
} from '../event-pixel-art';

const SPRITE_SIZE = EVENT_SPRITE_CELL * EVENT_SPRITE_SCALE;

/**
 * The 2-3 story objects of an event floating over the chalkboard stage.
 * Purely decorative: no full scene, just the things the story is about.
 */
export function EventPixelScene({
  artKey,
  reduceMotion = false,
  success = false,
}: {
  artKey: string;
  reduceMotion?: boolean;
  success?: boolean;
}) {
  const objectIds = eventObjectIds(artKey);
  const layout = eventObjectLayout(artKey, objectIds.length);
  return (
    <View pointerEvents="none" className="absolute inset-0 overflow-hidden">
      <View className="absolute -left-16 top-6 h-48 w-48 rounded-full border-4 border-paper/15" />
      <View className="absolute -right-14 bottom-2 h-40 w-40 rounded-full border-4 border-paper/10" />
      {objectIds.map((spriteId, index) => (
        <FloatingSprite
          key={`${artKey}:${spriteId}`}
          spriteId={spriteId}
          leftPercent={layout[index].leftPercent}
          topOffset={layout[index].topOffset}
          rotationDeg={layout[index].rotationDeg}
          phase={layout[index].phase}
          reduceMotion={reduceMotion}
          celebrate={success}
        />
      ))}
    </View>
  );
}

function FloatingSprite({
  spriteId,
  leftPercent,
  topOffset,
  rotationDeg,
  phase,
  reduceMotion,
  celebrate,
}: {
  spriteId: string;
  leftPercent: number;
  topOffset: number;
  rotationDeg: number;
  phase: number;
  reduceMotion: boolean;
  celebrate: boolean;
}) {
  const bob = useRef(new Animated.Value(phase)).current;
  const runs = useMemo(() => eventSpriteRuns(spriteId), [spriteId]);

  useEffect(() => {
    if (reduceMotion) {
      bob.setValue(0.5);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 2200 + phase * 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 2200 + phase * 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob, phase, reduceMotion]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: `${leftPercent}%`,
        top: topOffset,
        transform: [
          { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) },
          { rotate: `${rotationDeg}deg` },
          { scale: celebrate ? 1.15 : 1 },
        ],
      }}
    >
      <Canvas style={{ width: SPRITE_SIZE, height: SPRITE_SIZE }}>
        {runs.map(run => (
          <Rect
            key={run.id}
            x={run.x * EVENT_SPRITE_SCALE}
            y={run.y * EVENT_SPRITE_SCALE}
            width={run.width * EVENT_SPRITE_SCALE}
            height={EVENT_SPRITE_SCALE}
            color={run.color}
          />
        ))}
      </Canvas>
    </Animated.View>
  );
}
