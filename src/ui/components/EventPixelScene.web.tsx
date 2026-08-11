import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import {
  EVENT_SPRITE_CELL,
  EVENT_SPRITE_SCALE,
  eventObjectIds,
  eventObjectLayout,
  eventSpriteRuns,
} from '../event-pixel-art';
import { useLayoutMode } from '../layout/use-layout-mode';

const SPRITE_SIZE = EVENT_SPRITE_CELL * EVENT_SPRITE_SCALE;
export type EventPixelSceneLayout = 'float' | 'stage';
const STAGE_SCALE: Readonly<Record<number, number>> = { 1: 3, 2: 3, 3: 2.25 };
const NARROW_STAGE_SCALE: Readonly<Record<number, number>> = {
  1: 1.8,
  2: 1.6,
  3: 1.15,
};
const STAGE_STAGGER_PX = 14;
const STAGE_CARD_GAP_PX = 16;

/** Web preserves the story sprites with positioned pixel runs and no CanvasKit. */
export function EventPixelScene({
  artKey,
  reduceMotion = false,
  success = false,
  layout: sceneLayout = 'float',
  bottomInset = 0,
}: {
  artKey: string;
  reduceMotion?: boolean;
  success?: boolean;
  layout?: EventPixelSceneLayout;
  bottomInset?: number;
}) {
  const wide = useLayoutMode() === 'twoColumn';
  const [sceneHeight, setSceneHeight] = useState(0);
  const objectIds = eventObjectIds(artKey);
  const layout = eventObjectLayout(artKey, objectIds.length);
  const stage = sceneLayout === 'stage';
  const scale = !stage
    ? 1
    : ((wide ? STAGE_SCALE : NARROW_STAGE_SCALE)[objectIds.length] ?? 1);
  const rowHeight = SPRITE_SIZE * scale + STAGE_STAGGER_PX * 2;
  const reservedBottom =
    !stage || sceneHeight === 0
      ? 0
      : Math.max(
          0,
          Math.min(bottomInset + STAGE_CARD_GAP_PX, sceneHeight - rowHeight),
        );

  return (
    <View
      pointerEvents="none"
      className="absolute inset-0 overflow-hidden"
      onLayout={(event) => setSceneHeight(event.nativeEvent.layout.height)}
    >
      <View className="absolute -left-16 top-6 h-48 w-48 rounded-full border-4 border-paper/15" />
      <View className="absolute -right-14 bottom-2 h-40 w-40 rounded-full border-4 border-paper/10" />
      <View
        style={
          stage
            ? {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: reservedBottom,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 24 * scale,
              }
            : undefined
        }
      >
        {objectIds.map((spriteId, index) => (
          <FloatingSprite
            key={`${artKey}:${spriteId}`}
            spriteId={spriteId}
            leftPercent={stage ? null : layout[index].leftPercent}
            topOffset={
              stage
                ? (layout[index].topOffset % (STAGE_STAGGER_PX * 2)) -
                  STAGE_STAGGER_PX
                : layout[index].topOffset
            }
            rotationDeg={layout[index].rotationDeg}
            phase={layout[index].phase}
            scale={scale}
            reduceMotion={reduceMotion}
            celebrate={success}
          />
        ))}
      </View>
    </View>
  );
}

function FloatingSprite({
  spriteId,
  leftPercent,
  topOffset,
  rotationDeg,
  phase,
  scale,
  reduceMotion,
  celebrate,
}: {
  spriteId: string;
  leftPercent: number | null;
  topOffset: number;
  rotationDeg: number;
  phase: number;
  scale: number;
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
          duration: 2_200 + phase * 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 2_200 + phase * 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob, phase, reduceMotion]);

  const pixel = EVENT_SPRITE_SCALE * scale;
  return (
    <Animated.View
      style={{
        ...(leftPercent === null
          ? { marginTop: topOffset }
          : { position: 'absolute', left: `${leftPercent}%`, top: topOffset }),
        transform: [
          {
            translateY: bob.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 10],
            }),
          },
          { rotate: `${rotationDeg}deg` },
          { scale: celebrate ? 1.15 : 1 },
        ],
      }}
    >
      <View
        style={{
          position: 'relative',
          width: SPRITE_SIZE * scale,
          height: SPRITE_SIZE * scale,
        }}
      >
        {runs.map((run) => (
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
    </Animated.View>
  );
}
