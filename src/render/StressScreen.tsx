// Worklet render-path stress test (M1 renderer-migration validation): proves
// Skia's Atlas batched API can be driven entirely from Reanimated worklets on
// the UI thread at a high sprite count, with an FPS readout as the measure.
// Dev tool, not a game screen — visual polish is irrelevant; correctness of
// the worklet wiring is everything.
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Atlas, Canvas, Fill, Skia, useRSXformBuffer, type SkImage, type SkRect } from '@shopify/react-native-skia';
import { runOnJS, useFrameCallback, useSharedValue, type FrameInfo } from 'react-native-reanimated';
import { buildSpriteAtlas } from './sprites/buildAtlas';
import { mulberry32 } from '../sim/rng';

const SPRITE_COUNT = 2000;
const SEED = 42; // arbitrary, fixed — reproducible layout/motion run to run
const DRAW_SCALE = 2; // magnifies each atlas source cell for on-screen visibility
const MIN_SPEED = 60; // px/sec
const MAX_SPEED = 220; // px/sec
const DEFAULT_FRAME_MS = 1000 / 60; // assumed dt before Reanimated reports a real delta (first frame)

// The pack's 23 distinct sprites (see sprites/loader.ts's PLAYER_IDS: r0-r10,
// u0-u10, each with run0/run1, plus 'ball') — cycled across all 2000 slots
// for atlas variety. Walk-cycle frame animation (run0 vs run1) is a gameplay
// detail this screen has no need for, so every player slot pins to run0.
const SPRITE_KEYS: string[] = [
  ...Array.from({ length: 11 }, (_, i) => `r${i}:run0`),
  ...Array.from({ length: 11 }, (_, i) => `u${i}:run0`),
  'ball',
];

// Side of the placeholder square drawn when the sprite pack fails to build —
// mirrors MatchScreen's atlas useMemo fallback (same constant/behavior).
const FALLBACK_SPRITE = 16;

