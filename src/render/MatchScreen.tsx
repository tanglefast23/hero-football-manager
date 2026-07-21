import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Atlas, Canvas, Circle, Fill, Skia, type SkColor, type SkImage, type SkRect } from '@shopify/react-native-skia';
import { createMatch, queueInput, tick } from '../sim/match';
import { SLIDE_SUCCESS_RECOVERY_TICKS } from '../sim/engine';
import { isActive, teamPowerBusy, WEB_TRAP_TRIGGER_RANGE } from '../sim/powers';
import { ROVERS, UNITED } from '../sim/teams';
import { PITCH_W, PITCH_H, TICK_MS, HALF_TICKS, dist2 } from '../sim/geometry';
import type { MatchState, PowerId, TeamDef } from '../sim/types';
import type { HudSide } from '../persistence';
import { buildSpriteAtlas, buildFallbackAtlas } from './sprites/buildAtlas';
import { spriteKeyForMatchPlayer, visualIdForMatchPlayer } from './sprites/slot-key';
import { snapshotFrame, type PitchFrame } from './interpolate';
import {
  actionPose,
  isKeeperReady,
  keeperReadyFrame,
  runFrameForDistance,
  slideTackleSpriteFrameForAction,
  type PlayerActionAnimation,
} from './animation';
import { useWorkletAtlasFrame } from './worklet-atlas-frame';
import { nextMatchSpeed, type MatchSpeed } from './match-speed';
import {
  WorkletBallShadow,
  WorkletMatchOverlays,
  WorkletSlideTackleEffects,
} from './WorkletMatchOverlays';
import { BALL_AIRBORNE_THRESHOLD_CM, ballVisualOffset } from './ball-flight-visuals';
import { matchPoliciesForControlledTeam, retainedCarrierIndex } from './match-control';
import { shouldPauseMatch, type AutomaticMatchPauseReason } from './match-pause';
import { powerCutInDurationMs, powerCutInPresentation, shouldShowFullPowerCutIn } from './power-cut-in';
import { Pitch } from './Pitch';
import { PIXEL_ART_SAMPLING } from './pixel-art-sampling';
import { playHapticForEvent } from './haptics';
import { FormationDiagram } from '../ui/components/FormationDiagram';
import { SettingsButton } from '../ui/SettingsOverlay';
import { playUiClickSfx } from './management-sfx';
import {
  DEFAULT_FORMATION_PRESETS,
  ENERGY_USE_MODES,
  FORMATION_LABELS,
  nextFormation,
  nextMentality,
  type FormationId,
} from '../sim/tactics';
import {
  ENERGY_USE_ACCESSIBILITY,
  ENERGY_USE_LABELS,
  energyBand,
  summarizeTeamEnergy,
} from './match-energy-ui';
import {
  initAudio,
  playForEvent,
  startFireAmbience,
  startTheme,
  stopFireAmbience,
  stopTheme,
  teardownAudio,
} from './audio';

const MAX_CATCHUP_TICKS = 5;
const TOTAL_TICKS = HALF_TICKS * 2;

// Magnifies each atlas source-pixel into screen px, before the pitch->screen
// `scale` factor. Player cells are 24x30 source px; at PLAYER_DRAW_SCALE=17
// that keeps the same ~28-34pt tall footprint as the prior 16x20@26 across the
// common iPhone width range (375-430pt) — crisper and more detailed, not bigger.
const PLAYER_DRAW_SCALE = 17;

// The ball sprite is a separate 6x6 source asset, not a scaled-down player —
// reusing PLAYER_DRAW_SCALE would shrink it to a ~5pt speck. Calibrated
// instead for its own ~6pt on-screen radius (~12pt diameter) across the same
// width range.
const BALL_DRAW_SCALE = 34;

// speedFor()'s theoretical ceiling: (40 + 99 max pac) * 1.0 max conditionScale
// * 2.2 max active-SUPER_SPEED multiplier ~= 306 pitch-units/tick. The snap
// threshold (2x that) sits comfortably above any ordinary tick's movement but
// far below a kickoff/restart teleport (players jump thousands of units back
// to their formation anchors) — ledger item 3.
const MAX_SPEED_PER_TICK = 310;
const SNAP_DIST2 = (2 * MAX_SPEED_PER_TICK) ** 2;

// POWER_EXPIRED dim-flash duration, and POWER_FIRED/HALF_TIME banner display
// duration — ledger item 5 ("flash the chip dim for ~30 ticks").
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

// UX fix (zone-entry discoverability) — a HOME hero's zone entry gets a
// longer "go tap now" banner than a RIVAL hero's threat flash, since only the
// home banner is asking the player to do something before the window closes.
const ZONE_BANNER_TICKS = 25;
const RIVAL_ZONE_BANNER_TICKS = 20;

