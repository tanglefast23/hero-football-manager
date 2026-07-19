import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Atlas,
  Canvas,
  Circle,
  Fill,
  Group,
  Line,
  Skia,
  useRSXformBuffer,
  type SkColor,
  type SkImage,
  type SkRect,
} from '@shopify/react-native-skia';
import {
  Easing as ReanimatedEasing,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { PITCH_H, PITCH_W } from '../../sim/geometry';
import type { AwakeningCutsceneViewModel } from '../models';
import { Pitch } from '../../render/Pitch';
import { buildFallbackAtlas, buildSpriteAtlas } from '../../render/sprites/buildAtlas';
import { PIXEL_ART_SAMPLING } from '../../render/pixel-art-sampling';
import { AwakeningTriggerCalloutIcon } from './awakening-trigger-visuals/AwakeningTriggerCalloutIcon';
import { AwakeningTriggerVisual } from './awakening-trigger-visuals/AwakeningTriggerVisual';

const CUTSCENE_SPRITES = [
  // Back-to-front painter order. Actors with higher feet on the pitch draw
  // first; Vela draws between the rear and front rows of the huddle.
  'u9:run0',
  'r8:run0',
  'r5:run0',
  'u5:run0',
  'r9:run0',
  'r7:run0',
  'u7:run0',
] as const;
const FOCUS_INDEX = 4;
const DRAW_SCALE = 2.15;
const FALLBACK_SPRITE = 24;
const LIMP_DURATION_MS = 4400;
const HUDDLE_DELAY_MS = 3400;
const HUDDLE_DURATION_MS = 2600;
const HUDDLE_PAUSE_MS = 1500;
const TRIGGER_REVEAL_MS = 1900;
const TRIGGER_ART_DELAY_MS = 350;
const ASCENT_DURATION_MS = 2800;

const BEAT_LABELS = {
  1: { number: '01', kicker: 'THE HUSH', title: 'Something is wrong.' },
  3: { number: '03', kicker: 'THE ASCENSION', title: 'A hero rises.' },
} as const;

export interface AwakeningCutsceneScreenProps {
  viewModel: AwakeningCutsceneViewModel;
  reduceMotion?: boolean;
  initialBeat?: 1 | 2 | 3;
  onBeatChange?: (beat: 1 | 2 | 3) => void;
  onContinue: () => void;
}

export function AwakeningCutsceneScreen({
  viewModel,
  reduceMotion = false,
  initialBeat = 1,
  onBeatChange,
  onContinue,
}: AwakeningCutsceneScreenProps) {
  const { width } = useWindowDimensions();
  const pitchScale = width / PITCH_W;
  const pitchHeight = PITCH_H * pitchScale;
  const viewportHeight = Math.min(440, pitchHeight * 0.72);
  const [beat, setBeat] = useState<1 | 2 | 3>(initialBeat);
  const [advanceReady, setAdvanceReady] = useState(false);
  const [triggerPropVisible, setTriggerPropVisible] = useState(false);
  const cameraZoom = useSharedValue(1);
  const rush = useSharedValue(0);
  const ascent = useSharedValue(0);
  const burst = useSharedValue(0);
  const limp = useSharedValue(0);
  const limpTravel = useSharedValue(0);

  const atlas = useMemo(() => {
    try {
      return { ...buildSpriteAtlas(Skia), fallbackMode: false };
    } catch (error) {
      console.warn('AwakeningCutsceneScreen: sprite atlas failed, using fallback', error);
      return { ...buildFallbackAtlas(Skia, FALLBACK_SPRITE), fallbackMode: true };
    }
  }, []);
  const sprites: SkRect[] = useMemo(() => CUTSCENE_SPRITES.map(key => {
    const rect = atlas.rectFor(key);
    return Skia.XYWHRect(rect.x, rect.y, rect.w, rect.h);
  }), [atlas]);

  const centerX = width / 2;
  const centerY = pitchHeight / 2;
  const cameraTransform = useDerivedValue(() => [{ scale: cameraZoom.value }]);
  const starts = useMemo(() => [
    [width * 0.63, centerY - 176],
    [width * 0.36, centerY - 165],
    [width * 0.13, centerY - 118],
    [width * 0.86, centerY - 108],
    [width * 0.06, centerY],
    [width * 0.2, centerY + 132],
    [width * 0.8, centerY + 138],
  ], [centerX, centerY, width]);
  const huddle = useMemo(() => [
    [centerX + 13, centerY - 45],
    [centerX - 12, centerY - 42],
    [centerX - 34, centerY - 22],
    [centerX + 35, centerY - 20],
    [centerX, centerY],
    [centerX - 38, centerY + 28],
    [centerX + 38, centerY + 30],
  ], [centerX, centerY]);

  const transforms = useRSXformBuffer(CUTSCENE_SPRITES.length, (transform, index) => {
    'worklet';
    const focus = index === FOCUS_INDEX;
    const startX = starts[index][0];
    const startY = starts[index][1];
    const huddleX = huddle[index][0];
    const huddleY = huddle[index][1];
    const outwardX = huddleX + (huddleX - centerX) * 2.4;
    const outwardY = huddleY + (huddleY - centerY) * 1.6;
    let x = focus
      ? startX + (huddleX - startX) * limpTravel.value
      : startX + (huddleX - startX) * rush.value;
    let y = focus
      ? startY - Math.abs(Math.sin(limpTravel.value * Math.PI * 8)) * 4
      : startY + (huddleY - startY) * rush.value;
    if (focus) {
      y -= ascent.value * 70;
    } else {
      x += (outwardX - huddleX) * burst.value;
      y += (outwardY - huddleY) * burst.value;
    }
    const limpStep = Math.sin(limpTravel.value * Math.PI * 8) * 0.12;
    const rotation = focus ? (1 - ascent.value) * (limpStep + limp.value * 0.72) : 0;
    const cos = Math.cos(rotation) * DRAW_SCALE;
    const sin = Math.sin(rotation) * DRAW_SCALE;
    transform.set(
      cos,
      sin,
      x - (cos * 24 - sin * 30) / 2,
      y - (sin * 24 + cos * 30) / 2,
    );
  });

  const colors: SkColor[] = useMemo(() => CUTSCENE_SPRITES.map((_, index) => {
    if (index === FOCUS_INDEX && beat === 3) return Skia.Color('#f7d894');
    if (atlas.fallbackMode) return Skia.Color(index < 4 ? '#d94f52' : '#5a8fd6');
    return Skia.Color('#ffffff');
  }), [atlas.fallbackMode, beat]);

  useEffect(() => {
    onBeatChange?.(beat);
    setAdvanceReady(false);
    setTriggerPropVisible(false);
    let readyDelay: number;
    let propTimer: ReturnType<typeof setTimeout> | undefined;
    if (beat === 1) {
      limpTravel.value = 0;
      limp.value = 0;
      rush.value = 0;
      ascent.value = 0;
      burst.value = 0;
      cameraZoom.value = 1;
      limpTravel.value = withTiming(1, {
        duration: reduceMotion ? 0 : LIMP_DURATION_MS,
        easing: ReanimatedEasing.inOut(ReanimatedEasing.quad),
      });
      limp.value = withDelay(
        reduceMotion ? 0 : 3200,
        withTiming(1, {
          duration: reduceMotion ? 0 : 1200,
          easing: ReanimatedEasing.in(ReanimatedEasing.cubic),
        }),
      );
      rush.value = withDelay(
        reduceMotion ? 0 : HUDDLE_DELAY_MS,
        withTiming(1, {
          duration: reduceMotion ? 0 : HUDDLE_DURATION_MS,
          easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
        }),
      );
      cameraZoom.value = withTiming(reduceMotion ? 1.2 : 1.42, {
        duration: reduceMotion ? 0 : LIMP_DURATION_MS + HUDDLE_DURATION_MS,
        easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
      });
      readyDelay = reduceMotion
        ? 500
        : HUDDLE_DELAY_MS + HUDDLE_DURATION_MS + HUDDLE_PAUSE_MS;
    } else if (beat === 2) {
      limpTravel.value = 1;
      limp.value = 1;
      rush.value = 1;
      propTimer = setTimeout(
        () => setTriggerPropVisible(true),
        reduceMotion ? 0 : TRIGGER_ART_DELAY_MS,
      );
      cameraZoom.value = withTiming(reduceMotion ? 1.8 : 2.25, {
        duration: reduceMotion ? 0 : TRIGGER_REVEAL_MS,
        easing: ReanimatedEasing.inOut(ReanimatedEasing.cubic),
      });
      readyDelay = reduceMotion ? 500 : TRIGGER_REVEAL_MS + 900;
    } else {
      limpTravel.value = 1;
      limp.value = 1;
      rush.value = 1;
      ascent.value = withTiming(1, {
        duration: reduceMotion ? 0 : ASCENT_DURATION_MS,
        easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
      });
      burst.value = withTiming(1, {
        duration: reduceMotion ? 0 : 1600,
        easing: ReanimatedEasing.out(ReanimatedEasing.quad),
      });
      cameraZoom.value = withTiming(reduceMotion ? 1.55 : 1.68, {
        duration: reduceMotion ? 0 : 1800,
        easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
      });
      readyDelay = reduceMotion ? 500 : ASCENT_DURATION_MS + 700;
    }
    const readyTimer = setTimeout(() => setAdvanceReady(true), readyDelay);
    return () => {
      clearTimeout(readyTimer);
      if (propTimer !== undefined) clearTimeout(propTimer);
    };
  }, [
    ascent,
    beat,
    burst,
    cameraZoom,
    limp,
    limpTravel,
    onBeatChange,
    reduceMotion,
    rush,
  ]);

  const current = beat === 2
    ? { number: '02', kicker: viewModel.triggerKicker, title: viewModel.triggerTitle }
    : BEAT_LABELS[beat];
  const copy = beat === 1
    ? null
    : beat === 2
      ? `${viewModel.triggerCopy} ${viewModel.omenCopy}`
      : viewModel.revealCopy;
  const focusY = centerY - (beat === 3 ? 70 : 0);
  const tapHint = beat === 3
    ? advanceReady
      ? viewModel.firstHero ? 'HERO #1' : 'NEW HERO'
      : 'ASCENDING…'
    : advanceReady
      ? 'TAP TEXT TO CONTINUE'
      : beat === 1 ? 'SCENE PLAYING…' : 'REVEALING…';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.flex}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>FINAL WHISTLE · AWAKENING</Text>
            <Text style={styles.fixture}>{viewModel.fixtureLabel}</Text>
          </View>
          <View style={styles.counter}>
            <Text style={styles.counterText}>{current.number} / 03</Text>
          </View>
        </View>

        <View style={[styles.viewport, { height: viewportHeight }]}>
          <Canvas style={{ width, height: pitchHeight }}>
            <Fill color="#3f8a4a" />
            <Group
              origin={{ x: centerX, y: centerY }}
              transform={cameraTransform}
            >
              <Pitch scale={pitchScale} />
              {beat >= 2 ? <PowerOmen powerId={viewModel.powerId} x={centerX} y={focusY} reveal={beat === 3} /> : null}
              <Atlas
                image={atlas.image as SkImage}
                sprites={sprites}
                transforms={transforms}
                colors={colors}
                colorBlendMode="modulate"
                sampling={PIXEL_ART_SAMPLING}
              />
              {beat === 2 && triggerPropVisible ? (
                <AwakeningTriggerVisual
                  visual={viewModel.triggerVisual}
                  x={centerX}
                  y={centerY}
                />
              ) : null}
            </Group>
          </Canvas>
          <View style={styles.fullTimeBug}>
            <Text style={styles.fullTimeText}>FULL TIME</Text>
          </View>
          {beat === 2 ? (
            <View style={styles.biteCallout}>
              <AwakeningTriggerCalloutIcon visual={viewModel.triggerVisual} />
              <View>
                <Text style={styles.biteLabel}>{viewModel.triggerCallout}</Text>
                <Text style={styles.biteDetail}>{viewModel.triggerDetail}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <Pressable
          accessibilityRole={beat < 3 ? 'button' : undefined}
          accessibilityLabel={beat < 3 ? `Awakening beat ${beat} of 3. Tap the story text to continue.` : undefined}
          accessibilityState={beat < 3 ? { disabled: !advanceReady } : undefined}
          disabled={beat === 3 || !advanceReady}
          onPress={() => setBeat(currentBeat => currentBeat === 1 ? 2 : 3)}
          style={[styles.storyPanel, beat === 3 ? styles.storyPanelHero : null]}
        >
          <View style={styles.storyTopline}>
            <Text style={[styles.beatKicker, beat === 3 ? styles.heroInk : null]}>{current.kicker}</Text>
            <Text style={[styles.tapHint, beat === 3 ? styles.heroInk : null]}>{tapHint}</Text>
          </View>
          <Text style={[styles.beatTitle, beat === 3 ? styles.heroInk : null]}>
            {beat === 3 ? viewModel.playerName : current.title}
          </Text>
          {beat === 3 ? <Text style={styles.powerName}>{viewModel.powerName}</Text> : null}
          {copy !== null ? (
            <Text style={[styles.storyCopy, beat === 3 ? styles.heroCopy : null]}>{copy}</Text>
          ) : null}
          {beat === 3 ? (
            <View style={styles.heroFooter}>
              <Text style={styles.license}>{viewModel.licenseLabel}</Text>
            </View>
          ) : null}
        </Pressable>

        {beat === 3 && advanceReady ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue after the hero awakening"
            onPress={onContinue}
            style={({ pressed }) => [styles.continueButton, pressed ? styles.pressed : null]}
          >
            <Text style={styles.continueText}>
              {viewModel.continueLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function PowerOmen({
  powerId,
  x,
  y,
  reveal,
}: {
  powerId: AwakeningCutsceneViewModel['powerId'];
  x: number;
  y: number;
  reveal: boolean;
}) {
  if (powerId === 'FIRE_TORCH') {
    return (
      <>
        <Circle cx={x} cy={y} r={reveal ? 48 : 28} color="#ff6a00" opacity={reveal ? 0.32 : 0.18} />
        <Circle cx={x} cy={y} r={reveal ? 30 : 17} color="#f7d894" opacity={0.28} />
      </>
    );
  }
  if (powerId === 'SUPER_STRENGTH') {
    return (
      <>
        <Circle cx={x} cy={y + 24} r={reveal ? 62 : 34} color="#edb54a" style="stroke" strokeWidth={reveal ? 7 : 4} opacity={0.7} />
        <Circle cx={x} cy={y + 24} r={reveal ? 36 : 18} color="#f7d894" opacity={0.22} />
      </>
    );
  }
  return (
    <>
      {[-26, -13, 0, 13, 26].map((offset, index) => (
        <Line
          key={offset}
          p1={{ x: x - (reveal ? 76 : 45), y: y + offset }}
          p2={{ x: x + (reveal ? 76 : 45), y: y + offset - 8 }}
          color={index % 2 === 0 ? '#f7d894' : '#ffffff'}
          strokeWidth={reveal ? 4 : 2}
          opacity={0.65}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#181420' },
  flex: { flex: 1 },
  header: {
    minHeight: 84,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#241f2e',
    borderBottomWidth: 3,
    borderBottomColor: '#d94f52',
  },
  eyebrow: { color: '#d94f52', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  fixture: { marginTop: 6, color: '#f4f1ea', fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  counter: { borderWidth: 2, borderColor: '#f4f1ea', paddingHorizontal: 10, paddingVertical: 7 },
  counterText: { color: '#f4f1ea', fontSize: 15, fontWeight: '900' },
  viewport: { overflow: 'hidden', backgroundColor: '#3f8a4a', borderBottomWidth: 4, borderBottomColor: '#241f2e' },
  fullTimeBug: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: '#241f2eee',
    borderWidth: 2,
    borderColor: '#f4f1ea',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  fullTimeText: { color: '#f4f1ea', fontWeight: '900', letterSpacing: 1.5 },
  biteCallout: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#181420ee',
    borderWidth: 2,
    borderColor: '#e7ff7a',
    padding: 10,
  },
  biteLabel: { color: '#e7ff7a', fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  biteDetail: { marginTop: 3, color: '#f4f1ea', fontSize: 10 },
  storyPanel: {
    margin: 14,
    padding: 16,
    backgroundColor: '#f4f1ea',
    borderWidth: 3,
    borderColor: '#241f2e',
    borderBottomWidth: 7,
  },
  storyPanelHero: { backgroundColor: '#edb54a', borderColor: '#f7d894' },
  storyTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  beatKicker: { color: '#d94f52', fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  tapHint: { color: '#6b6675', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  heroInk: { color: '#241f2e' },
  beatTitle: { marginTop: 8, color: '#241f2e', fontSize: 28, lineHeight: 31, fontWeight: '900', textTransform: 'uppercase' },
  powerName: { marginTop: 4, color: '#fff8df', fontSize: 21, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
  storyCopy: { marginTop: 12, color: '#3a3350', fontSize: 15, lineHeight: 22 },
  heroCopy: { color: '#241f2e' },
  heroFooter: { marginTop: 14, paddingTop: 12, borderTopWidth: 2, borderTopColor: '#241f2e55', flexDirection: 'row', justifyContent: 'space-between' },
  license: { color: '#241f2e', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  continueButton: {
    marginHorizontal: 14,
    marginTop: 'auto',
    marginBottom: 14,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#edb54a',
    borderWidth: 3,
    borderColor: '#f7d894',
    borderBottomWidth: 7,
  },
  pressed: { opacity: 0.72, transform: [{ translateY: 2 }] },
  continueText: { color: '#241f2e', fontSize: 15, fontWeight: '900', letterSpacing: 1.1 },
});
