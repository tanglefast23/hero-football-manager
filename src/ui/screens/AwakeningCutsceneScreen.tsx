import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Atlas,
  Canvas,
  Circle,
  Fill,
  Group,
  Line,
  Rect,
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
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { PITCH_H, PITCH_W } from '../../sim/geometry';
import type { AwakeningCutsceneViewModel } from '../models';
import { Pitch } from '../../render/Pitch';
import { buildFallbackAtlas, buildSpriteAtlas } from '../../render/sprites/buildAtlas';
import { playerLookId } from '../../render/sprites/player-look';
import { PIXEL_ART_SAMPLING } from '../../render/pixel-art-sampling';
import { AwakeningTriggerCalloutIcon } from './awakening-trigger-visuals/AwakeningTriggerCalloutIcon';
import { AwakeningTriggerVisual } from './awakening-trigger-visuals/AwakeningTriggerVisual';
import { awakeningViewportHeight, nextAwakeningAction } from './awakening-progression';
import { PowerAcquiredDemoModal } from '../PowerAcquiredDemoModal';
import { usePixelStyles, type LocaleFaces } from '../../i18n';

const FOCUS_INDEX = 4;
/** How far the CTA halo dips between breaths; never to nothing, so it still reads as lit. */
const CTA_GLOW_MIN_OPACITY = 0.35;
/** How far the CTA swells at the top of a breath. Enough to catch the eye, not enough to jump. */
const CTA_PULSE_MAX_SCALE = 1.07;
/** Where the huddle sits inside the visible strip, as a share of its height. */
const SCENE_ANCHOR_RATIO = 0.8;
const DRAW_SCALE = 2.15;
const FALLBACK_SPRITE = 24;
const LIMP_DURATION_MS = 4400;
const HUDDLE_DELAY_MS = 3400;
const HUDDLE_DURATION_MS = 2600;
const HUDDLE_PAUSE_MS = 1500;
const TRIGGER_REVEAL_MS = 1900;
const TRIGGER_ART_DELAY_MS = 350;
const ASCENT_DURATION_MS = 2800;
const CATERPILLAR_FACE_OFFSET = { x: 11, y: -13 } as const;