// On-pitch zone marker geometry — a small upward triangle drawn ~14pt above
// a HOME hero's sprite while it's in the Zone, so an eyes-on-the-pitch player
// spots the tap opportunity without looking down at the chip row. Rival zone
// entries already get their own on-pitch tell (the existing red ring), so
// this marker — like the chip urgency and early-tap feedback above — is
// home-only.
const MARKER_Y_OFFSET = 14; // pt above the sprite's center, before the triangle's own height
const MARKER_HALF_W = 5;
const MARKER_H = 7;
const COLOR_SAFE_HOME_KIT = {
  o: '#6d4510',
  r: '#ba7517',
  R: '#edb54a',
  E: '#f7d894',
} as const;
function scoreCode(team: TeamDef): string {
  const words = team.name.trim().split(/\s+/);
  const last = words[words.length - 1];
  const source = /^(fc|afc|club)$/i.test(last) && words.length > 1
    ? words[0]
    : last;
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
  onOpenSettings: () => void;
  onDone: (state: MatchState) => void;
}) {
  const seenPowerCutInsRef = useRef(new Set<PowerId>(seenPowerCutIns));
  for (const power of seenPowerCutIns) seenPowerCutInsRef.current.add(power);
  const onPowerCutInSeenRef = useRef(onPowerCutInSeen);
  onPowerCutInSeenRef.current = onPowerCutInSeen;
  const { width, height } = useWindowDimensions();
  const compactHeight = height < 760;
  const narrowWidth = width < 375;
  // Keep the pitch and both coaching rows visible on short phones. Decorative
  // chrome compresses first; all controls retain at least a 44pt touch target.
  // FormationDiagram's compact artwork is 62pt tall, so that first row is
  // taller than coachButtonCompact's 52pt minimum. Reserve the rows' measured
  // content height rather than their minimums or the Energy Use row can fall
  // below the viewport on short phones.
  const reservedChromeHeight = compactHeight ? 226 : 286;
  const availablePitchHeight = Math.max(280, height - reservedChromeHeight);
  const pitchWidth = Math.min(width, availablePitchHeight * PITCH_W / PITCH_H);
  const scale = pitchWidth / PITCH_W;
  const pitchH = PITCH_H * scale;
  const homeCode = scoreCode(home);
  const awayCode = scoreCode(away);

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
  const bannerRef = useRef<{ text: string; untilTick: number; tone: 'gold' | 'red' | 'blue' }>({
    text: '',
    untilTick: 0,
    tone: 'gold',
  });
  const scoreFlashUntilRef = useRef<number>(0);
  // Ball-flight presentation — recent positions while a shot or lifted pass
  // flies, and the last kick origin + tick (dust puff). Render-only.
  const ballFlightTrailRef = useRef<Array<{ x: number; y: number; z: number }>>([]);
  const puffRef = useRef<{ x: number; y: number; tick: number } | null>(null);
  // End-of-match hold deadline (RAF/performance.now() timebase), set once
  // when the loop first sees phase === 'fulltime' — see FULLTIME_HOLD_MS.
  const fulltimeDeadlineRef = useRef<number | null>(null);
  // Render-only tackle poses keyed by player index. Slide travel itself is now
  // deterministic sim movement; this layer only tilts/recovers the sprite.
  const actionRef = useRef<Record<number, PlayerActionAnimation>>({});
  // Super Strength impact burst (render-only), set when a charge lands a KO.
  const impactRef = useRef<{ x: number; y: number; tick: number } | null>(null);
  // Whether the looping fire crackle is currently playing — reconciled each
  // frame against whether any Fire Torch hero is ablaze (see the RAF loop).
  const fireLoopOnRef = useRef(false);

  const [frame, setFrame] = useState<PitchFrame>(() => prevRef.current!);
  const [hud, setHud] = useState({
    score: [0, 0] as [number, number],
    tick: 0,
    banner: '',
    bannerTone: 'gold' as 'gold' | 'red' | 'blue',
    scoreFlash: false,
    visualTick: 0,
  });
  const [speed, setSpeed] = useState<MatchSpeed>(1);
  const [autoPowers, setAutoPowers] = useState(false);
  const [paused, setPaused] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [selectedOutgoing, setSelectedOutgoing] = useState<number | null>(null);
  const [selectedIncoming, setSelectedIncoming] = useState<string | null>(null);
  const [powerCutIn, setPowerCutIn] = useState<{
    id: string;
    power: PowerId;
    playerName: string;
    team: 0 | 1;
    skippable: boolean;
  } | null>(null);
  const speedRef = useRef<MatchSpeed>(1);
  const pausedRef = useRef(false);
  const userPausedRef = useRef(false);
  const automaticPauseReasonsRef = useRef(new Set<AutomaticMatchPauseReason>());
  speedRef.current = speed;
  const matchVisualIds = useMemo(() => [
    ...match.players.map((player, index) => (
      visualIdForMatchPlayer(index, player.def.id, player.def.role, player.def.lookId)
    )),
    ...match.bench.flatMap((players, team) => players.map(player => (
      visualIdForMatchPlayer(team === 0 ? 0 : 11, player.id, player.role, player.lookId)
    ))),
  ], [match]);
  // Ledger item 4 — build the atlas from the merged sprite pack. Color-safe
  // mode remaps only the home-kit palette tokens, preserving faces and hair.
  // If the pack fails to build (realistically: sprites.json failing loader
  // validation), fall back to a white square texture with team-color tints
  // (the plan's original placeholder look) instead of crashing the match.
  const atlas = useMemo(() => {
    try {
      return {
        ...buildSpriteAtlas(Skia, matchVisualIds, colorSafeKits ? COLOR_SAFE_HOME_KIT : undefined),
        fallbackMode: false,
      };
    } catch (err) {
      console.warn('MatchScreen: buildSpriteAtlas failed — rendering placeholder rects', err);
      return { ...buildFallbackAtlas(Skia, FALLBACK_SPRITE), fallbackMode: true };
    }
  }, [colorSafeKits, matchVisualIds]);

  const playerCell = atlas.rectFor(`${matchVisualIds[0]}:run0`);
  const actionCell = atlas.rectFor(`${matchVisualIds[0]}:slide0`);
  const ballCell = atlas.rectFor('ball');
  const {
    transforms: workletTransforms,
    visualPositions: workletVisualPositions,
    ballGroundPosition: workletBallGroundPosition,
    ballHeight: workletBallHeight,
    statuses: workletStatuses,
    zoneFractions: workletZoneFractions,
    carrier: workletCarrier,
    simTick: workletSimTick,
    progress: workletProgress,
    actionData: workletActionData,
    publish: publishAtlasFrame,
    pause: pauseAtlasFrame,
    resume: resumeAtlasFrame,
  } = useWorkletAtlasFrame({
    initialFrame: prevRef.current!,
    scale,
    playerCell: { width: playerCell.w, height: playerCell.h },
    actionCell: { width: actionCell.w, height: actionCell.h },
    ballCell: { width: ballCell.w, height: ballCell.h },
    playerDrawScale: PLAYER_DRAW_SCALE,
    ballDrawScale: BALL_DRAW_SCALE,
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
    else resumeAtlasFrame(speedRef.current);
    setPaused(value);
  };

  const syncPauseReasons = () => {
    setPausedBoth(shouldPauseMatch(userPausedRef.current, automaticPauseReasonsRef.current));
  };

  useEffect(() => {
    if (pausedExternally) automaticPauseReasonsRef.current.add('settings');
    else automaticPauseReasonsRef.current.delete('settings');
    syncPauseReasons();
  }, [pausedExternally]);

  useEffect(() => {
    if (powerCutIn === null) return undefined;
    automaticPauseReasonsRef.current.add('cut-in');
    syncPauseReasons();
    const timer = setTimeout(() => {
      automaticPauseReasonsRef.current.delete('cut-in');
      syncPauseReasons();
      setPowerCutIn(null);
    }, powerCutInDurationMs(powerCutIn.skippable));
    return () => clearTimeout(timer);
  }, [powerCutIn?.id]);

  // Audio lifecycle — own effect, separate from the RAF loop below: starts
  // the match theme on mount, tears everything down on unmount. No pause
  // handling needed (see src/render/audio.ts) — the theme keeps looping
  // through a paused match, and playForEvent() below is only ever reached
  // from ticks the RAF loop actually simulates.
  useEffect(() => {
    initAudio();
    startTheme();
    // The opening KICKOFF is emitted by createMatch before the RAF loop below
    // starts slicing newEvents, so its whistle would be skipped — play any
    // events already present at mount here. The loop starts from the current
    // length, so nothing double-fires.
    for (const e of match.events) playForEvent(e);
    return () => {
      stopTheme();
      teardownAudio();
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        last = performance.now();
        acc = 0;
      } else {
        automaticPauseReasonsRef.current.add('background');
        syncPauseReasons(); // background -> hard pause; user resumes via a tap
      }
    });

    const loop = (now: number) => {
      const s = stateRef.current!;
      if (pausedRef.current) {
        // Paused: keep the frame clock current (so resuming doesn't dump the
        // whole pause duration into the accumulator) and reschedule — but skip
        // the setFrame/setHud work, so a paused match doesn't re-render at
        // display refresh rate.
        last = now;
        raf = requestAnimationFrame(loop);
        return;
      }
      // Ledger item 7 — capped catch-up: never simulate more than
      // MAX_CATCHUP_TICKS in one frame, however long the JS thread stalled.
      acc = Math.min(acc + (now - last) * speedRef.current, TICK_MS * MAX_CATCHUP_TICKS);
      last = now;

      const eventsBefore = s.events.length;
      let snap = false;
      let advanced = false;

      // No pausedRef check needed here: the early return above already ran,
      // and the flag cannot flip mid-invocation on a single-threaded runtime.
      while (acc >= TICK_MS && s.phase !== 'fulltime') {
        const before = nextRef.current!;
        prevRef.current = before;
        tick(s);
        advanced = true;
        nextRef.current = snapshotFrame(s, before);

        for (let i = 0; i < 22; i++) {
          if (dist2(prevRef.current!.players[i], nextRef.current.players[i]) > SNAP_DIST2) {
            // A restart teleport is not locomotion. Keep the accumulated
            // stride distance unchanged so a kickoff cannot arbitrarily flip
            // every player's feet.
            nextRef.current.travel[i] = prevRef.current!.travel[i];
            snap = true;
          }
        }

        const speedster = s.players.find((p, i) => nextRef.current!.statuses[i] === 'active' && p.def.power === 'SUPER_SPEED');
        trailRef.current = !reduceMotion && speedster
          ? [{ ...speedster.pos }, ...trailRef.current].slice(0, 7)
          : [];

        // A longer curved trail makes lifted shots and keeper distributions
        // read as airborne; driven shots retain their existing speed streak.
        ballFlightTrailRef.current = !reduceMotion
          && (nextRef.current!.ballShooting || nextRef.current!.ballHeight >= BALL_AIRBORNE_THRESHOLD_CM)
          ? [{ ...nextRef.current!.ball, z: nextRef.current!.ballHeight }, ...ballFlightTrailRef.current].slice(0, BALL_FLIGHT_TRAIL_LEN)
          : [];

        acc -= TICK_MS;
      }

      const newEvents = s.events.slice(eventsBefore);
      // A FIRE_TORCH POWER_FIRED is emitted just before its IGNITED in the same
      // batch, so remembering the caster's spot here lets the ignite knockdown
      // fling the victim *away* from Flint.
      let torchCasterPos: { x: number; y: number } | null = null;
      for (const e of newEvents) {
        playForEvent(e);
        playHapticForEvent(e, controlledTeam);
        if (e.kind === 'POWER_FIRED' && e.power === 'FIRE_TORCH') {
          torchCasterPos = { ...nextRef.current!.players[e.player] };
        }
        if (!reduceMotion && e.kind === 'SHOT' && e.by >= 0 && e.by < 22) {
          // Kick up a dust puff at the striker's feet — the visual "he hit it".
          const o = s.players[e.by].pos;
          puffRef.current = { x: o.x, y: o.y, tick: e.t };
        }
        if (e.kind === 'GOAL' || e.kind === 'MISS' || e.kind === 'HALF_TIME' || e.kind === 'KICKOFF') snap = true;
        if (e.kind === 'GOAL') {
          const scorerName = e.by >= 0 && e.by < 22 ? s.players[e.by].def.name : 'Unknown';
          bannerRef.current = { text: `⚡ GOAL! ${scorerName}`, untilTick: e.t + FLASH_TICKS, tone: 'gold' };
          scoreFlashUntilRef.current = reduceMotion ? e.t : e.t + FLASH_TICKS;
        }
        if (e.kind === 'POWER_FIRED') {
          bannerRef.current = {
            text: `⚡ ${e.power.replace(/_/g, ' ')} — ${s.players[e.player].def.name}`,
            untilTick: e.t + FLASH_TICKS,
            tone: 'gold',
          };
          if (shouldShowFullPowerCutIn(cutInMode, reduceMotion)) {
            const skippable = seenPowerCutInsRef.current.has(e.power);
            if (!skippable) {
              seenPowerCutInsRef.current.add(e.power);
              onPowerCutInSeenRef.current?.(e.power);
            }
            setPowerCutIn({
              id: `${e.t}:${e.player}:${e.power}`,
              power: e.power,
              playerName: s.players[e.player].def.name,
              team: s.players[e.player].team,
              skippable,
            });
          }
        }
        if (e.kind === 'HALF_TIME') {
          bannerRef.current = { text: 'HALF TIME', untilTick: e.t + FLASH_TICKS, tone: 'blue' };
        }
        if (e.kind === 'FULL_TIME') {
          // Sim ticks freeze at fulltime, so `s.tick <= untilTick` below
          // holds and this banner stays up for the whole end-of-match hold.
          bannerRef.current = { text: 'FULL TIME', untilTick: e.t + FLASH_TICKS, tone: 'blue' };
        }
        if (e.kind === 'FORMATION_CHANGED' && e.team === controlledTeam) {
          bannerRef.current = {
            text: `${e.formation} · ${FORMATION_LABELS[e.formation].toUpperCase()}`,
            untilTick: e.t + FLASH_TICKS,
            tone: 'blue',
          };
        }
        if (e.kind === 'MENTALITY_CHANGED' && e.team === controlledTeam) {
          bannerRef.current = {
            text: `PLAYSTYLE · ${e.mentality}`,
            untilTick: e.t + FLASH_TICKS,
            tone: 'blue',
          };
        }
        if (e.kind === 'ENERGY_USE_CHANGED' && e.team === controlledTeam) {
          bannerRef.current = {
            text: `ENERGY USE · ${ENERGY_USE_LABELS[e.energyUse]}`,
            untilTick: e.t + FLASH_TICKS,
            tone: 'blue',
          };
        }
        if (e.kind === 'SUBSTITUTION' && e.team === controlledTeam) {
          const incoming = s.players[e.player].def.name;
          bannerRef.current = {
            text: `SUBSTITUTION · ${incoming} ON`,
            untilTick: e.t + FLASH_TICKS,
            tone: 'blue',
          };
        }
        if (!reduceMotion && e.kind === 'SLIDE_STARTED') {
          const rotation = Math.atan2(e.direction.y, e.direction.x);
          actionRef.current[e.by] = {
            kind: 'slide',
            startTick: e.t,
            direction: { ...e.direction },
            rotation,
            untilTick: e.untilTick + SLIDE_SUCCESS_RECOVERY_TICKS,
          };
        }
        if (!reduceMotion && e.kind === 'TACKLE') {
          const byPos = nextRef.current!.players[e.by];
          const onPos = nextRef.current!.players[e.on];
          const dx = onPos.x - byPos.x;
          const dy = onPos.y - byPos.y;
          const magnitude = Math.hypot(dx, dy);
          const direction = magnitude > 0
            ? { x: dx / magnitude, y: dy / magnitude }
            : { x: 0, y: s.players[e.by].team === 0 ? -1 : 1 };
          const rotation = direction.x >= 0 ? Math.PI / 2 : -Math.PI / 2;
          const startTick = e.t - 1;
          if (e.style === 'slide') {
            const current = actionRef.current[e.by];
            if (current?.kind === 'slide') {
              current.untilTick = Math.max(current.untilTick, s.players[e.by].tackleRecoveryUntil);
            }
          }
          // Super Strength knocks the target OUT (outUntilTick in the future):
          // hold them flat until they recover and punch up an impact burst. An
          // ordinary tackle only dispossesses — the quick fall-and-recover.
          if (s.players[e.on].outUntilTick > s.tick) {
            actionRef.current[e.on] = {
              kind: 'knockdown',
              startTick,
              anchor: { ...onPos },
              rotation: -rotation,
              untilTick: s.players[e.on].outUntilTick,
            };
            impactRef.current = { x: onPos.x, y: onPos.y, tick: e.t };
          } else if (e.won && e.contact) {
            actionRef.current[e.on] = {
              kind: 'fall',
              startTick,
              anchor: { ...onPos },
              rotation: -rotation,
            };
          }
        }
        if (!reduceMotion && e.kind === 'IGNITED') {
          const victimPos = nextRef.current!.players[e.player];
          const rotation = torchCasterPos
            ? (victimPos.x - torchCasterPos.x >= 0 ? Math.PI / 2 : -Math.PI / 2)
            : (e.player % 2 === 0 ? Math.PI / 2 : -Math.PI / 2);
          actionRef.current[e.player] = {
            kind: 'knockdown',
            startTick: e.t - 1,
            anchor: { ...victimPos },
            rotation,
            untilTick: s.players[e.player].outUntilTick,
          };
        }
        // UX fix — zone entry announcement: the player didn't discover the
        // tap affordance from the chip alone, so a HOME hero's Zone entry
        // (POWER_READY; see sim/powers.ts's comment — "event kind retained;
        // now means Zone entry") gets a loud "go tap now" banner. A RIVAL
        // entry gets a shorter red threat banner instead, echoing the same
        // "starving his window is the counterplay" reasoning as the rival
        // chip/ring's existing red treatment (ledger item 5 above).
        if (e.kind === 'POWER_READY') {
          const firstName = s.players[e.player].def.name.split(' ')[0];
          if (s.players[e.player].team === controlledTeam) {
            bannerRef.current = {
              text: `⚡ ${firstName} IS IN THE ZONE — TAP!`,
              untilTick: e.t + ZONE_BANNER_TICKS,
              tone: 'gold',
            };
          } else {
            bannerRef.current = {
              text: `⚠ ${firstName} IS HOT — KEEP THE BALL AWAY`,
              untilTick: e.t + RIVAL_ZONE_BANNER_TICKS,
              tone: 'red',
            };
          }
        }
      }
      // Fire crackle loop follows the caster's active window: on while any Fire
      // Torch hero is ablaze, off once none are. Reconciled from state each
      // frame (not off an event) so it also stops on a KO, interrupt, or the
      // half-time freeze — none of which emit a "power ended" event.
      const fireActive = s.players.some((p, i) => p.def.power === 'FIRE_TORCH' && isActive(s, i));
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
        // Publish one immutable tick pair. Reanimated interpolates it and
        // updates all 23 Atlas transforms on the UI thread; React only receives
        // the discrete state used by HUD, chips, and event overlays.
        publishAtlasFrame(
          prevRef.current!,
          nextRef.current!,
          s.tick,
          speedRef.current,
          actionRef.current
        );
        setFrame(nextRef.current!);
        setHud({
          score: [...s.score] as [number, number],
          tick: s.tick,
          banner: s.tick <= bannerRef.current.untilTick ? bannerRef.current.text : '',
          bannerTone: bannerRef.current.tone,
          scoreFlash: !reduceMotion && s.tick <= scoreFlashUntilRef.current,
          visualTick: s.tick,
        });
      }

      if (s.phase === 'fulltime') {
        // End-of-match hold: calling onDone on the same frame that emitted
        // FULL_TIME would unmount the screen and tear audio down mid-whistle
        // (same for a last-tick goal). Keep rendering — sim ticks already
        // stop at fulltime — until the deadline passes, then hand off once.
        // `now` is the RAF timestamp: the same performance.now() timebase
        // the rest of the loop uses.
        if (fulltimeDeadlineRef.current === null) {
          fulltimeDeadlineRef.current = now + (reduceMotion ? 0 : FULLTIME_HOLD_MS);
        }
        if (now >= fulltimeDeadlineRef.current) {
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
    };
  }, [controlledTeam, cutInMode, onDone, publishAtlasFrame, reduceMotion]);

  // Distance, not wall-clock ticks, advances the run cycle. The action pose
  // takes priority, followed by the far-ball GK ready loop, then locomotion.
  const playerSpriteKeys = useMemo(() => match.players.map((p, i) => {
    const action = actionRef.current[i];
    const pose = actionPose(action, hud.visualTick);
    if (pose.active && action?.kind === 'slide') {
      return spriteKeyForMatchPlayer(i, p.def.id, p.def.role, slideTackleSpriteFrameForAction(action, hud.visualTick), p.def.lookId);
    }
    if (pose.active) return spriteKeyForMatchPlayer(i, p.def.id, p.def.role, 'run0', p.def.lookId);
    if (p.def.role === 'GK' && isKeeperReady(dist2(frame.players[i], frame.ball))) {
      return spriteKeyForMatchPlayer(i, p.def.id, p.def.role, keeperReadyFrame(hud.visualTick), p.def.lookId);
    }
    return spriteKeyForMatchPlayer(i, p.def.id, p.def.role, runFrameForDistance(frame.travel[i], frame.moved[i]), p.def.lookId);
  }), [frame, hud.visualTick, match]);

  // All 22 players plus the ball still share one batched Atlas draw call.
  const sprites: SkRect[] = useMemo(() => {
    const ball = atlas.rectFor('ball');
    return [
      ...match.players.map((_p, i) => {
        const r = atlas.rectFor(playerSpriteKeys[i]);
        return Skia.XYWHRect(r.x, r.y, r.w, r.h);
      }),
      Skia.XYWHRect(ball.x, ball.y, ball.w, ball.h),
    ];
  }, [atlas, match, playerSpriteKeys]);

  // Ledger item 4 — tints carry status ONLY. A normal player gets white (a
  // no-op multiply) so the sprite's own kit/skin/hair colors survive instead
  // of being flattened to a solid team-color block.
  const colors: SkColor[] = useMemo(() => {
    const tints = frame.statuses.map((st, i) => {
      if (st === 'ignited') return Skia.Color('#ff6a00'); // flame orange (matches Fire Torch FX)
      if (st === 'out') return Skia.Color('#6b6675'); // bible grey-dark
      if (st === 'windup') {
        return Skia.Color(reduceMotion || hud.tick % 4 < 2 ? '#ffffff' : '#edb54a');
      }
      if (st === 'active') return Skia.Color('#edb54a'); // hero gold
      // 'ok' | 'zone' — zone is telegraphed by the glow ring, not a body tint.
      // In fallback mode there are no kit pixels to preserve, so tint the
      // white placeholder rects with bible team colors (red / blue) instead.
      return atlas.fallbackMode
        ? Skia.Color(i < 11 ? (colorSafeKits ? '#edb54a' : '#d94f52') : '#5a8fd6')
        : Skia.Color('#ffffff');
    });
    tints.push(Skia.Color('#ffffff')); // ball — no tint
    return tints;
  }, [frame, hud.tick, atlas, colorSafeKits, reduceMotion]);

  const minute = Math.min(90, Math.ceil((hud.tick / TOTAL_TICKS) * 90));
  const stoppage =
    match.phase === 'play' &&
    ((match.half === 1 && match.tick >= HALF_TICKS) || (match.half === 2 && match.tick >= TOTAL_TICKS));
  const ringR = (PLAYER_CELL_W * scale * PLAYER_DRAW_SCALE) / 2 + 4;
  const heroPlayers: number[] = [];
  const userHeroes: number[] = [];
  const fireTorchPlayers: number[] = [];
  match.players.forEach((player, index) => {
    if (!player.def.power) return;
    heroPlayers.push(index);
    if (player.team === controlledTeam) userHeroes.push(index);
    if (player.def.power === 'FIRE_TORCH') fireTorchPlayers.push(index);
  });
  const activeWebTraps = match.players.flatMap((player, index) => (
    player.def.power === 'WEB_TRAP' && isActive(match, index) && player.powerAnchor !== undefined
      ? [{
          key: `${index}:${player.powerState.kind === 'active' ? player.powerState.untilTick : match.tick}`,
          x: player.powerAnchor.x,
          y: player.powerAnchor.y,
          color: player.team === controlledTeam ? '#edb54a' : '#d94f52',
        }]
      : []
  ));

  const teamOffset = controlledTeam === 0 ? 0 : 11;
  const onFieldIndices = Array.from({ length: 11 }, (_, slot) => teamOffset + slot);
  const activeOnFieldIndices = onFieldIndices.filter(
    (index) => match.players[index].outReason !== 'redcard',
  );
  const currentTactics = match.tactics[controlledTeam];
  const pendingFormation = [...match.pendingInputs].reverse().find(
    (input) => input.kind === 'SET_FORMATION',
  );
  const pendingMentality = [...match.pendingInputs].reverse().find(
    (input) => input.kind === 'SET_MENTALITY',
  );
  const pendingEnergyUse = [...match.pendingInputs].reverse().find(
    (input) => input.kind === 'SET_ENERGY_USE',
  );
  const displayedFormation = pendingFormation?.kind === 'SET_FORMATION'
    ? pendingFormation.formation
    : currentTactics.formation;
  const displayedMentality = pendingMentality?.kind === 'SET_MENTALITY'
    ? pendingMentality.mentality
    : currentTactics.mentality;
  const displayedEnergyUse = pendingEnergyUse?.kind === 'SET_ENERGY_USE'
    ? pendingEnergyUse.energyUse
    : currentTactics.energyUse;
  const carrierIndex = retainedCarrierIndex(frame.carrier, lastCarrierRef.current);
  useEffect(() => {
    if (frame.carrier >= 0) lastCarrierRef.current = frame.carrier;
  }, [frame.carrier]);
  const carrier = carrierIndex === null ? null : match.players[carrierIndex];
  const selectedOutgoingPlayer = selectedOutgoing === null ? null : match.players[selectedOutgoing];
  const selectedIncomingPlayer = selectedIncoming === null
    ? null
    : match.bench[controlledTeam].find((player) => player.id === selectedIncoming) ?? null;
  const bench = match.bench[controlledTeam];
  const substitutionsUsed = match.substitutionsUsed[controlledTeam];
  const substitutionsRemaining = Math.max(0, 3 - substitutionsUsed);
  const { average: teamEnergy, tiredCount } = summarizeTeamEnergy(
    activeOnFieldIndices.map((index) => match.players[index].condition),
  );
  const teamEnergyBand = energyBand(teamEnergy);
  const swapDisabled = match.phase === 'fulltime' || substitutionsUsed >= 3 || bench.length === 0;
  const coachingDisabled = match.phase === 'fulltime';
  const swapSecondary = tiredCount > 0
    ? `${tiredCount} TIRED · ${substitutionsUsed}/3`
    : `${substitutionsUsed}/3 USED`;

  const surname = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return parts[parts.length - 1];
  };
  const initials = (name: string) => name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  const openSwap = () => {
    if (match.phase === 'fulltime' || substitutionsUsed >= 3 || bench.length === 0) return;
    setSelectedOutgoing(null);
    setSelectedIncoming(null);
    setSwapOpen(true);
    automaticPauseReasonsRef.current.add('swap');
    syncPauseReasons();
  };
  const closeSwap = () => {
    setSwapOpen(false);
    setSelectedOutgoing(null);
    setSelectedIncoming(null);
    automaticPauseReasonsRef.current.delete('swap');
    syncPauseReasons();
  };
  const confirmSwap = () => {
    if (selectedOutgoing === null || selectedIncoming === null) return;
    queueInput(match, {
      tick: match.tick + 1,
      kind: 'SUBSTITUTE',
      player: selectedOutgoing,
      replacementId: selectedIncoming,
    });
    closeSwap();
  };

  const toggleAutoPowers = () => {
    if (match.phase === 'fulltime') return;
    playUiClickSfx();
    const enabled = !autoPowers;
    queueInput(match, {
      tick: match.tick + 1,
      kind: 'SET_AUTO_POWERS',
      enabled,
    });
    setAutoPowers(enabled);
    const text = enabled ? 'AUTO SUPERPOWERS' : 'MANUAL SUPERPOWERS';
    bannerRef.current = { text, untilTick: match.tick + FLASH_TICKS, tone: 'gold' };
    setHud((current) => ({ ...current, banner: text, bannerTone: 'gold' }));
  };

  return (
    <View style={[styles.root, highContrast ? styles.rootHighContrast : null]}>
      <Pressable
        style={[
          styles.scorebar,
          compactHeight ? styles.scorebarCompact : null,
          hudSide === 'right' ? styles.scorebarFlipped : null,
        ]}
        onPress={() => {
          playUiClickSfx();
          automaticPauseReasonsRef.current.delete('background');
          userPausedRef.current = !pausedRef.current;
          syncPauseReasons();
        }}
      >
        {/* Scoreboard "bug": an ink-outlined dark pill with a raised bottom
            lip (Track-A bevel) and cream mono numerals; flashes hero-gold on a
            goal. Tapping the surrounding bar still toggles pause. */}
        <View style={styles.scoreBug}>
          <Text style={[styles.scoreText, hud.scoreFlash ? styles.scoreTextFlash : null]}>
            {homeCode} {hud.score[0]} – {hud.score[1]} {awayCode} · {minute}'{stoppage ? '+' : ''}
            {paused ? ' ⏸' : ''}
          </Text>
        </View>
        <View style={styles.controls}>
          <Pressable
            style={[styles.ctrlButton, coachingDisabled ? styles.coachButtonDisabled : null]}
            accessibilityRole="switch"
            accessibilityLabel={`Superpower control ${autoPowers ? 'automatic' : 'manual'}. Tap for ${autoPowers ? 'manual' : 'automatic'}.`}
            accessibilityState={{ checked: autoPowers, disabled: coachingDisabled }}
            disabled={coachingDisabled}
            hitSlop={10}
            onPress={toggleAutoPowers}
          >
            <Text style={styles.powerModeText}>{autoPowers ? 'AUTO' : 'MANUAL'}</Text>
          </Pressable>
          <Pressable
            style={styles.ctrlButton}
            accessibilityRole="button"
            accessibilityLabel={`Match speed ${speed} times. Tap for next speed.`}
            hitSlop={10}
            onPress={() => {
              playUiClickSfx();
              const next = nextMatchSpeed(speed);
              speedRef.current = next;
              if (!pausedRef.current) resumeAtlasFrame(next);
              setSpeed(next);
            }}
          >
            <Text style={styles.ctrlText}>×{speed}</Text>
          </Pressable>
          <SettingsButton onPress={onOpenSettings} variant="match" />
        </View>
      </Pressable>
      <View style={{ width: pitchWidth, height: pitchH, alignSelf: 'center' }}>
        <Canvas style={{ width: pitchWidth, height: pitchH }}>
        {/* Pitch base = pixel-bible pitch-dark (#3f8a4a); Pitch.tsx paints the
            brighter base #5cb85c on alternating mow bands over it. */}
        <Fill color="#3f8a4a" />
        <Pitch scale={scale} />
        {/* Web Trap is simulation geometry, so keep its fixed trigger circle
            visible after the caster moves. Rival traps use the threat palette. */}
        {activeWebTraps.map(trap => (
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
            color="#f4f7fa"
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
            <Circle key="puff-body" cx={cx} cy={cy} r={9 + prog * 20} color="#efeade" opacity={Math.max(0, (1 - prog) * 0.6)} />,
            ...Array.from({ length: PUFF_RINGS }, (_, k) => (
              <Circle
                key={`puff-${k}`}
                cx={cx}
                cy={cy}
                r={11 + prog * 28 + k * 6}
                color="#d8d2c4"
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
            <Circle key="impact-core" cx={cx} cy={cy} r={6 + prog * 22} color="#f7d894" opacity={fade * 0.5} />,
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
        <WorkletSlideTackleEffects
          layer="dust"
          visualPositions={workletVisualPositions}
          actionData={workletActionData}
          simTick={workletSimTick}
          progress={workletProgress}
          scale={scale}
          playerDrawScale={PLAYER_DRAW_SCALE}
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
          layer="grass"
          visualPositions={workletVisualPositions}
          actionData={workletActionData}
          simTick={workletSimTick}
          progress={workletProgress}
          scale={scale}
          playerDrawScale={PLAYER_DRAW_SCALE}
        />
        <WorkletMatchOverlays
          visualPositions={workletVisualPositions}
          statuses={workletStatuses}
          zoneFractions={workletZoneFractions}
          carrier={workletCarrier}
          simTick={workletSimTick}
          progress={workletProgress}
          controlledTeam={controlledTeam}
          heroPlayers={heroPlayers}
          fireTorchPlayers={fireTorchPlayers}
          scale={scale}
          ringRadius={ringR}
          markerYOffset={MARKER_Y_OFFSET}
          markerHalfWidth={MARKER_HALF_W}
          markerHeight={MARKER_H}
          reduceMotion={reduceMotion}
        />
        </Canvas>
        {carrier ? (
          <View
            pointerEvents="none"
            style={[
              styles.carrierCard,
              hudSide === 'left' ? styles.carrierCardLeft : styles.carrierCardRight,
            ]}
          >
            <View style={styles.carrierLine}>
              <Text numberOfLines={1} style={styles.carrierName}>{carrier.def.name}</Text>
              <Text style={styles.carrierEnergy}>{Math.round(carrier.condition)}%</Text>
            </View>
            <View style={styles.energyTrack}>
              <View style={[
                styles.energyFill,
                energyBand(carrier.condition) === 'amber' ? styles.energyFillMedium : null,
                energyBand(carrier.condition) === 'red' ? styles.energyFillLow : null,
                { width: `${Math.max(0, Math.min(100, carrier.condition))}%` },
              ]} />
            </View>
          </View>
        ) : null}
        {!autoPowers ? userHeroes.map((index) => {
          const player = match.players[index];
          const ready = player.outUntilTick <= match.tick
            && player.powerState.kind === 'zone'
            && !teamPowerBusy(match, controlledTeam);
          if (!ready) return null;
          const position = frame.players[index];
          return (
            <Pressable
              key={`hero-tap-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`Activate ${player.def.name}'s ${player.def.power?.replace(/_/g, ' ').toLowerCase()}`}
              hitSlop={8}
              style={[styles.heroTapTarget, { left: position.x * scale - 27, top: position.y * scale - 30 }]}
              onPress={() => queueInput(match, { tick: match.tick + 1, kind: 'POWER_TAP', player: index })}
            >
              <Text style={styles.heroTapLabel}>TAP</Text>
            </Pressable>
          );
        }) : null}
      </View>
      {hud.banner ? (
        <Text
          style={[
            styles.banner,
            hud.bannerTone === 'red' ? styles.bannerThreat : null,
            hud.bannerTone === 'blue' ? styles.bannerAction : null,
          ]}
        >
          {hud.banner}
        </Text>
      ) : null}
      {powerCutIn ? (
        <Pressable
          accessibilityRole={powerCutIn.skippable ? 'button' : 'text'}
          accessibilityLabel={`${powerCutInPresentation(powerCutIn.power).name}, ${powerCutIn.playerName}${powerCutIn.skippable ? '. Tap to skip.' : ''}`}
          disabled={!powerCutIn.skippable}
          style={[styles.powerCutIn, powerCutIn.team === controlledTeam ? styles.powerCutInHome : styles.powerCutInRival]}
          onPress={() => {
            automaticPauseReasonsRef.current.delete('cut-in');
            syncPauseReasons();
            setPowerCutIn(null);
          }}
        >
          <View style={styles.powerCutInSlash} />
          <Text style={[styles.powerCutInGlyph, { color: powerCutInPresentation(powerCutIn.power).color }]}>{powerCutInPresentation(powerCutIn.power).glyph}</Text>
          <View style={styles.powerCutInCopy}>
            <Text style={styles.powerCutInPlayer}>{powerCutIn.playerName}</Text>
            <Text style={[styles.powerCutInName, { color: powerCutInPresentation(powerCutIn.power).color }]}>{powerCutInPresentation(powerCutIn.power).name}</Text>
            <Text style={styles.powerCutInHint}>{powerCutIn.skippable ? 'TAP TO SKIP' : 'FIRST REVEAL'}</Text>
          </View>
        </Pressable>
      ) : null}
      <View style={[styles.coachingDock, compactHeight ? styles.coachingDockCompact : null]}>
        <View style={styles.coachBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Formation ${displayedFormation}. Tap for next match formation.`}
            accessibilityState={{ disabled: coachingDisabled }}
            disabled={coachingDisabled}
            style={[
              styles.coachButton,
              compactHeight ? styles.coachButtonCompact : null,
              coachingDisabled ? styles.coachButtonDisabled : null,
            ]}
            onPress={() => {
              playUiClickSfx();
              const formation = nextFormation(displayedFormation, formationPresets);
              queueInput(match, { tick: match.tick + 1, kind: 'SET_FORMATION', formation });
              const text = `${formation} · ${FORMATION_LABELS[formation].toUpperCase()}`;
              bannerRef.current = { text, untilTick: match.tick + FLASH_TICKS, tone: 'blue' };
              setHud((current) => ({ ...current, banner: text, bannerTone: 'blue' }));
            }}
          >
            <FormationDiagram formation={displayedFormation} compact inverted />
            <View style={styles.coachCopy}>
              <Text style={styles.coachLabel}>FORMATION</Text>
              <Text style={styles.coachValue}>{displayedFormation}</Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Playstyle ${displayedMentality}. Tap for next playstyle.`}
            accessibilityState={{ disabled: coachingDisabled }}
            disabled={coachingDisabled}
            style={[
              styles.coachButton,
              compactHeight ? styles.coachButtonCompact : null,
              coachingDisabled ? styles.coachButtonDisabled : null,
            ]}
            onPress={() => {
              playUiClickSfx();
              const mentality = nextMentality(displayedMentality);
              queueInput(match, { tick: match.tick + 1, kind: 'SET_MENTALITY', mentality });
              const text = `PLAYSTYLE · ${mentality}`;
              bannerRef.current = { text, untilTick: match.tick + FLASH_TICKS, tone: 'blue' };
              setHud((current) => ({ ...current, banner: text, bannerTone: 'blue' }));
            }}
          >
            <Text style={styles.mentalityIcon}>{displayedMentality === 'ATTACK' ? '▲' : displayedMentality === 'PROTECT' ? '▼' : '◆'}</Text>
            <View style={styles.coachCopy}>
              <Text style={styles.coachLabel}>PLAYSTYLE</Text>
              <Text style={styles.coachValue}>{displayedMentality}</Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Swap players. ${tiredCount === 0 ? 'No tired players.' : `${tiredCount} tired players.`} ${substitutionsRemaining} substitutions remaining.`}
            accessibilityState={{ disabled: swapDisabled }}
            disabled={swapDisabled}
            style={[
              styles.coachButton,
              compactHeight ? styles.coachButtonCompact : null,
              swapDisabled
                ? (tiredCount > 0 ? styles.coachButtonDisabledReadable : styles.coachButtonDisabled)
                : null,
            ]}
            onPress={() => {
              playUiClickSfx();
              openSwap();
            }}
          >
            <Text style={styles.swapIcon}>⇄</Text>
            <View style={styles.coachCopy}>
              <Text style={styles.coachLabel}>SWAP</Text>
              <Text numberOfLines={1} style={[styles.coachValue, tiredCount > 0 ? styles.tiredValue : null]}>
                {swapSecondary}
              </Text>
            </View>
          </Pressable>
        </View>
        <View style={[styles.energyUseRow, compactHeight ? styles.energyUseRowCompact : null]}>
          <View style={styles.energyUseHeader}>
            <Text style={styles.energyUseTitle}>ENERGY USE</Text>
            <Text
              style={[
                styles.teamEnergy,
                teamEnergyBand === 'amber' ? styles.energyTextMedium : null,
                teamEnergyBand === 'red' ? styles.energyTextLow : null,
              ]}
            >
              TEAM ENERGY {teamEnergy}%
            </Text>
          </View>
          <View style={styles.energySegments}>
            {ENERGY_USE_MODES.map((mode) => {
              const selected = displayedEnergyUse === mode;
              return (
                <Pressable
                  key={mode}
                  accessibilityRole="button"
                  accessibilityLabel={`${ENERGY_USE_LABELS[mode]}. ${ENERGY_USE_ACCESSIBILITY[mode]}`}
                  accessibilityState={{ selected, disabled: coachingDisabled }}
                  disabled={coachingDisabled}
                  style={[
                    styles.energySegment,
                    narrowWidth ? styles.energySegmentNarrow : null,
                    selected ? styles.energySegmentSelected : null,
                    selected && mode === 'SAVE_ENERGY' ? styles.energySegmentSave : null,
                    selected && mode === 'BALANCED' ? styles.energySegmentBalanced : null,
                    selected && mode === 'ALL_OUT' ? styles.energySegmentAllOut : null,
                    coachingDisabled ? styles.coachButtonDisabled : null,
                  ]}
                  onPress={() => {
                    playUiClickSfx();
                    if (mode === displayedEnergyUse) return;
                    queueInput(match, { tick: match.tick + 1, kind: 'SET_ENERGY_USE', energyUse: mode });
                    const text = `ENERGY USE · ${ENERGY_USE_LABELS[mode]}`;
                    bannerRef.current = { text, untilTick: match.tick + FLASH_TICKS, tone: 'blue' };
                    setHud((current) => ({ ...current, banner: text, bannerTone: 'blue' }));
                  }}
                >
                  <Text style={[styles.energySegmentText, selected ? styles.energySegmentTextSelected : null]}>
                    {ENERGY_USE_LABELS[mode]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
      {swapOpen ? (
        <View style={styles.swapOverlay}>
          <View style={styles.swapSheet}>
            <View style={styles.swapHeader}>
              <View>
                <Text style={styles.swapEyebrow}>MATCH PAUSED</Text>
                <Text style={styles.swapTitle}>CHOOSE A SUBSTITUTE</Text>
              </View>
              <Text style={styles.swapCount}>{substitutionsUsed} / 3</Text>
            </View>

            <Text style={styles.swapInstruction}>1 · TAP THE PLAYER COMING OFF</Text>
            <View style={styles.playerGrid}>
              {onFieldIndices.map((index, slot) => {
                const player = match.players[index];
                const selected = selectedOutgoing === index;
                const sentOff = player.outReason === 'redcard';
                return (
                  <Pressable
                    key={player.def.id}
                    accessibilityRole="button"
                    accessibilityLabel={sentOff
                      ? `${player.def.name}, sent off and unavailable`
                      : `${player.def.name}, ${Math.round(player.condition)} percent energy`}
                    disabled={sentOff}
                    style={[
                      styles.playerCard,
                      selected ? styles.playerCardSelected : null,
                      sentOff ? styles.benchCardDisabled : null,
                    ]}
                    onPress={() => {
                      playUiClickSfx();
                      setSelectedOutgoing(index);
                      setSelectedIncoming(null);
                    }}
                  >
                    <View style={[styles.playerHead, selected ? styles.playerHeadSelected : null]}>
                      <Text style={styles.playerInitials}>{initials(player.def.name)}</Text>
                      <Text style={styles.shirtNumber}>{slot + 1}</Text>
                    </View>
                    <Text numberOfLines={1} style={styles.playerSurname}>{surname(player.def.name)}</Text>
                    <View style={styles.cardEnergyTrack}>
                      <View style={[
                        styles.cardEnergyFill,
                        energyBand(player.condition) === 'amber' ? styles.energyFillMedium : null,
                        energyBand(player.condition) === 'red' ? styles.energyFillLow : null,
                        { width: `${Math.max(0, Math.min(100, player.condition))}%` },
                      ]} />
                    </View>
                    <Text style={[
                      styles.cardEnergyText,
                      energyBand(player.condition) === 'amber' ? styles.energyTextMedium : null,
                      energyBand(player.condition) === 'red' ? styles.energyTextLow : null,
                    ]}>
                      {Math.round(player.condition)}%
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.swapInstruction}>2 · TAP THE PLAYER COMING ON</Text>
            <View style={styles.benchGrid}>
              {bench.map((player) => {
                const compatible = selectedOutgoingPlayer !== null
                  && ((selectedOutgoingPlayer.def.role === 'GK') === (player.role === 'GK'));
                const selected = selectedIncoming === player.id;
                return (
                  <Pressable
                    key={player.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${player.name}, full energy`}
                    disabled={!compatible}
                    style={[
                      styles.benchCard,
                      selected ? styles.playerCardSelected : null,
                      !compatible ? styles.benchCardDisabled : null,
                    ]}
                    onPress={() => {
                      playUiClickSfx();
                      setSelectedIncoming(player.id);
                    }}
                  >
                    <View style={[styles.playerHead, styles.benchHead, selected ? styles.playerHeadSelected : null]}>
                      <Text style={styles.playerInitials}>{initials(player.name)}</Text>
                    </View>
                    <Text numberOfLines={1} style={styles.playerSurname}>{surname(player.name)}</Text>
                    <Text style={styles.roleLabel}>{player.role}</Text>
                    <Text style={[styles.cardEnergyText, styles.benchEnergyText]}>100%</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.swapSelection}>
              <View style={styles.selectionSide}>
                <Text style={styles.selectionLabel}>OFF</Text>
                <Text numberOfLines={1} style={styles.selectionName}>
                  {selectedOutgoingPlayer?.def.name ?? 'Select player'}
                </Text>
                <Text style={[
                  styles.selectionEnergy,
                  selectedOutgoingPlayer && energyBand(selectedOutgoingPlayer.condition) === 'amber'
                    ? styles.energyTextMedium
                    : null,
                  selectedOutgoingPlayer && energyBand(selectedOutgoingPlayer.condition) === 'red'
                    ? styles.energyTextLow
                    : null,
                ]}>
                  {selectedOutgoingPlayer ? `${Math.round(selectedOutgoingPlayer.condition)}% ENERGY` : '—'}
                </Text>
              </View>
              <Text style={styles.swapArrow}>→</Text>
              <View style={styles.selectionSide}>
                <Text style={styles.selectionLabel}>ON</Text>
                <Text numberOfLines={1} style={styles.selectionName}>
                  {selectedIncomingPlayer?.name ?? 'Select substitute'}
                </Text>
                <Text style={styles.selectionEnergy}>{selectedIncomingPlayer ? '100% ENERGY' : '—'}</Text>
              </View>
            </View>

            <View style={styles.swapActions}>
              <Pressable style={styles.cancelButton} onPress={() => {
                playUiClickSfx();
                closeSwap();
              }}>
                <Text style={styles.cancelText}>CANCEL</Text>
              </Pressable>
              <Pressable
                disabled={selectedOutgoing === null || selectedIncoming === null}
                style={[
                  styles.confirmButton,
                  selectedOutgoing === null || selectedIncoming === null ? styles.confirmButtonDisabled : null,
                ]}
                onPress={() => {
                  playUiClickSfx();
                  confirmSwap();
                }}
              >
                <Text style={styles.confirmText}>MAKE SWAP</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

// All colours below come from the pixel-art bible palette (docs/11): ink
// #241f2e / ink-soft #3a3350 (dark canvas + chrome faces), cream #f4f1ea
// (text), hero gold #edb54a / #c8862a / #f7d894 (hero-only accents), red
// #d94f52 / #a83440 (rival threat), grey-dark #6b6675 (structure). Interactive
// chrome (Track A) uses an ink outline with a thicker bottom edge as the
// raised "lip"; gold is reserved for hero/power moments per docs/08.
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#241f2e' },
  rootHighContrast: { backgroundColor: '#09070d' },
  scorebar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 56,
    paddingBottom: 12,
  },
  scorebarCompact: { paddingTop: 24, paddingBottom: 6 },
  scorebarFlipped: { flexDirection: 'row-reverse' },
  // Scoreboard "bug": a lighter ink-soft pill on the ink canvas, outlined in
  // ink with a thicker bottom lip for a raised, pressable-panel read.
  scoreBug: {
    backgroundColor: '#3a3350',
    borderWidth: 2,
    borderColor: '#241f2e',
    borderBottomWidth: 4,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  scoreText: { color: '#f4f1ea', fontSize: 18, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  scoreTextFlash: { color: '#f7d894' },
  // Top-right controls: small beveled buttons (same Track-A recipe as the bug).
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ctrlButton: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: '#3a3350',
    borderWidth: 2,
    borderColor: '#241f2e',
    borderBottomWidth: 4,
    borderRadius: 4,
  },
  ctrlText: { color: '#f4f1ea', fontSize: 16, fontWeight: 'bold' },
  powerModeText: { color: '#f4f1ea', fontSize: 10, fontWeight: 'bold' },
  banner: {
    position: 'absolute',
    zIndex: 8,
    top: '46%',
    left: 18,
    right: 18,
    textAlign: 'center',
    color: '#edb54a',
    fontSize: 18,
    fontWeight: 'bold',
    backgroundColor: '#241f2edd',
    borderWidth: 2,
    borderColor: '#edb54a',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  bannerThreat: { color: '#f4f1ea', borderColor: '#d94f52', backgroundColor: '#3a1512ee' },
  bannerAction: { color: '#f4f1ea', borderColor: '#77a4d8', backgroundColor: '#214566ee' },
  powerCutIn: {
    position: 'absolute',
    zIndex: 30,
    top: '28%',
    left: 0,
    right: 0,
    minHeight: 210,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderColor: '#edb54a',
    backgroundColor: '#16121ff5',
    paddingHorizontal: 20,
  },
  powerCutInHome: { borderColor: '#edb54a' },
  powerCutInRival: { borderColor: '#d94f52' },
  powerCutInSlash: { position: 'absolute', left: '42%', top: -70, width: 70, height: 360, backgroundColor: '#f4f1ea12', transform: [{ rotate: '18deg' }] },
  powerCutInGlyph: { width: 120, fontSize: 72, fontWeight: 'bold', textAlign: 'center' },
  powerCutInCopy: { minWidth: 0, flex: 1, paddingLeft: 12 },
  powerCutInPlayer: { color: '#f4f1ea', fontSize: 16, fontWeight: 'bold', textTransform: 'uppercase' },
  powerCutInName: { marginTop: 6, fontSize: 34, lineHeight: 38, fontWeight: '900', textTransform: 'uppercase' },
  powerCutInHint: { marginTop: 12, color: '#c9c5d0', fontSize: 10, fontWeight: 'bold', letterSpacing: 2 },
  carrierCard: {
    position: 'absolute',
    zIndex: 4,
    bottom: 8,
    width: 150,
    backgroundColor: '#241f2eee',
    borderWidth: 1,
    borderColor: '#f4f1ea99',
    borderRadius: 3,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  carrierCardLeft: { left: 8 },
  carrierCardRight: { right: 8 },
  carrierLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  carrierName: { flex: 1, color: '#f4f1ea', fontSize: 11, fontWeight: 'bold' },
  carrierEnergy: { color: '#f4f1ea', fontSize: 10, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  energyTrack: { height: 4, backgroundColor: '#3a3350', marginTop: 4, overflow: 'hidden' },
  energyFill: { height: 4, backgroundColor: '#65b96e' },
  energyFillMedium: { backgroundColor: '#edb54a' },
  energyFillLow: { backgroundColor: '#d94f52' },
  energyTextMedium: { color: '#edb54a' },
  energyTextLow: { color: '#f06b6e' },
  heroTapTarget: {
    position: 'absolute',
    zIndex: 6,
    width: 54,
    height: 60,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  heroTapLabel: {
    color: '#f4f1ea',
    backgroundColor: '#a83440',
    borderColor: '#f4f1ea',
    borderWidth: 1,
    fontSize: 9,
    fontWeight: 'bold',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  coachingDock: {
    gap: 6,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#241f2e',
  },
  coachingDockCompact: { paddingTop: 4, paddingBottom: 6, gap: 4 },
  coachBar: {
    flexDirection: 'row',
    gap: 6,
  },
  coachButton: {
    flex: 1,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#3a3350',
    borderWidth: 2,
    borderColor: '#6b6675',
    borderBottomWidth: 5,
    borderBottomColor: '#16121f',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  coachButtonCompact: { minHeight: 52, borderBottomWidth: 4, paddingVertical: 2 },
  coachButtonDisabled: { opacity: 0.38 },
  coachButtonDisabledReadable: { opacity: 0.68 },
  coachCopy: { flexShrink: 1, alignItems: 'flex-start' },
  coachLabel: { color: '#bcb7c4', fontSize: 8, fontWeight: 'bold' },
  coachValue: { color: '#f4f1ea', fontSize: 11, fontWeight: 'bold', marginTop: 3 },
  mentalityIcon: { color: '#70b879', fontSize: 28, fontWeight: 'bold' },
  swapIcon: { color: '#77a4d8', fontSize: 30, fontWeight: 'bold' },
  tiredValue: { color: '#edb54a', fontSize: 9 },
  energyUseRow: {
    backgroundColor: '#2d283c',
    borderWidth: 2,
    borderColor: '#6b6675',
    borderBottomWidth: 4,
    borderBottomColor: '#16121f',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingTop: 4,
    paddingBottom: 5,
  },
  energyUseRowCompact: { paddingTop: 2, paddingBottom: 3 },
  energyUseHeader: {
    minHeight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 3,
  },
  energyUseTitle: { color: '#bcb7c4', fontSize: 8, fontWeight: 'bold', letterSpacing: 0.6 },
  teamEnergy: {
    color: '#65b96e',
    fontSize: 9,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  energySegments: { flexDirection: 'row', gap: 4 },
  energySegment: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3a3350',
    borderWidth: 2,
    borderColor: '#49415f',
    borderBottomWidth: 3,
    borderBottomColor: '#16121f',
    borderRadius: 3,
    paddingHorizontal: 4,
  },
  energySegmentNarrow: { paddingHorizontal: 1 },
  energySegmentSelected: { borderColor: '#f4f1ea', borderBottomColor: '#f4f1ea' },
  energySegmentSave: { backgroundColor: '#35618e' },
  energySegmentBalanced: { backgroundColor: '#4f6753' },
  energySegmentAllOut: { backgroundColor: '#a83440' },
  energySegmentText: { color: '#bcb7c4', fontSize: 9, fontWeight: 'bold', textAlign: 'center' },
  energySegmentTextSelected: { color: '#f4f1ea' },
  swapOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    backgroundColor: '#16121fee',
    justifyContent: 'flex-end',
  },
  swapSheet: {
    backgroundColor: '#2d283c',
    borderTopWidth: 3,
    borderColor: '#6b6675',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 24,
  },
  swapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  swapEyebrow: { color: '#77a4d8', fontSize: 9, fontWeight: 'bold' },
  swapTitle: { color: '#f4f1ea', fontSize: 17, fontWeight: 'bold', marginTop: 2 },
  swapCount: {
    color: '#f4f1ea',
    backgroundColor: '#3a3350',
    borderWidth: 1,
    borderColor: '#6b6675',
    fontWeight: 'bold',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  swapInstruction: { color: '#bcb7c4', fontSize: 9, fontWeight: 'bold', marginTop: 5, marginBottom: 5 },
  playerGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4 },
  benchGrid: { flexDirection: 'row', justifyContent: 'center', gap: 8, minHeight: 62 },
  playerCard: {
    width: 49,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 3,
    paddingVertical: 3,
  },
  benchCard: {
    width: 54,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 3,
    paddingVertical: 3,
  },
  playerCardSelected: { backgroundColor: '#49415f', borderColor: '#f4f1ea' },
  benchCardDisabled: { opacity: 0.25 },
  playerHead: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#a83440',
    borderWidth: 2,
    borderColor: '#d94f52',
  },
  benchHead: { backgroundColor: '#35618e', borderColor: '#77a4d8' },
  playerHeadSelected: { borderColor: '#f4f1ea', transform: [{ scale: 1.08 }] },
  playerInitials: { color: '#f4f1ea', fontSize: 9, fontWeight: 'bold' },
  shirtNumber: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    color: '#241f2e',
    backgroundColor: '#f4f1ea',
    minWidth: 13,
    height: 13,
    borderRadius: 7,
    textAlign: 'center',
    fontSize: 8,
    fontWeight: 'bold',
  },
  playerSurname: { color: '#f4f1ea', fontSize: 8, marginTop: 3, maxWidth: 50 },
  roleLabel: { color: '#77a4d8', fontSize: 7, fontWeight: 'bold', marginTop: 1 },
  cardEnergyTrack: { width: 38, height: 3, backgroundColor: '#16121f', marginTop: 3, overflow: 'hidden' },
  cardEnergyFill: { height: 3, backgroundColor: '#65b96e' },
  cardEnergyText: {
    color: '#65b96e',
    fontSize: 7,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  benchEnergyText: { color: '#65b96e' },
  swapSelection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#241f2e',
    borderWidth: 1,
    borderColor: '#49415f',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  selectionSide: { flex: 1 },
  selectionLabel: { color: '#bcb7c4', fontSize: 8, fontWeight: 'bold' },
  selectionName: { color: '#f4f1ea', fontSize: 11, fontWeight: 'bold', marginTop: 2 },
  selectionEnergy: { color: '#65b96e', fontSize: 8, fontWeight: 'bold', marginTop: 2 },
  swapArrow: { color: '#f4f1ea', fontSize: 20, paddingHorizontal: 8 },
  swapActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  cancelButton: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3a3350',
    borderWidth: 2,
    borderColor: '#6b6675',
    borderBottomWidth: 4,
    borderBottomColor: '#16121f',
  },
  cancelText: { color: '#f4f1ea', fontSize: 12, fontWeight: 'bold' },
  confirmButton: {
    flex: 2,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#76509f',
    borderWidth: 2,
    borderColor: '#b189d9',
    borderBottomWidth: 4,
    borderBottomColor: '#563779',
  },
  confirmButtonDisabled: { opacity: 0.3 },
  confirmText: { color: '#f4f1ea', fontSize: 12, fontWeight: 'bold' },
  selectionPlaceholder: {
    color: '#bcb7c4',
    fontSize: 10,
  },
});