export function StressScreen({ onBack }: { onBack?: () => void }) {
  const { width, height } = useWindowDimensions();
  const [fps, setFps] = useState(0);

  // Real sprite atlas, built once. Mirrors MatchScreen's atlas useMemo
  // exactly: buildSpriteAtlas already applies makeNonTextureImage() — if it
  // throws (sprites.json failing loader validation), fall back to a plain
  // white square instead of crashing the screen. (Unlike MatchScreen, this
  // screen never tints sprites, so there's no fallbackMode flag to track.)
  const atlas = useMemo(() => {
    try {
      return buildSpriteAtlas(Skia);
    } catch (err) {
      console.warn('StressScreen: buildSpriteAtlas failed — rendering placeholder rects', err);
      const surface = Skia.Surface.MakeOffscreen(FALLBACK_SPRITE, FALLBACK_SPRITE);
      if (!surface) throw err; // Skia itself is broken — nothing could render anyway
      const canvas = surface.getCanvas();
      const paint = Skia.Paint();
      paint.setColor(Skia.Color('#ffffff'));
      canvas.drawRect(Skia.XYWHRect(0, 0, FALLBACK_SPRITE, FALLBACK_SPRITE), paint);
      surface.flush();
      return {
        image: surface.makeImageSnapshot().makeNonTextureImage() as unknown,
        rectFor: (_key: string) => ({ x: 0, y: 0, w: FALLBACK_SPRITE, h: FALLBACK_SPRITE }),
      };
    }
  }, []);

  // Static per-sprite source rect — which atlas cell each of the 2000 slots
  // samples from. Never changes frame to frame, so it's a plain array, not a
  // Reanimated buffer — only position needs to be worklet-driven (below).
  const sprites: SkRect[] = useMemo(() => {
    return Array.from({ length: SPRITE_COUNT }, (_, i) => {
      const r = atlas.rectFor(SPRITE_KEYS[i % SPRITE_KEYS.length]);
      return Skia.XYWHRect(r.x, r.y, r.w, r.h);
    });
  }, [atlas]);

  // CRITICAL worklet rule (a prior session's hard-won lesson): a worklet may
  // only write Reanimated shared values, never state captured from useMemo.
  // `initial` here is a plain, JS-thread-only template computed once; the
  // shared values below are separate Float32Arrays cloned from it at mount
  // and never aliased to it — from this point on `initial` is never read
  // again, and no worklet closes over it.
  //
  // Deps are intentionally empty: the starting layout is seeded once from
  // whatever width/height the first render sees, so a mid-session rotation
  // doesn't rescatter every sprite. The frame callback below still reads the
  // *live* width/height for its bounce bounds, so motion still adapts to a
  // new screen size going forward.
  const initial = useMemo(() => {
    const rng = mulberry32(SEED);
    const x = new Float32Array(SPRITE_COUNT);
    const y = new Float32Array(SPRITE_COUNT);
    const vx = new Float32Array(SPRITE_COUNT);
    const vy = new Float32Array(SPRITE_COUNT);
    for (let i = 0; i < SPRITE_COUNT; i++) {
      x[i] = rng() * width;
      y[i] = rng() * height;
      const angle = rng() * Math.PI * 2;
      const speed = MIN_SPEED + rng() * (MAX_SPEED - MIN_SPEED);
      vx[i] = Math.cos(angle) * speed;
      vy[i] = Math.sin(angle) * speed;
    }
    return { x, y, vx, vy };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- seed layout once at mount, see comment above

  const posX = useSharedValue<Float32Array>(() => initial.x.slice());
  const posY = useSharedValue<Float32Array>(() => initial.y.slice());
  const velX = useSharedValue<Float32Array>(() => initial.vx.slice());
  const velY = useSharedValue<Float32Array>(() => initial.vy.slice());

  const frameCount = useSharedValue(0);
  const lastFlushMs = useSharedValue(-1);

  // The one Atlas-facing value that varies frame to frame. This modifier
  // reruns automatically whenever posX/posY change (the frame callback's
  // `.modify()` calls below) — no React state, no re-render, purely UI-thread.
  const transforms = useRSXformBuffer(SPRITE_COUNT, (xf, i) => {
    'worklet';
    xf.set(DRAW_SCALE, 0, posX.value[i], posY.value[i]);
  });

  const onFrame = useCallback(
    (info: FrameInfo) => {
      'worklet';
      const dt = (info.timeSincePreviousFrame ?? DEFAULT_FRAME_MS) / 1000;

      // Position + bounce-velocity update. velX/velY have no reactive
      // dependents (only posX/posY feed the transforms buffer above), so
      // they're mutated directly in place; posX/posY go through `.modify()`
      // so the transforms buffer's mapper is notified to recompute.
      posX.modify((arr) => {
        const vel = velX.value;
        for (let i = 0; i < SPRITE_COUNT; i++) {
          let next = arr[i] + vel[i] * dt;
          if (next < 0) {
            next = -next;
            vel[i] = -vel[i];
          } else if (next > width) {
            next = 2 * width - next;
            vel[i] = -vel[i];
          }
          arr[i] = next;
        }
        return arr;
      });

      posY.modify((arr) => {
        const vel = velY.value;
        for (let i = 0; i < SPRITE_COUNT; i++) {
          let next = arr[i] + vel[i] * dt;
          if (next < 0) {
            next = -next;
            vel[i] = -vel[i];
          } else if (next > height) {
            next = 2 * height - next;
            vel[i] = -vel[i];
          }
          arr[i] = next;
        }
        return arr;
      });

      // 1Hz FPS readout: count frames on the UI thread, flush to React state
      // via runOnJS at most once per second — never setState per frame.
      frameCount.value += 1;
      if (lastFlushMs.value < 0) {
        lastFlushMs.value = info.timestamp; // seed the flush clock, don't flush yet
      } else {
        const elapsed = info.timestamp - lastFlushMs.value;
        if (elapsed >= 1000) {
          runOnJS(setFps)(Math.round((frameCount.value * 1000) / elapsed));
          frameCount.value = 0;
          lastFlushMs.value = info.timestamp;
        }
      }
    },
    [posX, posY, velX, velY, frameCount, lastFlushMs, width, height, setFps]
  );
  useFrameCallback(onFrame);

  return (
    <View style={styles.root}>
      <Canvas style={{ width, height }}>
        <Fill color="#101418" />
        <Atlas image={atlas.image as SkImage} sprites={sprites} transforms={transforms} />
      </Canvas>
      <Pressable style={styles.backBtn} onPress={() => onBack?.()}>
        <Text style={styles.backText}>‹ Back</Text>
      </Pressable>
      <View style={styles.hud}>
        <Text style={styles.hudText}>
          {SPRITE_COUNT} sprites · {fps} fps
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#101418' },
  backBtn: {
    position: 'absolute',
    top: 56,
    left: 16,
    backgroundColor: '#1e2630',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  backText: { color: 'white', fontSize: 16 },
  hud: {
    position: 'absolute',
    top: 56,
    right: 16,
    backgroundColor: '#1e2630',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  hudText: { color: '#f5c518', fontSize: 16, fontVariant: ['tabular-nums'] },
});
