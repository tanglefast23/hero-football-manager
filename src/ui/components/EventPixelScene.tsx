import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { Canvas, Rect } from '@shopify/react-native-skia';
import {
  EVENT_SPRITE_CELL,
  EVENT_SPRITE_SCALE,
  eventObjectIds,
  eventObjectLayout,
  eventSpriteRuns,
} from '../event-pixel-art';
import { useLayoutMode } from '../layout/use-layout-mode';

const SPRITE_SIZE = EVENT_SPRITE_CELL * EVENT_SPRITE_SCALE;

/**
 * How big the objects are drawn, and where.
 *
 * 'float' is the original: sprites pinned near the top by a hashed percentage,
 * which is right inside the small request cards that borrow this scene.
 *
 * 'stage' is the full-screen story event, where that layout failed — on a
 * desktop the whole picture is one wide band and two 80pt sprites sat in the
 * top-left corner of it, small and off-centre. Stage centres the objects in
 * whatever space it is given and draws them large enough to be the artwork
 * rather than a garnish on it.
 */
export type EventPixelSceneLayout = 'float' | 'stage';

/** Stage scale by object count: three objects have to share the same width. */
const STAGE_SCALE: Readonly<Record<number, number>> = { 1: 3, 2: 3, 3: 2.25 };
const NARROW_STAGE_SCALE: Readonly<Record<number, number>> = { 1: 1.8, 2: 1.6, 3: 1.15 };
/** Keeps the centred row from reading as a rigid line of stickers. */
const STAGE_STAGGER_PX = 14;
/** Clear air between the objects and the card that reserved the space. */
const STAGE_CARD_GAP_PX = 16;

/**
 * The 2-3 story objects of an event floating over the chalkboard stage.
 * Purely decorative: no full scene, just the things the story is about.
 */
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
  /**
   * Height of the card the caller lays over the bottom of this scene. Stage
   * objects centre in the space left above it instead of behind it — see
   * `reservedBottom`.
   */
  bottomInset?: number;
}) {
  const wide = useLayoutMode() === 'twoColumn';
  const [sceneHeight, setSceneHeight] = useState(0);
  const objectIds = eventObjectIds(artKey);
  const layout = eventObjectLayout(artKey, objectIds.length);
  const stage = sceneLayout === 'stage';
  const scale = !stage
    ? 1
    : (wide ? STAGE_SCALE : NARROW_STAGE_SCALE)[objectIds.length] ?? 1;
  /**
   * Centring in the whole scene put the objects behind the outcome card, which
   * on a tall screen left two hats poking over its top edge. They centre in the
   * clear band above the card instead — which, once the card is tall, reads as
   * "sitting just above it".
   *
   * Clamped by the measured height: a card taller than the scene must not
   * reserve the objects out of existence, and a scene that has not measured yet
   * reserves nothing rather than guessing.
   */
  const rowHeight = SPRITE_SIZE * scale + STAGE_STAGGER_PX * 2;
  const reservedBottom = !stage || sceneHeight === 0
    ? 0
    : Math.max(0, Math.min(bottomInset + STAGE_CARD_GAP_PX, sceneHeight - rowHeight));
  return (
    <View
      pointerEvents="none"
      className="absolute inset-0 overflow-hidden"
      onLayout={event => setSceneHeight(event.nativeEvent.layout.height)}
    >
      <View className="absolute -left-16 top-6 h-48 w-48 rounded-full border-4 border-paper/15" />
      <View className="absolute -right-14 bottom-2 h-40 w-40 rounded-full border-4 border-paper/10" />
      <View
        style={stage
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
          : undefined}
      >
        {objectIds.map((spriteId, index) => (
          <FloatingSprite
            key={`${artKey}:${spriteId}`}
            spriteId={spriteId}
            // Stage centres the row, so the hashed left/top become a small
            // vertical stagger instead of an absolute position.
            leftPercent={stage ? null : layout[index].leftPercent}
            topOffset={stage
              ? ((layout[index].topOffset % (STAGE_STAGGER_PX * 2)) - STAGE_STAGGER_PX)
              : layout[index].topOffset}
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
  /** null on the stage layout, where the row is centred rather than positioned. */
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
        ...(leftPercent === null
          // Centred by the parent row; `topOffset` is the float stagger.
          ? { marginTop: topOffset }
          : { position: 'absolute', left: `${leftPercent}%`, top: topOffset }),
        transform: [
          { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) },
          { rotate: `${rotationDeg}deg` },
          { scale: celebrate ? 1.15 : 1 },
        ],
      }}
    >
      {/* Every run is multiplied rather than the canvas being transformed, so
          the rectangles stay axis-aligned and the pixel edges stay hard. */}
      <Canvas
        style={{
          width: SPRITE_SIZE * scale,
          height: SPRITE_SIZE * scale,
        }}
      >
        {runs.map(run => (
          <Rect
            key={run.id}
            x={run.x * EVENT_SPRITE_SCALE * scale}
            y={run.y * EVENT_SPRITE_SCALE * scale}
            width={run.width * EVENT_SPRITE_SCALE * scale}
            height={EVENT_SPRITE_SCALE * scale}
            color={run.color}
          />
        ))}
      </Canvas>
    </Animated.View>
  );
}
