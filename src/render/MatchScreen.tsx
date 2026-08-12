import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Atlas,
  Circle,
  Fill,
  Group,
  Rect,
  Skia,
  type SkColor,
  type SkImage,
  type SkRect,
  type SkRSXform,
} from '@shopify/react-native-skia';
import {
  Easing as ReanimatedEasing,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { createMatch, MAX_SUBSTITUTIONS, queueInput, tick } from '../sim/match';
import { queueControlledAutoSubstitution } from '../game/match-policy';
import { isRivalHeroIntroHeroId } from '../game/rival-hero-intro';
import { SLIDE_SUCCESS_RECOVERY_TICKS } from '../sim/engine';
import { isActive, WEB_TRAP_TRIGGER_RANGE } from '../sim/powers';
import { ROVERS, UNITED } from '../sim/teams';
import { PITCH_H, TICK_MS, HALF_TICKS, dist2 } from '../sim/geometry';
import type {
  MatchEvent,
  MatchInput,
  MatchState,
  PowerId,
  TeamDef,
} from '../sim/types';
import {
  BASE_PLAYER_COUNT,
  decoyCloneAt,
  HOME_DECOY_INDEX,
  playerAt,
  RENDER_PLAYER_COUNT,
} from '../sim/entities';
import type { HudSide, MatchPerformanceLimit } from '../persistence';
import { buildSpriteAtlas, buildFallbackAtlas } from './sprites/buildAtlas';
import {
  keeperReadyFrameFacingBall,
  runFrameFacingBall,
} from './sprites/facing';
import { webbedSpriteKey } from './sprites/loader';
import {
  spriteKeyForMatchPlayer,
  visualIdForMatchPlayer,
} from './sprites/slot-key';
import {
  MATCH_SHAKE_AMPLITUDE_PT,
  matchCameraOffset,
  matchPitchLayout,
  matchShakeOffset,
  snapshotFrame,
  type PitchFrame,
} from './interpolate';
import {
  actionPose,
  isKeeperReady,
  keeperReadyFrame,
  runFrameForDistance,
  slideTackleSpriteFrameForAction,
  type PlayerActionAnimation,
} from './animation';
import { tacklePoses } from './tackle-poses';
import { useWorkletAtlasFrame } from './worklet-atlas-frame';
import {
  matchPlaybackRate,
  nextMatchSpeed,
  type MatchSpeed,
} from './match-speed';
import {
  ENCORE_MARKER_TICKS,
  type EncoreMarker,
  WorkletBallShadow,
  WorkletMatchOverlays,
  WorkletSlideTackleEffects,
  WorkletSpeedLines,
} from './WorkletMatchOverlays';
import { ProceduralMatchEffects } from './ProceduralMatchEffects';
import {
  appendMatchVfxEmitter,
  isHardShotPower,
  prepareMatchVfxEmitter,
  type MatchVfxKind,
  type PreparedMatchVfxEmitter,
} from './match-vfx';
import {
  BALL_AIRBORNE_THRESHOLD_CM,
  ballFlightWhooshStarted,
  ballVisualOffset,
} from './ball-flight-visuals';
import {
  matchPoliciesForControlledTeam,
  retainedCarrierIndex,
} from './match-control';
import {
  shouldPauseMatch,
  syncBackgroundPauseReason,
  type AutomaticMatchPauseReason,
} from './match-pause';
import {
  appendNewestFour,
  hasPowerJuiceExtras,
  POWER_JUICE_END_MS,
  POWER_JUICE_FLASH_MS,
  POWER_JUICE_FLASH_OPACITY,
  POWER_JUICE_PUNCH_MS,
  POWER_JUICE_PUNCH_ZOOM,
  POWER_JUICE_SHAKE_MS,
  POWER_JUICE_SPEED_LINES_MS,
  powerCutInAccessibilityLabel,
  powerCutInGroupPolicy,
  powerCutInPresentation,
  powerJuice,
  powerJuiceHeroTint,
  powerOverlayPath,
  POWER_TAKEOVER_POST_POWER_MS,
  powerCutInOutroDue,
  powerTakeoverShouldRemain,
  type PowerJuice,
  type PowerJuiceHeroTint,
} from './power-cut-in';
import { releaseMenuThemeToMatch, yieldMenuThemeToMatch } from './menu-audio';
import { PowerTitleTakeover } from './PowerTitleTakeover';
import {
  appendBannerNewestFour,
  type MatchBannerSubject,
} from './match-banners';
import { CupTitleCard } from './CupTitleCard';
import { cupTitleCard, type CupRoundLabel } from './cup-title-card';
import { PowerEffectScene, type PowerEffectPoint } from './PowerEffectScene';
import { powerEffectDescriptor } from './power-effect-descriptors';
import {
  livePowerEffectActors,
  superSpeedAfterimageActors,
} from './live-power-effect-actors';
import {
  advancePowerMatchShowcaseReady,
  initializePowerMatchShowcase,
  POWER_MATCH_SHOWCASE_SAFETY_FREEZE_MS,
  powerMatchShowcaseCardDueAt,
  powerMatchShowcaseSucceeded,
  powerMatchShowcaseSuccessRestartsPlay,
} from './power-match-showcase';
import {
  advanceMatchVfxShowcase,
  initializeMatchVfxShowcase,
  MATCH_VFX_SHOWCASE_FREEZE_TICKS,
  MATCH_VFX_SHOWCASE_SAFETY_TICK,
  matchVfxShowcaseEvent,
  type MatchVfxQaConfig,
} from './match-vfx-showcase';
import { Pitch } from './Pitch';
import { PIXEL_ART_SAMPLING } from './pixel-art-sampling';
import { playHapticForEvent } from './haptics';
import { FormationDiagram } from '../ui/components/FormationDiagram';
import { SfxPressable as Pressable } from '../ui/components/SfxPressable';
import { SettingsButton } from '../ui/SettingsOverlay';
import { TutorialTapCue } from '../ui/TutorialTapCue';
import { TutorialSpotlight } from '../ui/TutorialSpotlight';
import {
  tutorialCuePositionAbove,
  type TutorialAnchorLayout,
} from '../ui/tutorial-cue-position';
import { playUiClickSfx } from './management-sfx';
import { FirstMatchCoachingModal } from './FirstMatchCoachingModal';
import {
  nextFirstMatchCoachingPrompt,
  type FirstMatchCoachingPromptsSeen,
} from './first-match-coaching';
import {
  DEFAULT_FORMATION_PRESETS,
  ENERGY_USE_MODES,
  nextFormation,
  nextMentality,
  type EnergyUse,
  type FormationId,
  type Mentality,
} from '../sim/tactics';
import { layoutModeForWidth } from '../ui/layout/layout-mode';
import {
  MatchControlRail,
  type MatchRailHeroTile,
  type MatchRailTiredPlayer,
} from './MatchControlRail';
import { SubstitutionBoard } from './SubstitutionBoard';
import {
  heatFraction,
  MATCH_RAIL_GUTTER,
  MATCH_RAIL_TOP_INSET,
  MATCH_RAIL_WIDTH,
  mostTiredFirst,
  RAIL_HERO_TILE_CAP,
  railHeroStatus,
} from './match-rail';
import {
  energyUseAccessibility,
  energyUseLabel,
  energyBand,
  summarizeTeamEnergy,
} from './match-energy-ui';
import { mentalityLabel } from './match-mentality-ui';
import { chargeMeter } from './hero-charge-meter';
import { HeroChargeMeter } from './HeroChargeMeter';
import { teamKitColor } from './team-kit-ui';
import {
  CARRIER_CARD_CONTENT_WIDTH,
  useMatchScreenStyles,
} from './match-screen-styles';
import { useCopy } from '../i18n';
import {
  type MatchAudioProfile,
  initAudio,
  playBallFlightWhoosh,
  playForEvent,
  startFireAmbience,
  startTheme,
  stopFireAmbience,
  stopTheme,
  teardownAudio,
} from './audio';
import { RecoverableSkiaCanvas } from './RecoverableSkiaCanvas';
import {
  createFramePacingMonitor,
  createMatchPerformanceLimit,
  isMatchPerformanceLimitActive,
  performanceAdaptationDecision,
  recordFrameGap,
  resetFramePacingMonitor,
} from './match-performance';
import { hasWeakDeviceHardwareHint } from './device-performance-hint';
import { advanceGraphicsRecoveryChunk } from './match-graphics-recovery';

const MAX_CATCHUP_TICKS = 5;
const TOTAL_TICKS = HALF_TICKS * 2;

// Shared "no shake" reading, so the per-frame camera update allocates nothing.
const ZERO_SHAKE = { x: 0, y: 0 } as const;

// Sprite magnification (PLAYER_DRAW_SCALE / BALL_DRAW_SCALE) and the pixel-grid
// snapping that keeps it an integer multiple live in interpolate.ts, which is
// headless-testable — see matchPitchLayout below.

// speedFor()'s PAC ceiling: (40 + 168 max effective PAC) * 1.0 conditionScale
// * 2.2 max active-SUPER_SPEED multiplier ~= 306 pitch-units/tick. The snap
// threshold (2x that) sits comfortably above any ordinary tick's movement but
// far below a kickoff/restart teleport (players jump thousands of units back
// to their formation anchors) — ledger item 3.
const MAX_SPEED_PER_TICK = 310;
const SNAP_DIST2 = (2 * MAX_SPEED_PER_TICK) ** 2;

// How long a HUD banner holds, and how long the score keeps flashing after a
// goal, in sim ticks. The number comes from ledger item 5 ("flash the chip dim
// for ~30 ticks") — but that chip dim was the POWER_EXPIRED flash, and it went
// away with the Zone countdown at m1.27. Every caller left is a banner.
const FLASH_TICKS = 30;

// Ball-flight presentation (render-only) — lifted kicks show a curved history;
// shots also retain the dust puff kicked up at the strike.
const BALL_FLIGHT_TRAIL_LEN = 8; // longer arc history makes lifted kicks read at a glance
const PUFF_TICKS = 16; // how long the kick-origin dust puff lingers, in sim ticks
const PUFF_RINGS = 3; // concentric expanding dust rings

// Super Strength impact burst — a bright core + shockwave ring at the point a
// charge lands, in sim ticks (render-only, like the shot dust puff above).
const IMPACT_TICKS = 14;

// End-of-match hold — real-time ms the screen stays mounted after the sim
// reaches fulltime, so the FULL_TIME whistle (and any last-tick goal audio)
// rings out before onDone unmounts the screen and tears audio down.
// Renderer-side wall clock, not sim state: sim ticks already stop at fulltime.
const FULLTIME_HOLD_MS = 1500;

// Player sprite cell width (sprites.json `cell.w`, validated by loadSpriteSheet)
// — used to size the possession/zone rings around a player's sprite.
const PLAYER_CELL_W = 24;

// Held-ball foot offset (T8) — draws a held ball at the carrier's leading
// foot instead of dead-center, so it reads as carried rather than "stood
// on." Render-only (transforms useMemo below); never touches frame.ball,
// frame.players, or any sim state. Reuses PLAYER_CELL_W above for "half the
// player sprite's drawn width."
const BALL_FOOT_FORWARD_FRACTION = 0.35; // of the player sprite's drawn half-width
const BALL_FOOT_DOWN_PX = 3; // feet sit toward the sprite's bottom half, not its center
const BALL_FOOT_DEADZONE_PX = 0.5; // tick-to-tick screen-px delta below this reads as "stationary"

// Side of the plain white square drawn when the sprite pack fails to build
// (matches the player cell width so the placeholder keeps sane proportions).
const FALLBACK_SPRITE = 24;

// Rival readiness remains visible counterplay. Controlled-team powers activate
// automatically and announce themselves only when they actually fire.
const RIVAL_ZONE_BANNER_TICKS = 20;
const COLOR_SAFE_HOME_KIT = {
  o: '#6a4326',
  r: '#ba7517',
  R: '#edb54a',
  E: '#f7d894',
} as const;

type MatchBanner = {
  id: string;
  text: string;
  untilTick: number;
  tone: 'gold' | 'red' | 'blue';
  /** Set for the three coaching controls so a tap and the sim's confirming
   * event share one tile instead of stacking two identical banners. */
  subject?: MatchBannerSubject;
};

type PowerCutInEntry = {
  id: string;
  power: PowerId;
  playerName: string;
  skippable: boolean;
  /** Present for real activations; the static QA group has no lifecycle owner. */
  player?: number;
  /** Wall-clock start of the one-second post-power hold. */
  outroStartedAt?: number;
};

type MatchPowerEffectTarget =
  | { player: number; point?: never }
  | { player?: never; point: PowerEffectPoint };

type MatchPowerEffect = {
  id: string;
  power: PowerId;
  /** The power owner remains useful after an effect starts tracking a GK. */
  player: number;
  origin: MatchPowerEffectTarget;
  targets: MatchPowerEffectTarget[];
  anchor?: PowerEffectPoint;
  startTick: number;
  timelineOffsetMs: number;
  maxElapsedMs?: number;
  tier: 1 | 2 | 3;
};

function appendPowerEffect(
  effects: readonly MatchPowerEffect[],
  effect: MatchPowerEffect,
): MatchPowerEffect[] {
  return [...effects, effect].slice(-12);
}

/**
 * One activation beat sheet in flight. `startedAt` is on the RAF timestamp clock
 * (the same performance.now() timebase the loop already uses), and the focus
 * point is frozen in canvas dp at the moment of firing so a punch-in cannot
 * chase a sprite around the pitch mid-shot.
 */
type ActivationJuice = {
  startedAt: number;
  player: number;
  focusX: number;
  focusY: number;
  juice: PowerJuice;
};

export type PowerCutInQaEntry = PowerCutInEntry;

export interface PowerMatchQaConfig {
  readonly power: PowerId;
}

/**
 * Interned Atlas tints.
 *
 * The status tint table below resolves 25 colours on every sim tick, and it
 * draws them from a fixed handful of literals — so parsing the CSS string each
 * time (Skia.Color is a parser, not a lookup) bought nothing. SkColor is an
 * immutable Float32Array that Skia only ever reads, so one instance per string
 * is safe to hand to as many Atlas slots and frames as ask for it.
 *
 * Fixed palette entries ONLY. A colour built from a continuous animation value
 * would mint a new key every frame, which is why the bound below exists: past it
 * the cache stops growing and simply stops interning.
 */
const SK_COLOR_CACHE_LIMIT = 64;
const SK_COLOR_CACHE = new Map<string, SkColor>();

function skColor(css: string): SkColor {
  const cached = SK_COLOR_CACHE.get(css);
  if (cached !== undefined) return cached;
  const color = Skia.Color(css);
  if (SK_COLOR_CACHE.size < SK_COLOR_CACHE_LIMIT)
    SK_COLOR_CACHE.set(css, color);
  return color;
}

function scoreCode(team: TeamDef): string {
  const words = team.name.trim().split(/\s+/);
  const last = words[words.length - 1];
  const source =
    /^(fc|afc|club)$/i.test(last) && words.length > 1 ? words[0] : last;
  return source.slice(0, 3).toUpperCase();
}

export function MatchScreen({
  seed,
  home = ROVERS,
  away = UNITED,
  controlledTeam = 0,
  formationPresets = DEFAULT_FORMATION_PRESETS,
  reduceMotion = false,
  hudSide = 'left',
  cutInMode = 'full',
  seenPowerCutIns = [],
  onPowerCutInSeen,
  highContrast = false,
  colorSafeKits = true,
  pausedExternally = false,
  firstMatchTutorial = false,
  autoSubs: initialAutoSubs = false,
  onAutoSubsChange,
  maximumSpeed = 3,
  performanceLimit,
  onPerformanceLimitChange,
  audioProfile = 'full',
  cupRoundLabel,
  powerCutInQaEntries,
  powerMatchQa,
  matchVfxQa,
  presentationOnly = false,
  onPowerShowcaseComplete,
  onOpenSettings,
  onDone,
}: {
  seed: number;
  home?: TeamDef;
  away?: TeamDef;
  controlledTeam?: 0 | 1;
  formationPresets?: readonly [FormationId, FormationId, FormationId];
  reduceMotion?: boolean;
  hudSide?: HudSide;
  cutInMode?: 'full' | 'banner';
  seenPowerCutIns?: readonly PowerId[];
  onPowerCutInSeen?: (power: PowerId) => void;
  highContrast?: boolean;
  colorSafeKits?: boolean;
  pausedExternally?: boolean;
  firstMatchTutorial?: boolean;
  /** Bench cover as the manager last left it, so it survives the final whistle. */
  autoSubs?: boolean;
  /** Fires only when the substitution board saves a different setting. */
  onAutoSubsChange?: (autoSubs: boolean) => void;
  /** Seasons 1–2 cap at 2×; the veteran 3× option unlocks in Season 3. */
  maximumSpeed?: MatchSpeed;
  /** A time-limited device cap created from measured frame pacing. */
  performanceLimit?: MatchPerformanceLimit | null;
  onPerformanceLimitChange?: (limit: MatchPerformanceLimit | null) => void;
  /** The awakening clip omits sounds that cannot occur in its short showcase. */
  audioProfile?: MatchAudioProfile;
  /** Set only for a Hero Cup tie; it opens the match on the title card. */
  cupRoundLabel?: CupRoundLabel;
  /** Dev-only held fixture for visual QA. Ignored by production bundles. */
  powerCutInQaEntries?: readonly PowerCutInQaEntry[];
  /** Dev-only live match scenario. It still fires through the real engine. */
  powerMatchQa?: PowerMatchQaConfig;
  /** Dev-only real-event fixture for procedural match-effect review. */
  matchVfxQa?: MatchVfxQaConfig;
  /** Hide coaching controls and centre the pitch for an automatic match clip. */
  presentationOnly?: boolean;
  /** Acquisition replay only: freezes 1s after the staged power has ended. */
  onPowerShowcaseComplete?: () => void;
  onOpenSettings: () => void;
  onDone: (state: MatchState) => void;
}) {
  // The sheet names pixel faces directly, so it is rebuilt when the language
  // changes — Silkscreen cannot draw Vietnamese.
  const styles = useMatchScreenStyles();
  const t = useCopy();
  const performanceLimitActive =
    isMatchPerformanceLimitActive(performanceLimit);
  const effectiveMaximumSpeed = Math.min(
    maximumSpeed,
    performanceLimitActive ? 2 : 3,
  ) as MatchSpeed;
  const seenPowerCutInsRef = useRef(new Set<PowerId>(seenPowerCutIns));
  for (const power of seenPowerCutIns) seenPowerCutInsRef.current.add(power);
  const onPowerCutInSeenRef = useRef(onPowerCutInSeen);
  onPowerCutInSeenRef.current = onPowerCutInSeen;
  // `scale` here is React Native's name for the device pixel ratio; the pitch's
  // own scale factor is derived below and would shadow it.
  const { width, height, scale: devicePixelRatio } = useWindowDimensions();
  const compactHeight = height < 760;
  const narrowWidth = width < 375;
  // Keep the pitch and both coaching rows visible on short phones. Decorative
  // chrome compresses first; all controls retain at least a 44pt touch target.
  // FormationDiagram's compact artwork is 62pt tall, so that first row is
  // taller than coachButtonCompact's 52pt minimum. Reserve the rows' measured
  // content height rather than their minimums or the Energy Use row can fall
  // below the viewport on short phones.
  // Desktop windows swap the top scorebar + bottom coaching dock for a fixed
  // left control rail, so the pitch reserves no dock height and instead gives
  // up the rail's width. Same aspect-ratio math either way; only `scale`
  // changes, so every sprite/atlas transform follows automatically.
  const railLayout =
    !presentationOnly && layoutModeForWidth(width) === 'twoColumn';
  const reservedChromeHeight = presentationOnly
    ? 0
    : railLayout
      ? MATCH_RAIL_TOP_INSET + MATCH_RAIL_GUTTER
      : compactHeight
        ? 226
        : 286;
  const availablePitchHeight = Math.max(280, height - reservedChromeHeight);
  const availablePitchWidth = railLayout
    ? Math.max(280, width - MATCH_RAIL_WIDTH - MATCH_RAIL_GUTTER * 3)
    : width;
  // Sprite draw scales come back snapped so one source pixel always covers a
  // whole number of device pixels (art-bible integer-scaling rule); `scale`
  // itself stays continuous for the vector pitch, which tolerates fractions.
  // The rail's reserved width is fed in rather than the raw viewport, so the
  // snap is computed against the space the pitch actually receives.
  const {
    pitchWidth,
    scale,
    player: playerSpriteScale,
    ball: ballSpriteScale,
  } = matchPitchLayout(
    availablePitchWidth,
    availablePitchHeight,
    devicePixelRatio,
  );
  const pitchH = PITCH_H * scale;
  // The desktop body centres rail + pitch as one group, so the pitch no longer
  // begins at a fixed offset from the rail: banners have to follow its real
  // left edge or they float in the dead space beside the touchline.
  const desktopPitchLeft = railLayout
    ? MATCH_RAIL_GUTTER * 2 +
      MATCH_RAIL_WIDTH +
      Math.max(
        0,
        (width - MATCH_RAIL_GUTTER * 3 - MATCH_RAIL_WIDTH - pitchWidth) / 2,
      )
    : 0;
  const homeCode = scoreCode(home);
  const awayCode = scoreCode(away);
  const homeKitColor = teamKitColor(0, colorSafeKits);
  const awayKitColor = teamKitColor(1, colorSafeKits);

  // The RAF loop below drives the activation camera, and its effect deps
  // deliberately exclude layout (a resize must not restart the match clock), so
  // the current canvas geometry is handed over through a mutated ref instead of
  // captured by the closure. Same render-time-ref pattern as speedRef below.
  const layoutRef = useRef({
    pitchWidth: 0,
    pitchH: 0,
    scale: 1,
    devicePixelRatio: 1,
  });
  layoutRef.current.pitchWidth = pitchWidth;
  layoutRef.current.pitchH = pitchH;
  layoutRef.current.scale = scale;
  layoutRef.current.devicePixelRatio = devicePixelRatio;

  // Ledger item 1 — lazy init: never `useRef(createMatch(...))`, whose
  // argument expression would run (creating and discarding a fresh match)
  // on every render. Guard-then-assign only ever creates one match per mount.
  const stateRef = useRef<MatchState | null>(null);
  if (stateRef.current === null) {
    stateRef.current = createMatch(
      seed,
      home,
      away,
      matchPoliciesForControlledTeam(controlledTeam, formationPresets[0]),
    );
    if (powerMatchQa !== undefined) {
      initializePowerMatchShowcase(stateRef.current, powerMatchQa.power);
    } else if (matchVfxQa !== undefined) {
      initializeMatchVfxShowcase(stateRef.current, matchVfxQa.kind);
    }
  }
  const match = stateRef.current;

  const prevRef = useRef<PitchFrame | null>(null);
  const nextRef = useRef<PitchFrame | null>(null);
  const lastCarrierRef = useRef<number | null>(null);
  if (prevRef.current === null) {
    const initial = snapshotFrame(match);
    prevRef.current = initial;
    nextRef.current = initial;
  }

  const trailRef = useRef<Array<{ x: number; y: number }>>([]);
  const bannerRef = useRef<MatchBanner[]>([]);
  const scoreFlashUntilRef = useRef<number>(0);
  // Ball-flight presentation — recent positions while a shot or lifted pass
  // flies. The old puff remains for ordinary shots and Decoy Pop only; hard
  // shots now use the shared procedural match-VFX layer.
  const ballFlightTrailRef = useRef<Array<{ x: number; y: number; z: number }>>(
    [],
  );
  const puffRef = useRef<{
    x: number;
    y: number;
    tick: number;
    owner: 'ordinary-shot' | 'decoy-pop';
  } | null>(null);
  const matchVfxRef = useRef<PreparedMatchVfxEmitter[]>([]);
  // End-of-match hold deadline (RAF/performance.now() timebase), set once
  // when the loop first sees phase === 'fulltime' — see FULLTIME_HOLD_MS.
  const fulltimeDeadlineRef = useRef<number | null>(null);
  // Whether the result has already been handed to the career. The loop effect
  // restarts on a settings change (Reduce Motion, cut-in mode), and a restart
  // after the deadline has passed would otherwise re-hand the same result on
  // its first frame.
  const handedOffRef = useRef(false);
  // Render-only tackle poses keyed by player index. Slide travel itself is now
  // deterministic sim movement; this layer only tilts/recovers the sprite.
  const actionRef = useRef<Record<number, PlayerActionAnimation>>({});
  // Super Strength impact burst (render-only), set when a charge lands a KO.
  const impactRef = useRef<{ x: number; y: number; tick: number } | null>(null);
  // Production power art is event-driven but renderer-only. Entries remember
  // just stable player indices/placed points; simulation state remains the
  // sole authority for whether a shield, root, clone, or hunt is still live.
  const powerEffectsRef = useRef<MatchPowerEffect[]>([]);
  // Tick each teammate received a Rally Cry encore, so the gold bolt marker can
  // show for ~2s from the grant and then clear itself.
  const encoreGrantedTickRef = useRef<Map<number, number>>(new Map());
  // Whether the looping fire crackle is currently playing — reconciled each
  // frame against whether any Fire Torch hero is ablaze (see the RAF loop).
  const fireLoopOnRef = useRef(false);
  // The activation beat sheet currently playing (power-cut-in.ts owns the
  // timings). Presentation only: it dresses ticks, never changes them.
  const juiceRef = useRef<ActivationJuice | null>(null);
  // Last camera triple actually pushed to the UI thread, so an idle match never
  // writes shared values it has already written.
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 });
  const heroTintStepRef = useRef<PowerJuiceHeroTint>('none');

  const [frame, setFrame] = useState<PitchFrame>(() => prevRef.current!);
  const [hud, setHud] = useState({
    score: [0, 0] as [number, number],
    tick: 0,
    banners: [] as MatchBanner[],
    scoreFlash: false,
    visualTick: 0,
  });
  const [speed, setSpeed] = useState<MatchSpeed>(1);
  const [reducedEffects, setReducedEffects] = useState(false);
  const reducedEffectsRef = useRef(false);
  const [performanceNotice, setPerformanceNotice] = useState(false);
  const performanceMonitorRef = useRef(createFramePacingMonitor());
  const performanceBadWindowsRef = useRef(0);
  const weakDeviceHardwareHint = useMemo(hasWeakDeviceHardwareHint, []);
  const performanceResumeAtRef = useRef(
    performance.now() + (weakDeviceHardwareHint ? 1000 : 2000),
  );
  const performanceLimitActiveRef = useRef(performanceLimitActive);
  performanceLimitActiveRef.current = performanceLimitActive;
  const onPerformanceLimitChangeRef = useRef(onPerformanceLimitChange);
  onPerformanceLimitChangeRef.current = onPerformanceLimitChange;
  const [graphicsGeneration, setGraphicsGeneration] = useState(0);
  const graphicsGenerationRef = useRef(0);
  const graphicsRestartAttemptsRef = useRef(0);
  const [graphicsStatus, setGraphicsStatus] = useState<
    'ok' | 'restarting' | 'failed' | 'finishing'
  >('ok');
  const graphicsStatusRef = useRef(graphicsStatus);
  graphicsStatusRef.current = graphicsStatus;
  const suppressCosmeticEffects = reduceMotion || reducedEffects;
  /** Opt-in bench cover: a manager who only wants to watch should not be
   * punished with eleven exhausted players and five unused substitutions.
   * Seeded from the saved preference, so the choice is made once, not weekly. */
  const [autoSubs, setAutoSubs] = useState(initialAutoSubs);
  const autoSubsRef = useRef(initialAutoSubs);
  // A Hero Cup tie opens on a title card; a league fixture arrives with no
  // `cupRoundLabel` and gets none. Decided once, at mount: flipping Reduce
  // Motion from the settings overlay must not restyle a card already playing.
  const [titleCard] = useState(() =>
    cupTitleCard(cupRoundLabel, reduceMotion, t),
  );
  const [titleCardShowing, setTitleCardShowing] = useState(titleCard !== null);
  // Starts paused behind the card so the very first RAF frame simulates
  // nothing. The clock is held, not skipped — the loop keeps `last` current
  // while paused, so no part of the card's duration lands in the accumulator.
  const [paused, setPaused] = useState(titleCard !== null);
  const [swapOpen, setSwapOpen] = useState(false);
  const [firstMatchTutorialStep, setFirstMatchTutorialStep] = useState<
    'tired-modal' | 'tired-swap-cue' | 'tired-player-cue' | null
  >(null);
  const firstMatchTutorialStepRef = useRef<
    'tired-modal' | 'tired-swap-cue' | 'tired-player-cue' | null
  >(null);
  /** Stable identity shared by the card, Swap cue, and substitution-board cue. */
  const firstMatchTiredPlayerRef = useRef<number | null>(null);
  const firstMatchPromptsSeenRef = useRef<FirstMatchCoachingPromptsSeen>({
    tiredPlayer: false,
  });
  const guideSwapButton = firstMatchTutorialStep === 'tired-swap-cue';
  const swapGuideTargetRef = useRef<View>(null);
  const swapGuideMeasureFrameRef = useRef<number | null>(null);
  const [swapGuideAnchor, setSwapGuideAnchor] =
    useState<TutorialAnchorLayout | null>(null);
  const scheduleSwapGuideMeasurement = useCallback(() => {
    if (!guideSwapButton) return;
    if (swapGuideMeasureFrameRef.current !== null) {
      cancelAnimationFrame(swapGuideMeasureFrameRef.current);
    }
    swapGuideMeasureFrameRef.current = requestAnimationFrame(() => {
      swapGuideMeasureFrameRef.current = null;
      swapGuideTargetRef.current?.measureInWindow(
        (x, y, targetWidth, targetHeight) => {
          if (targetWidth <= 0 || targetHeight <= 0) return;
          setSwapGuideAnchor({
            x,
            y,
            width: targetWidth,
            height: targetHeight,
          });
        },
      );
    });
  }, [guideSwapButton]);
  useEffect(() => {
    if (!guideSwapButton) {
      setSwapGuideAnchor(null);
      return;
    }
    scheduleSwapGuideMeasurement();
  }, [
    guideSwapButton,
    height,
    railLayout,
    scheduleSwapGuideMeasurement,
    width,
  ]);
  useEffect(
    () => () => {
      if (swapGuideMeasureFrameRef.current !== null) {
        cancelAnimationFrame(swapGuideMeasureFrameRef.current);
      }
    },
    [],
  );
  const powerCutInQaActive = __DEV__ && powerCutInQaEntries !== undefined;
  const [powerCutIns, setPowerCutIns] = useState<PowerCutInEntry[]>(() =>
    powerCutInQaActive ? [...powerCutInQaEntries] : [],
  );
  const powerShowcaseCompletedRef = useRef(false);
  /** Whether the clip has already handed the manager their REPLAY/CONTINUE card. */
  const powerShowcaseCardShownRef = useRef(false);
  /**
   * When the clip froze on its success. The pitch stops there; the result card
   * follows a beat later so the manager sees the goal before it is written over.
   */
  const [powerShowcaseFrozenAt, setPowerShowcaseFrozenAt] = useState<
    number | undefined
  >(undefined);
  const powerCutInPolicy = powerCutInGroupPolicy(powerCutIns);
  /** Which player's body is mid white/gold activation flash, and in which half. */
  const [heroTint, setHeroTint] = useState<{
    player: number;
    tint: 'white' | 'gold';
  } | null>(null);
  const speedRef = useRef<MatchSpeed>(1);
  const pausedRef = useRef(titleCard !== null);
  const userPausedRef = useRef(false);
  const automaticPauseReasonsRef = useRef(new Set<AutomaticMatchPauseReason>());
  // Seeded during the first render rather than from an effect: the reason has
  // to be in the set before anything can call syncPauseReasons(), or the first
  // sync would resume a match the card is still covering.
  const titleCardSeededRef = useRef(false);
  if (!titleCardSeededRef.current) {
    titleCardSeededRef.current = true;
    if (titleCard !== null) automaticPauseReasonsRef.current.add('title-card');
  }
  speedRef.current = speed;

  // ---- Activation camera & FX, all on the UI thread ----------------------
  // One camera for the whole pitch: a single <Group transform> below. The two
  // translates and the scale are pushed from the RAF loop (only while an
  // activation is playing), so an idle match writes nothing and the derived
  // transform never re-evaluates.
  const cameraX = useSharedValue(0);
  const cameraY = useSharedValue(0);
  const cameraZoom = useSharedValue(1);
  const cameraTransform = useDerivedValue(() => [
    { translateX: cameraX.value },
    { translateY: cameraY.value },
    { scale: cameraZoom.value },
  ]);
  const activationFlash = useSharedValue(0);
  const speedLineSlot = useSharedValue(-1);
  const speedLineLife = useSharedValue(0);
  const matchVisualIds = useMemo(
    () => [
      ...match.players.map((player, index) =>
        visualIdForMatchPlayer(
          index,
          player.def.id,
          player.def.role,
          player.def.lookId,
        ),
      ),
      ...match.bench.flatMap((players, team) =>
        players.map((player) =>
          visualIdForMatchPlayer(
            team === 0 ? 0 : 11,
            player.id,
            player.role,
            player.lookId,
          ),
        ),
      ),
    ],
    [match],
  );
  // Ledger item 4 — build the atlas from the merged sprite pack. Color-safe
  // mode remaps only the home-kit palette tokens, preserving faces and hair.
  // If the pack fails to build (realistically: sprites.json failing loader
  // validation), fall back to a white square texture with team-color tints
  // (the plan's original placeholder look) instead of crashing the match.
  const atlas = useMemo(() => {
    try {
      return {
        ...buildSpriteAtlas(
          Skia,
          matchVisualIds,
          colorSafeKits ? COLOR_SAFE_HOME_KIT : undefined,
        ),
        fallbackMode: false,
      };
    } catch (err) {
      console.warn(
        'MatchScreen: buildSpriteAtlas failed — rendering placeholder rects',
        err,
      );
      return {
        ...buildFallbackAtlas(Skia, FALLBACK_SPRITE),
        fallbackMode: true,
      };
    }
  }, [colorSafeKits, graphicsGeneration, matchVisualIds]);

  // Sprite-rect cache, keyed by atlas because rectFor's layout is derived from
  // the sheet this atlas was built from. `sprites` below asks for 25 rects on
  // every sim tick and the answers never change for a given key, so without this
  // each tick allocated 25 plain rect objects plus 25 SkRects.
  const spriteRects = useMemo(() => {
    const cache = new Map<string, SkRect>();
    return (key: string): SkRect => {
      const cached = cache.get(key);
      if (cached !== undefined) return cached;
      const r = atlas.rectFor(key);
      const rect = Skia.XYWHRect(r.x, r.y, r.w, r.h);
      cache.set(key, rect);
      return rect;
    };
  }, [atlas]);

  // The three source cells are fixed for the life of an atlas, and they are
  // handed to the UI-thread worklets below — a fresh object literal per render
  // would put them in the worklet closure and churn its dependency list.
  const { playerCell, actionCell, ballCell } = useMemo(() => {
    const cell = (key: string) => {
      const r = atlas.rectFor(key);
      return { width: r.w, height: r.h };
    };
    return {
      playerCell: cell(`${matchVisualIds[0]}:run0`),
      actionCell: cell(`${matchVisualIds[0]}:slide0`),
      ballCell: cell('ball'),
    };
  }, [atlas, matchVisualIds]);
  const {
    transforms: workletTransforms,
    visualPositions: workletVisualPositions,
    visibility: workletVisibility,
    ballGroundPosition: workletBallGroundPosition,
    ballHeight: workletBallHeight,
    statuses: workletStatuses,
    zoneFractions: workletZoneFractions,
    carrier: workletCarrier,
    visualTick: workletVisualTick,
    actionData: workletActionData,
    publish: publishAtlasFrame,
    pause: pauseAtlasFrame,
    resume: resumeAtlasFrame,
  } = useWorkletAtlasFrame({
    initialFrame: prevRef.current!,
    scale,
    playerCell,
    actionCell,
    ballCell,
    playerDrawScale: playerSpriteScale.drawScale,
    ballDrawScale: ballSpriteScale.drawScale,
    devicePixelRatio,
    ballFootForwardFraction: BALL_FOOT_FORWARD_FRACTION,
    ballFootDownPx: BALL_FOOT_DOWN_PX,
    ballFootDeadzonePx: BALL_FOOT_DEADZONE_PX,
  });

  // Single pause setter: pauses both the JS simulation clock and the UI-thread
  // interpolation. There is deliberately no render-time ref write-back; that
  // would undo an AppState pause on the next render.
  const setPausedBoth = (value: boolean) => {
    pausedRef.current = value;
    if (value) pauseAtlasFrame();
    else resumeAtlasFrame(matchPlaybackRate(speedRef.current));
    setPaused(value);
  };

  const syncPauseReasons = () => {
    setPausedBoth(
      shouldPauseMatch(userPausedRef.current, automaticPauseReasonsRef.current),
    );
  };

  const pauseForGraphicsFailure = useCallback(() => {
    automaticPauseReasonsRef.current.add('graphics');
    pausedRef.current = true;
    pauseAtlasFrame();
    setPaused(true);
    resetFramePacingMonitor(performanceMonitorRef.current);
  }, [pauseAtlasFrame]);

  const handleGraphicsContextLost = useCallback(
    (generation: number) => {
      if (
        generation !== graphicsGenerationRef.current ||
        graphicsStatusRef.current === 'failed' ||
        graphicsStatusRef.current === 'finishing'
      ) {
        return;
      }
      pauseForGraphicsFailure();
      if (graphicsRestartAttemptsRef.current >= 1) {
        graphicsStatusRef.current = 'failed';
        setGraphicsStatus('failed');
        return;
      }
      graphicsRestartAttemptsRef.current += 1;
      graphicsStatusRef.current = 'restarting';
      setGraphicsStatus('restarting');
      const nextGeneration = graphicsGenerationRef.current + 1;
      graphicsGenerationRef.current = nextGeneration;
      setGraphicsGeneration(nextGeneration);
    },
    [pauseForGraphicsFailure],
  );

  const handleGraphicsContextReady = useCallback(
    (generation: number) => {
      if (
        generation !== graphicsGenerationRef.current ||
        graphicsStatusRef.current !== 'restarting'
      ) {
        return;
      }
      graphicsStatusRef.current = 'ok';
      setGraphicsStatus('ok');
      automaticPauseReasonsRef.current.delete('graphics');
      const shouldPause = shouldPauseMatch(
        userPausedRef.current,
        automaticPauseReasonsRef.current,
      );
      pausedRef.current = shouldPause;
      if (shouldPause) pauseAtlasFrame();
      else resumeAtlasFrame(matchPlaybackRate(speedRef.current));
      setPaused(shouldPause);
      performanceResumeAtRef.current = performance.now() + 1000;
    },
    [pauseAtlasFrame, resumeAtlasFrame],
  );

  const finishGraphicsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const finishAfterGraphicsFailure = useCallback(() => {
    if (presentationOnly) {
      onOpenSettings();
      return;
    }
    if (graphicsStatusRef.current === 'finishing') return;
    graphicsStatusRef.current = 'finishing';
    setGraphicsStatus('finishing');
    const advance = () => {
      const state = stateRef.current!;
      if (advanceGraphicsRecoveryChunk(state, autoSubsRef.current)) {
        handedOffRef.current = true;
        onDone(state);
        return;
      }
      finishGraphicsTimerRef.current = setTimeout(advance, 0);
    };
    advance();
  }, [onDone, onOpenSettings, presentationOnly]);

  const reloadAfterGraphicsFailure = useCallback(() => {
    if (typeof window !== 'undefined') window.location.reload();
  }, []);

  useEffect(
    () => () => {
      if (finishGraphicsTimerRef.current !== null) {
        clearTimeout(finishGraphicsTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    resetFramePacingMonitor(performanceMonitorRef.current);
    performanceBadWindowsRef.current = 0;
    performanceResumeAtRef.current = performance.now() + 1000;
  }, [height, width]);

  useEffect(() => {
    if (pausedExternally) automaticPauseReasonsRef.current.add('settings');
    else automaticPauseReasonsRef.current.delete('settings');
    syncPauseReasons();
  }, [pausedExternally]);

  /**
   * A cut-in ends when its power does — or when the clip holding it freezes.
   *
   * This runs on the tick, so a frozen showcase is the one state it can never
   * be woken out of: no further tick is coming, and a power still `active` on
   * the frozen frame would hold its cut-in open for the life of the modal.
   */
  useEffect(() => {
    if (powerCutInQaActive || powerCutIns.length === 0) return;
    const now = performance.now();
    const clipFrozen = powerShowcaseFrozenAt !== undefined;
    setPowerCutIns((current) => {
      let changed = false;
      const next = current.map((entry) => {
        if (entry.outroStartedAt !== undefined || entry.player === undefined)
          return entry;
        const player = match.players[entry.player];
        const stillActive =
          player?.def.power === entry.power &&
          player.powerState.kind === 'active';
        if (!powerCutInOutroDue(stillActive, clipFrozen)) return entry;
        changed = true;
        return { ...entry, outroStartedAt: now };
      });
      return changed ? next : current;
    });
  }, [hud.tick, match, powerCutInQaActive, powerShowcaseFrozenAt]);

  useEffect(() => {
    if (powerCutInQaActive) return undefined;
    const endingEntries = powerCutIns.filter(
      (entry) => entry.outroStartedAt !== undefined,
    );
    if (endingEntries.length === 0) return undefined;
    const nextDeadline = Math.min(
      ...endingEntries.map(
        (entry) => entry.outroStartedAt! + POWER_TAKEOVER_POST_POWER_MS,
      ),
    );
    const timer = setTimeout(
      () => {
        const now = performance.now();
        setPowerCutIns((current) =>
          current.filter(
            (entry) =>
              entry.outroStartedAt === undefined ||
              powerTakeoverShouldRemain(now - entry.outroStartedAt),
          ),
        );
      },
      Math.max(0, Math.ceil(nextDeadline - performance.now())),
    );
    return () => clearTimeout(timer);
  }, [powerCutInQaActive, powerCutIns]);

  /**
   * The result card, a beat after the pitch froze.
   *
   * Split from the freeze on purpose. The clip stops on the frame where the
   * power's promise lands — for the shooting powers that is the ball at the net
   * — and a card published on the same frame would cover the only thing the
   * manager was brought here to see. It also waits out the power's own cut-in
   * where one is still playing, so the card never lands on top of it.
   *
   * The wait is bounded by the freeze rather than by the cut-in: a cut-in with
   * no ending yet is one the effect above is about to end, and treating it as
   * a reason to hold the card indefinitely is what stranded the manager on a
   * frozen pitch.
   */
  useEffect(() => {
    if (
      powerMatchQa === undefined ||
      onPowerShowcaseComplete === undefined ||
      powerShowcaseFrozenAt === undefined
    )
      return undefined;
    const cutIn = powerCutIns.find(
      (entry) => entry.power === powerMatchQa.power,
    );
    const showAt = powerMatchShowcaseCardDueAt(
      powerShowcaseFrozenAt,
      cutIn?.outroStartedAt,
    );
    const timer = setTimeout(
      () => {
        powerShowcaseCardShownRef.current = true;
        onPowerShowcaseComplete();
      },
      Math.max(0, Math.ceil(showAt - performance.now())),
    );
    return () => clearTimeout(timer);
  }, [
    onPowerShowcaseComplete,
    powerCutIns,
    powerMatchQa,
    powerShowcaseFrozenAt,
  ]);

  /**
   * The backstop, which guards the card rather than the freeze.
   *
   * A clip whose promise never lands would run until full time behind a modal
   * with no way out — but so would one that froze and then never handed over,
   * and that is the harder failure to see coming. Whatever the clip is doing at
   * this point, the manager gets their buttons.
   */
  useEffect(() => {
    if (powerMatchQa === undefined || onPowerShowcaseComplete === undefined)
      return undefined;
    const timer = setTimeout(() => {
      if (powerShowcaseCardShownRef.current) return;
      powerShowcaseCardShownRef.current = true;
      if (!powerShowcaseCompletedRef.current) {
        powerShowcaseCompletedRef.current = true;
        automaticPauseReasonsRef.current.add('showcase');
        syncPauseReasons();
        setPowerShowcaseFrozenAt(performance.now());
      }
      onPowerShowcaseComplete();
    }, POWER_MATCH_SHOWCASE_SAFETY_FREEZE_MS);
    return () => clearTimeout(timer);
  }, [onPowerShowcaseComplete, powerMatchQa]);

  // Audio lifecycle — own effect, separate from the RAF loop below: starts
  // the match theme on mount, tears everything down on unmount. No pause
  // handling needed (see src/render/audio.ts) — the theme keeps looping
  // through a paused match, and playForEvent() below is only ever reached
  // from ticks the RAF loop actually simulates.
  // The yield pairs with the theme: a pitch on screen owns the music, and
  // claiming that here — where the match theme already starts and stops — is
  // the one place a future caller cannot forget it. In ordinary play there is
  // no menu bed to silence, so this is a no-op; it earns its keep when a match
  // is shown *over* a menu screen, as the power demo does over the awakening.
  useEffect(() => {
    initAudio(audioProfile, powerMatchQa?.power);
    yieldMenuThemeToMatch();
    startTheme();
    return () => {
      stopTheme();
      // Pause the crackle loop's native player before release; the wanted-flag
      // guarantee against a later match resurrecting it lives in teardownAudio().
      stopFireAmbience();
      teardownAudio();
      releaseMenuThemeToMatch();
    };
  }, [audioProfile, powerMatchQa?.power]);

  // The opening KICKOFF is emitted by createMatch before the RAF loop below
  // starts slicing newEvents, so its whistle would be skipped — play any events
  // already present at mount here. The loop starts from the current length, so
  // nothing double-fires. Held behind a cup title card so the whistle sounds at
  // the real kickoff rather than from under the card; the match is paused
  // meanwhile, so no further events can accumulate before this runs.
  const openingEventsPlayedRef = useRef(false);
  useEffect(() => {
    if (titleCardShowing || openingEventsPlayedRef.current) return;
    openingEventsPlayedRef.current = true;
    for (const e of match.events) playForEvent(e);
  }, [titleCardShowing]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const sub = AppState.addEventListener('change', (next) => {
      const appIsActive = next === 'active';
      resetFramePacingMonitor(performanceMonitorRef.current);
      performanceBadWindowsRef.current = 0;
      performanceResumeAtRef.current = performance.now() + 1000;
      if (appIsActive) {
        // Resume from the same simulation instant instead of catching up while hidden.
        last = performance.now();
        acc = 0;
      }
      syncBackgroundPauseReason(automaticPauseReasonsRef.current, appIsActive);
      syncPauseReasons();
    });

    // ---- Activation juice ------------------------------------------------
    // Beat sheet and timings live in power-cut-in.ts; this is only the wiring.
    // Reduce Motion opts out of every part of it — no camera move, flash,
    // lines, or body flash.

    const resetJuice = () => {
      juiceRef.current = null;
      speedLineSlot.value = -1;
      speedLineLife.value = 0;
      activationFlash.value = 0;
      if (
        cameraRef.current.zoom !== 1 ||
        cameraRef.current.x !== 0 ||
        cameraRef.current.y !== 0
      ) {
        cameraRef.current.x = 0;
        cameraRef.current.y = 0;
        cameraRef.current.zoom = 1;
        cameraX.value = 0;
        cameraY.value = 0;
        cameraZoom.value = 1;
      }
      if (heroTintStepRef.current !== 'none') {
        heroTintStepRef.current = 'none';
        setHeroTint(null);
      }
    };

    const startJuice = (power: PowerId, player: number, now: number) => {
      if (suppressCosmeticEffects) return;
      const juice = powerJuice(power);
      const { scale: pitchScale } = layoutRef.current;
      juiceRef.current = {
        startedAt: now,
        player,
        focusX: nextRef.current!.players[player].x * pitchScale,
        focusY: nextRef.current!.players[player].y * pitchScale,
        juice,
      };
      if (juice.flash) {
        activationFlash.value = withSequence(
          withTiming(POWER_JUICE_FLASH_OPACITY, {
            duration: 30,
            easing: ReanimatedEasing.linear,
          }),
          withTiming(0, {
            duration: POWER_JUICE_FLASH_MS,
            easing: ReanimatedEasing.linear,
          }),
        );
      }
      if (juice.speedLines) {
        speedLineSlot.value = player;
        speedLineLife.value = 0;
        speedLineLife.value = withTiming(
          1,
          {
            duration: POWER_JUICE_SPEED_LINES_MS,
            easing: ReanimatedEasing.out(ReanimatedEasing.quad),
          },
          (finished) => {
            'worklet';
            if (finished) speedLineSlot.value = -1;
          },
        );
      }
    };

    const advanceJuice = (now: number) => {
      const active = juiceRef.current;
      if (active === null) return;
      const elapsed = now - active.startedAt;
      if (elapsed >= POWER_JUICE_END_MS) {
        resetJuice();
        return;
      }

      // Camera: an integer magnification step plus a device-pixel-quantised
      // shake, both computed by interpolate.ts so the sprite pixel grid holds.
      const {
        pitchWidth: viewWidth,
        pitchH: viewHeight,
        devicePixelRatio: dpr,
      } = layoutRef.current;
      const shake = active.juice.shake
        ? matchShakeOffset(
            elapsed,
            POWER_JUICE_SHAKE_MS,
            MATCH_SHAKE_AMPLITUDE_PT,
          )
        : ZERO_SHAKE;
      const zoomStep =
        active.juice.punchIn && elapsed < POWER_JUICE_PUNCH_MS
          ? POWER_JUICE_PUNCH_ZOOM
          : 1;
      const camera = matchCameraOffset(
        active.focusX,
        active.focusY,
        viewWidth,
        viewHeight,
        zoomStep,
        shake,
        dpr,
      );
      const previousCamera = cameraRef.current;
      if (
        camera.translateX !== previousCamera.x ||
        camera.translateY !== previousCamera.y ||
        camera.zoom !== previousCamera.zoom
      ) {
        previousCamera.x = camera.translateX;
        previousCamera.y = camera.translateY;
        previousCamera.zoom = camera.zoom;
        cameraX.value = camera.translateX;
        cameraY.value = camera.translateY;
        cameraZoom.value = camera.zoom;
      }

      // Hero body flash — four alternating steps, so four extra renders.
      const tint = powerJuiceHeroTint(elapsed);
      if (tint !== heroTintStepRef.current) {
        heroTintStepRef.current = tint;
        setHeroTint(tint === 'none' ? null : { player: active.player, tint });
      }
    };

    const loop = (now: number) => {
      const s = stateRef.current!;
      if (pausedRef.current && s.phase !== 'fulltime') {
        // Paused: keep the frame clock current (so resuming doesn't dump the
        // whole pause duration into the accumulator) and reschedule — but skip
        // the setFrame/setHud work, so a paused match doesn't re-render at
        // display refresh rate. Full time is exempt: the result handoff must
        // still reach its deadline after the simulation has already stopped.
        last = now;
        resetFramePacingMonitor(performanceMonitorRef.current);
        performanceBadWindowsRef.current = 0;
        performanceResumeAtRef.current = now + 1000;
        raf = requestAnimationFrame(loop);
        return;
      }
      const wallGap = now - last;
      if (speedRef.current >= 2 && now >= performanceResumeAtRef.current) {
        const pacing = recordFrameGap(performanceMonitorRef.current, wallGap);
        if (pacing !== null) {
          const decision = performanceAdaptationDecision(
            performanceBadWindowsRef.current,
            reducedEffectsRef.current,
            pacing.bad,
          );
          performanceBadWindowsRef.current = decision.consecutiveBadWindows;
          if (decision.action !== 'none') {
            performanceResumeAtRef.current = now + 1000;
            if (decision.action === 'reduce-effects') {
              reducedEffectsRef.current = true;
              setReducedEffects(true);
            } else if (!performanceLimitActiveRef.current) {
              performanceLimitActiveRef.current = true;
              onPerformanceLimitChangeRef.current?.(
                createMatchPerformanceLimit(Date.now()),
              );
              setPerformanceNotice(true);
              if (speedRef.current === 3) {
                speedRef.current = 2;
                resumeAtlasFrame(matchPlaybackRate(2));
                setSpeed(2);
              }
            }
          }
        }
      } else if (performanceMonitorRef.current.gaps.length > 0) {
        resetFramePacingMonitor(performanceMonitorRef.current);
        performanceBadWindowsRef.current = 0;
      }
      // Ledger item 7 — capped catch-up: never simulate more than
      // MAX_CATCHUP_TICKS in one frame, however long the JS thread stalled.
      //
      acc = Math.min(
        acc + (now - last) * matchPlaybackRate(speedRef.current),
        TICK_MS * MAX_CATCHUP_TICKS,
      );
      last = now;

      const eventsBefore = s.events.length;
      const eventFrames = new Map<
        MatchEvent,
        Readonly<{ before: PitchFrame; after: PitchFrame }>
      >();
      let snap = false;
      let advanced = false;
      let pauseAfterPublish = false;
      let showcaseFroze = false;

      // No pausedRef check needed here: the early return above already ran,
      // and the flag cannot flip mid-invocation on a single-threaded runtime.
      while (acc >= TICK_MS && s.phase !== 'fulltime') {
        const before = nextRef.current!;
        const tickEventsBefore = s.events.length;
        prevRef.current = before;
        const heldForPowerReview =
          powerMatchQa !== undefined &&
          advancePowerMatchShowcaseReady(s, powerMatchQa.power);
        const heldForMatchVfxReview =
          !heldForPowerReview &&
          matchVfxQa !== undefined &&
          advanceMatchVfxShowcase(s, matchVfxQa.kind);
        if (!heldForPowerReview && !heldForMatchVfxReview) {
          tick(s);
          // A frame may catch up several engine ticks. Evaluate Auto Subs after
          // each one, in the same order as Quick Result, so a scheduled tick or
          // a one-tick red-energy emergency cannot be skipped by frame batching.
          queueControlledAutoSubstitution(s, autoSubsRef.current);
        }
        advanced = true;
        nextRef.current = snapshotFrame(s, before);
        for (const event of s.events.slice(tickEventsBefore)) {
          eventFrames.set(event, {
            before,
            after: nextRef.current,
          });
        }

        // The acquisition clip ends when the power's promise lands, not on a
        // timer, so what the manager is left looking at is the power working.
        if (
          powerMatchQa !== undefined &&
          onPowerShowcaseComplete !== undefined &&
          !powerShowcaseCompletedRef.current &&
          powerMatchShowcaseSucceeded(s, powerMatchQa.power)
        ) {
          powerShowcaseCompletedRef.current = true;
          if (powerMatchShowcaseSuccessRestartsPlay(powerMatchQa.power)) {
            // A goal restarts the kickoff inside the tick it is scored, so this
            // tick's own frame is already twenty-two players on the halfway
            // line. The one before it still has the ball at the net.
            nextRef.current = before;
          }
          automaticPauseReasonsRef.current.add('showcase');
          // Publish the frozen frame before pausing, the same order the first
          // match's coaching prompt uses a few hundred lines below.
          pauseAfterPublish = true;
          showcaseFroze = true;
          acc = 0;
          break;
        }

        const matchVfxQaEvent =
          matchVfxQa === undefined
            ? undefined
            : matchVfxShowcaseEvent(s, matchVfxQa.kind);
        const matchVfxSafetyFreeze =
          matchVfxQa !== undefined && s.tick >= MATCH_VFX_SHOWCASE_SAFETY_TICK;
        if (
          (matchVfxQaEvent !== undefined &&
            s.tick >= matchVfxQaEvent.t + MATCH_VFX_SHOWCASE_FREEZE_TICKS) ||
          matchVfxSafetyFreeze
        ) {
          automaticPauseReasonsRef.current.add('showcase');
          pauseAfterPublish = true;
          acc = 0;
          break;
        }

        for (let i = 0; i < RENDER_PLAYER_COUNT; i++) {
          if (
            dist2(prevRef.current!.players[i], nextRef.current.players[i]) >
            SNAP_DIST2
          ) {
            // A restart teleport is not locomotion. Keep the accumulated
            // stride distance unchanged so a kickoff cannot arbitrarily flip
            // every player's feet.
            nextRef.current.travel[i] = prevRef.current!.travel[i];
            snap = true;
          }
        }

        const speedster = s.players.find(
          (p, i) =>
            nextRef.current!.statuses[i] === 'active' &&
            p.def.power === 'SUPER_SPEED',
        );
        trailRef.current =
          !suppressCosmeticEffects && speedster
            ? [{ ...speedster.pos }, ...trailRef.current].slice(0, 7)
            : [];

        // A longer curved trail makes lifted shots and keeper distributions
        // read as airborne; driven shots retain their existing speed streak.
        ballFlightTrailRef.current =
          !reduceMotion &&
          (nextRef.current!.ballShooting ||
            nextRef.current!.ballHeight >= BALL_AIRBORNE_THRESHOLD_CM)
            ? [
                { ...nextRef.current!.ball, z: nextRef.current!.ballHeight },
                ...ballFlightTrailRef.current,
              ].slice(0, BALL_FLIGHT_TRAIL_LEN)
            : [];

        if (
          ballFlightWhooshStarted(
            prevRef.current!.ballHeight,
            nextRef.current!.ballHeight,
          )
        ) {
          playBallFlightWhoosh();
        }

        acc -= TICK_MS;
      }

      const newEvents = s.events.slice(eventsBefore);
      // A FIRE_TORCH POWER_FIRED is emitted just before its IGNITED in the same
      // batch, so remembering the caster's spot here lets the ignite knockdown
      // fling the victim *away* from Flint.
      let torchCasterPos: { x: number; y: number } | null = null;
      const recordPowerEffect = (
        power: PowerId,
        player: number,
        config: {
          idSuffix?: string;
          origin?: MatchPowerEffectTarget;
          targets?: MatchPowerEffectTarget[];
          anchor?: PowerEffectPoint;
          timelineOffsetMs?: number;
          maxElapsedMs?: number;
          startTick?: number;
        } = {},
      ) => {
        const startTick = config.startTick ?? s.tick;
        powerEffectsRef.current = appendPowerEffect(powerEffectsRef.current, {
          id: `${startTick}:${player}:${power}:${config.idSuffix ?? 'fire'}`,
          power,
          player,
          origin: config.origin ?? { player },
          targets: config.targets ?? [],
          anchor: config.anchor,
          startTick,
          timelineOffsetMs: config.timelineOffsetMs ?? 0,
          maxElapsedMs: config.maxElapsedMs,
          tier: s.players[player]?.def.powerTier ?? 1,
        });
      };
      const recordMatchVfx = (
        kind: MatchVfxKind,
        event: MatchEvent,
        actor: number,
        anchor: PowerEffectPoint,
        direction: PowerEffectPoint,
        target?: number,
        intensity?: number,
      ) => {
        matchVfxRef.current = appendMatchVfxEmitter(
          matchVfxRef.current,
          prepareMatchVfxEmitter({
            matchSeed: seed,
            kind,
            eventTick: event.t,
            actor,
            target,
            anchor,
            direction,
            intensity,
          }),
        );
      };
      const interruptedPlayers = new Set(
        newEvents.flatMap((event) =>
          event.kind === 'POWER_INTERRUPTED' ? [event.player] : [],
        ),
      );
      for (const e of newEvents) {
        const captured = eventFrames.get(e);
        const eventBefore = captured?.before ?? prevRef.current!;
        const eventAfter = captured?.after ?? nextRef.current!;
        playForEvent(e);
        playHapticForEvent(e, controlledTeam);
        if (e.kind === 'POWER_FIRED' && e.power === 'FIRE_TORCH') {
          torchCasterPos = { ...nextRef.current!.players[e.player] };
        }
        const shotActor = e.kind === 'SHOT' ? (e.actor ?? e.by) : -1;
        if (e.kind === 'SHOT' && playerAt(s, shotActor) !== undefined) {
          const origin = eventAfter.players[shotActor];
          const shotPlayer = playerAt(s, shotActor)!;
          const ballDirection = {
            x: eventAfter.ball.x - eventBefore.ball.x,
            y: eventAfter.ball.y - eventBefore.ball.y,
          };
          const direction =
            ballDirection.x === 0 && ballDirection.y === 0
              ? { x: 0, y: shotPlayer.team === 0 ? -1 : 1 }
              : ballDirection;
          if (origin !== undefined && isHardShotPower(e.power)) {
            if (puffRef.current?.owner === 'ordinary-shot')
              puffRef.current = null;
            recordMatchVfx(
              'hard-shot',
              e,
              shotActor,
              origin,
              direction,
              undefined,
              Math.min(1, e.power / 100),
            );
          } else if (origin !== undefined && !suppressCosmeticEffects) {
            // Ordinary shots retain the small legacy puff. A hard shot owns the
            // new burst instead, so the two treatments never stack.
            puffRef.current = {
              x: origin.x,
              y: origin.y,
              tick: e.t,
              owner: 'ordinary-shot',
            };
          }
        }
        if (e.kind === 'TACKLE' && e.contact) {
          const challenger = eventAfter.players[e.by];
          const target = eventAfter.players[e.on];
          if (challenger !== undefined && target !== undefined) {
            const kind: MatchVfxKind | null = interruptedPlayers.has(e.on)
              ? null
              : e.style === 'standing'
                ? 'standing-tackle'
                : e.style === 'slide'
                  ? 'slide-tackle'
                  : null;
            if (kind !== null) {
              recordMatchVfx(
                kind,
                e,
                e.by,
                {
                  x: (challenger.x + target.x) / 2,
                  y: (challenger.y + target.y) / 2,
                },
                {
                  x: target.x - challenger.x,
                  y: target.y - challenger.y,
                },
                e.on,
              );
            }
          }
        }
        if (e.kind === 'SAVE') {
          const keeper = eventAfter.players[e.by];
          if (keeper !== undefined) {
            recordMatchVfx(
              'save-impact',
              e,
              e.by,
              { x: eventBefore.ball.x, y: keeper.y },
              {
                x: eventBefore.ball.x - keeper.x,
                y: eventBefore.ball.y - keeper.y,
              },
            );
          }
        }
        if (e.kind === 'POWER_INTERRUPTED') {
          const interrupted = eventAfter.players[e.player];
          const player = playerAt(s, e.player);
          if (interrupted !== undefined && player !== undefined) {
            recordMatchVfx('power-interruption', e, e.player, interrupted, {
              x: 0,
              y: player.team === 0 ? -1 : 1,
            });
          }
        }
        if (
          e.kind === 'GOAL' ||
          e.kind === 'MISS' ||
          e.kind === 'HALF_TIME' ||
          e.kind === 'KICKOFF'
        )
          snap = true;
        if (e.kind === 'GOAL') {
          const scorerName =
            e.by >= 0 && e.by < BASE_PLAYER_COUNT
              ? s.players[e.by].def.name
              : 'Unknown';
          bannerRef.current = appendNewestFour(bannerRef.current, {
            id: `goal:${e.t}:${e.by}`,
            // '⚡' and '⚠' below are pictograms, not words: they stay in the
            // source and only the sentence beside them comes from the catalog.
            text: `⚡ ${t('matchScreen.bannerGoal', { player: scorerName })}`,
            untilTick: e.t + FLASH_TICKS,
            tone: 'gold',
          });
          scoreFlashUntilRef.current = reduceMotion ? e.t : e.t + FLASH_TICKS;
        }
        if (e.kind === 'POWER_FIRED') {
          const firingPlayer = s.players[e.player];
          const state = firingPlayer.powerState;
          const targets: MatchPowerEffectTarget[] = [];
          let effectOrigin: MatchPowerEffectTarget = { player: e.player };
          let anchor =
            firingPlayer.powerAnchor === undefined
              ? undefined
              : { ...firingPlayer.powerAnchor };
          if (state.kind === 'active') {
            if (state.targetIdx !== undefined)
              targets.push({ player: state.targetIdx });
            if (state.secondaryTargetIdx !== undefined)
              targets.push({ player: state.secondaryTargetIdx });
            if (state.runnerIdx !== undefined)
              targets.push({ player: state.runnerIdx });
          }
          if (e.power === 'PORTAL_PASS' && s.ball.kind === 'held') {
            targets.splice(0, targets.length, { player: s.ball.by });
          }
          if (e.power === 'ELASTIC_KEEPER') {
            // Aim the glove at the real shot's goal-plane destination. The
            // ball remains the one ball in the main Atlas; the FX must never
            // invent a second projectile or follow the later distribution.
            const catchX =
              s.ball.kind === 'shot' ? s.ball.targetX : prevRef.current!.ball.x;
            targets.splice(0, targets.length, {
              point: { x: catchX, y: firingPlayer.pos.y },
            });
          }
          if (e.power === 'BLINK_RUN') {
            effectOrigin = { point: { ...prevRef.current!.players[e.player] } };
            targets.splice(0, targets.length, {
              point: { ...nextRef.current!.players[e.player] },
            });
          }
          if (e.power === 'DECOY_DOUBLE') {
            const clone = s.decoyClones[firingPlayer.team];
            if (clone !== null) {
              const marker =
                state.kind === 'active' ? state.targetIdx : undefined;
              targets.splice(
                0,
                targets.length,
                ...(marker === undefined
                  ? []
                  : [{ player: marker } as MatchPowerEffectTarget]),
                { point: { ...clone.pos } },
              );
              effectOrigin = { point: { ...clone.pos } };
            }
          }
          if (
            e.power === 'GRAVITY_WELL' &&
            state.kind === 'active' &&
            state.carrierIdx !== undefined
          ) {
            effectOrigin = { player: state.carrierIdx };
            anchor = { ...s.players[state.carrierIdx].pos };
          }
          if (e.power === 'RALLY_CRY') {
            const encore = s.players.findIndex(
              (candidate, index) =>
                index !== e.player &&
                candidate.team === firingPlayer.team &&
                candidate.encoreState === 'BANKED',
            );
            if (encore !== -1) {
              targets.splice(0, targets.length, { player: encore });
              // Stamp the grant so the overlay can flash a 2s bolt over this mate.
              encoreGrantedTickRef.current.set(encore, e.t);
            }
          }
          const delayedFirstBeat =
            e.power === 'FUTURE_SIGHT' ||
            e.power === 'GUST' ||
            e.power === 'WEB_TRAP' ||
            e.power === 'ICE_RINK' ||
            e.power === 'SHADOW_MARK';
          const strengthImpact = e.power === 'SUPER_STRENGTH';
          // Ice Rink is drawn entirely by the victim-anchored slide effect
          // below. A recorded one-shot here is anchored to the caster's team
          // direction, so its sheet lands on the opposite side and then "hops"
          // when the victim slide takes over. Skip it.
          const casterSheet = e.power === 'ICE_RINK';
          const descriptor = powerEffectDescriptor(e.power);
          if (!strengthImpact && !casterSheet) {
            recordPowerEffect(e.power, e.player, {
              startTick: e.t,
              origin: effectOrigin,
              targets,
              anchor,
              maxElapsedMs: delayedFirstBeat
                ? descriptor.beats[0].endMs
                : undefined,
            });
          }
          // Activation juice. Every power gets the shared sheet; only powers
          // with authored extras take over an in-flight one, so a plain
          // activation can't cut short a shoulder charge's shake.
          if (juiceRef.current === null || hasPowerJuiceExtras(e.power)) {
            startJuice(e.power, e.player, now);
          }
          if (
            powerOverlayPath(
              cutInMode,
              reduceMotion,
              firingPlayer.team,
              controlledTeam,
            ) === 'tile'
          ) {
            const skippable = seenPowerCutInsRef.current.has(e.power);
            if (!skippable) {
              seenPowerCutInsRef.current.add(e.power);
              onPowerCutInSeenRef.current?.(e.power);
            }
            setPowerCutIns((current) =>
              appendNewestFour(current, {
                id: `${e.t}:${e.player}:${e.power}`,
                power: e.power,
                playerName: firingPlayer.def.name,
                skippable,
                player: e.player,
              }),
            );
          } else {
            bannerRef.current = appendNewestFour(bannerRef.current, {
              id: `power:${e.t}:${e.player}:${e.power}`,
              text: `⚡ ${e.power.replace(/_/g, ' ')} · ${firingPlayer.def.name}`,
              untilTick: e.t + FLASH_TICKS,
              tone: firingPlayer.team === controlledTeam ? 'gold' : 'red',
            });
          }
        }
        if (e.kind === 'PASS') {
          // Future Sight mutates its hero into POWER_OUTLET immediately before
          // the intercepted PASS event is emitted. That stable commitment is
          // the exact causal marker for forecast -> intercept -> outlet art.
          const future = s.players.findIndex(
            (candidate) =>
              candidate.def.power === 'FUTURE_SIGHT' &&
              candidate.team !== playerAt(s, e.from)?.team &&
              candidate.powerState.kind === 'active' &&
              candidate.powerState.commitment === 'POWER_OUTLET',
          );
          if (future !== -1) {
            const futureState = s.players[future].powerState;
            const outlet =
              futureState.kind === 'active' ? futureState.targetIdx : undefined;
            recordPowerEffect('FUTURE_SIGHT', future, {
              startTick: e.t,
              idSuffix: `intercept:${e.from}:${e.to}`,
              origin: { point: { ...prevRef.current!.players[future] } },
              targets: [
                { player: e.to },
                { player: e.from },
                ...(outlet === undefined
                  ? []
                  : [{ player: outlet } as MatchPowerEffectTarget]),
              ],
              timelineOffsetMs:
                powerEffectDescriptor('FUTURE_SIGHT').beats[1].startMs,
            });
          }
        }
        if (e.kind === 'GUST_REDIRECT') {
          recordPowerEffect('GUST', e.player, {
            startTick: e.t,
            idSuffix: `redirect:${e.from}:${e.to}`,
            origin: { player: e.to },
            targets: [{ player: e.from }],
            timelineOffsetMs: powerEffectDescriptor('GUST').beats[1].startMs,
          });
        }
        if (e.kind === 'GUST_PUNT') {
          recordPowerEffect('GUST', e.player, {
            startTick: e.t,
            idSuffix: `punt:${e.from}:${e.to}`,
            origin: { player: e.from },
            targets: [{ player: e.from }, { player: e.to }],
            timelineOffsetMs: powerEffectDescriptor('GUST').beats[2].startMs,
          });
        }
        if (e.kind === 'DECOY_POP') {
          puffRef.current = {
            x: e.pos.x,
            y: e.pos.y,
            tick: e.t,
            owner: 'decoy-pop',
          };
        }
        if (e.kind === 'TACKLE' && e.style === 'power') {
          const source = playerAt(s, e.by);
          const power = source?.def.power;
          // Web and Ice already have state-backed persistent art while the
          // victim is rooted/sliding. Recording another event copy here drew
          // two effects over the same player and made both read as clutter.
          if (power === 'SUPER_STRENGTH' || power === 'SHADOW_MARK') {
            const descriptor = powerEffectDescriptor(power);
            const placedAnchor = source?.powerAnchor;
            const offset =
              power === 'SUPER_STRENGTH'
                ? descriptor.beats[2].startMs
                : power === 'SHADOW_MARK'
                  ? descriptor.beats[2].startMs
                  : descriptor.beats[1].startMs;
            recordPowerEffect(power, e.by, {
              startTick: e.t,
              idSuffix: `resolve:${e.on}`,
              origin:
                power === 'SHADOW_MARK' && placedAnchor !== undefined
                  ? { point: { ...placedAnchor } }
                  : { player: e.by },
              targets: [{ player: e.on }],
              anchor:
                placedAnchor === undefined ? undefined : { ...placedAnchor },
              timelineOffsetMs: offset,
            });
          }
        }
        if (e.kind === 'HALF_TIME') {
          bannerRef.current = appendNewestFour(bannerRef.current, {
            id: `half:${e.t}`,
            text: t('matchScreen.bannerHalfTime'),
            untilTick: e.t + FLASH_TICKS,
            tone: 'blue',
          });
        }
        if (e.kind === 'FULL_TIME') {
          // Sim ticks freeze at fulltime, so `s.tick <= untilTick` below
          // holds and this banner stays up for the whole end-of-match hold.
          bannerRef.current = appendNewestFour(bannerRef.current, {
            id: `full:${e.t}`,
            text: t('matchScreen.bannerFullTime'),
            untilTick: e.t + FLASH_TICKS,
            tone: 'blue',
          });
        }
        if (e.kind === 'FORMATION_CHANGED' && e.team === controlledTeam) {
          bannerRef.current = appendBannerNewestFour(bannerRef.current, {
            id: `formation:${e.t}`,
            text: `${e.formation} · ${t(`formation.${e.formation}.blurb`).toUpperCase()}`,
            untilTick: e.t + FLASH_TICKS,
            tone: 'blue',
            subject: 'formation',
          });
        }
        if (e.kind === 'MENTALITY_CHANGED' && e.team === controlledTeam) {
          bannerRef.current = appendBannerNewestFour(bannerRef.current, {
            id: `mentality:${e.t}`,
            text: `${t('matchScreen.playstyle')} · ${mentalityLabel(e.mentality, t)}`,
            untilTick: e.t + FLASH_TICKS,
            tone: 'blue',
            subject: 'mentality',
          });
        }
        if (e.kind === 'ENERGY_USE_CHANGED' && e.team === controlledTeam) {
          bannerRef.current = appendBannerNewestFour(bannerRef.current, {
            id: `energy:${e.t}`,
            text: `${t('matchScreen.energyUse')} · ${energyUseLabel(e.energyUse, t)}`,
            untilTick: e.t + FLASH_TICKS,
            tone: 'blue',
            subject: 'energy',
          });
        }
        if (e.kind === 'SUBSTITUTION' && e.team === controlledTeam) {
          const incoming = s.players[e.player].def.name;
          bannerRef.current = appendNewestFour(bannerRef.current, {
            id: `sub:${e.t}:${e.player}`,
            text: t('matchScreen.bannerSubstitution', { player: incoming }),
            untilTick: e.t + FLASH_TICKS,
            tone: 'blue',
          });
        }
        if (!reduceMotion && e.kind === 'SLIDE_STARTED') {
          const rotation = Math.atan2(e.direction.y, e.direction.x);
          actionRef.current[e.by] = {
            kind: 'slide',
            startTick: e.t,
            origin: { ...playerAt(s, e.by)!.pos },
            direction: { ...e.direction },
            rotation,
            untilTick: e.untilTick + SLIDE_SUCCESS_RECOVERY_TICKS,
          };
        }
        if (!reduceMotion && e.kind === 'TACKLE') {
          if (e.style === 'slide') {
            const current = actionRef.current[e.by];
            if (current?.kind === 'slide') {
              current.untilTick = Math.max(
                current.untilTick,
                playerAt(s, e.by)?.tackleRecoveryUntil ?? current.untilTick,
              );
            }
          }
          // The whole decision table lives in tackle-poses.ts, where it is
          // unit-testable; this only applies what it returns.
          const poses = tacklePoses({
            won: e.won,
            contact: e.contact,
            startTick: e.t - 1,
            tick: s.tick,
            challenger: nextRef.current!.players[e.by],
            target: nextRef.current!.players[e.on],
            challengerTeam: playerAt(s, e.by)?.team,
            targetOutUntilTick: playerAt(s, e.on)?.outUntilTick ?? null,
            challengerBusy: actionPose(actionRef.current[e.by], s.tick).active,
            ...(e.dropped ? { dropped: e.dropped } : {}),
            // A floored challenger is held prone to his own recovery tick, so the
            // pose needs the sim's number rather than a render-side duration.
            challengerRecoveryUntil: playerAt(s, e.by)?.tackleRecoveryUntil,
          });
          if (poses.target !== undefined)
            actionRef.current[e.on] = poses.target;
          if (poses.challenger !== undefined)
            actionRef.current[e.by] = poses.challenger;
          if (poses.impact !== undefined) {
            impactRef.current = {
              x: poses.impact.x,
              y: poses.impact.y,
              tick: e.t,
            };
          }
        }
        if (e.kind === 'IGNITED') {
          for (
            let index = powerEffectsRef.current.length - 1;
            index >= 0;
            index -= 1
          ) {
            const effect = powerEffectsRef.current[index];
            if (effect.power !== 'FIRE_TORCH' || effect.startTick !== e.t)
              continue;
            if (!effect.targets.some((target) => target.player === e.player)) {
              effect.targets.push({ player: e.player });
            }
            break;
          }
        }
        if (!reduceMotion && e.kind === 'IGNITED') {
          const victimPos = nextRef.current!.players[e.player];
          const rotation = torchCasterPos
            ? victimPos.x - torchCasterPos.x >= 0
              ? Math.PI / 2
              : -Math.PI / 2
            : e.player % 2 === 0
              ? Math.PI / 2
              : -Math.PI / 2;
          actionRef.current[e.player] = {
            kind: 'knockdown',
            startTick: e.t - 1,
            anchor: { ...victimPos },
            rotation,
            untilTick: s.players[e.player].outUntilTick,
          };
        }
        // Controlled heroes activate automatically without a readiness marker.
        // Rival Zone entry remains a short red threat so keeping possession
        // away from that hero is still visible counterplay.
        if (e.kind === 'POWER_READY') {
          const firstName = s.players[e.player].def.name.split(' ')[0];
          if (s.players[e.player].team !== controlledTeam) {
            bannerRef.current = appendNewestFour(bannerRef.current, {
              id: `rival-zone:${e.t}:${e.player}`,
              text: `⚠ ${t('matchScreen.bannerRivalZone', { player: firstName })}`,
              untilTick: e.t + RIVAL_ZONE_BANNER_TICKS,
              tone: 'red',
            });
          }
        }
      }
      // Every frame, not every tick: the beat sheet runs on wall clock so its
      // brief camera and tint effects stay smooth at every selected match speed.
      advanceJuice(now);
      if (
        advanced &&
        firstMatchTutorial &&
        firstMatchTutorialStepRef.current === null
      ) {
        const prompt = nextFirstMatchCoachingPrompt(
          s,
          controlledTeam,
          firstMatchPromptsSeenRef.current,
        );
        if (prompt !== null) {
          const step = 'tired-modal';
          firstMatchPromptsSeenRef.current = { tiredPlayer: true };
          firstMatchTiredPlayerRef.current = prompt.player;
          firstMatchTutorialStepRef.current = step;
          setFirstMatchTutorialStep(step);
          automaticPauseReasonsRef.current.add('tutorial');
          // Publish the completed coaching tick first, then freeze it. Pausing
          // here would queue before the UI-runtime publish and the new timing
          // segment would immediately restart underneath the tutorial.
          pauseAfterPublish = true;
          acc = 0;
        }
      }
      // Fire crackle loop follows the caster's active window: on while any Fire
      // Torch hero is ablaze, off once none are. Reconciled from state each
      // frame (not off an event) so it also stops on a KO, interruption, or
      // natural expiry — none of which emit a "power ended" event.
      // Both things that draw flames count: the caster while ablaze AND anyone
      // they set alight (WorkletMatchOverlays draws tongues for STATUS_IGNITED
      // too), so the crackle covers every flame on the pitch and nothing else.
      const fireActive = s.players.some(
        (p, i) =>
          (p.def.power === 'FIRE_TORCH' && isActive(s, i)) ||
          (p.outReason === 'ignited' && p.outUntilTick > s.tick),
      );
      if (fireActive && !fireLoopOnRef.current) {
        startFireAmbience();
        fireLoopOnRef.current = true;
      } else if (!fireActive && fireLoopOnRef.current) {
        stopFireAmbience();
        fireLoopOnRef.current = false;
      }

      // Ledger item 6 — a dangling SHOT at a tick/half boundary (no paired
      // SAVE/GOAL/MISS) needs no special handling: the renderer never assumes
      // events pair up, it only reacts to the specific kinds listed above.

      // Ledger item 3 — snap, don't lerp, across a restart or any single-tick
      // teleport: otherwise players visibly streak across the pitch from
      // their pre-restart spot to the kickoff formation.
      if (snap) {
        prevRef.current = nextRef.current;
        trailRef.current = [];
      }

      if (advanced) {
        powerEffectsRef.current = powerEffectsRef.current.filter((effect) => {
          const elapsed =
            (s.tick - effect.startTick) * TICK_MS + effect.timelineOffsetMs;
          const end =
            effect.maxElapsedMs ??
            powerEffectDescriptor(effect.power).durationMs;
          return elapsed <= end;
        });
        // Publish one immutable tick pair. Reanimated interpolates it and
        // updates all 25 Atlas transforms on the UI thread; React only receives
        // the discrete state used by HUD, chips, and event overlays.
        publishAtlasFrame(
          nextRef.current!,
          s.tick,
          matchPlaybackRate(speedRef.current),
          actionRef.current,
          snap || pauseAfterPublish || s.phase === 'fulltime',
        );
        setFrame(nextRef.current!);
        bannerRef.current = bannerRef.current.filter(
          (banner) => s.tick <= banner.untilTick,
        );
        setHud({
          score: [...s.score] as [number, number],
          tick: s.tick,
          banners: [...bannerRef.current],
          scoreFlash: !reduceMotion && s.tick <= scoreFlashUntilRef.current,
          visualTick: s.tick,
        });
        if (pauseAfterPublish) syncPauseReasons();
        if (showcaseFroze) setPowerShowcaseFrozenAt(performance.now());
      }

      if (s.phase === 'fulltime') {
        // End-of-match hold: calling onDone on the same frame that emitted
        // FULL_TIME would unmount the screen and tear audio down mid-whistle
        // (same for a last-tick goal). Keep rendering — sim ticks already
        // stop at fulltime — until the deadline passes, then hand off once.
        // `now` is the RAF timestamp: the same performance.now() timebase
        // the rest of the loop uses.
        if (fulltimeDeadlineRef.current === null) {
          // The `else if` below guarantees a later RAF before unmounting, so
          // even Reduce Motion presents the final React/Atlas frame once.
          fulltimeDeadlineRef.current =
            now + (reduceMotion ? 0 : FULLTIME_HOLD_MS);
        } else if (now >= fulltimeDeadlineRef.current) {
          if (handedOffRef.current) return;
          handedOffRef.current = true;
          onDone(s);
          return;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      sub.remove();
      // Never leave an off-centre camera behind for the next loop (this effect
      // restarts when Reduce Motion is toggled mid-match).
      resetJuice();
    };
  }, [
    controlledTeam,
    cutInMode,
    firstMatchTutorial,
    home,
    matchVfxQa,
    onDone,
    powerMatchQa,
    publishAtlasFrame,
    reduceMotion,
    resumeAtlasFrame,
    suppressCosmeticEffects,
    away,
  ]);

  // Distance, not wall-clock ticks, advances the run cycle. The action pose
  // takes priority, followed by the far-ball GK ready loop, then locomotion.
  const playerSpriteKeys = useMemo(
    () =>
      Array.from({ length: RENDER_PLAYER_COUNT }, (_, i) => {
        const entity = playerAt(match, i);
        const clone = decoyCloneAt(match, i);
        const sourceIndex =
          clone?.sourceIdx ??
          (i < BASE_PLAYER_COUNT ? i : i === HOME_DECOY_INDEX ? 9 : 20);
        const p = entity ?? match.players[sourceIndex];
        // Clone IDs are intentionally unique replay identities. The visual must
        // still use the copied forward's stable ID whenever no explicit lookId is
        // authored, or playerLookId() would derive a different face and request a
        // sprite that was never included in the match Atlas.
        const visualPlayerId = clone?.sourcePlayerId ?? p.def.id;
        const webbed = (p.webbedUntilTick ?? 0) > hud.tick;
        if (webbed) {
          // Web Trap roots the whole body. Hold the authored grey standing pose
          // even if a stale pre-trap slide animation still exists in the UI ref.
          return webbedSpriteKey(
            spriteKeyForMatchPlayer(
              i,
              visualPlayerId,
              p.def.role,
              runFrameFacingBall(frame.players[i].y, frame.ball.y, 'run0'),
              p.def.lookId,
            ),
          );
        }
        const action = actionRef.current[i];
        const pose = actionPose(action, hud.visualTick);
        if (pose.active && action?.kind === 'slide') {
          return spriteKeyForMatchPlayer(
            i,
            visualPlayerId,
            p.def.role,
            slideTackleSpriteFrameForAction(action, hud.visualTick),
            p.def.lookId,
          );
        }
        if (pose.active) {
          return spriteKeyForMatchPlayer(
            i,
            visualPlayerId,
            p.def.role,
            runFrameFacingBall(frame.players[i].y, frame.ball.y, 'run0'),
            p.def.lookId,
          );
        }
        if (
          p.def.role === 'GK' &&
          isKeeperReady(dist2(frame.players[i], frame.ball))
        ) {
          return spriteKeyForMatchPlayer(
            i,
            visualPlayerId,
            p.def.role,
            keeperReadyFrameFacingBall(
              frame.players[i].y,
              frame.ball.y,
              keeperReadyFrame(hud.visualTick),
            ),
            p.def.lookId,
          );
        }
        return spriteKeyForMatchPlayer(
          i,
          visualPlayerId,
          p.def.role,
          runFrameFacingBall(
            frame.players[i].y,
            frame.ball.y,
            runFrameForDistance(frame.travel[i], frame.moved[i]),
          ),
          p.def.lookId,
        );
      }),
    [frame, hud.tick, hud.visualTick, match],
  );

  // The 22 starters, two reserved Decoy slots, and ball share one batched Atlas
  // draw call. Rects come from the per-atlas cache, so a tick that reuses the
  // same sprite frames constructs no new SkRects at all.
  const sprites: SkRect[] = useMemo(
    () => [...playerSpriteKeys.map(spriteRects), spriteRects('ball')],
    [playerSpriteKeys, spriteRects],
  );

  // Ledger item 4 — tints carry status ONLY. A normal player gets white (a
  // no-op multiply) so the sprite's own kit/skin/hair colors survive instead
  // of being flattened to a solid team-color block.
  const colors: SkColor[] = useMemo(() => {
    const tints = frame.statuses.map((st, i) => {
      const player = playerAt(match, i);
      if (player === undefined || !frame.visible[i])
        return skColor('rgba(255,255,255,0)');
      if (
        player.def.power === 'SHADOW_MARK' &&
        player.powerState.kind === 'active' &&
        player.powerState.commitment === 'SHADOW_HUNT'
      ) {
        return skColor(reduceMotion ? '#6b6675' : 'rgba(255,255,255,0)');
      }
      // Activation body flash — white, then the bright highlight gold, twice
      // over ~0.26s, before releasing to the settled 'active' gold below. Ranked
      // above the other power tints so the moment of firing always reads, but
      // below Shadow Mark's vanish so a hunt can't be lit up.
      if (heroTint !== null && heroTint.player === i) {
        return skColor(heroTint.tint === 'white' ? '#ffffff' : '#f7d894');
      }
      if (
        player.def.power === 'PHASE_RUN' &&
        player.powerState.kind === 'active'
      ) {
        return skColor(reduceMotion ? '#c9a6ec' : 'rgba(201,166,236,0.48)');
      }
      // Webbed players use an authored four-step grey sprite variant above;
      // keep its palette intact instead of multiplying another tint over it.
      if ((player.webbedUntilTick ?? 0) > hud.tick) return skColor('#ffffff');
      if ((player.portalProtectedUntilTick ?? 0) > hud.tick)
        return skColor('#a3c8f0');
      if ((player.forcedMovement?.untilTick ?? 0) > hud.tick)
        return skColor('#a3c8f0');
      if ((player.actionLockedUntilTick ?? 0) > hud.tick)
        return skColor('#d94f52');
      if (st === 'ignited') return skColor('#ff6a00'); // flame orange (matches Fire Torch FX)
      if (st === 'out') return skColor('#6b6675'); // bible grey-dark
      if (st === 'windup') {
        return skColor(
          reduceMotion || hud.tick % 4 < 2 ? '#ffffff' : '#edb54a',
        );
      }
      if (st === 'active') return skColor('#edb54a'); // hero gold
      // 'ok' | 'zone' — zone is telegraphed by the glow ring, not a body tint.
      // In fallback mode there are no kit pixels to preserve, so tint the
      // white placeholder rects with bible team colors (red / blue) instead.
      return atlas.fallbackMode
        ? skColor(
            teamKitColor(
              i < 11 || i === HOME_DECOY_INDEX ? 0 : 1,
              colorSafeKits,
            ),
          )
        : skColor(
            i >= BASE_PLAYER_COUNT ? 'rgba(185,235,255,0.78)' : '#ffffff',
          );
    });
    tints.push(skColor('#ffffff')); // ball — no tint
    return tints;
  }, [frame, heroTint, hud.tick, atlas, colorSafeKits, match, reduceMotion]);

  const minute = Math.min(90, Math.ceil((hud.tick / TOTAL_TICKS) * 90));
  const stoppage =
    match.phase === 'play' &&
    ((match.half === 1 && match.tick >= HALF_TICKS) ||
      (match.half === 2 && match.tick >= TOTAL_TICKS));
  const ringR = (PLAYER_CELL_W * scale * playerSpriteScale.drawScale) / 2 + 4;
  // The canvas is sized by layout, not by the match clock. Fresh object literals
  // here handed the Skia host view (and its wrapper) a new style object on every
  // sim tick, for a size that had not changed since mount.
  const canvasStyle = useMemo(
    () => ({ width: pitchWidth, height: pitchH }),
    [pitchWidth, pitchH],
  );
  const pitchFrameStyle = useMemo(
    () => ({ width: pitchWidth, height: pitchH, alignSelf: 'center' as const }),
    [pitchWidth, pitchH],
  );
  const rivalHeroPlayers: number[] = [];
  // A BITMASK, not an array: this one is read inside the flame worklet, and
  // Reanimated derives that worklet's dependency list from its captured closure
  // values. A fresh array each render therefore tore down and restarted three
  // UI-thread mappers (one per flame layer) on every sim tick; a number compares
  // by value, so the mappers now only restart when the cast actually changes.
  let fireTorchMask = 0;
  match.players.forEach((player, index) => {
    if (!player.def.power) return;
    if (player.team !== controlledTeam) rivalHeroPlayers.push(index);
    if (player.def.power === 'FIRE_TORCH') fireTorchMask |= 1 << index;
  });
  const activeWebTraps = match.players.flatMap((player, index) =>
    player.def.power === 'WEB_TRAP' &&
    isActive(match, index) &&
    player.powerAnchor !== undefined
      ? [
          {
            key: `${index}:${player.powerState.kind === 'active' ? player.powerState.untilTick : match.tick}`,
            x: player.powerAnchor.x,
            y: player.powerAnchor.y,
            color: player.team === controlledTeam ? '#edb54a' : '#d94f52',
          },
        ]
      : [],
  );

  const screenPoint = (point: PowerEffectPoint): PowerEffectPoint => ({
    x: point.x * scale,
    y: point.y * scale,
  });
  const playerPoint = (index: number): PowerEffectPoint =>
    screenPoint(frame.players[index]);
  const resolveEffectTarget = (
    target: MatchPowerEffectTarget,
  ): PowerEffectPoint =>
    target.point === undefined
      ? playerPoint(target.player)
      : screenPoint(target.point);
  const drawablePowerEffects: Array<{
    id: string;
    power: PowerId;
    elapsedMs: number;
    origin: PowerEffectPoint;
    targets: PowerEffectPoint[];
    anchor?: PowerEffectPoint;
    tier: 1 | 2 | 3;
    direction: -1 | 1;
    sourcePlayer: number;
  }> = powerEffectsRef.current.map((effect) => ({
    id: effect.id,
    power: effect.power,
    elapsedMs: Math.max(
      0,
      (hud.tick - effect.startTick) * TICK_MS + effect.timelineOffsetMs,
    ),
    origin: resolveEffectTarget(effect.origin),
    targets: effect.targets.map(resolveEffectTarget),
    anchor:
      effect.anchor === undefined ? undefined : screenPoint(effect.anchor),
    tier: effect.tier,
    direction: match.players[effect.player].team === 0 ? -1 : 1,
    sourcePlayer: effect.origin.player ?? effect.player,
  }));

  const addPersistentPowerEffect = (
    id: string,
    power: PowerId,
    player: number,
    elapsedMs: number,
    origin: PowerEffectPoint,
    targets: PowerEffectPoint[],
    anchor?: PowerEffectPoint,
    sourcePlayer = player,
  ) => {
    drawablePowerEffects.push({
      id,
      power,
      elapsedMs,
      origin,
      targets,
      anchor,
      tier: match.players[player].def.powerTier ?? 1,
      direction: match.players[player].team === 0 ? -1 : 1,
      sourcePlayer,
    });
  };

  match.players.forEach((player, index) => {
    const state = player.powerState;
    if (
      player.def.power === 'SUPER_STRENGTH' &&
      state.kind === 'winding' &&
      state.targetIdx !== undefined
    ) {
      const chargeStartTick = state.untilTick - 5;
      addPersistentPowerEffect(
        `strength-charge:${index}`,
        'SUPER_STRENGTH',
        index,
        1000 + Math.max(0, hud.tick - chargeStartTick) * TICK_MS,
        playerPoint(index),
        [playerPoint(state.targetIdx)],
      );
    }

    // The banked-encore marker is no longer a lingering ticket/ring here; it is
    // a short gold bolt over the granted teammate, built as encoreMarkers below
    // and drawn by WorkletMatchOverlays.

    if ((player.portalProtectedUntilTick ?? 0) > hud.tick) {
      const remaining = player.portalProtectedUntilTick! - hud.tick;
      addPersistentPowerEffect(
        `portal-shield:${index}`,
        'PORTAL_PASS',
        index,
        2300 + (10 - remaining) * 150,
        playerPoint(index),
        [playerPoint(index)],
      );
    }

    if ((player.webbedUntilTick ?? 0) > hud.tick) {
      // Hold the "rooted" frame for the whole webbed duration so the binding
      // bands stay on the victim start to finish. The root lasts 120-200 ticks,
      // far longer than the 4.3s descriptor, so a progressing elapsed time only
      // reached the banded beat in the final ~1s (the "lines only at the end"
      // bug). A fixed mid-beat time keeps the bands fully lit throughout.
      addPersistentPowerEffect(
        `webbed:${index}`,
        'WEB_TRAP',
        index,
        2580,
        playerPoint(index),
        [playerPoint(index)],
        playerPoint(index),
      );
    }

    if ((player.forcedMovement?.untilTick ?? 0) > hud.tick) {
      const remaining = player.forcedMovement!.untilTick - hud.tick;
      addPersistentPowerEffect(
        `ice-slide:${index}`,
        'ICE_RINK',
        index,
        950 + (10 - remaining) * 190,
        playerPoint(index),
        [playerPoint(index)],
        playerPoint(index),
      );
    }

    if (
      player.def.power === 'SHADOW_MARK' &&
      state.kind === 'active' &&
      state.commitment === 'SHADOW_HUNT' &&
      state.armedAtTick !== undefined &&
      player.powerAnchor !== undefined
    ) {
      const burrowStartTick = state.armedAtTick - 20;
      const elapsedMs =
        hud.tick < state.armedAtTick
          ? (Math.max(0, hud.tick - burrowStartTick) / 20) * 1250
          : 1250 + Math.min(1, (hud.tick - state.armedAtTick) / 100) * 1900;
      const carrier =
        match.ball.kind === 'held' &&
        playerAt(match, match.ball.by)?.team !== player.team
          ? playerPoint(match.ball.by)
          : screenPoint(player.powerAnchor);
      addPersistentPowerEffect(
        `shadow-hunt:${index}`,
        'SHADOW_MARK',
        index,
        elapsedMs,
        screenPoint(player.powerAnchor),
        [carrier],
        screenPoint(player.powerAnchor),
      );
    }

    // The live Decoy clone is a real Atlas player; its dashed hologram ring is
    // drawn by WorkletMatchOverlays, so it needs no power-effect scene here.

    // Web Trap keeps its short caster-side cast flash. Ice Rink is intentionally
    // excluded: it is drawn only by the victim-anchored slide effect above, so a
    // caster-side sheet here would put the ice on the wrong side and cause the
    // "starts one side, hops to the other" flip.
    if (
      player.def.power === 'WEB_TRAP' &&
      state.kind === 'active' &&
      player.powerAnchor !== undefined
    ) {
      addPersistentPowerEffect(
        `placed:${player.def.power}:${index}`,
        player.def.power,
        index,
        820,
        playerPoint(index),
        [screenPoint(player.powerAnchor)],
        screenPoint(player.powerAnchor),
      );
    }
  });

  // Rally Cry grant markers: a gold bolt over each freshly-granted teammate for
  // ~2s. Drop entries once the window elapses or the encore is spent so stale
  // bolts never linger.
  const encoreMarkers: EncoreMarker[] = [];
  encoreGrantedTickRef.current.forEach((grantTick, slot) => {
    const banked = match.players[slot]?.encoreState === 'BANKED';
    if (!banked || hud.tick - grantTick >= ENCORE_MARKER_TICKS) {
      encoreGrantedTickRef.current.delete(slot);
      return;
    }
    encoreMarkers.push({ slot, grantTick });
  });

  const activeSpeedster = match.players.findIndex(
    (player) =>
      player.def.power === 'SUPER_SPEED' && player.powerState.kind === 'active',
  );
  const presentedPowerEffects = drawablePowerEffects;
  const powerEffectActors = [
    ...presentedPowerEffects.flatMap((effect) =>
      livePowerEffectActors({
        id: effect.id,
        power: effect.power,
        player: effect.sourcePlayer,
        elapsedMs: effect.elapsedMs,
        width: pitchWidth,
        height: pitchH,
        origin: effect.origin,
        targets: effect.targets,
        direction: effect.direction,
        reduceMotion,
      }),
    ),
    ...(activeSpeedster === -1
      ? []
      : superSpeedAfterimageActors(
          activeSpeedster,
          trailRef.current.map(screenPoint),
        )),
  ];
  const powerActorSprites: SkRect[] = powerEffectActors.map((actor) =>
    spriteRects(playerSpriteKeys[actor.player]),
  );
  const powerActorTransforms: SkRSXform[] = powerEffectActors.map((actor) => {
    const rect = atlas.rectFor(playerSpriteKeys[actor.player]);
    const actorScale = scale * playerSpriteScale.drawScale * actor.scale;
    return Skia.RSXform(
      actorScale,
      0,
      actor.at.x - (rect.w * actorScale) / 2,
      actor.at.y - (rect.h * actorScale) / 2,
    );
  });
  // Not interned: an afterimage's opacity is a continuous animation value, so
  // every frame would be a fresh cache key.
  const powerActorColors: SkColor[] = powerEffectActors.map((actor) =>
    Skia.Color(`rgba(255,255,255,${actor.opacity})`),
  );

  const teamOffset = controlledTeam === 0 ? 0 : 11;
  const onFieldIndices = Array.from(
    { length: 11 },
    (_, slot) => teamOffset + slot,
  );
  const activeOnFieldIndices = onFieldIndices.filter(
    (index) => match.players[index].outReason !== 'redcard',
  );
  const currentTactics = match.tactics[controlledTeam];
  // One backwards scan for the newest input of each kind — this runs on every
  // HUD render (per advanced tick), and four copy+reverse passes were the
  // per-tick allocation hot spot outside the draw call.
  let pendingFormation: MatchInput | undefined;
  let pendingMentality: MatchInput | undefined;
  let pendingEnergyUse: MatchInput | undefined;
  for (let i = match.pendingInputs.length - 1; i >= 0; i--) {
    const input = match.pendingInputs[i];
    if (input.kind === 'SET_FORMATION') pendingFormation ??= input;
    else if (input.kind === 'SET_MENTALITY') pendingMentality ??= input;
    else if (input.kind === 'SET_ENERGY_USE') pendingEnergyUse ??= input;
    // SET_AUTO_POWERS is deliberately not scanned: the M/A badge it fed was
    // removed with the manual tap (2026-07-25), and the input survives as test
    // instrumentation only. Nothing in the HUD reads a firing policy now.
  }
  const displayedFormation =
    pendingFormation?.kind === 'SET_FORMATION'
      ? pendingFormation.formation
      : currentTactics.formation;
  const displayedMentality =
    pendingMentality?.kind === 'SET_MENTALITY'
      ? pendingMentality.mentality
      : currentTactics.mentality;
  const displayedEnergyUse =
    pendingEnergyUse?.kind === 'SET_ENERGY_USE'
      ? pendingEnergyUse.energyUse
      : currentTactics.energyUse;
  const carrierIndex = retainedCarrierIndex(
    frame.carrier,
    lastCarrierRef.current,
  );
  useEffect(() => {
    if (frame.carrier >= 0) lastCarrierRef.current = frame.carrier;
  }, [frame.carrier]);
  const carrier =
    carrierIndex === null ? null : (playerAt(match, carrierIndex) ?? null);
  const bench = match.bench[controlledTeam];
  const substitutionsUsed = match.substitutionsUsed[controlledTeam];
  const substitutionsRemaining = Math.max(
    0,
    MAX_SUBSTITUTIONS - substitutionsUsed,
  );
  // A substitute enters at their startingCondition (src/sim/substitutions.ts),
  // so the board shows that as their energy rather than assuming a full bar.
  const substitutionBoardBench = bench.map((player) => ({
    id: player.id,
    name: player.name,
    role: player.role,
    condition: player.startingCondition ?? 100,
    ...(player.lookId === undefined ? {} : { lookId: player.lookId }),
  }));
  const substitutionBoardField = onFieldIndices.map((index) => {
    const player = match.players[index];
    return {
      index,
      name: player.def.name,
      role: player.def.role,
      condition: player.condition,
      sentOff: player.outReason === 'redcard',
      ...(player.def.lookId === undefined ? {} : { lookId: player.def.lookId }),
    };
  });
  const { average: teamEnergy, tiredCount } = summarizeTeamEnergy(
    activeOnFieldIndices.map((index) => match.players[index].condition),
  );
  const teamEnergyBand = energyBand(teamEnergy);
  const swapDisabled =
    match.phase === 'fulltime' ||
    substitutionsUsed >= MAX_SUBSTITUTIONS ||
    bench.length === 0;
  const coachingDisabled = match.phase === 'fulltime';
  const primaryPowerCutIn = powerCutIns[powerCutIns.length - 1] ?? null;
  const dismissPowerTakeover = () => {
    if (!powerCutInPolicy.skippable) return;
    playUiClickSfx();
    setPowerCutIns([]);
  };
  const powerTakeover =
    primaryPowerCutIn === null
      ? undefined
      : {
          power: primaryPowerCutIn.power,
          playerName: primaryPowerCutIn.playerName,
          additionalPowerCount: powerCutIns.filter(
            (entry) =>
              entry !== primaryPowerCutIn && entry.outroStartedAt === undefined,
          ).length,
          teamColor: teamKitColor(controlledTeam, colorSafeKits),
          ending: primaryPowerCutIn.outroStartedAt !== undefined,
          reduceMotion,
          skippable: powerCutInPolicy.skippable,
          accessibilityLabel: powerCutInAccessibilityLabel(powerCutIns, t),
          onDismiss: dismissPowerTakeover,
        };
  const tutorialTiredStarter =
    firstMatchTiredPlayerRef.current === null
      ? null
      : (playerAt(match, firstMatchTiredPlayerRef.current) ?? null);
  const substitutionTally = `${substitutionsUsed}/${MAX_SUBSTITUTIONS}`;
  const swapSecondary = autoSubs
    ? t('matchScreen.swapAuto', { used: substitutionTally })
    : tiredCount > 0
      ? t('matchScreen.swapTired', {
          count: tiredCount,
          used: substitutionTally,
        })
      : t('matchScreen.swapUsed', { used: substitutionTally });

  const openSwap = () => {
    if (
      match.phase === 'fulltime' ||
      substitutionsUsed >= MAX_SUBSTITUTIONS ||
      bench.length === 0
    )
      return;
    setSwapOpen(true);
    automaticPauseReasonsRef.current.add('swap');
    if (firstMatchTutorialStepRef.current === 'tired-swap-cue') {
      firstMatchTutorialStepRef.current = 'tired-player-cue';
      setFirstMatchTutorialStep('tired-player-cue');
    }
    syncPauseReasons();
  };
  const closeSwap = () => {
    setSwapOpen(false);
    automaticPauseReasonsRef.current.delete('swap');
    // Cancel backs up one tutorial step instead of losing the lesson. The
    // exact player remains captured for the next board visit.
    if (firstMatchTutorialStepRef.current === 'tired-player-cue') {
      firstMatchTutorialStepRef.current = 'tired-swap-cue';
      setFirstMatchTutorialStep('tired-swap-cue');
    }
    syncPauseReasons();
  };
  const finishTiredPlayerTutorial = () => {
    if (firstMatchTutorialStepRef.current !== 'tired-player-cue') return;
    firstMatchTutorialStepRef.current = null;
    firstMatchTiredPlayerRef.current = null;
    setFirstMatchTutorialStep(null);
    automaticPauseReasonsRef.current.delete('tutorial');
    syncPauseReasons();
  };
  /** The cup card has been read (or skipped): release kickoff. */
  const dismissTitleCard = () => {
    setTitleCardShowing(false);
    automaticPauseReasonsRef.current.delete('title-card');
    syncPauseReasons();
  };
  /**
   * Commits the whole board at once: one recorded SUBSTITUTE input per staged
   * pair, all on the same tick. The engine validates each one and the board
   * mirrors those rules, so the try/catch only covers the match having moved
   * under an open board — one rejected swap must never take the screen down.
   */
  const commitSubstitutions = (
    swaps: readonly { player: number; replacementId: string }[],
    nextAutoSubs: boolean,
  ) => {
    if (nextAutoSubs !== autoSubsRef.current) onAutoSubsChange?.(nextAutoSubs);
    setAutoSubs(nextAutoSubs);
    autoSubsRef.current = nextAutoSubs;
    for (const swap of swaps) {
      try {
        queueInput(match, {
          tick: match.tick + 1,
          kind: 'SUBSTITUTE',
          player: swap.player,
          replacementId: swap.replacementId,
        });
      } catch (error) {
        console.warn(
          'MatchScreen: the engine rejected a staged substitution',
          error,
        );
      }
    }
    closeSwap();
  };

  const continueTiredPlayerTutorial = () => {
    firstMatchTutorialStepRef.current = 'tired-swap-cue';
    setFirstMatchTutorialStep('tired-swap-cue');
  };

  // Shared coaching actions. The phone dock and the desktop rail both call
  // these, so both issue byte-identical recorded inputs and the same banner.
  // The tap cue stays at each call site: the dock plays it explicitly, and the
  // rail's SfxPressable plays it for every chip.
  const applySpeed = (next: MatchSpeed) => {
    const allowed =
      next <= effectiveMaximumSpeed ? next : effectiveMaximumSpeed;
    speedRef.current = allowed;
    resetFramePacingMonitor(performanceMonitorRef.current);
    performanceBadWindowsRef.current = 0;
    performanceResumeAtRef.current = performance.now() + 1000;
    if (!pausedRef.current) resumeAtlasFrame(matchPlaybackRate(allowed));
    setSpeed(allowed);
  };
  const toggleUserPause = () => {
    automaticPauseReasonsRef.current.delete('background');
    userPausedRef.current = !pausedRef.current;
    syncPauseReasons();
  };
  const pushInputBanner = (
    id: string,
    text: string,
    subject: MatchBannerSubject,
  ) => {
    bannerRef.current = appendBannerNewestFour(bannerRef.current, {
      id,
      text,
      untilTick: match.tick + FLASH_TICKS,
      tone: 'blue',
      subject,
    });
    setHud((current) => ({ ...current, banners: [...bannerRef.current] }));
  };
  // Re-picking what is already selected is not a coaching decision: it would
  // record a redundant replay input and flash a banner announcing no change.
  // Compared against the DISPLAYED value, so a second tap landing before the
  // queued input applies is caught too.
  const selectFormation = (formation: FormationId) => {
    if (formation === displayedFormation) return;
    queueInput(match, {
      tick: match.tick + 1,
      kind: 'SET_FORMATION',
      formation,
    });
    pushInputBanner(
      `formation-input:${match.tick}`,
      `${formation} · ${t(`formation.${formation}.blurb`).toUpperCase()}`,
      'formation',
    );
  };
  const selectMentality = (mentality: Mentality) => {
    if (mentality === displayedMentality) return;
    queueInput(match, {
      tick: match.tick + 1,
      kind: 'SET_MENTALITY',
      mentality,
    });
    pushInputBanner(
      `mentality-input:${match.tick}`,
      `${t('matchScreen.playstyle')} · ${mentalityLabel(mentality, t)}`,
      'mentality',
    );
  };
  const selectEnergyUse = (mode: EnergyUse) => {
    if (mode === displayedEnergyUse) return;
    queueInput(match, {
      tick: match.tick + 1,
      kind: 'SET_ENERGY_USE',
      energyUse: mode,
    });
    pushInputBanner(
      `energy-input:${match.tick}`,
      `${t('matchScreen.energyUse')} · ${energyUseLabel(mode, t)}`,
      'energy',
    );
  };
  // Desktop rail view-model. Everything here reads the JS-side match state the
  // RAF loop already re-renders each tick, so heat and the Zone countdown are
  // live without touching the Reanimated worklet frame.
  const railTiredPlayers: MatchRailTiredPlayer[] = mostTiredFirst(
    activeOnFieldIndices.map((index) => ({
      id: match.players[index].def.id,
      name: match.players[index].def.name,
      role: match.players[index].def.role,
      condition: match.players[index].condition,
    })),
  );
  const controlledRailHeroTiles: MatchRailHeroTile[] = activeOnFieldIndices
    .flatMap((index) => {
      const player = match.players[index];
      const power = player.def.power;
      if (!power) return [];
      const presentation = powerCutInPresentation(power, t);
      return [
        {
          id: player.def.id,
          name: player.def.name,
          powerName: presentation.name,
          powerGlyph: presentation.glyph,
          powerColor: presentation.color,
          heat: heatFraction(player.gauge),
          status: railHeroStatus(player.powerState),
          rival: false,
        },
      ];
    })
    .slice(0, RAIL_HERO_TILE_CAP);
  const rivalTeamOffset = controlledTeam === 0 ? 11 : 0;
  const rivalHeadlineIndex = Array.from(
    { length: 11 },
    (_, slot) => rivalTeamOffset + slot,
  ).find((index) => {
    const player = match.players[index];
    return (
      player.outReason !== 'redcard' &&
      player.def.power !== undefined &&
      isRivalHeroIntroHeroId(player.def.id)
    );
  });
  const rivalRailHeroTiles: MatchRailHeroTile[] =
    rivalHeadlineIndex === undefined
      ? []
      : (() => {
          const player = match.players[rivalHeadlineIndex];
          const power = player.def.power;
          if (power === undefined) return [];
          const presentation = powerCutInPresentation(power, t);
          return [
            {
              id: player.def.id,
              name: player.def.name,
              powerName: presentation.name,
              powerGlyph: presentation.glyph,
              powerColor: '#d94f52',
              heat: heatFraction(player.gauge),
              status: railHeroStatus(player.powerState),
              rival: true,
            },
          ];
        })();
  const railHeroTiles = [...controlledRailHeroTiles, ...rivalRailHeroTiles];
  const railClockLine = `${t(
    match.half === 1 ? 'matchScreen.firstHalf' : 'matchScreen.secondHalf',
  )} · ${minute}'${stoppage ? '+' : ''}${paused ? ` · ${t('matchScreen.paused')}` : ''}`;

  return (
    <View style={[styles.root, highContrast ? styles.rootHighContrast : null]}>
      {/* Desktop replaces this bar with the rail scoreboard card. */}
      {railLayout || presentationOnly ? null : (
        <Pressable
          immediatePress
          accessibilityRole="button"
          accessibilityLabel={
            paused
              ? t('matchScreen.a11y.resumeMatch')
              : t('matchScreen.a11y.pauseMatch')
          }
          style={({ pressed }) => [
            styles.scorebar,
            compactHeight ? styles.scorebarCompact : null,
            hudSide === 'right' ? styles.scorebarFlipped : null,
            // Scaling a full-width surface shifts both screen edges by almost
            // 6px on a 390px phone. Keep this large target crisp: one pixel of
            // key travel gives contact feedback without the sideways wobble.
            pressed ? { opacity: 0.7, transform: [{ translateY: 1 }] } : null,
          ]}
          onPress={() => {
            toggleUserPause();
          }}
        >
          {/* Scoreboard "bug": an ink-outlined dark pill with a raised bottom
              lip (Track-A bevel). Team codes match their on-pitch kits while
              the score and clock stay cream and flash hero-gold on a goal.
              Tapping the surrounding bar still toggles pause. */}
          <View style={styles.scoreBug}>
            <Text
              style={[
                styles.scoreText,
                hud.scoreFlash ? styles.scoreTextFlash : null,
              ]}
            >
              <Text style={{ color: homeKitColor }}>{homeCode}</Text>
              {` ${hud.score[0]} – ${hud.score[1]} `}
              <Text style={{ color: awayKitColor }}>{awayCode}</Text>
              {` · ${minute}'${stoppage ? '+' : ''}${paused ? ' ⏸' : ''}`}
            </Text>
          </View>
          <View style={styles.controls}>
            <Pressable
              immediatePress
              style={styles.ctrlButton}
              accessibilityRole="button"
              accessibilityLabel={t('matchScreen.a11y.matchSpeed', { speed })}
              hitSlop={10}
              onPress={() => {
                applySpeed(nextMatchSpeed(speed, effectiveMaximumSpeed));
              }}
            >
              <Text style={styles.ctrlText}>×{speed}</Text>
            </Pressable>
            <SettingsButton onPress={onOpenSettings} variant="match" />
          </View>
        </Pressable>
      )}
      <View
        style={
          railLayout
            ? styles.desktopBody
            : presentationOnly
              ? styles.presentationBody
              : null
        }
      >
        {railLayout ? (
          <MatchControlRail
            homeCode={homeCode}
            homeScore={hud.score[0]}
            homeColor={homeKitColor}
            awayCode={awayCode}
            awayScore={hud.score[1]}
            awayColor={awayKitColor}
            clockLine={railClockLine}
            scoreFlash={hud.scoreFlash}
            paused={paused}
            speed={speed}
            maximumSpeed={effectiveMaximumSpeed}
            onSelectSpeed={applySpeed}
            onTogglePause={toggleUserPause}
            onOpenSettings={onOpenSettings}
            formations={formationPresets}
            formation={displayedFormation}
            onSelectFormation={selectFormation}
            mentality={displayedMentality}
            onSelectMentality={selectMentality}
            coachingDisabled={coachingDisabled}
            substitutionsRemaining={substitutionsRemaining}
            tiredPlayers={railTiredPlayers}
            swapDisabled={swapDisabled}
            guideSwap={guideSwapButton}
            guideSwapAnchorRef={swapGuideTargetRef}
            onGuideSwapLayout={scheduleSwapGuideMeasurement}
            onSwap={openSwap}
            teamEnergy={teamEnergy}
            tiredCount={tiredCount}
            energyUse={displayedEnergyUse}
            onSelectEnergyUse={selectEnergyUse}
            heroTiles={railHeroTiles}
            powerTakeover={powerTakeover}
          />
        ) : null}
        <View style={railLayout ? styles.desktopPitchPane : null}>
          <View style={pitchFrameStyle}>
            {graphicsStatus === 'failed' ||
            graphicsStatus === 'finishing' ? null : (
              <RecoverableSkiaCanvas
                key={graphicsGeneration}
                generation={graphicsGeneration}
                onContextLost={handleGraphicsContextLost}
                onContextReady={handleGraphicsContextReady}
                style={canvasStyle}
              >
                {/* Pitch base = pixel-bible pitch-dark (#3f8a4a); Pitch.tsx paints the
                  brighter base #5cb85c on alternating mow bands over it. Kept
                  OUTSIDE the camera group so a punched-in frame still has a
                  backdrop everywhere. */}
                <Fill color="#3f8a4a" />
                {/* The one match camera. Idle it is identity, and the derived
                  transform only re-evaluates when the RAF loop pushes an
                  activation beat. The zoom is an integer step and the translate
                  is whole device pixels (see interpolate.ts), so wrapping the
                  contents here cannot knock the sprites off the pixel grid. */}
                <Group transform={cameraTransform}>
                  <Pitch scale={scale} devicePixelRatio={devicePixelRatio} />
                  {/* Web Trap is simulation geometry, so keep its fixed trigger circle
                    visible after the caster moves. Rival traps use the threat palette. */}
                  {activeWebTraps.map((trap) => (
                    <Circle
                      key={trap.key}
                      cx={trap.x * scale}
                      cy={trap.y * scale}
                      r={WEB_TRAP_TRIGGER_RANGE * scale}
                      color={trap.color}
                      style="stroke"
                      strokeWidth={3}
                      opacity={reduceMotion || hud.tick % 20 < 10 ? 0.88 : 0.55}
                    />
                  ))}
                  {trailRef.current.map((t, i) => (
                    <Circle
                      key={i}
                      cx={t.x * scale}
                      cy={t.y * scale}
                      r={Math.max(1.5, 7 - i)}
                      color="#ffffff"
                      opacity={0.55 * (1 - i / trailRef.current.length)}
                    />
                  ))}
                  {/* Fading arc history behind driven shots and every lifted kick. */}
                  {ballFlightTrailRef.current.map((t, i) => (
                    <Circle
                      key={`shot-${i}`}
                      cx={t.x * scale}
                      cy={t.y * scale - ballVisualOffset(t.z, scale)}
                      r={Math.max(1.5, 6.5 - i)}
                      color="#ffffff"
                      opacity={0.64 * (1 - i / BALL_FLIGHT_TRAIL_LEN)}
                    />
                  ))}
                  {/* Dust puff at the strike origin — a soft filled smoke body plus
                    expanding rings; both grow and fade over PUFF_TICKS. */}
                  {(() => {
                    const puff = puffRef.current;
                    if (!puff) return null;
                    const prog = (match.tick - puff.tick) / PUFF_TICKS;
                    if (prog < 0 || prog >= 1) return null;
                    const cx = puff.x * scale;
                    const cy = puff.y * scale;
                    return [
                      <Circle
                        key="puff-body"
                        cx={cx}
                        cy={cy}
                        r={9 + prog * 20}
                        color="#f4f1ea"
                        opacity={Math.max(0, (1 - prog) * 0.6)}
                      />,
                      ...Array.from({ length: PUFF_RINGS }, (_, k) => (
                        <Circle
                          key={`puff-${k}`}
                          cx={cx}
                          cy={cy}
                          r={11 + prog * 28 + k * 6}
                          color="#d9d5cf"
                          style="stroke"
                          strokeWidth={2.5}
                          opacity={Math.max(0, (1 - prog) * (0.62 - k * 0.16))}
                        />
                      )),
                    ];
                  })()}
                  {/* Super Strength impact — a bright core plus an expanding shockwave
                    ring where the charge lands, fading over IMPACT_TICKS. */}
                  {(() => {
                    const im = impactRef.current;
                    if (!im) return null;
                    const prog = (match.tick - im.tick) / IMPACT_TICKS;
                    if (prog < 0 || prog >= 1) return null;
                    const cx = im.x * scale;
                    const cy = im.y * scale;
                    const fade = 1 - prog;
                    return [
                      <Circle
                        key="impact-core"
                        cx={cx}
                        cy={cy}
                        r={6 + prog * 22}
                        color="#f7d894"
                        opacity={fade * 0.5}
                      />,
                      <Circle
                        key="impact-ring"
                        cx={cx}
                        cy={cy}
                        r={9 + prog * 34}
                        color="#edb54a"
                        style="stroke"
                        strokeWidth={3}
                        opacity={fade * 0.7}
                      />,
                    ];
                  })()}
                  <WorkletBallShadow
                    ballGroundPosition={workletBallGroundPosition}
                    ballHeight={workletBallHeight}
                    scale={scale}
                  />
                  <Atlas
                    image={atlas.image as SkImage}
                    sprites={sprites}
                    transforms={workletTransforms}
                    colors={colors}
                    colorBlendMode="modulate"
                    sampling={PIXEL_ART_SAMPLING}
                  />
                  <WorkletSlideTackleEffects
                    layer="dust"
                    visualPositions={workletVisualPositions}
                    actionData={workletActionData}
                    visualTick={workletVisualTick}
                    scale={scale}
                    playerDrawScale={playerSpriteScale.drawScale}
                    devicePixelRatio={devicePixelRatio}
                    reduceMotion={reduceMotion}
                    reducedEffects={reducedEffects}
                  />
                  <WorkletSlideTackleEffects
                    layer="grass"
                    visualPositions={workletVisualPositions}
                    actionData={workletActionData}
                    visualTick={workletVisualTick}
                    scale={scale}
                    playerDrawScale={playerSpriteScale.drawScale}
                    devicePixelRatio={devicePixelRatio}
                    reduceMotion={reduceMotion}
                    reducedEffects={reducedEffects}
                  />
                  <ProceduralMatchEffects
                    emitters={matchVfxRef.current}
                    visualTick={hud.visualTick}
                    scale={scale}
                    playerDrawScale={playerSpriteScale.drawScale}
                    devicePixelRatio={devicePixelRatio}
                    reduceMotion={reduceMotion}
                    reducedEffects={reducedEffects}
                  />
                  {presentedPowerEffects.map((effect) => (
                    <PowerEffectScene
                      key={effect.id}
                      power={effect.power}
                      elapsedMs={effect.elapsedMs}
                      width={pitchWidth}
                      height={pitchH}
                      origin={effect.origin}
                      targets={effect.targets}
                      anchor={effect.anchor}
                      tier={effect.tier}
                      direction={effect.direction}
                      reduceMotion={reduceMotion}
                      showPlaceholderActors={false}
                    />
                  ))}
                  {powerEffectActors.length > 0 ? (
                    <Atlas
                      image={atlas.image as SkImage}
                      sprites={powerActorSprites}
                      transforms={powerActorTransforms}
                      colors={powerActorColors}
                      colorBlendMode="modulate"
                      sampling={PIXEL_ART_SAMPLING}
                    />
                  ) : null}
                  <WorkletMatchOverlays
                    visualPositions={workletVisualPositions}
                    visibility={workletVisibility}
                    statuses={workletStatuses}
                    zoneFractions={workletZoneFractions}
                    carrier={workletCarrier}
                    visualTick={workletVisualTick}
                    controlledTeam={controlledTeam}
                    heroPlayers={rivalHeroPlayers}
                    fireTorchMask={fireTorchMask}
                    encoreMarkers={encoreMarkers}
                    scale={scale}
                    ringRadius={ringR}
                    reduceMotion={reduceMotion}
                    hiddenPlayer={-1}
                  />
                  {/* Radial burst off the hero for the speed powers. Batched into
                    one hard-edged path; idle when its slot is -1. */}
                  <WorkletSpeedLines
                    slot={speedLineSlot}
                    life={speedLineLife}
                    visualPositions={workletVisualPositions}
                    scale={scale}
                    ringRadius={ringR}
                    hiddenPlayer={-1}
                  />
                </Group>
                {/* White-out for the speed powers, over the camera so a punched-in
                  frame flashes evenly. Peaks well short of a full white screen
                  and is gone inside ~0.16s. */}
                <Rect
                  x={0}
                  y={0}
                  width={pitchWidth}
                  height={pitchH}
                  color="#ffffff"
                  opacity={activationFlash}
                />
              </RecoverableSkiaCanvas>
            )}
            {carrier ? (
              <View
                pointerEvents="none"
                style={[
                  styles.carrierCard,
                  hudSide === 'left'
                    ? styles.carrierCardLeft
                    : styles.carrierCardRight,
                  // The panel wears the carrier's kit, so which team has the
                  // ball reads at a glance without looking back at the pitch.
                  {
                    backgroundColor: teamKitColor(carrier.team, colorSafeKits),
                  },
                ]}
              >
                <View style={styles.carrierLine}>
                  <Text numberOfLines={1} style={styles.carrierName}>
                    {carrier.def.name}
                  </Text>
                  <Text style={styles.carrierEnergy}>
                    {Math.round(carrier.condition)}%
                  </Text>
                </View>
                <View style={styles.energyTrack}>
                  <View
                    style={[
                      styles.energyFill,
                      energyBand(carrier.condition) === 'amber'
                        ? styles.energyFillMedium
                        : null,
                      energyBand(carrier.condition) === 'red'
                        ? styles.energyFillLow
                        : null,
                      {
                        width: `${Math.max(0, Math.min(100, carrier.condition))}%`,
                      },
                    ]}
                  />
                </View>
                {/* Heroes only — an ordinary player has no Heat to read. */}
                {carrier.def.power ? (
                  <HeroChargeMeter
                    meter={chargeMeter(carrier.gauge, carrier.powerState)}
                    trackWidth={CARRIER_CARD_CONTENT_WIDTH}
                    reduceMotion={reduceMotion}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </View>
      {hud.banners.length > 0 ? (
        <View
          pointerEvents="none"
          style={[
            styles.bannerStack,
            // Only `left` was being moved for the rail, so the stack still
            // reached the window's right edge and banners ran off the pitch.
            railLayout
              ? { left: desktopPitchLeft, right: undefined, width: pitchWidth }
              : null,
          ]}
        >
          {hud.banners.map((banner) => (
            <Text
              key={banner.id}
              style={[
                styles.banner,
                banner.tone === 'red' ? styles.bannerThreat : null,
                banner.tone === 'blue' ? styles.bannerAction : null,
              ]}
            >
              {banner.text}
            </Text>
          ))}
        </View>
      ) : null}
      {performanceNotice ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('matchScreen.performance.dismiss')}
          onPress={() => setPerformanceNotice(false)}
          style={styles.performanceNotice}
        >
          <Text style={styles.performanceNoticeText}>
            {t('matchScreen.performance.limited')}
          </Text>
          <Text style={styles.performanceNoticeDismiss}>×</Text>
        </Pressable>
      ) : null}
      {/* Desktop moves every dock control into the left rail. */}
      {presentationOnly ? null : railLayout ? null : powerTakeover !==
        undefined ? (
        <View
          style={[
            styles.coachingDock,
            compactHeight ? styles.coachingDockCompact : null,
          ]}
        >
          <PowerTitleTakeover
            {...powerTakeover}
            layout="mobile"
            compact={compactHeight}
          />
        </View>
      ) : (
        <View
          style={[
            styles.coachingDock,
            compactHeight ? styles.coachingDockCompact : null,
          ]}
        >
          <View style={styles.coachBar}>
            <Pressable
              immediatePress
              pressSfx="match-control"
              accessibilityRole="button"
              accessibilityLabel={t('matchScreen.a11y.formation', {
                formation: displayedFormation,
              })}
              accessibilityState={{ disabled: coachingDisabled }}
              disabled={coachingDisabled}
              style={[
                styles.coachButton,
                compactHeight ? styles.coachButtonCompact : null,
                coachingDisabled ? styles.coachButtonDisabled : null,
              ]}
              onPress={() => {
                selectFormation(
                  nextFormation(displayedFormation, formationPresets),
                );
              }}
            >
              <FormationDiagram
                formation={displayedFormation}
                compact
                inverted
              />
              <View style={styles.coachCopy}>
                <Text style={styles.coachLabel}>
                  {t('matchScreen.formation')}
                </Text>
                <Text style={styles.coachValue}>{displayedFormation}</Text>
              </View>
            </Pressable>
            <Pressable
              immediatePress
              pressSfx="match-control"
              accessibilityRole="button"
              accessibilityLabel={t('matchScreen.a11y.playstyle', {
                playstyle: mentalityLabel(displayedMentality, t),
              })}
              accessibilityState={{ disabled: coachingDisabled }}
              disabled={coachingDisabled}
              style={[
                styles.coachButton,
                compactHeight ? styles.coachButtonCompact : null,
                coachingDisabled ? styles.coachButtonDisabled : null,
              ]}
              onPress={() => {
                selectMentality(nextMentality(displayedMentality));
              }}
            >
              <Text style={styles.mentalityIcon}>
                {displayedMentality === 'ATTACK'
                  ? '▲'
                  : displayedMentality === 'PROTECT'
                    ? '▼'
                    : '◆'}
              </Text>
              <View style={styles.coachCopy}>
                <Text style={styles.coachLabel}>
                  {t('matchScreen.playstyle')}
                </Text>
                <Text style={styles.coachValue}>
                  {mentalityLabel(displayedMentality, t)}
                </Text>
              </View>
            </Pressable>
            <Pressable
              immediatePress
              pressSfx="match-control"
              ref={swapGuideTargetRef}
              collapsable={false}
              onLayout={
                guideSwapButton ? scheduleSwapGuideMeasurement : undefined
              }
              accessibilityRole="button"
              accessibilityLabel={t('matchScreen.a11y.swapPlayers', {
                tired:
                  tiredCount === 0
                    ? t('matchScreen.a11y.noTiredPlayers')
                    : t('matchScreen.a11y.tiredPlayers', { count: tiredCount }),
                substitutions: substitutionsRemaining,
              })}
              accessibilityHint={
                guideSwapButton ? t('matchScreen.a11y.swapHint') : undefined
              }
              accessibilityState={{ disabled: swapDisabled }}
              disabled={swapDisabled}
              style={[
                styles.coachButton,
                compactHeight ? styles.coachButtonCompact : null,
                swapDisabled
                  ? tiredCount > 0
                    ? styles.coachButtonDisabledReadable
                    : styles.coachButtonDisabled
                  : null,
                guideSwapButton ? styles.coachButtonGuided : null,
              ]}
              onPress={() => {
                openSwap();
              }}
            >
              {guideSwapButton ? (
                <View
                  pointerEvents="none"
                  style={styles.coachButtonGuidedHighlight}
                />
              ) : null}
              <Text
                style={[
                  styles.swapIcon,
                  guideSwapButton ? styles.swapIconGuided : null,
                ]}
              >
                ⇄
              </Text>
              <View style={styles.coachCopy}>
                <Text
                  style={[
                    styles.coachLabel,
                    guideSwapButton ? styles.coachLabelGuided : null,
                  ]}
                >
                  {t('matchScreen.swap')}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.coachValue,
                    tiredCount > 0 ? styles.tiredValue : null,
                    guideSwapButton ? styles.coachValueGuided : null,
                  ]}
                >
                  {swapSecondary}
                </Text>
              </View>
            </Pressable>
          </View>
          <View
            style={[
              styles.energyUseRow,
              compactHeight ? styles.energyUseRowCompact : null,
            ]}
          >
            <View style={styles.energyUseHeader}>
              <Text style={styles.energyUseTitle}>
                {t('matchScreen.energyUse')}
              </Text>
              <Text
                style={[
                  styles.teamEnergy,
                  teamEnergyBand === 'amber' ? styles.energyTextMedium : null,
                  teamEnergyBand === 'red' ? styles.energyTextLow : null,
                ]}
              >
                {t('matchScreen.teamEnergy', { percent: teamEnergy })}
              </Text>
            </View>
            <View style={styles.energySegments}>
              {ENERGY_USE_MODES.map((mode) => {
                const selected = displayedEnergyUse === mode;
                return (
                  <Pressable
                    immediatePress
                    pressSfx="match-control"
                    key={mode}
                    accessibilityRole="button"
                    accessibilityLabel={`${energyUseLabel(mode, t)}. ${energyUseAccessibility(mode, t)}`}
                    accessibilityState={{
                      selected,
                      disabled: coachingDisabled,
                    }}
                    disabled={coachingDisabled}
                    style={[
                      styles.energySegment,
                      narrowWidth ? styles.energySegmentNarrow : null,
                      selected ? styles.energySegmentSelected : null,
                      selected && mode === 'SAVE_ENERGY'
                        ? styles.energySegmentSave
                        : null,
                      selected && mode === 'BALANCED'
                        ? styles.energySegmentBalanced
                        : null,
                      selected && mode === 'ALL_OUT'
                        ? styles.energySegmentAllOut
                        : null,
                      coachingDisabled ? styles.coachButtonDisabled : null,
                    ]}
                    onPress={() => {
                      selectEnergyUse(mode);
                    }}
                  >
                    <Text
                      style={[
                        styles.energySegmentText,
                        selected ? styles.energySegmentTextSelected : null,
                      ]}
                    >
                      {energyUseLabel(mode, t)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      )}
      {guideSwapButton && swapGuideAnchor !== null ? (
        <>
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.firstMatchGuideOverlay]}
          >
            <TutorialSpotlight
              anchor={swapGuideAnchor}
              viewportWidth={width}
              viewportHeight={height}
            />
          </View>
          <TutorialTapCue
            label={
              railLayout ? t('matchScreen.clickHere') : t('matchScreen.tapHere')
            }
            detail={t('matchScreen.swapPlayers')}
            style={tutorialCuePositionAbove(swapGuideAnchor, width, height)}
          />
        </>
      ) : null}
      {swapOpen ? (
        <SubstitutionBoard
          field={substitutionBoardField}
          bench={substitutionBoardBench}
          substitutionsUsed={substitutionsUsed}
          autoSubs={autoSubs}
          guideFieldPlayer={
            firstMatchTutorialStep === 'tired-player-cue'
              ? (firstMatchTiredPlayerRef.current ?? undefined)
              : undefined
          }
          onGuideFieldPlayerAction={finishTiredPlayerTutorial}
          onCancel={closeSwap}
          onSave={commitSubstitutions}
        />
      ) : null}
      {firstMatchTutorialStep === 'tired-modal' ? (
        <FirstMatchCoachingModal
          title={
            tutorialTiredStarter === null
              ? t('matchScreen.onePlayerIsVeryTired')
              : t('matchScreen.playerIsVeryTired', {
                  player: tutorialTiredStarter.def.name,
                })
          }
          body={t('matchScreen.swapInAFreshPlayer')}
          buttonLabel={t('matchScreen.showMe')}
          player={
            tutorialTiredStarter === null
              ? undefined
              : {
                  id: tutorialTiredStarter.def.id,
                  name: tutorialTiredStarter.def.name,
                  role: tutorialTiredStarter.def.role,
                  lookId: tutorialTiredStarter.def.lookId,
                  energyPercent: Math.round(tutorialTiredStarter.condition),
                }
          }
          reduceMotion={reduceMotion}
          onContinue={continueTiredPlayerTutorial}
        />
      ) : null}
      {/* Last child, so the cup card covers the whole match screen. */}
      {titleCard !== null && titleCardShowing ? (
        <CupTitleCard card={titleCard} onDone={dismissTitleCard} />
      ) : null}
      {graphicsStatus !== 'ok' ? (
        <View accessibilityViewIsModal style={styles.graphicsRecoveryOverlay}>
          <View style={styles.graphicsRecoveryCard}>
            <Text style={styles.graphicsRecoveryTitle}>
              {graphicsStatus === 'restarting'
                ? t('graphics.restarting')
                : graphicsStatus === 'finishing'
                  ? t('graphics.finishingMatch')
                  : t('graphics.pitchStopped')}
            </Text>
            {graphicsStatus === 'failed' ? (
              <>
                <Text style={styles.graphicsRecoveryDetail}>
                  {presentationOnly
                    ? t('graphics.showcaseDetail')
                    : t('graphics.matchDetail')}
                </Text>
                <View style={styles.graphicsRecoveryButtons}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={reloadAfterGraphicsFailure}
                    style={styles.graphicsRecoveryButton}
                  >
                    <Text style={styles.graphicsRecoveryButtonText}>
                      {t('graphics.reload')}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={finishAfterGraphicsFailure}
                    style={styles.graphicsRecoveryButtonPrimary}
                  >
                    <Text style={styles.graphicsRecoveryButtonText}>
                      {presentationOnly
                        ? t('graphics.returnToAwakening')
                        : t('graphics.finishMatch')}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}