// Scene juice. Unlike the match, this stage is already drawn at a fractional
// DRAW_SCALE with a fractional camera zoom, so there is no integer pixel grid
// here to protect — the shake stays a plain screen-space offset.
/** Opening jolt: the hush lands as a hit, then settles. */
const SCENE_SHAKE_MS = 420;
const SCENE_SHAKE_PT = 4;
/** The hobbling walk gets a hard punch-in before the slow push continues. */
const HOBBLE_PUNCH_MS = 140;
const HOBBLE_PUNCH_ZOOM = 1.18;
/** White-out immediately before the power arrives and the player rises. */
const REVEAL_FLASH_IN_MS = 40;
const REVEAL_FLASH_OUT_MS = 220;
const REVEAL_FLASH_OPACITY = 0.8;

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
  const styles = usePixelStyles(makeStyles);
  const { width, height } = useWindowDimensions();
  const pitchScale = width / PITCH_W;
  const viewportHeight = awakeningViewportHeight(width, height);
  const [beat, setBeat] = useState<1 | 2 | 3>(initialBeat);
  const [advanceReady, setAdvanceReady] = useState(false);
  /**
   * Fast-forwards the beat now playing to its final frame, set by the beat's own
   * effect. A tap during a beat lands here; a tap after it advances the story.
   * The same two-stage tap Bert's bubbles use — finish the line, then move on —
   * so a manager who has seen the awakening before can walk it through at their
   * own pace without ever skipping a beat unseen.
   */
  const skipBeatRef = useRef<(() => void) | null>(null);
  const [triggerPropVisible, setTriggerPropVisible] = useState(false);
  const [demoVisible, setDemoVisible] = useState(false);
  const cameraZoom = useSharedValue(1);
  // 0 -> 1 across the opening jolt; 1 means settled.
  const shakePhase = useSharedValue(1);
  const revealFlash = useSharedValue(0);
  const rush = useSharedValue(0);
  const ascent = useSharedValue(0);
  const burst = useSharedValue(0);
  const limp = useSharedValue(0);
  const limpTravel = useSharedValue(0);
  const cutsceneVisualIds = useMemo(() => [
    'u:f18',
    'r:f07',
    'r:f04',
    'u:f14',
    `r:${playerLookId(viewModel.playerId, viewModel.role, viewModel.lookId)}`,
    'r:f06',
    'u:f16',
  ], [viewModel.lookId, viewModel.playerId, viewModel.role]);
  const cutsceneSpriteKeys = useMemo(() => cutsceneVisualIds.map(id => `${id}:run0`), [cutsceneVisualIds]);

  const atlas = useMemo(() => {
    try {
      return { ...buildSpriteAtlas(Skia, cutsceneVisualIds), fallbackMode: false };
    } catch (error) {
      console.warn('AwakeningCutsceneScreen: sprite atlas failed, using fallback', error);
      return { ...buildFallbackAtlas(Skia, FALLBACK_SPRITE), fallbackMode: true };
    }
  }, [cutsceneVisualIds]);
  const sprites: SkRect[] = useMemo(() => cutsceneSpriteKeys.map(key => {
    const rect = atlas.rectFor(key);
    return Skia.XYWHRect(rect.x, rect.y, rect.w, rect.h);
  }), [atlas, cutsceneSpriteKeys]);

  const centerX = width / 2;
  // Anchored inside the band the viewport actually shows, NOT the middle of the
  // full-pitch drawing. The canvas is PITCH_H * (width / PITCH_W) tall — 3,000pt
  // on a desktop window — so centring on its middle parked the entire cast about
  // a thousand points below the visible strip and left an empty green field.
  // 0.8 reproduces the phone framing the shot was composed for.
  const centerY = viewportHeight * SCENE_ANCHOR_RATIO;
  // Camera = opening jolt (screen-space, applied before the zoom) + the push in.
  // Two incommensurate sine terms with a quadratic decay: the first frame
  // carries the hit and the tail settles instead of buzzing.
  const cameraTransform = useDerivedValue(() => {
    const phase = shakePhase.value;
    const decay = phase >= 1 ? 0 : (1 - phase) ** 2;
    return [
      { translateX: Math.sin(phase * Math.PI * 14) * SCENE_SHAKE_PT * decay },
      { translateY: Math.sin(phase * Math.PI * 11 + 1.7) * SCENE_SHAKE_PT * decay * 0.7 },
      { scale: cameraZoom.value },
    ];
  });
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

  const transforms = useRSXformBuffer(cutsceneSpriteKeys.length, (transform, index) => {
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

  const colors: SkColor[] = useMemo(() => cutsceneSpriteKeys.map((_, index) => {
    if (index === FOCUS_INDEX && beat === 3) return Skia.Color('#f7d894');
    if (atlas.fallbackMode) return Skia.Color(index < 4 ? '#d94f52' : '#5a8fd6');
    return Skia.Color('#ffffff');
  }), [atlas.fallbackMode, beat, cutsceneSpriteKeys]);

  useEffect(() => {
    onBeatChange?.(beat);
    setAdvanceReady(false);
    setTriggerPropVisible(false);
    let readyDelay: number;
    let propTimer: ReturnType<typeof setTimeout> | undefined;
    /** Snaps this beat to the frame it was going to settle on, for a skip tap. */
    let settle: () => void;
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
      // The scene opens on a jolt, then the hobbling walk gets a hard punch-in
      // before the long slow push resumes to the same 1.42 it always ended on.
      shakePhase.value = 1;
      revealFlash.value = 0;
      if (reduceMotion) {
        cameraZoom.value = withTiming(1.2, { duration: 0 });
      } else {
        shakePhase.value = 0;
        shakePhase.value = withTiming(1, {
          duration: SCENE_SHAKE_MS,
          easing: ReanimatedEasing.linear,
        });
        cameraZoom.value = withSequence(
          withTiming(HOBBLE_PUNCH_ZOOM, {
            duration: HOBBLE_PUNCH_MS,
            easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
          }),
          withTiming(1.42, {
            duration: LIMP_DURATION_MS + HUDDLE_DURATION_MS - HOBBLE_PUNCH_MS,
            easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
          }),
        );
      }
      readyDelay = reduceMotion
        ? 500
        : HUDDLE_DELAY_MS + HUDDLE_DURATION_MS + HUDDLE_PAUSE_MS;
      settle = () => {
        limpTravel.value = 1;
        limp.value = 1;
        rush.value = 1;
        shakePhase.value = 1;
        cameraZoom.value = reduceMotion ? 1.2 : 1.42;
      };
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
      settle = () => {
        setTriggerPropVisible(true);
        cameraZoom.value = reduceMotion ? 1.8 : 2.25;
      };
    } else {
      limpTravel.value = 1;
      limp.value = 1;
      rush.value = 1;
      // The power arrives on a white-out: it peaks inside 40ms, while the
      // ascent's out(cubic) has barely left the ground, so it reads as the
      // flash that lifts him.
      if (!reduceMotion) {
        revealFlash.value = withSequence(
          withTiming(REVEAL_FLASH_OPACITY, {
            duration: REVEAL_FLASH_IN_MS,
            easing: ReanimatedEasing.linear,
          }),
          withTiming(0, { duration: REVEAL_FLASH_OUT_MS, easing: ReanimatedEasing.linear }),
        );
      }
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
      settle = () => {
        // The white-out is a transition, not a destination: skipping past the
        // lift means skipping the flash that sold it, so it ends cleared.
        revealFlash.value = 0;
        ascent.value = 1;
        burst.value = 1;
        cameraZoom.value = reduceMotion ? 1.55 : 1.68;
      };
    }
    const readyTimer = setTimeout(() => setAdvanceReady(true), readyDelay);
    skipBeatRef.current = () => {
      clearTimeout(readyTimer);
      if (propTimer !== undefined) clearTimeout(propTimer);
      settle();
      setAdvanceReady(true);
    };
    return () => {
      skipBeatRef.current = null;
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
    revealFlash,
    rush,
    shakePhase,
  ]);

  const current = beat === 2
    ? { number: '02', kicker: viewModel.triggerKicker, title: viewModel.triggerTitle }
    : BEAT_LABELS[beat];
  const triggerOffset = viewModel.triggerVisual === 'caterpillar'
    ? CATERPILLAR_FACE_OFFSET
    : { x: 0, y: 0 };
  const copy = beat === 1
    ? null
    : beat === 2
      ? `${viewModel.triggerCopy} ${viewModel.omenCopy}`
      : viewModel.revealCopy;
  const focusY = centerY - (beat === 3 ? 70 : 0);
  const tapHint = !advanceReady
    ? 'TAP TO SKIP'
    : beat === 3
      ? viewModel.firstHero ? 'HERO #1' : 'NEW HERO'
      : 'TAP TO CONTINUE';
  /**
   * One tap, two jobs. Mid-beat it jumps to the end of what is playing rather
   * than fast-forwarding through it: at 3x the hobble and the huddle are a blur,
   * and the point of these beats is the pose they arrive at.
   */
  const advanceStory = () => {
    if (!advanceReady) {
      skipBeatRef.current?.();
      return;
    }
    const action = nextAwakeningAction(beat);
    if (action === 'continue') {
      setDemoVisible(true);
      return;
    }
    setBeat(action);
  };
  const storyAccessibilityLabel = beat < 3
    ? `Awakening beat ${beat} of 3.`
    : `${viewModel.playerName} awakened with ${viewModel.powerName}. ${viewModel.powerDescription} ${viewModel.revealCopy} ${viewModel.licenseLabel}.`;
  const storyAccessibilityHint = advanceReady
    ? beat < 3 ? 'Tap anywhere for the next beat' : 'Tap anywhere to watch a short demonstration'
    : 'Tap anywhere to skip to the end of this beat';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.flex}>
        {/* First child, absolutely filled: it is painted UNDER the header, the
            viewport and the story panel, so each of those still takes its own
            taps — but the bare pitch either side of the card is no longer dead.
            On a wide screen that empty area is most of the screen, and tapping
            it did nothing. */}
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onPress={advanceStory}
          style={StyleSheet.absoluteFill}
        />
        {/* Read-only chrome, so it lets the tap through to the backdrop above
            rather than swallowing it: a tap on the fixture line is a tap on
            the cutscene. */}
        <View style={styles.header} pointerEvents="none">
          <View>
            <Text style={styles.eyebrow}>FINAL WHISTLE · AWAKENING</Text>
            <Text style={styles.fixture}>{viewModel.fixtureLabel}</Text>
          </View>
          <View style={styles.counter}>
            <Text style={styles.counterText}>{current.number} / 03</Text>
          </View>
        </View>

        <View style={[styles.viewport, { height: viewportHeight }]}>
          <Canvas style={{ width, height: viewportHeight }}>
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
                  x={centerX + triggerOffset.x}
                  y={centerY + triggerOffset.y}
                />
              ) : null}
            </Group>
            {/* Outside the camera group so the white-out covers the whole
                viewport however far the shot has pushed in. */}
            <Rect
              x={0}
              y={0}
              width={width}
              height={viewportHeight}
              color="#ffffff"
              opacity={revealFlash}
            />
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
          {/* The whole picture is the button too, so a skip tap can land where
              the manager is already looking instead of on the text below. */}
          <Pressable
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onPress={advanceStory}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={storyAccessibilityLabel}
          accessibilityHint={storyAccessibilityHint}
          onPress={advanceStory}
        >
          <View style={[
            styles.storyPanel,
            beat === 3 ? styles.storyPanelHero : null,
          ]}>
            <View style={styles.storyTopline}>
              <Text style={[styles.beatKicker, beat === 3 ? styles.heroInk : null]}>{current.kicker}</Text>
              {/* Lit only once the tap does something. While the scene is still
                  playing the same line is a status, and a status that glows
                  like a button is a promise the screen cannot keep. */}
              {advanceReady ? (
                <AwakeningCta label={tapHint} reduceMotion={reduceMotion} />
              ) : (
                <Text style={[styles.tapHint, beat === 3 ? styles.heroInk : null]}>{tapHint}</Text>
              )}
            </View>
            <Text style={[styles.beatTitle, beat === 3 ? styles.heroInk : null]}>
              {beat === 3 ? viewModel.playerName : current.title}
            </Text>
            {beat === 3 ? <Text style={styles.powerName}>{viewModel.powerName}</Text> : null}
            {beat === 3 ? (
              <View style={styles.powerDescriptionCard}>
                <Text style={styles.powerDescriptionLabel}>WHAT IT DOES</Text>
                <Text style={styles.powerDescription}>{viewModel.powerDescription}</Text>
              </View>
            ) : null}
            {copy !== null ? (
              <Text style={[styles.storyCopy, beat === 3 ? styles.heroCopy : null]}>{copy}</Text>
            ) : null}
            {beat === 3 ? (
              <View style={styles.heroFooter}>
                <Text style={styles.license}>{viewModel.licenseLabel}</Text>
                <AwakeningCta label="WATCH EXAMPLE ›" reduceMotion={reduceMotion} />
              </View>
            ) : null}
          </View>
        </Pressable>
      </View>
      <PowerAcquiredDemoModal
        visible={demoVisible}
        playerName={viewModel.playerName}
        powerId={viewModel.powerId}
        powerName={viewModel.powerName}
        description={viewModel.powerDescription}
        continueLabel={viewModel.continueLabel}
        reduceMotion={reduceMotion}
        onClose={() => setDemoVisible(false)}
        onContinue={() => {
          setDemoVisible(false);
          onContinue();
        }}
      />
    </SafeAreaView>
  );
}

