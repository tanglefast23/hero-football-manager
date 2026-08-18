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
import Animated, {
  Easing as ReanimatedEasing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { createMatch, MAX_SUBSTITUTIONS, queueInput, tick } from '../sim/match';
import { queueControlledAutoSubstitution } from '../game/match-policy';
import { goalsFrom } from '../game/matchday';
import { isRivalHeroIntroHeroId } from '../game/rival-hero-intro';
import { SLIDE_SUCCESS_RECOVERY_TICKS } from '../sim/engine';
import { isActive, WEB_TRAP_TRIGGER_RANGE } from '../sim/powers';
import { ROVERS, UNITED } from '../sim/teams';
import {
  PITCH_H,
  TICK_MS,
  HALF_TICKS,
  dist2,
  shotOnTarget,
} from '../sim/geometry';
import type {
  MatchEvent,
  MatchInput,
  MatchState,
  PlayerDef,
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
  ballIsBehindAPlayer,
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
import { zoneReadyTint } from './zone-ready-look';
import {
  matchPlaybackRate,
  nextMatchSpeed,
  type MatchSpeed,
} from './match-speed';
import {
  ENCORE_MARKER_TICKS,
  type EncoreMarker,
  POSSESSION_RING_DROP_PX,
  WorkletBallFlame,
  WorkletBallShadow,
  WorkletBallXray,
  WorkletMatchOverlays,
  WorkletPossessionRing,
  WorkletSlideTackleEffects,
  WorkletSpeedLines,
} from './WorkletMatchOverlays';
import { ProceduralMatchEffects } from './ProceduralMatchEffects';
import {
  appendMatchVfxEmitter,
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
  shotBurstIntensity,
  shotDanger,
  shotTier,
  type ShotTier,
} from './shot-danger';
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
  MATCH_TIME_WARP_ZOOM,
  matchTimeWarpExpired,
  matchTimeWarpScale,
} from './match-time-warp';
import {
  ShotPowerPop,
  type ShotPowerPopSubject,
} from './ShotPowerPop';
import { SHOT_POWER_POP_MS, shotPowerBand } from './shot-power-pop';
import {
  PassComboPop,
  type PassComboPopSubject,
} from './PassComboPop';
import {
  PASS_COMBO_FLOOR,
  PASS_COMBO_IDLE,
  PASS_COMBO_POP_MS,
  passComboAfter,
  type PassComboChain,
} from './pass-combo';
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
import { FormationRoleLabels } from './FormationRoleLabels';
import { IncapacityCountdowns } from './IncapacityCountdowns';
import { SubstitutionWalkers } from './SubstitutionWalkers';
import {
  WALKER_SLOTS,
  WALKER_STRIDE,
  distanceBetween,
  hiddenSlots,
  packWalks,
  walkDurationTicks,
  walkEndpoints,
  walkIsActive,
  walkRunFrame,
  type SubstitutionWalk,
} from './substitution-walk';
import {
  applyRoleLabelEvent,
  CLOSED_ROLE_LABEL_WINDOW,
  roleLabelsVisible,
} from './formation-role-labels';
import { incapacityCountdowns } from './incapacity-countdown';
import {
  appendBannerNewestFour,
  goalBannerPresentation,
  type MatchBannerSubject,
} from './match-banners';
import { MatchTickerLine } from './MatchTickerLine';
import { tickerLane } from './match-ticker';
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
  MATCH_VFX_SHOWCASE_SHOT_FREEZE_TICKS,
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
import { ConfirmationSheet } from '../ui/components/ConfirmationSheet';
import { MotivationalSpeechCutscene } from './MotivationalSpeechCutscene';
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
import { matchKitPaletteOverride, teamKitColor } from './team-kit-ui';
import {
  CARRIER_CARD_CONTENT_WIDTH,
  CARRIER_CARD_DESKTOP_CONTENT_WIDTH,
  CARRIER_CHARGE_DESKTOP_HEIGHT,
  CARRIER_CHARGE_HEIGHT,
  useMatchScreenStyles,
} from './match-screen-styles';
import { useCopy } from '../i18n';
import {
  type MatchAudioProfile,
  initAudio,
  playBallFlightWhoosh,
  playPassCombo,
  playForEvent,
  playShotTierAudio,
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

// Goal impact shake (render-only). The whole screen takes one short knock,
// on the same decaying curve as the Super Strength camera shake. The scorer's
// line used to take a second, harder knock on top of it — that was a jolt for
// a card, and the event lines have no card any more. Jolting type that is
// mid-crossing reads as dropped frames, so only the screen shakes now.
const GOAL_SHAKE_MS = 380;

// Ball-flight presentation (render-only) — lifted kicks show a curved history;
// shots also retain the dust puff kicked up at the strike.
const BALL_FLIGHT_TRAIL_LEN = 12; // longer arc history makes lifted kicks read at a glance
/** Drawn trail length per shot tier. Tier 0 keeps the length it always had. */
const BALL_TRAIL_LEN_BY_TIER = [8, 10, 12] as const;
/** Trail colour per shot tier. Tier 2 uses the reserved flame accent. */
const BALL_TRAIL_COLOR_BY_TIER = ['#ffffff', '#edb54a', '#ff6a00'] as const;
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
// Sprite centre -> the boots, in sprite SOURCE pixels. Shared with the carrier
// ring so a dribbled ball sits inside the ring rather than above it. A caught
// ball is exempt: the keeper holds it at chest height, so `height < 1` in the
// transform buffer keeps it on his centre.
const BALL_FOOT_DROP_SOURCE_PX = POSSESSION_RING_DROP_PX;
const BALL_FOOT_DEADZONE_PX = 0.5; // tick-to-tick screen-px delta below this reads as "stationary"

// Side of the plain white square drawn when the sprite pack fails to build
// (matches the player cell width so the placeholder keeps sane proportions).
const FALLBACK_SPRITE = 24;

// Rival readiness remains visible counterplay. Controlled-team powers activate
// automatically and announce themselves only when they actually fire.
const RIVAL_ZONE_BANNER_TICKS = 20;
type MatchBanner = {
  id: string;
  text: string;
  untilTick: number;
  tone: 'gold' | 'red' | 'blue';
  /** Which ticker row it runs on. Stamped by the push helpers below. */
  lane: number;
  /** Crossing length, in sim ticks. Stamped at creation and never re-derived:
   * `setHud` copies the banner list every published tick, so a life computed
   * from the live tick would restart the crossing ten times a second. */
  lifeTicks: number;
  /** Wall-clock crossing length, overriding `lifeTicks`. Full time only. */
  durationMs?: number;
  /** A footnote to the line above it — currently the power behind a goal. */
  size?: 'small';
  /** Set for the three coaching controls so a tap and the sim's confirming
   * event share one line instead of stacking two identical ones. */
  subject?: MatchBannerSubject;
};

/** What a caller supplies; the helpers below stamp the rest. */
type NewMatchBanner = Omit<MatchBanner, 'lane' | 'lifeTicks'> & {
  lifeTicks?: number;
};

/**
 * Appends an event line and stamps the ticker row it runs on.
 *
 * Module scope on purpose: the RAF loop below would otherwise close over a
 * component-scope helper and could hold a stale one. `lane` being required on
 * `MatchBanner` is what makes these the only way in — any site still calling
 * `appendNewestFour` on the banner list fails to compile.
 */
function pushMatchBanner(
  banners: readonly MatchBanner[],
  banner: NewMatchBanner,
): MatchBanner[] {
  return appendNewestFour(banners, {
    lifeTicks: FLASH_TICKS,
    ...banner,
    lane: tickerLane(banners, undefined),
  });
}

/** The same, for the three coaching controls that replace their own line. */
function pushSubjectedMatchBanner(
  banners: readonly MatchBanner[],
  banner: NewMatchBanner & { subject: MatchBannerSubject },
): MatchBanner[] {
  return appendBannerNewestFour(banners, {
    lifeTicks: FLASH_TICKS,
    ...banner,
    lane: tickerLane(banners, banner.subject),
  });
}

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
  formationOptions,
  reduceMotion = false,
  hudSide = 'left',
  cutInMode = 'full',
  seenPowerCutIns = [],
  onPowerCutInSeen,
  highContrast = false,
  colorSafeKits = true,
  pausedExternally = false,
  firstMatchTutorial = false,
  motivationalSpeech,
  autoSubs: initialAutoSubs = false,
  onAutoSubsChange,
  onFormationChange,
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
  /**
   * Every shape the manager may switch to live. Slot 0 of the presets above
   * still decides the shape the match OPENS on; this list only decides what
   * the coaching controls offer once it is running. They are separate on
   * purpose: the matchday picker writes the opening shape into slot 0, while a
   * coach unlock widens the live choice without touching it. Defaults to the
   * three presets, which is what every caller got before the list existed.
   */
  formationOptions?: readonly FormationId[];
  reduceMotion?: boolean;
  hudSide?: HudSide;
  cutInMode?: 'full' | 'banner';
  seenPowerCutIns?: readonly PowerId[];
  onPowerCutInSeen?: (power: PowerId) => void;
  highContrast?: boolean;
  colorSafeKits?: boolean;
  pausedExternally?: boolean;
  firstMatchTutorial?: boolean;
  /**
   * Set only when the head coach is holding a speech for this match. Half time
   * then stops play and asks whether to spend it; `boost` is what each stored
   * attribute gains for the second half. The bank itself is emptied by the
   * settled match, from the recorded input log — this screen only records the
   * decision.
   */
  motivationalSpeech?: {
    readonly boost: number;
    readonly coachName: string;
    readonly coachPortraitId: string;
  };
  /** Bench cover as the manager last left it, so it survives the final whistle. */
  autoSubs?: boolean;
  /** Fires only when the substitution board saves a different setting. */
  onAutoSubsChange?: (autoSubs: boolean) => void;
  /** Remembers a live selection as the opening shape for the next match. */
  onFormationChange?: (formation: FormationId) => void;
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

  // Frozen for the life of the match. `onFormationChange` moves the picked
  // formation into slot 0 so the NEXT match opens on it — which, read live,
  // reordered the chip row under the manager's finger: tapping the middle chip
  // swapped its label with the first, so a second tap in the same place undid
  // the first and the white border never appeared to leave 4-4-2.
  const presetsRef = useRef(formationPresets);
  const livePresets = presetsRef.current;
  // Frozen for the same reason, and never empty: an empty list would leave the
  // rail with no chip to tap and `nextFormation` with nothing to cycle to.
  const optionsRef = useRef<readonly FormationId[]>(
    formationOptions === undefined || formationOptions.length === 0
      ? formationPresets
      : formationOptions,
  );
  const liveFormationOptions = optionsRef.current;
  // Ledger item 1 — lazy init: never `useRef(createMatch(...))`, whose
  // argument expression would run (creating and discarding a fresh match)
  // on every render. Guard-then-assign only ever creates one match per mount.
  const stateRef = useRef<MatchState | null>(null);
  if (stateRef.current === null) {
    stateRef.current = createMatch(
      seed,
      home,
      away,
      matchPoliciesForControlledTeam(controlledTeam, livePresets[0]),
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
  // Elapsed ms into the goal shake. Parked at the duration, which the shake
  // curve reads as "finished" and returns a zero offset for.
  const goalShakeElapsed = useSharedValue(GOAL_SHAKE_MS);
  const goalShakeStyle = useAnimatedStyle(() => {
    const offset = matchShakeOffset(
      goalShakeElapsed.value,
      GOAL_SHAKE_MS,
      MATCH_SHAKE_AMPLITUDE_PT,
    );
    return {
      transform: [{ translateX: offset.x }, { translateY: offset.y }],
    };
  });
  // Ball-flight presentation — recent positions while a shot or lifted pass
  // flies. The old puff remains for ordinary shots and Decoy Pop only; graded
  // shots now use the shared procedural match-VFX layer.
  const ballFlightTrailRef = useRef<Array<{ x: number; y: number; z: number }>>(
    [],
  );
  // Shot tier of the ball currently in flight, stamped once at launch. Held on
  // the JS thread for the trail colour; mirrored into `scorchingShot` for the
  // UI thread. Never recomputed mid-flight, so a Resolve drop or a keeper
  // substitution cannot make a burning ball flicker.
  const shotTierRef = useRef<ShotTier>(0);
  const shotDangerAtLaunchRef = useRef<number | null>(null);
  const shotInFlightRef = useRef(false);
  // Age of the tier-2 shot time warp in ms, or null when play runs at its
  // ordinary rate. Accumulated from the frame gap rather than stamped as a
  // wall-clock start: a pause, a half-time speech or an app backgrounding must
  // not burn the warp down while the pitch is not moving. See match-time-warp.ts.
  const timeWarpElapsedRef = useRef<number | null>(null);
  /** The live warp's rate multiplier, or 1. Stable, so callbacks can hold it. */
  const timeWarpScaleNow = useCallback(() => {
    const elapsed = timeWarpElapsedRef.current;
    return elapsed === null ? 1 : matchTimeWarpScale(elapsed);
  }, []);
  // The power number over the shooter's head. React state because the colour
  // band and the glyph both change only once per shot; the animation itself
  // rides `shotPowerPopLife` on the UI thread. Parked at the end of its window
  // so a fresh mount draws nothing, the same trick `goalShakeElapsed` uses.
  const [shotPowerPop, setShotPowerPop] = useState<ShotPowerPopSubject | null>(
    null,
  );
  const shotPowerPopLife = useSharedValue(SHOT_POWER_POP_MS);
  // The live pass chain, and the counter drawn over its latest receiver. The
  // chain is a ref because only the pop it produces is rendered; parked life,
  // same trick as the shot number above.
  const passComboChainRef = useRef<PassComboChain>(PASS_COMBO_IDLE);
  /** Slot the ball in flight is aimed at, or null when no pass is airborne. */
  const passInFlightRef = useRef<number | null>(null);
  const [passComboPop, setPassComboPop] = useState<PassComboPopSubject | null>(
    null,
  );
  const passComboLife = useSharedValue(PASS_COMBO_POP_MS);
  // Which number popped most recently. Both can be alive at once — a pass
  // lands, then its receiver shoots inside the counter's 620ms — and the newer
  // one has to win, so the order is recency and not a fixed nesting.
  const [newestPop, setNewestPop] = useState<'shot' | 'combo'>('shot');
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
  // The DEF/MID/FWD labels after a formation change. Held in a ref and read per
  // render against `hud.tick`, the way the banner filter beside `setHud` works:
  // nothing fires an event when the 3.5s simply elapses, so the expiry has to be
  // a tick comparison. No hud field, because the per-tick `setHud` replaces the
  // whole object rather than spreading it.
  const roleLabelWindowRef = useRef(CLOSED_ROLE_LABEL_WINDOW);
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
  // The half-time speech sheet. The ref is what the RAF loop reads, the state
  // is what React renders — the same split every other mid-match prompt uses.
  const [speechPromptOpen, setSpeechPromptOpen] = useState(false);
  const speechPromptOfferedRef = useRef(false);
  // The cutscene the confirmed sheet hands over to. The ref carries the
  // decision across the sheet's dismissal animation; the state is what renders.
  const [speechCutsceneOpen, setSpeechCutsceneOpen] = useState(false);
  const speechCutsceneWantedRef = useRef(false);
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
  // ---- Substitution walk -------------------------------------------------
  // The sim swap is instant; these two bodies act it out afterwards. The list
  // is a ref because it is written from the RAF loop, and the packed copy is
  // what the UI thread reads — a worklet cannot see a ref. Written on start and
  // end only, never per frame.
  const substitutionWalksRef = useRef<SubstitutionWalk[]>([]);
  const substitutionWalkers = useSharedValue<Float32Array>(
    () => new Float32Array(WALKER_SLOTS * WALKER_STRIDE),
  );
  const activationFlash = useSharedValue(0);
  const speedLineSlot = useSharedValue(-1);
  const speedLineLife = useSharedValue(0);
  // 1 while a tier-2 shot is in flight. Written once when the shot launches and
  // once when it ends, never per frame — the flame and the fire crackle both
  // read this one flag, so they can never disagree about when the fire stops.
  const scorchingShot = useSharedValue(0);
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
          matchKitPaletteOverride(colorSafeKits),
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
    ballDrawPosition: workletBallDrawPosition,
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
    ballFootDropSourcePx: BALL_FOOT_DROP_SOURCE_PX,
    ballFootDeadzonePx: BALL_FOOT_DEADZONE_PX,
  });

  // Single pause setter: pauses both the JS simulation clock and the UI-thread
  // interpolation. There is deliberately no render-time ref write-back; that
  // would undo an AppState pause on the next render.
  const setPausedBoth = (value: boolean) => {
    pausedRef.current = value;
    if (value) pauseAtlasFrame();
    else resumeAtlasFrame(matchPlaybackRate(speedRef.current) * timeWarpScaleNow());
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
      else resumeAtlasFrame(matchPlaybackRate(speedRef.current) * timeWarpScaleNow());
      setPaused(shouldPause);
      performanceResumeAtRef.current = performance.now() + 1000;
    },
    [pauseAtlasFrame, resumeAtlasFrame, timeWarpScaleNow],
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

    // Every player either side started the match with, bench included. A
    // substitution DESTROYS the outgoing PlayerDef — performSubstitution
    // overwrites the slot and splices the replacement off the bench — so the
    // frozen team definitions are the only place his name and look survive.
    const playerDefById = new Map<string, PlayerDef>();
    for (const team of [home, away]) {
      for (const def of team.players) playerDefById.set(def.id, def);
      for (const def of team.bench ?? []) playerDefById.set(def.id, def);
    }

    /**
     * Starts the pair of cosmetic walks for one substitution.
     *
     * `startTick` is the tick about to be PUBLISHED, never `e.t`: the loop runs
     * up to MAX_CATCHUP_TICKS ticks and only then reads the batch, so an event
     * can already be four ticks old and a short walk would open half spent.
     *
     * The substitute's own position stands in for the swap spot. He inherited
     * it from the man he replaced and has had at most those few ticks to leave
     * it, and starting the pair from one shared point is what makes the two
     * bodies read as a handover.
     */
    const startSubstitutionWalk = (s: MatchState, e: MatchEvent) => {
      if (suppressCosmeticEffects || e.kind !== 'SUBSTITUTION') return;
      const incoming = s.players[e.player];
      const outgoing = playerDefById.get(e.outPlayerId);
      if (incoming === undefined || outgoing === undefined) {
        // A look we cannot resolve is a missing decoration, not a reason to
        // take the match screen down.
        console.warn(
          'MatchScreen: no team definition for the substituted player',
          e.outPlayerId,
        );
        return;
      }
      const startTick = s.tick;
      const live = substitutionWalksRef.current;
      const pairIndex = live.filter(
        (walk) => walk.startTick === startTick && walk.direction === 'off',
      ).length;
      const from = { ...incoming.pos };
      const { exit, entry } = walkEndpoints(from, pairIndex);
      const started: SubstitutionWalk[] = [
        {
          id: `sub:${startTick}:${e.player}:off`,
          slot: e.player,
          direction: 'off',
          visualId: visualIdForMatchPlayer(
            e.player,
            outgoing.id,
            outgoing.role,
            outgoing.lookId,
          ),
          name: outgoing.name,
          from,
          to: exit,
          startTick,
          durationTicks: walkDurationTicks(
            distanceBetween(from, exit),
            outgoing.attrs.pac,
          ),
        },
      ];
      // A substitute who is already on the ball skips his walk-on entirely:
      // hiding him would leave the ball and its possession ring on bare grass.
      if (!(s.ball.kind === 'held' && s.ball.by === e.player)) {
        started.push({
          id: `sub:${startTick}:${e.player}:on`,
          slot: e.player,
          direction: 'on',
          visualId: visualIdForMatchPlayer(
            e.player,
            incoming.def.id,
            incoming.def.role,
            incoming.def.lookId,
          ),
          name: incoming.def.name,
          from: entry,
          to: from,
          startTick,
          durationTicks: walkDurationTicks(
            distanceBetween(entry, from),
            incoming.def.attrs.pac,
          ),
        });
      }
      substitutionWalksRef.current = [...live, ...started].slice(-WALKER_SLOTS);
      substitutionWalkers.value = packWalks(substitutionWalksRef.current);
    };

    // ---- Activation juice ------------------------------------------------
    // Beat sheet and timings live in power-cut-in.ts; this is only the wiring.
    // Reduce Motion opts out of every part of it — no camera move, flash,
    // lines, or body flash.

    const resetCamera = () => {
      const camera = cameraRef.current;
      if (camera.zoom === 1 && camera.x === 0 && camera.y === 0) return;
      camera.x = 0;
      camera.y = 0;
      camera.zoom = 1;
      cameraX.value = 0;
      cameraY.value = 0;
      cameraZoom.value = 1;
    };

    /**
     * Whether a live power activation is actually MOVING the camera right now.
     * Not "is juice live": startJuice fires on every POWER_FIRED, and most
     * powers carry no camera beat at all, so juice held the camera hostage for
     * its whole 560ms while writing an identity transform. That is exactly the
     * window a hero's own shot flies through.
     */
    const juiceOwnsCamera = (now: number): boolean => {
      const active = juiceRef.current;
      if (active === null) return false;
      const elapsed = now - active.startedAt;
      return (
        (active.juice.punchIn && elapsed < POWER_JUICE_PUNCH_MS) ||
        (active.juice.shake && elapsed < POWER_JUICE_SHAKE_MS)
      );
    };

    // Tear the shot time warp down. The camera only goes back to neutral when
    // no power activation owns it — an activation that started mid-flight is
    // still driving it, and must keep its own frame.
    const endTimeWarp = (now: number) => {
      if (timeWarpElapsedRef.current === null) return;
      timeWarpElapsedRef.current = null;
      if (!juiceOwnsCamera(now)) resetCamera();
    };

    const resetJuice = () => {
      juiceRef.current = null;
      speedLineSlot.value = -1;
      speedLineLife.value = 0;
      activationFlash.value = 0;
      // A juice that ends mid-flight must not flash the camera back to 1x for
      // a frame: the warp reclaims it on the very next advance anyway.
      if (timeWarpElapsedRef.current === null) resetCamera();
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

    // Camera for the shot time warp: punched in on the BALL, retargeted every
    // frame so a slowed flight cannot leave the zoomed window. A live power
    // activation outranks it — that camera is already following its hero.
    const advanceTimeWarpCamera = (now: number) => {
      if (timeWarpElapsedRef.current === null) return;
      if (juiceOwnsCamera(now)) return;
      const {
        pitchWidth: viewWidth,
        pitchH: viewHeight,
        devicePixelRatio: dpr,
        scale: pitchScale,
      } = layoutRef.current;
      const ball = nextRef.current!.ball;
      const camera = matchCameraOffset(
        ball.x * pitchScale,
        ball.y * pitchScale,
        viewWidth,
        viewHeight,
        MATCH_TIME_WARP_ZOOM,
        ZERO_SHAKE,
        dpr,
      );
      const previousCamera = cameraRef.current;
      if (
        camera.translateX === previousCamera.x &&
        camera.translateY === previousCamera.y &&
        camera.zoom === previousCamera.zoom
      )
        return;
      previousCamera.x = camera.translateX;
      previousCamera.y = camera.translateY;
      previousCamera.zoom = camera.zoom;
      cameraX.value = camera.translateX;
      cameraY.value = camera.translateY;
      cameraZoom.value = camera.zoom;
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
        // Silence the fire crackle here, not in the reconcile below — this
        // branch returns before the loop ever reaches it. A scorching shot
        // frozen mid-flight (the VFX harness does exactly that) otherwise
        // crackles for ever, because the tick loop is what clears the flag.
        if (fireLoopOnRef.current) {
          stopFireAmbience();
          fireLoopOnRef.current = false;
        }
        raf = requestAnimationFrame(loop);
        return;
      }
      const wallGap = now - last;
      // Age the warp on the same gap the accumulator uses, and only on frames
      // that actually advance play — the paused branch above returns first.
      if (timeWarpElapsedRef.current !== null) {
        timeWarpElapsedRef.current += wallGap;
        if (matchTimeWarpExpired(timeWarpElapsedRef.current)) endTimeWarp(now);
      }
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
                resumeAtlasFrame(matchPlaybackRate(2) * timeWarpScaleNow());
                setSpeed(2);
              }
            }
          }
        }
      } else if (performanceMonitorRef.current.gaps.length > 0) {
        resetFramePacingMonitor(performanceMonitorRef.current);
        performanceBadWindowsRef.current = 0;
      }
      // The shot time warp scales wall-clock time before it reaches the
      // accumulator, so the hit-stop is simply "no ticks this frame" and
      // bullet time is "fewer ticks per frame". The sim itself is untouched.
      const timeWarpScale = timeWarpScaleNow();
      const playbackRate = matchPlaybackRate(speedRef.current) * timeWarpScale;
      // Ledger item 7 — capped catch-up: never simulate more than
      // MAX_CATCHUP_TICKS in one frame, however long the JS thread stalled.
      //
      acc = Math.min(
        acc + (now - last) * playbackRate,
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
      // Publish the strike frame snapped, so the Atlas holds it instead of
      // interpolating on through a freeze that has already started.
      let freezeAtStrike = false;

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
          //
          // The first-match lesson owns the bench until it has been taught.
          // FIRST_MATCH_RED_ENERGY_THRESHOLD and AUTO_SUB_EMERGENCY_CONDITION
          // are the same 30%, so with Auto Subs on the tick that pops the
          // coaching card ALSO queues the engine's own swap — and it applied
          // the moment the board closed, whether the manager pressed Save or
          // Cancel. Standing down here keeps the taught decision the manager's;
          // Auto resumes for the rest of the match once the lesson is over.
          const lessonOwnsBench =
            firstMatchTutorial &&
            (!firstMatchPromptsSeenRef.current.tiredPlayer ||
              firstMatchTutorialStepRef.current !== null);
          queueControlledAutoSubstitution(
            s,
            autoSubsRef.current && !lessonOwnsBench,
          );
        }
        advanced = true;
        nextRef.current = snapshotFrame(s, before);
        for (const event of s.events.slice(tickEventsBefore)) {
          eventFrames.set(event, {
            before,
            after: nextRef.current,
          });
        }

        // Half time with a speech in the bank stops the catch-up loop dead,
        // rather than letting the rest of a slow frame's ticks run first. The
        // events below are handled after this loop, so without the break a
        // stalled frame would simulate seconds of the second half before the
        // question appeared — and the lift would arrive after the play it was
        // meant to change. Same publish-then-freeze order as the showcase
        // freeze directly below.
        if (
          motivationalSpeech !== undefined &&
          !speechPromptOfferedRef.current &&
          s.events
            .slice(tickEventsBefore)
            .some((event) => event.kind === 'HALF_TIME')
        ) {
          speechPromptOfferedRef.current = true;
          setSpeechPromptOpen(true);
          automaticPauseReasonsRef.current.add('halftime-speech');
          pauseAfterPublish = true;
          acc = 0;
          break;
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
        // A shot's effect lasts its whole flight, not four ticks. Freezing at
        // the shared 4 stopped the fixture five ticks short of the net, so the
        // burning ball never reached the keeper and it read as a hang.
        const freezeTicks =
          matchVfxQa?.kind === 'dangerous-shot'
            ? MATCH_VFX_SHOWCASE_SHOT_FREEZE_TICKS
            : MATCH_VFX_SHOWCASE_FREEZE_TICKS;
        if (
          (matchVfxQaEvent !== undefined &&
            s.tick >= matchVfxQaEvent.t + freezeTicks) ||
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

        // Stamp the shot tier on the tick the ball BECOMES a shot, not when the
        // SHOT event is drained below: up to MAX_CATCHUP_TICKS ticks run before
        // events are read, by which point the ball may already have landed and
        // `s.ball` would no longer be the shot we are grading.
        const ballIsShot = s.ball.kind === 'shot';
        if (ballIsShot && !shotInFlightRef.current) {
          const danger = shotDanger(s, s.ball);
          shotDangerAtLaunchRef.current = danger;
          shotTierRef.current = shotTier(danger);
          // Adaptive reduction drops tier 2 to the tier-1 burst, per the plan:
          // the burst and both cues still play, only the per-frame flame goes.
          // Reduce Motion is NOT checked here — it freezes the flame instead of
          // removing it, which the worklet handles itself.
          scorchingShot.value =
            shotTierRef.current === 2 && !reducedEffectsRef.current ? 1 : 0;
          // The power number, for every shot ON TARGET — a grade the sim takes
          // off `targetX` alone, stamped at launch, so it is answerable ticks
          // before SAVE/GOAL/MISS exists. Reduce Motion and adaptive reduction
          // both KEEP it: it is information, and it costs two static Paths.
          // The anchor is stamped, never followed. A goal and a miss each
          // restart the kickoff on the tick they resolve, so a number still
          // reading its shooter's slot would jump to the halfway line mid-pop.
          const shotBall = s.ball.kind === 'shot' ? s.ball : null;
          if (shotBall !== null && shotOnTarget(shotBall.targetX)) {
            // `ball.by` is the CREDITED player, not the body that struck it —
            // a Decoy clone's shot is attributed to the real forward, who may
            // be standing elsewhere. The SHOT event emitted by this same tick
            // carries the striker on `actor`, so prefer that for the anchor.
            let strikerSlot = shotBall.by;
            for (const emitted of s.events.slice(tickEventsBefore)) {
              if (emitted.kind !== 'SHOT') continue;
              strikerSlot = emitted.actor ?? emitted.by;
            }
            const shooter =
              nextRef.current!.players[strikerSlot] ??
              nextRef.current!.players[shotBall.by];
            setShotPowerPop({
              power: shotBall.power,
              band: shotPowerBand(shotBall.power),
              x: shooter.x,
              y: shooter.y,
            });
            setNewestPop('shot');
            shotPowerPopLife.value = 0;
            shotPowerPopLife.value = withTiming(SHOT_POWER_POP_MS, {
              duration: SHOT_POWER_POP_MS,
              easing: ReanimatedEasing.linear,
            });
          }
          // Hit-stop and bullet time, on the same tier-2 gate as the flame.
          // Reduce Motion opts out entirely, and so does adaptive reduction —
          // a device already dropping frames must not be handed a time warp.
          if (
            shotTierRef.current === 2 &&
            !suppressCosmeticEffects &&
            !reduceMotion &&
            !reducedEffectsRef.current &&
            timeWarpElapsedRef.current === null
          ) {
            timeWarpElapsedRef.current = 0;
            freezeAtStrike = true;
          }
        } else if (!ballIsShot && shotInFlightRef.current) {
          // One exit for every ending — goal, save, miss, restart, half time.
          // The flame and the crackle both stop here, off this one flag.
          //
          // The launch grade itself is deliberately NOT cleared: the SHOT and
          // SAVE handlers below run after the whole catch-up batch, by which
          // point a short flight has already landed. Clearing here would leave
          // them reading 0 and drawing nothing.
          scorchingShot.value = 0;
          // Goal, save, miss, restart, half time — the warp releases wherever
          // the shot ends, off the same single exit the flame uses.
          endTimeWarp(now);
        }
        shotInFlightRef.current = ballIsShot;

        // Pass chain, counted at the CATCH and never at the kick. PASS is
        // emitted the moment the ball leaves the boot, and the flight runs
        // several ticks — a launch-time counter would stand on empty grass and
        // often expire before the ball ever arrived.
        //
        // Both the breaks and the extension live here rather than in the event
        // drain below, so they apply in TICK order. One frame can catch several
        // ticks up, and a break from an earlier tick must not undo a chain that
        // legitimately continued after it.
        for (const emitted of s.events.slice(tickEventsBefore)) {
          if (
            (emitted.kind === 'PASS' && !emitted.ok) ||
            (emitted.kind === 'TACKLE' && emitted.won) ||
            emitted.kind === 'SAVE' ||
            emitted.kind === 'MISS' ||
            emitted.kind === 'GOAL' ||
            emitted.kind === 'HALF_TIME' ||
            emitted.kind === 'KICKOFF'
          )
            passComboChainRef.current = passComboAfter(
              passComboChainRef.current,
              { kind: 'break' },
            );
        }
        if (s.ball.kind === 'pass') {
          // Re-stamped every tick on purpose: a Gust redirect rewrites `to`
          // mid-flight, and the receiver that matters is the last one.
          passInFlightRef.current = s.ball.to;
        } else if (passInFlightRef.current !== null) {
          const intended = passInFlightRef.current;
          passInFlightRef.current = null;
          // Held by the man it was aimed at is the only completion. A loose
          // arrival, an interception, or a receiver knocked out between kick
          // and catch all land somewhere else, and all end the run.
          const holder = s.ball.kind === 'held' ? s.ball.by : -1;
          const team =
            holder === intended ? playerAt(s, holder)?.team : undefined;
          passComboChainRef.current = passComboAfter(
            passComboChainRef.current,
            team === undefined
              ? { kind: 'break' }
              : { kind: 'completed-pass', team },
          );
          const chain = passComboChainRef.current;
          if (team !== undefined && chain.count >= PASS_COMBO_FLOOR) {
            const receiver = nextRef.current!.players[holder];
            setPassComboPop({
              count: chain.count,
              x: receiver.x,
              y: receiver.y,
            });
            setNewestPop('combo');
            playPassCombo(chain.count);
            passComboLife.value = 0;
            passComboLife.value = withTiming(PASS_COMBO_POP_MS, {
              duration: PASS_COMBO_POP_MS,
              easing: ReanimatedEasing.linear,
            });
          }
        }

        acc -= TICK_MS;
        // Stop catching up on the tick that struck the shot. Without this a
        // frame holding several ticks would fly the ball on before the freeze
        // could bite, and the hit-stop would land late.
        if (freezeAtStrike) {
          acc = 0;
          break;
        }
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
        // Before playForEvent, never after: this sets kick-shot's playback rate
        // and adds the scorch layer, and the rate must land before it starts.
        if (e.kind === 'SHOT') playShotTierAudio(shotTierRef.current);
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
          // The tier was stamped in the tick loop above, off the ball at launch.
          // `e.power` is deliberately not consulted: it ignores the keeper, and
          // cap-free development walks it past any fixed threshold.
          if (origin !== undefined && shotTierRef.current >= 1) {
            if (puffRef.current?.owner === 'ordinary-shot')
              puffRef.current = null;
            recordMatchVfx(
              'dangerous-shot',
              e,
              shotActor,
              origin,
              direction,
              undefined,
              shotBurstIntensity(shotDangerAtLaunchRef.current),
            );
          } else if (origin !== undefined && !suppressCosmeticEffects) {
            // Ordinary shots retain the small legacy puff. A graded shot owns
            // the new burst instead, so the two treatments never stack.
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
            // Stopping a scorching shot is the payoff for showing danger before
            // the roll resolves, so the save it took gets drawn at full weight.
            recordMatchVfx(
              'save-impact',
              e,
              e.by,
              { x: eventBefore.ball.x, y: keeper.y },
              {
                x: eventBefore.ball.x - keeper.x,
                y: eventBefore.ball.y - keeper.y,
              },
              undefined,
              shotTierRef.current === 2 ? 1 : 0.6,
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
          // Resolve the stable scorer id against the full team def: a scorer
          // substituted while his shot flew is no longer in s.players.
          const teamDef = s.teams[e.team];
          const scorerName =
            [...teamDef.players, ...(teamDef.bench ?? [])].find(
              (def) => def.id === e.scoredById,
            )?.name ?? 'Unknown';
          const scoringPower = goalsFrom(s).find(
            (goal) =>
              goal.tick === e.t &&
              goal.playerId === e.scoredById &&
              goal.power !== undefined,
          )?.power;
          const presentation = goalBannerPresentation(
            scoringPower !== undefined,
            e.team,
            controlledTeam,
          );
          bannerRef.current = pushMatchBanner(bannerRef.current, {
            id: `goal:${e.t}:${e.by}`,
            // The icon below is a pictogram, not a word: it stays in the
            // source and only the sentence beside it comes from the catalog.
            text: `${presentation.icon} ${t('matchScreen.bannerGoal', { player: scorerName })}`,
            untilTick: e.t + FLASH_TICKS,
            tone: presentation.tone,
          });
          // A powered finish names the power on a smaller tile directly under
          // the goal banner. The name comes from the already-translated power
          // catalog, so this adds no new string to the i18n catalogs. It shares
          // the goal banner's tone, so a rival's powered goal stays a threat
          // rather than turning half gold. Both tiles hold for the same window;
          // three further banners inside those 3s could slice the goal tile off
          // and leave this one orphaned, which is rare enough to live with.
          if (scoringPower !== undefined) {
            const power = powerCutInPresentation(scoringPower, t);
            bannerRef.current = pushMatchBanner(bannerRef.current, {
              id: `goal-power:${e.t}:${e.by}`,
              text: `${power.glyph} ${power.name}`,
              untilTick: e.t + FLASH_TICKS,
              tone: presentation.tone,
              size: 'small',
            });
          }
          scoreFlashUntilRef.current = reduceMotion ? e.t : e.t + FLASH_TICKS;
          if (!suppressCosmeticEffects) {
            goalShakeElapsed.value = 0;
            goalShakeElapsed.value = withTiming(GOAL_SHAKE_MS, {
              duration: GOAL_SHAKE_MS,
              easing: ReanimatedEasing.linear,
            });
          }
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
            // The carrier is `state.ball.by`, which is a decoy clone (22/23)
            // whenever the clone is the one holding the ball. Clones live in
            // `s.decoyClones`, not in the 22-entry `s.players`, so only
            // `playerAt` resolves them.
            const carrier = playerAt(s, state.carrierIdx);
            if (carrier !== undefined) {
              effectOrigin = { player: state.carrierIdx };
              anchor = { ...carrier.pos };
            }
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
            bannerRef.current = pushMatchBanner(bannerRef.current, {
              id: `power:${e.t}:${e.player}:${e.power}`,
              text:
                `⚡ ${powerCutInPresentation(e.power, t).name}` +
                ` · ${firingPlayer.def.name}`,
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
          bannerRef.current = pushMatchBanner(bannerRef.current, {
            id: `half:${e.t}`,
            text: t('matchScreen.bannerHalfTime'),
            untilTick: e.t + FLASH_TICKS,
            tone: 'blue',
          });
        }
        if (e.kind === 'FULL_TIME') {
          // Sim ticks freeze at fulltime, so `s.tick <= untilTick` below
          // holds and this banner stays up for the whole end-of-match hold.
          // That hold is `FULLTIME_HOLD_MS` of wall clock and does not scale
          // with match speed, so the crossing is given the hold directly
          // rather than a tick life that would finish in 500ms at ×3.
          bannerRef.current = pushMatchBanner(bannerRef.current, {
            id: `full:${e.t}`,
            text: t('matchScreen.bannerFullTime'),
            untilTick: e.t + FLASH_TICKS,
            durationMs: FULLTIME_HOLD_MS,
            tone: 'blue',
          });
        }
        roleLabelWindowRef.current = applyRoleLabelEvent(
          roleLabelWindowRef.current,
          e,
          controlledTeam,
        );
        if (e.kind === 'FORMATION_CHANGED' && e.team === controlledTeam) {
          bannerRef.current = pushSubjectedMatchBanner(bannerRef.current, {
            id: `formation:${e.t}`,
            text: `${e.formation} · ${t(`formation.${e.formation}.blurb`).toUpperCase()}`,
            untilTick: e.t + FLASH_TICKS,
            tone: 'blue',
            subject: 'formation',
          });
        }
        if (e.kind === 'MENTALITY_CHANGED' && e.team === controlledTeam) {
          bannerRef.current = pushSubjectedMatchBanner(bannerRef.current, {
            id: `mentality:${e.t}`,
            text: `${t('matchScreen.playstyle')} · ${mentalityLabel(e.mentality, t)}`,
            untilTick: e.t + FLASH_TICKS,
            tone: 'blue',
            subject: 'mentality',
          });
        }
        if (e.kind === 'ENERGY_USE_CHANGED' && e.team === controlledTeam) {
          bannerRef.current = pushSubjectedMatchBanner(bannerRef.current, {
            id: `energy:${e.t}`,
            text: `${t('matchScreen.energyUse')} · ${energyUseLabel(e.energyUse, t)}`,
            untilTick: e.t + FLASH_TICKS,
            tone: 'blue',
            subject: 'energy',
          });
        }
        if (e.kind === 'SUBSTITUTION') {
          // Deliberately unfiltered by team: the opponent's substitutions and
          // every automatic one walk on and off too.
          startSubstitutionWalk(s, e);
        }
        if (!reduceMotion && e.kind === 'SLIDE_STARTED') {
          // A decoy clone can slide, and this batch is read after up to
          // MAX_CATCHUP_TICKS further ticks — long enough for the clone to be
          // dismissed by expiry, a restart, or an auto-substitution. The
          // TACKLE handler below guards the same lookup for the same reason.
          const slider = playerAt(s, e.by);
          if (slider !== undefined) {
            const rotation = Math.atan2(e.direction.y, e.direction.x);
            actionRef.current[e.by] = {
              kind: 'slide',
              startTick: e.t,
              origin: { ...slider.pos },
              direction: { ...e.direction },
              rotation,
              untilTick: e.untilTick + SLIDE_SUCCESS_RECOVERY_TICKS,
            };
          }
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
            bannerRef.current = pushMatchBanner(bannerRef.current, {
              id: `rival-zone:${e.t}:${e.player}`,
              text: `⚠ ${t('matchScreen.bannerRivalZone', { player: firstName })}`,
              untilTick: e.t + RIVAL_ZONE_BANNER_TICKS,
              lifeTicks: RIVAL_ZONE_BANNER_TICKS,
              tone: 'red',
            });
          }
        }
      }
      // Every frame, not every tick: the beat sheet runs on wall clock so its
      // brief camera and tint effects stay smooth at every selected match speed.
      advanceJuice(now);
      advanceTimeWarpCamera(now);
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
      // Every thing that draws flames counts: the caster while ablaze, anyone
      // they set alight (WorkletMatchOverlays draws tongues for STATUS_IGNITED
      // too), AND a scorching shot in flight — so the crackle covers every
      // flame on the pitch and nothing else.
      //
      // This must stay ONE predicate. A second start/stop pair for the ball
      // would let a landing shot silence a Fire Torch hero who is still
      // burning, because both share a single looping player.
      // `paused` is part of the predicate, not just the sim state. The harness
      // freezes the match with a scorching ball still in flight, and the tick
      // loop is what clears the flag — so without this the crackle loops for
      // ever with nothing left running to stop it.
      const fireActive =
        shotInFlightRef.current && shotTierRef.current === 2
          ? true
          : s.players.some(
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
        if (substitutionWalksRef.current.length > 0) {
          // One list, two views. The DRAW list is every live walk; the HIDE
          // list is the incoming walks alone, because the pair share a slot but
          // not a clock — a quicker substitute arrives while his predecessor is
          // still leaving, and a hide tied to that ghost would keep the man who
          // is actually playing invisible under the ball.
          const carrier = s.ball.kind === 'held' ? s.ball.by : -1;
          const live = substitutionWalksRef.current.filter(
            (walk) =>
              walkIsActive(walk, s.tick) &&
              // Checked every tick, not just at the swap: the ball can reach
              // him mid-walk, and the moment it does he has to be on his own
              // sprite again.
              !(walk.direction === 'on' && walk.slot === carrier),
          );
          if (live.length !== substitutionWalksRef.current.length) {
            substitutionWalksRef.current = live;
            substitutionWalkers.value = packWalks(live);
          }
          // Unhide and prune land on this one published frame, so no frame ever
          // draws the substitute twice or loses him altogether.
          for (const slot of hiddenSlots(live, s.tick))
            nextRef.current!.visible[slot] = false;
        }

        // Publish one immutable tick pair. Reanimated interpolates it and
        // updates all 25 Atlas transforms on the UI thread; React only receives
        // the discrete state used by HUD, chips, and event overlays.
        publishAtlasFrame(
          nextRef.current!,
          s.tick,
          playbackRate,
          actionRef.current,
          snap || pauseAfterPublish || freezeAtStrike || s.phase === 'fulltime',
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
      timeWarpElapsedRef.current = null;
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
        // Team 0 attacks y=0, so its carrier is running up-screen with the
        // ball at his boots. Only he is exempt from the face-the-ball rule.
        const carryingUpScreen = i === frame.carrier && p.team === 0;
        const webbed = (p.webbedUntilTick ?? 0) > hud.tick;
        if (webbed) {
          // Web Trap roots the whole body. Hold the authored grey standing pose
          // even if a stale pre-trap slide animation still exists in the UI ref.
          return webbedSpriteKey(
            spriteKeyForMatchPlayer(
              i,
              visualPlayerId,
              p.def.role,
              runFrameFacingBall(
                frame.players[i].y,
                frame.ball.y,
                'run0',
                carryingUpScreen,
              ),
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
            runFrameFacingBall(
              frame.players[i].y,
              frame.ball.y,
              'run0',
              carryingUpScreen,
            ),
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
            carryingUpScreen,
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
  // Ball x-ray — true while a player's body sits between the camera and the
  // ball. Recomputed per tick, which is where `frame` changes; the ball moves
  // per FRAME on the UI thread, but a body only covers or uncovers it on the
  // scale of ticks, so a tick-granular flag is honest here.
  const ballOccluded =
    !suppressCosmeticEffects &&
    ballIsBehindAPlayer(
      frame,
      playerSpriteScale.drawScale,
      ballVisualOffset(frame.ballHeight, scale) / scale,
    );

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
      // Power banked and waiting for its opportunity: a red-shifted body that
      // flashes, on top of the 10% growth the atlas transform applies. Read
      // from zoneFraction rather than the status, and ranked above 'out' and
      // the slide/recovery statuses, so being tackled cannot cancel a look
      // that is still true — the power is still loaded.
      if (frame.zoneFraction[i] > 0)
        return skColor(zoneReadyTint(hud.tick, reduceMotion, speed));
      if (st === 'out') return skColor('#6b6675'); // bible grey-dark
      if (st === 'windup') {
        return skColor(
          reduceMotion || hud.tick % 4 < 2 ? '#ffffff' : '#edb54a',
        );
      }
      if (st === 'active') return skColor('#edb54a'); // hero gold
      // 'ok' | 'zone' — a banked power is tinted above, by zoneFraction.
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
    // Ball — no tint, except the x-ray ghost that lets the body behind it show
    // through. `modulate` multiplies, so the alpha here scales the sprite's own.
    tints.push(skColor(ballOccluded ? 'rgba(255,255,255,0.7)' : '#ffffff'));
    return tints;
  }, [
    frame,
    heroTint,
    hud.tick,
    atlas,
    ballOccluded,
    colorSafeKits,
    match,
    reduceMotion,
    speed,
  ]);

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

  // The two pitch numbers, ordered newest-last so the fresher pop draws over
  // the older one when both are still alive. Keys keep each node's identity
  // across the swap, so a reorder does not remount it and rebuild its SkPath.
  const matchNumberPops = useMemo(() => {
    const shot = (
      <ShotPowerPop
        key="shot-power"
        subject={shotPowerPop}
        life={shotPowerPopLife}
        scale={scale}
        playerDrawScale={playerSpriteScale.drawScale}
        devicePixelRatio={devicePixelRatio}
        reduceMotion={reduceMotion}
      />
    );
    const combo = (
      <PassComboPop
        key="pass-combo"
        subject={passComboPop}
        life={passComboLife}
        scale={scale}
        playerDrawScale={playerSpriteScale.drawScale}
        devicePixelRatio={devicePixelRatio}
        reduceMotion={reduceMotion}
      />
    );
    return newestPop === 'shot' ? [combo, shot] : [shot, combo];
  }, [
    devicePixelRatio,
    newestPop,
    passComboLife,
    passComboPop,
    playerSpriteScale.drawScale,
    reduceMotion,
    scale,
    shotPowerPop,
    shotPowerPopLife,
  ]);

  // Seconds-until-back numbers over stricken players. Measured over 10 seeded
  // matches: at most two at once, longest hold 15s, and something to draw on
  // ~20% of ticks — so this stays a two-path draw, not a per-player node tree.
  const countdowns = useMemo(
    () =>
      incapacityCountdowns(match).filter(
        (countdown) => frame.visible[countdown.slot],
      ),
    [frame, hud.tick, match],
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

  // The draw list: every live walk, both directions. Read straight off the ref
  // the RAF loop just pruned, so it agrees with the frame published this tick.
  const drawnSubstitutionWalks = substitutionWalksRef.current.filter((walk) =>
    walkIsActive(walk, hud.tick),
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

  /**
   * Gives play back after the half-time speech, however that ended.
   *
   * ONE release path, three callers, and the third is the one that is easy to
   * miss: a confirm whose input the engine REFUSED opens no cutscene, so no
   * `onDone` ever arrives to release the pause. Without this being its own
   * idempotent function that path leaves the match paused forever.
   */
  const releaseSpeechPause = () => {
    automaticPauseReasonsRef.current.delete('halftime-speech');
    syncPauseReasons();
  };

  /**
   * Answers the half-time speech sheet.
   *
   * A `yes` records the input and flashes a banner; a `no` keeps the speech in
   * the bank for another match. The sheet is never offered twice in one match.
   *
   * On a confirm the pause is HELD — the cutscene runs over a stopped match and
   * releases it from `onDone`. The cutscene itself is opened by
   * `onAfterConfirmDismiss`, not from here, so its flash and thunder cannot
   * start behind a sheet that is still dismissing.
   */
  const answerSpeechPrompt = (spend: boolean) => {
    setSpeechPromptOpen(false);
    if (!spend || motivationalSpeech === undefined) {
      speechCutsceneWantedRef.current = false;
      releaseSpeechPause();
      return;
    }
    const recorded = recordCoachingInput({
      tick: match.tick + 1,
      kind: 'MOTIVATIONAL_SPEECH',
      boost: motivationalSpeech.boost,
    });
    // Only announce a speech the engine accepted — a banner over a refused
    // input would tell the manager the second half changed when it did not,
    // and a cutscene is a much louder version of that same lie.
    speechCutsceneWantedRef.current = recorded;
    if (!recorded) {
      releaseSpeechPause();
      return;
    }
    bannerRef.current = pushMatchBanner(bannerRef.current, {
      id: `speech:${match.tick}`,
      text: t('matchScreen.bannerMotivationalSpeech'),
      untilTick: match.tick + FLASH_TICKS,
      tone: 'blue',
    });
    setHud((current) => ({ ...current, banners: [...bannerRef.current] }));
  };

  /** Runs once the sheet has fully left the accessibility tree. */
  const openSpeechCutsceneAfterSheet = () => {
    if (!speechCutsceneWantedRef.current) return;
    speechCutsceneWantedRef.current = false;
    setSpeechCutsceneOpen(true);
  };

  const finishSpeechCutscene = () => {
    setSpeechCutsceneOpen(false);
    releaseSpeechPause();
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
    if (!pausedRef.current)
      resumeAtlasFrame(matchPlaybackRate(allowed) * timeWarpScaleNow());
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
    bannerRef.current = pushSubjectedMatchBanner(bannerRef.current, {
      id,
      text,
      untilTick: match.tick + FLASH_TICKS,
      tone: 'blue',
      subject,
    });
    setHud((current) => ({ ...current, banners: [...bannerRef.current] }));
  };
  /**
   * Records a coaching decision, or reports that the engine refused it.
   *
   * The three coaching controls are disabled from `coachingDisabled`, which is
   * computed at render time — while the engine refuses inputs the moment its
   * own state says the match is over. The RAF loop and the press handlers share
   * one thread, so a press landing in the frame between the tick that reached
   * full time and the re-render that greys the control reaches an engine that
   * has already closed. That throw used to be impossible and is now the normal
   * refusal, so it is caught here rather than taking the match screen down at
   * the final whistle — the one moment a manager is still poking at these.
   *
   * The banner is only flashed on success: announcing a change the engine
   * refused would be a lie printed over the closing match.
   */
  const recordCoachingInput = (input: MatchInput): boolean => {
    try {
      queueInput(match, input);
      return true;
    } catch (error) {
      console.warn('MatchScreen: the engine refused a coaching input', error);
      return false;
    }
  };
  // Re-picking what is already selected is not a coaching decision: it would
  // record a redundant replay input and flash a banner announcing no change.
  // Compared against the DISPLAYED value, so a second tap landing before the
  // queued input applies is caught too.
  const selectFormation = (formation: FormationId) => {
    if (formation === displayedFormation) return;
    const recorded = recordCoachingInput({
      tick: match.tick + 1,
      kind: 'SET_FORMATION',
      formation,
    });
    if (!recorded) return;
    onFormationChange?.(formation);
    pushInputBanner(
      `formation-input:${match.tick}`,
      `${formation} · ${t(`formation.${formation}.blurb`).toUpperCase()}`,
      'formation',
    );
  };
  const selectMentality = (mentality: Mentality) => {
    if (mentality === displayedMentality) return;
    const recorded = recordCoachingInput({
      tick: match.tick + 1,
      kind: 'SET_MENTALITY',
      mentality,
    });
    if (!recorded) return;
    pushInputBanner(
      `mentality-input:${match.tick}`,
      `${t('matchScreen.playstyle')} · ${mentalityLabel(mentality, t)}`,
      'mentality',
    );
  };
  const selectEnergyUse = (mode: EnergyUse) => {
    if (mode === displayedEnergyUse) return;
    const recorded = recordCoachingInput({
      tick: match.tick + 1,
      kind: 'SET_ENERGY_USE',
      energyUse: mode,
    });
    if (!recorded) return;
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
    <Animated.View
      style={[
        styles.root,
        highContrast ? styles.rootHighContrast : null,
        goalShakeStyle,
      ]}
    >
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
            formations={liveFormationOptions}
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
                  {/* Fading arc history behind driven shots and every lifted kick.
                    A graded shot lengthens and recolours these same circles —
                    no extra draw call, and the trail starts meaning something. */}
                  {(() => {
                    const tier = shotInFlightRef.current
                      ? shotTierRef.current
                      : 0;
                    const len = BALL_TRAIL_LEN_BY_TIER[tier];
                    return ballFlightTrailRef.current
                      .slice(0, len)
                      .map((t, i) => (
                        <Circle
                          key={`shot-${i}`}
                          cx={t.x * scale}
                          cy={t.y * scale - ballVisualOffset(t.z, scale)}
                          r={Math.max(1.5, 6.5 - i)}
                          color={BALL_TRAIL_COLOR_BY_TIER[tier]}
                          opacity={0.64 * (1 - i / len)}
                        />
                      ));
                  })()}
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
                  {/* Under the Atlas on purpose: the ball sprite draws on top,
                    so a scorching shot keeps its readable white core and wears
                    the fire around it. */}
                  <WorkletBallFlame
                    ballGroundPosition={workletBallGroundPosition}
                    ballHeight={workletBallHeight}
                    scorching={scorchingShot}
                    visualTick={workletVisualTick}
                    scale={scale}
                    reduceMotion={reduceMotion}
                  />
                  {/* Under the Atlas on purpose: the carrier marker lies on
                    the grass at his feet, so his sprite draws over it. */}
                  <WorkletPossessionRing
                    visualPositions={workletVisualPositions}
                    carrier={workletCarrier}
                    scale={scale}
                    spriteScale={scale * playerSpriteScale.drawScale}
                    hiddenPlayer={-1}
                  />
                  <Atlas
                    image={atlas.image as SkImage}
                    sprites={sprites}
                    transforms={workletTransforms}
                    colors={colors}
                    colorBlendMode="modulate"
                    sampling={PIXEL_ART_SAMPLING}
                  />
                  {/* On top of the Atlas on purpose: the ring has to sit over
                    the body that is hiding the ball. */}
                  <WorkletBallXray
                    ballDrawPosition={workletBallDrawPosition}
                    ballRadius={
                      (ballCell.width * scale * ballSpriteScale.drawScale) / 2
                    }
                    visible={ballOccluded}
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
                  {/* The substitution pair: one body walking off at the nearest
                    touchline, one walking on to take the place, each under its
                    own last name. Inside the camera Group like everything else
                    on the grass, so a punch-in carries them with it. */}
                  <SubstitutionWalkers
                    walkers={drawnSubstitutionWalks}
                    packed={substitutionWalkers}
                    visualPositions={workletVisualPositions}
                    visualTick={workletVisualTick}
                    atlasImage={atlas.image as SkImage}
                    rectFor={spriteRects}
                    runFrame={walkRunFrame(hud.tick, TICK_MS)}
                    playerCell={playerCell}
                    scale={scale}
                    playerDrawScale={playerSpriteScale.drawScale}
                    devicePixelRatio={devicePixelRatio}
                  />
                  <WorkletMatchOverlays
                    visualPositions={workletVisualPositions}
                    visibility={workletVisibility}
                    statuses={workletStatuses}
                    zoneFractions={workletZoneFractions}
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
                  {/* Formation roles, under the feet rather than over the head:
                    the plate clears the carrier's possession ring, and sits
                    below anything the countdown and the flame tongues use. */}
                  <FormationRoleLabels
                    firstSlot={roleLabelWindowRef.current.firstSlot}
                    packedRoles={roleLabelWindowRef.current.packedRoles}
                    visible={roleLabelsVisible(
                      roleLabelWindowRef.current,
                      hud.tick,
                    )}
                    visualPositions={workletVisualPositions}
                    visibility={workletVisibility}
                    scale={scale}
                    playerDrawScale={playerSpriteScale.drawScale}
                    devicePixelRatio={devicePixelRatio}
                  />
                  {/* Last inside the camera: a Fire Torch victim's flame tongues
                    rise well above his head, exactly where this plate sits, so
                    drawing the number earlier hid it for its whole short life. */}
                  <IncapacityCountdowns
                    countdowns={countdowns}
                    positions={frame.players}
                    scale={scale}
                    playerDrawScale={playerSpriteScale.drawScale}
                    devicePixelRatio={devicePixelRatio}
                  />
                  {/* Last of all: these numbers clear the countdown plate and
                    the Fire Torch tongues both, and the newest of the two
                    clears the other. Keyed, so reordering moves the nodes
                    instead of remounting them and rebuilding their paths. */}
                  {matchNumberPops}
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
            {hud.banners.length > 0 ? (
              <View pointerEvents="none" style={styles.bannerStack}>
                {hud.banners.map((banner) => (
                  // Keyed by subject, not id: the optimistic coaching line and
                  // the sim's confirmation of the same control carry different
                  // ids, and keying by id would remount the row a tick after
                  // every tap and snap the line back to the left touchline.
                  <MatchTickerLine
                    key={banner.subject ?? banner.id}
                    text={banner.text}
                    tone={banner.tone}
                    small={banner.size === 'small'}
                    lane={banner.lane}
                    pitchWidth={pitchWidth}
                    lifeTicks={banner.lifeTicks}
                    durationMs={banner.durationMs}
                    speed={speed}
                    // The whistle leaves `paused` true if the manager paused
                    // just before it, and the RAF loop runs on regardless
                    // (`paused && phase !== 'fulltime'`). A pause-gated
                    // crossing would hold the full-time line off-screen for
                    // the entire end-of-match hold.
                    paused={paused && match.phase !== 'fulltime'}
                    reduceMotion={reduceMotion}
                    reducedEffects={reducedEffects}
                  />
                ))}
              </View>
            ) : null}
            {carrier ? (
              <View
                pointerEvents="none"
                style={[
                  styles.carrierCard,
                  hudSide === 'left'
                    ? styles.carrierCardLeft
                    : styles.carrierCardRight,
                  railLayout ? styles.carrierCardDesktop : null,
                  // The panel wears the carrier's kit, so which team has the
                  // ball reads at a glance without looking back at the pitch.
                  {
                    backgroundColor: teamKitColor(carrier.team, colorSafeKits),
                  },
                ]}
              >
                <View style={styles.carrierLine}>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.carrierName,
                      railLayout ? styles.carrierNameDesktop : null,
                    ]}
                  >
                    {carrier.def.name}
                  </Text>
                  <Text
                    style={[
                      styles.carrierEnergy,
                      railLayout ? styles.carrierEnergyDesktop : null,
                    ]}
                  >
                    {Math.round(carrier.condition)}%
                  </Text>
                </View>
                <View
                  style={[
                    styles.energyTrack,
                    railLayout ? styles.energyTrackDesktop : null,
                  ]}
                >
                  <View
                    style={[
                      styles.energyFill,
                      energyBand(carrier.condition) === 'amber'
                        ? styles.energyFillMedium
                        : null,
                      energyBand(carrier.condition) === 'red'
                        ? styles.energyFillLow
                        : null,
                      railLayout ? styles.energyFillDesktop : null,
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
                    trackWidth={
                      railLayout
                        ? CARRIER_CARD_DESKTOP_CONTENT_WIDTH
                        : CARRIER_CARD_CONTENT_WIDTH
                    }
                    height={
                      railLayout
                        ? CARRIER_CHARGE_DESKTOP_HEIGHT
                        : CARRIER_CHARGE_HEIGHT
                    }
                    reduceMotion={reduceMotion}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </View>
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
                  nextFormation(displayedFormation, liveFormationOptions),
                );
              }}
            >
              <FormationDiagram
                formation={displayedFormation}
                compact
                inverted
              />
              <View style={styles.coachCopy}>
                <Text
                  style={styles.coachLabel}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
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
                {/* Shrink rather than clip: "0/5 USED" fits, but German
                    "0/5 GENUTZT" and its longer siblings were cut to
                    "0/5 GEN_" against this fixed-width control. */}
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
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
      {/* Half time, a banked speech, one question. The club's own commit
          sheet rather than a bespoke overlay: it already carries the focus
          trap, the Escape/Back route, and reduced motion. */}
      <ConfirmationSheet
        confirmation={
          speechPromptOpen && motivationalSpeech !== undefined
            ? {
                kicker: t('matchScreen.speechKicker'),
                title: t('matchScreen.speechTitle'),
                detail: t('matchScreen.speechDetail', {
                  boost: motivationalSpeech.boost,
                }),
                confirmLabel: t('matchScreen.speechConfirm'),
                cancelLabel: t('matchScreen.speechCancel'),
                onAfterConfirmDismiss: openSpeechCutsceneAfterSheet,
                onConfirm: () => answerSpeechPrompt(true),
              }
            : null
        }
        reduceMotion={reduceMotion}
        onCancel={() => answerSpeechPrompt(false)}
        onConfirm={() => answerSpeechPrompt(true)}
      />
      {speechCutsceneOpen && motivationalSpeech !== undefined ? (
        <MotivationalSpeechCutscene
          boost={motivationalSpeech.boost}
          coachName={motivationalSpeech.coachName}
          coachPortraitId={motivationalSpeech.coachPortraitId}
          onDone={finishSpeechCutscene}
          reduceMotion={reduceMotion}
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
    </Animated.View>
  );
}