/**
 * Every "tap to go on" in the awakening, in one shape: hero gold on ink,
 * behind a breathing halo. The sequence is the one place a manager watches
 * rather than plays, so the single thing they still have to do is the only
 * thing on the panel wearing the accent.
 *
 * The halo is a layer of its own rather than the chip's own opacity — fading
 * the chip would fade the label with it, which reads as dimming, not glowing.
 *
 * The chip breathes in size on the same value that drives the halo, so the
 * glow and the swell are one movement rather than two things ticking at each
 * other. Reduce Motion flattens the size range instead of switching the
 * transform off, which keeps a single type on the style either way.
 */
function AwakeningCta({ label, reduceMotion }: { label: string; reduceMotion: boolean }) {
  const styles = usePixelStyles(makeStyles);
  const pulse = useRef(new Animated.Value(reduceMotion ? 1 : CTA_GLOW_MIN_OPACITY)).current;
  const scale = pulse.interpolate({
    inputRange: [CTA_GLOW_MIN_OPACITY, 1],
    outputRange: reduceMotion ? [1, 1] : [1, CTA_PULSE_MAX_SCALE],
  });

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 620, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: CTA_GLOW_MIN_OPACITY, duration: 620, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reduceMotion]);

  return (
    <View style={styles.ctaAnchor}>
      <Animated.View pointerEvents="none" style={[styles.ctaGlow, { opacity: pulse }]} />
      <Animated.View style={[styles.ctaChip, { transform: [{ scale }] }]}>
        <Text style={styles.ctaText}>{label}</Text>
      </Animated.View>
    </View>
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
  if (powerId === 'PORTAL_PASS' || powerId === 'PHASE_RUN' || powerId === 'ELASTIC_KEEPER') {
    const color = powerId === 'PORTAL_PASS' ? '#b189d9' : powerId === 'PHASE_RUN' ? '#77a4d8' : '#65b96e';
    const stretch = powerId === 'ELASTIC_KEEPER' ? 1.55 : 1;
    return (
      <>
        {[24, 39, 56].map((radius, index) => (
          <Circle
            key={radius}
            cx={x}
            cy={y}
            r={radius * (reveal ? stretch : 0.72)}
            color={color}
            style="stroke"
            strokeWidth={Math.max(2, 5 - index)}
            opacity={0.72 - index * 0.16}
          />
        ))}
      </>
    );
  }
  if (powerId === 'FUTURE_SIGHT' || powerId === 'DECOY_DOUBLE') {
    const spread = reveal ? 42 : 24;
    return (
      <>
        <Circle cx={x - spread} cy={y} r={reveal ? 24 : 14} color="#b189d9" opacity={0.35} />
        <Circle cx={x + spread} cy={y} r={reveal ? 24 : 14} color="#77a4d8" opacity={0.35} />
        <Line p1={{ x: x - spread, y }} p2={{ x: x + spread, y }} color="#f7d894" strokeWidth={reveal ? 6 : 3} opacity={0.8} />
      </>
    );
  }
  if (powerId === 'WEB_TRAP') {
    const radius = reveal ? 66 : 38;
    return (
      <>
        {[0, 45, 90, 135].map(angle => {
          const radians = angle * Math.PI / 180;
          return <Line key={angle} p1={{ x: x - Math.cos(radians) * radius, y: y - Math.sin(radians) * radius }} p2={{ x: x + Math.cos(radians) * radius, y: y + Math.sin(radians) * radius }} color="#f4f1ea" strokeWidth={2} opacity={0.7} />;
        })}
        <Circle cx={x} cy={y} r={radius * 0.58} color="#f4f1ea" style="stroke" strokeWidth={2} opacity={0.55} />
      </>
    );
  }
  if (powerId === 'THUNDER_STRIKE') {
    const radius = reveal ? 72 : 42;
    return (
      <>
        {[-1, 1].map(direction => (
          <Line key={direction} p1={{ x: x + direction * radius, y: y - radius }} p2={{ x: x - direction * 10, y: y + radius }} color="#edb54a" strokeWidth={reveal ? 7 : 4} opacity={0.85} />
        ))}
        <Circle cx={x} cy={y} r={reveal ? 22 : 13} color="#f7d894" opacity={0.48} />
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

// Chalkboard-pitch chrome (docs/11 palette): the cutscene sits on the same
// dark-pitch stage as the landing screens — pixel display type, paper
// stickers, and a centered story panel. Custom fonts are referenced without
// fontWeight so iOS never swaps in a synthetic system face.
const makeStyles = (faces: LocaleFaces) => StyleSheet.create({
  root: { flex: 1, backgroundColor: '#3f8a4a' },
  flex: { flex: 1 },
  header: {
    minHeight: 84,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: { fontFamily: faces.display, color: '#f7d894', fontSize: 10, letterSpacing: 2 },
  fixture: { marginTop: 6, fontFamily: faces.data, color: '#f4f1ea', fontSize: 12, textTransform: 'uppercase' },
  counter: {
    borderWidth: 2,
    borderColor: '#241f2e',
    backgroundColor: '#f4f1ea',
    paddingHorizontal: 10,
    paddingVertical: 7,
    transform: [{ rotate: '2deg' }],
  },
  counterText: { fontFamily: faces.display, color: '#241f2e', fontSize: 13 },
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
  fullTimeText: { fontFamily: faces.display, color: '#f4f1ea', fontSize: 12, letterSpacing: 1.5 },
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
  biteLabel: { fontFamily: faces.display, color: '#e7ff7a', fontSize: 10, letterSpacing: 1 },
  biteDetail: { marginTop: 3, color: '#f4f1ea', fontSize: 10 },
  storyPanel: {
    margin: 14,
    padding: 16,
    width: 'auto',
    maxWidth: 560,
    minWidth: 320,
    alignSelf: 'center',
    backgroundColor: '#f4f1ea',
    borderWidth: 3,
    borderColor: '#241f2e',
    borderBottomWidth: 7,
  },
  storyPanelHero: { backgroundColor: '#edb54a', borderColor: '#f7d894' },
  storyTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  beatKicker: { fontFamily: faces.data, color: '#d94f52', fontSize: 11, letterSpacing: 1 },
  tapHint: { fontFamily: faces.data, color: '#6b6675', fontSize: 9, letterSpacing: 0.8 },
  heroInk: { color: '#241f2e' },
  beatTitle: { marginTop: 8, fontFamily: faces.display, color: '#241f2e', fontSize: 24, lineHeight: 28, textTransform: 'uppercase' },
  powerName: { marginTop: 4, fontFamily: faces.display, color: '#fff8df', fontSize: 17, textTransform: 'uppercase', letterSpacing: 1 },
  powerDescriptionCard: { marginTop: 10, borderWidth: 2, borderColor: '#3f6fb5', backgroundColor: '#a3c8f0', paddingHorizontal: 10, paddingVertical: 8 },
  powerDescriptionLabel: { color: '#3f6fb5', fontFamily: faces.display, fontSize: 8, letterSpacing: 1.4 },
  powerDescription: { marginTop: 4, color: '#241f2e', fontSize: 14, lineHeight: 19 },
  storyCopy: { marginTop: 12, color: '#3a3350', fontSize: 15, lineHeight: 22 },
  heroCopy: { color: '#241f2e' },
  heroFooter: { marginTop: 14, paddingTop: 12, borderTopWidth: 2, borderTopColor: '#241f2e55', flexDirection: 'row', justifyContent: 'space-between' },
  license: { fontFamily: faces.data, color: '#241f2e', fontSize: 10, textTransform: 'uppercase' },
  ctaAnchor: { position: 'relative' },
  ctaGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    backgroundColor: '#edb54a',
    // Same halo geometry as the guided-alert glow, in hero gold: docs/08 gives
    // gold to hero and power elements, and this whole screen is one.
    boxShadow: '0 0 12px 4px rgba(237, 181, 74, 0.9)',
    shadowColor: '#edb54a',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 9,
    elevation: 10,
  },
  ctaChip: {
    backgroundColor: '#241f2e',
    borderWidth: 2,
    borderColor: '#f7d894',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ctaText: {
    fontFamily: faces.display,
    color: '#edb54a',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
