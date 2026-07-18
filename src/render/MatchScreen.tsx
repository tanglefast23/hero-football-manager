import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Atlas, Canvas, Circle, Fill, Skia, type SkColor, type SkImage, type SkRect } from '@shopify/react-native-skia';
import { createMatch, queueInput, tick } from '../sim/match';
import { isActive, teamPowerBusy } from '../sim/powers';
import { ROVERS, UNITED } from '../sim/teams';
import { PITCH_W, PITCH_H, TICK_MS, HALF_TICKS, dist2 } from '../sim/geometry';
import type { MatchState, TeamDef } from '../sim/types';
import { buildSpriteAtlas, buildFallbackAtlas } from './sprites/buildAtlas';
import { spriteKeyForMatchSlot } from './sprites/slot-key';
import { snapshotFrame, type PitchFrame } from './interpolate';
import {
  actionPose,
  isKeeperReady,
  keeperReadyFrame,
  runFrameForDistance,
  type PlayerActionAnimation,
} from './animation';
import { useWorkletAtlasFrame } from './worklet-atlas-frame';
import { nextMatchSpeed, type MatchSpeed } from './match-speed';
import { WorkletMatchOverlays } from './WorkletMatchOverlays';
import { matchPoliciesForControlledTeam } from './match-control';
import { Pitch } from './Pitch';
import { DebugOverlay } from './DebugOverlay';
import { queueAutoPowerTap } from './autoPower';
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
// `scale` factor. Player cells are 16x20 source px; at PLAYER_DRAW_SCALE=26
// that's a ~28-34pt tall sprite across the common iPhone width range
// (375-430pt), matching the target "readable but not oversized" body size.
const PLAYER_DRAW_SCALE = 26;

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

// Shot presentation (render-only) — a shot reads differently from a pass via a
// fading motion trail on the ball plus a dust puff kicked up at the strike.
const SHOT_TRAIL_LEN = 6; // recent ball positions kept while a shot is in flight
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
const PLAYER_CELL_W = 16;

// Held-ball foot offset (T8) — draws a held ball at the carrier's leading
// foot instead of dead-center, so it reads as carried rather than "stood
// on." Render-only (transforms useMemo below); never touches frame.ball,
// frame.players, or any sim state. Reuses PLAYER_CELL_W above for "half the
// player sprite's drawn width."
const BALL_FOOT_FORWARD_FRACTION = 0.35; // of the player sprite's drawn half-width
const BALL_FOOT_DOWN_PX = 3; // feet sit toward the sprite's bottom half, not its center
const BALL_FOOT_DEADZONE_PX = 0.5; // tick-to-tick screen-px delta below this reads as "stationary"

// Side of the plain white square drawn when the sprite pack fails to build
// (the plan's original placeholder texture size).
const FALLBACK_SPRITE = 16;

// UX fix (zone-entry discoverability) — a HOME hero's zone entry gets a
// longer "go tap now" banner than a RIVAL hero's threat flash, since only the
// home banner is asking the player to do something before the window closes.
const ZONE_BANNER_TICKS = 25;
const RIVAL_ZONE_BANNER_TICKS = 20;

// How long the "wait for the glow…" early-tap feedback (mini-label + chip
// border flash) stays visible after a home hero is tapped outside its zone.
const EARLY_TAP_TICKS = 15;

// WARMTH step heat thresholds for the (non-zone) chip background/border.
// ZONE_HEAT_THRESHOLD (sim/powers.ts) is 60 — the heat level below which a
// Zone-entry roll can never happen at all — so "warming" starts exactly
// there; "hot ember" at 100 flags heat that has run past the old 0-100 gauge
// display range (heat has no firing-relevant ceiling; it only ever affects
// the entry-roll odds).
const WARMTH_WARM_THRESHOLD = 60;
const WARMTH_HOT_THRESHOLD = 100;

type WarmthStep = 'cold' | 'warming' | 'hot';
const warmthStep = (heat: number): WarmthStep =>
  heat >= WARMTH_HOT_THRESHOLD ? 'hot' : heat >= WARMTH_WARM_THRESHOLD ? 'warming' : 'cold';

// On-pitch zone marker geometry — a small upward triangle drawn ~14pt above
// a HOME hero's sprite while it's in the Zone, so an eyes-on-the-pitch player
// spots the tap opportunity without looking down at the chip row. Rival zone
// entries already get their own on-pitch tell (the existing red ring), so
// this marker — like the chip urgency and early-tap feedback above — is
// home-only.
const MARKER_Y_OFFSET = 14; // pt above the sprite's center, before the triangle's own height
const MARKER_HALF_W = 5;
const MARKER_H = 7;
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
  onDone,
}: {
  seed: number;
  home?: TeamDef;
  away?: TeamDef;
  controlledTeam?: 0 | 1;
  onDone: (state: MatchState) => void;
}) {
  const { width } = useWindowDimensions();
  const scale = width / PITCH_W;
  const pitchH = PITCH_H * scale;
  const homeCode = scoreCode(home);
  const awayCode = scoreCode(away);

  // Ledger item 1 — lazy init: never `useRef(createMatch(...))`, whose
  // argument expression would run (creating and discarding a fresh match)
  // on every render. Guard-then-assign only ever creates one match per mount.
  const stateRef = useRef<MatchState | null>(null);
  if (stateRef.current === null) {
    stateRef.current = createMatch(seed, home, away, matchPoliciesForControlledTeam(controlledTeam));
  }
  const match = stateRef.current;

  const prevRef = useRef<PitchFrame | null>(null);
  const nextRef = useRef<PitchFrame | null>(null);
  if (prevRef.current === null) {
    const initial = snapshotFrame(match);
    prevRef.current = initial;
    nextRef.current = initial;
  }

  const trailRef = useRef<Array<{ x: number; y: number }>>([]);
  const bannerRef = useRef<{ text: string; untilTick: number; tone: 'gold' | 'red' }>({
    text: '',
    untilTick: 0,
    tone: 'gold',
  });
  const expiredAtRef = useRef<Record<number, number>>({});
  const scoreFlashUntilRef = useRef<number>(0);
  // Shot presentation — recent ball positions while a shot flies (motion
  // trail), and the last kick origin + tick (dust puff). Render-only.
  const shotTrailRef = useRef<Array<{ x: number; y: number }>>([]);
  const puffRef = useRef<{ x: number; y: number; tick: number } | null>(null);
  // End-of-match hold deadline (RAF/performance.now() timebase), set once
  // when the loop first sees phase === 'fulltime' — see FULLTIME_HOLD_MS.
  const fulltimeDeadlineRef = useRef<number | null>(null);
  // UX fix — keyed by player index: the tick a home hero's chip was last
  // tapped outside its zone (early-tap feedback), read by homeChip() below.
  const pressFeedbackRef = useRef<Record<number, number>>({});
  // Render-only tackle choreography keyed by player index. TACKLE is already
  // part of the deterministic event stream; these poses never feed back into
  // positions, possession, RNG, or replay data.
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
    bannerTone: 'gold' as 'gold' | 'red',
    scoreFlash: false,
    visualTick: 0,
  });
  const [speed, setSpeed] = useState<MatchSpeed>(1);
  const [autoPower, setAutoPower] = useState(false);
  // Dev-only movement-table tuning instrument (movement spec's debug-overlay
  // deliverable; the toggle ships __DEV__-gated, never in release UI).
  const [debugGrid, setDebugGrid] = useState(false);
  const [paused, setPaused] = useState(false);
  const speedRef = useRef<MatchSpeed>(1);
  const autoPowerRef = useRef(false);
  const pausedRef = useRef(false);
  speedRef.current = speed;

  const setAutoPowerBoth = (enabled: boolean) => {
    autoPowerRef.current = enabled;
    setAutoPower(enabled);
  };
  // Ledger item 4 — build the atlas once at mount from the merged sprite pack.
  // If the pack fails to build (realistically: sprites.json failing loader
  // validation), fall back to a white square texture with team-color tints
  // (the plan's original placeholder look) instead of crashing the match.
  const atlas = useMemo(() => {
    try {
      return { ...buildSpriteAtlas(Skia), fallbackMode: false };
    } catch (err) {
      console.warn('MatchScreen: buildSpriteAtlas failed — rendering placeholder rects', err);
      return { ...buildFallbackAtlas(Skia, FALLBACK_SPRITE), fallbackMode: true };
    }
  }, []);

  const playerCell = atlas.rectFor('r0:run0');
  const ballCell = atlas.rectFor('ball');
  const {
    transforms: workletTransforms,
    visualPositions: workletVisualPositions,
    statuses: workletStatuses,
    zoneFractions: workletZoneFractions,
    carrier: workletCarrier,
    simTick: workletSimTick,
    progress: workletProgress,
    publish: publishAtlasFrame,
    pause: pauseAtlasFrame,
    resume: resumeAtlasFrame,
  } = useWorkletAtlasFrame({
    initialFrame: prevRef.current!,
    scale,
    playerCell: { width: playerCell.w, height: playerCell.h },
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
        setPausedBoth(true); // background -> hard pause; user resumes via a tap
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
        if (autoPowerRef.current) queueAutoPowerTap(s, controlledTeam);
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
        trailRef.current = speedster ? [{ ...speedster.pos }, ...trailRef.current].slice(0, 7) : [];

        // Shot-ball motion trail — recent ball positions while it's a live
        // shot; cleared the instant it stops being one (goal/save/miss).
        shotTrailRef.current = nextRef.current!.ballShooting
          ? [{ ...nextRef.current!.ball }, ...shotTrailRef.current].slice(0, SHOT_TRAIL_LEN)
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
        if (e.kind === 'POWER_FIRED' && e.power === 'FIRE_TORCH') {
          torchCasterPos = { ...nextRef.current!.players[e.player] };
        }
        if (e.kind === 'SHOT' && e.by >= 0 && e.by < 22) {
          // Kick up a dust puff at the striker's feet — the visual "he hit it".
          const o = s.players[e.by].pos;
          puffRef.current = { x: o.x, y: o.y, tick: e.t };
        }
        if (e.kind === 'GOAL' || e.kind === 'MISS' || e.kind === 'HALF_TIME' || e.kind === 'KICKOFF') snap = true;
        if (e.kind === 'GOAL') {
          const scorerName = e.by >= 0 && e.by < 22 ? s.players[e.by].def.name : 'Unknown';
          bannerRef.current = { text: `⚡ GOAL! ${scorerName}`, untilTick: e.t + FLASH_TICKS, tone: 'gold' };
          scoreFlashUntilRef.current = e.t + FLASH_TICKS;
        }
        if (e.kind === 'POWER_FIRED') {
          bannerRef.current = {
            text: `⚡ ${e.power.replace(/_/g, ' ')} — ${s.players[e.player].def.name}`,
            untilTick: e.t + FLASH_TICKS,
            tone: 'gold',
          };
        }
        if (e.kind === 'HALF_TIME') {
          bannerRef.current = { text: '⚡ HALF TIME', untilTick: e.t + FLASH_TICKS, tone: 'gold' };
        }
        if (e.kind === 'FULL_TIME') {
          // Sim ticks freeze at fulltime, so `s.tick <= untilTick` below
          // holds and this banner stays up for the whole end-of-match hold.
          bannerRef.current = { text: '⚡ FULL TIME', untilTick: e.t + FLASH_TICKS, tone: 'gold' };
        }
        if (e.kind === 'POWER_EXPIRED') expiredAtRef.current[e.player] = e.t;
        if (e.kind === 'TACKLE') {
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
          actionRef.current[e.by] = { kind: 'slide', startTick, direction, rotation };
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
          } else if (e.won) {
            actionRef.current[e.on] = {
              kind: 'fall',
              startTick,
              anchor: { ...onPos },
              rotation: -rotation,
            };
          }
        }
        if (e.kind === 'IGNITED') {
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
          scoreFlash: s.tick <= scoreFlashUntilRef.current,
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
        if (fulltimeDeadlineRef.current === null) fulltimeDeadlineRef.current = now + FULLTIME_HOLD_MS;
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
  }, [onDone, publishAtlasFrame]);

  // Distance, not wall-clock ticks, advances the run cycle. The action pose
  // takes priority, followed by the far-ball GK ready loop, then locomotion.
  const playerSpriteKeys = useMemo(() => match.players.map((p, i) => {
    const pose = actionPose(actionRef.current[i], hud.visualTick);
    if (pose.active) return spriteKeyForMatchSlot(i, 'run0');
    if (p.def.role === 'GK' && isKeeperReady(dist2(frame.players[i], frame.ball))) {
      return spriteKeyForMatchSlot(i, keeperReadyFrame(hud.visualTick));
    }
    return spriteKeyForMatchSlot(i, runFrameForDistance(frame.travel[i], frame.moved[i]));
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
      if (st === 'ignited') return Skia.Color('#ff6a00');
      if (st === 'out') return Skia.Color('#666666');
      if (st === 'windup') return Skia.Color(hud.tick % 4 < 2 ? '#ffffff' : '#f5c518');
      if (st === 'active') return Skia.Color('#f5c518');
      // 'ok' | 'zone' — zone is telegraphed by the glow ring, not a body tint.
      // In fallback mode there are no kit pixels to preserve, so tint the
      // white placeholder rects with team colors instead.
      return atlas.fallbackMode ? Skia.Color(i < 11 ? '#e8433f' : '#3f6fd8') : Skia.Color('#ffffff');
    });
    tints.push(Skia.Color('#ffffff')); // ball — no tint
    return tints;
  }, [frame, hud.tick, atlas]);

  const minute = Math.min(90, Math.ceil((hud.tick / TOTAL_TICKS) * 90));
  const stoppage =
    match.phase === 'play' &&
    ((match.half === 1 && match.tick >= HALF_TICKS) || (match.half === 2 && match.tick >= TOTAL_TICKS));
  const ringR = (PLAYER_CELL_W * scale * PLAYER_DRAW_SCALE) / 2 + 4;
  // Zone-urgency chip border pulse — alternates gold/white every ~5 ticks,
  // independent of the on-canvas ring's own (slower, 20-tick) pulse above.
  const chipPulseGold = hud.tick % 10 < 5;

  // Home/rival hero indices — scanned generically from live roster data
  // (whichever players carry `def.power`) instead of hardcoded slots, since
  // which squad members are heroes is content, not an engine fact.
  const { userHeroes, rivalHeroes, heroPlayers, fireTorchPlayers } = useMemo(() => {
    const user: number[] = [];
    const rival: number[] = [];
    const heroes: number[] = [];
    const fireTorch: number[] = [];
    match.players.forEach((p, i) => {
      if (!p.def.power) return;
      heroes.push(i);
      if (p.def.power === 'FIRE_TORCH') fireTorch.push(i);
      (p.team === controlledTeam ? user : rival).push(i);
    });
    return {
      userHeroes: user,
      rivalHeroes: rival,
      heroPlayers: heroes,
      fireTorchPlayers: fireTorch,
    };
  }, [controlledTeam, match]);

  // Shared per-chip state, read by both renderers below.
  //
  // Availability guard — a hero knocked out mid-window KEEPS its Zone by
  // design (docs/04 canon: the window pauses and resumes on recovery — see
  // powers.ts knockOut), so a downed hero legitimately carries
  // `powerState.kind === 'zone'`. The chips must not treat that paused window
  // as tappable. `outUntilTick > match.tick` is the same "is this player
  // currently out" check interpolate.ts's snapshotFrame uses to pick the
  // canvas 'out'/'ignited' tint, so it renders unavailable here too —
  // dimmed, no zone styling, no TAP! overlay, no queued input.
  //
  // Ledger item 5 — no 'ready' state exists; a hero is chip-highlighted
  // while its powerState.kind is 'zone'.
  //
  // WARMTH step replaces the old numeric heat bar — heat-weighted zone
  // entry is a hot-streak mechanic, not a "fills up and fires" gauge, so no
  // bar/number is shown. The zone state owns the chip's look once a hero is
  // actually in the Zone; warmth only applies before that.
  const chipState = (idx: number) => {
    const p = match.players[idx];
    const unavailable = p.outUntilTick > match.tick;
    const inZoneRaw = !unavailable && p.powerState.kind === 'zone';
    // One power per team: a teammate winding/active freezes this hero's Zone
    // (paused in the sim). A frozen home window must not invite a tap — powerTick
    // silently drops a tap while the team is busy (audit finding 7) — so the
    // home chip treats `frozen` as "waiting, not tappable". The rival strip keeps
    // using `inZoneRaw` for its threat glow (a paused rival is still a threat).
    const frozen = inZoneRaw && teamPowerBusy(match, p.team);
    const inZone = inZoneRaw && !frozen;
    const dimmed = match.tick - (expiredAtRef.current[idx] ?? -Infinity) < FLASH_TICKS;
    const step = unavailable || inZoneRaw ? null : warmthStep(p.gauge);
    return { p, unavailable, inZone, inZoneRaw, frozen, dimmed, step };
  };

  const homeChip = (idx: number) => {
    const { p, unavailable, inZone, frozen, dimmed, step } = chipState(idx);
    // UX fix — early-tap feedback: set (only) in onPress below, read here for
    // up to EARLY_TAP_TICKS afterward.
    const earlyTap = !unavailable && match.tick - (pressFeedbackRef.current[idx] ?? -Infinity) < EARLY_TAP_TICKS;
    const warmthStyle = step === 'warming' ? styles.warmingHome : step === 'hot' ? styles.hotHome : null;
    return (
      <Pressable
        key={idx}
        disabled={unavailable || frozen}
        style={[
          styles.chip,
          warmthStyle,
          inZone ? styles.chipReady : null,
          inZone ? styles.chipZoneTap : null,
          inZone ? { borderColor: chipPulseGold ? '#f5c518' : '#ffffff' } : null,
          dimmed || unavailable || frozen ? styles.chipDim : null,
          earlyTap ? styles.chipFlash : null,
        ]}
        onPress={() => {
          // Route around the old unconditional queue — a tap outside the
          // Zone was always a no-op in the sim (powerTick only converts a
          // POWER_TAP input while powerState.kind === 'zone'; see
          // sim/powers.ts), so gating it here changes no sim behavior. It
          // just stops those taps from feeling ignored. `disabled` above
          // already blocks this when unavailable/frozen; the check is repeated
          // here so the guard holds even if disabled's native behavior
          // ever changes. `frozen` = the Zone is paused behind a busy teammate,
          // so a tap would be silently dropped by powerTick (audit finding 7).
          if (unavailable || frozen) return;
          if (p.powerState.kind === 'zone') {
            queueInput(match, { tick: match.tick + 1, kind: 'POWER_TAP', player: idx });
          } else {
            pressFeedbackRef.current[idx] = match.tick;
          }
        }}
      >
        {inZone ? <Text style={styles.tapOverlay}>TAP!</Text> : null}
        <Text style={styles.chipName}>{p.def.name.split(' ')[1]}</Text>
        {earlyTap ? <Text style={styles.waitLabel}>wait for the glow…</Text> : null}
      </Pressable>
    );
  };

  // Rival strip chip — slim, non-tappable badge (red family, plain View: no
  // Pressable behavior at all). Keeps the zone-threat glow (chipThreat) when
  // he's in the Zone — starving his window is the counterplay, so seeing him
  // heat up matters even though the player can't act on it directly.
  const rivalChip = (idx: number) => {
    const { p, unavailable, inZoneRaw, dimmed, step } = chipState(idx);
    const warmthStyle = step === 'warming' ? styles.warmingRival : step === 'hot' ? styles.hotRival : null;
    return (
      <View
        key={idx}
        style={[
          styles.rivalChip,
          warmthStyle,
          inZoneRaw ? styles.chipThreat : null, // a paused rival is still a threat — unchanged from pre-fix
          dimmed || unavailable ? styles.chipDim : null,
        ]}
      >
        <Text style={styles.rivalTag}>RIVAL</Text>
        <Text style={styles.rivalChipName}>{p.def.name.split(' ')[1]}</Text>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <Pressable style={styles.scorebar} onPress={() => setPausedBoth(!pausedRef.current)}>
        <Text style={[styles.scoreText, hud.scoreFlash ? styles.scoreTextFlash : null]}>
          {homeCode} {hud.score[0]} – {hud.score[1]} {awayCode} · {minute}'{stoppage ? '+' : ''}
          {paused ? ' ⏸' : ''}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Match speed ${speed} times. Tap for next speed.`}
          hitSlop={10}
          onPress={() => setSpeed((current) => {
            const next = nextMatchSpeed(current);
            speedRef.current = next;
            resumeAtlasFrame(next);
            return next;
          })}
        >
          <Text style={styles.speedText}>×{speed}</Text>
        </Pressable>
        {__DEV__ ? (
          <Pressable onPress={() => setDebugGrid((d) => !d)}>
            <Text style={styles.speedText}>{debugGrid ? '▦' : '▢'}</Text>
          </Pressable>
        ) : null}
      </Pressable>
      {rivalHeroes.length > 0 ? (
        <View style={styles.rivalStrip}>{rivalHeroes.map((i) => rivalChip(i))}</View>
      ) : null}
      <Canvas style={{ width, height: pitchH }}>
        <Fill color="#2e7d3a" />
        <Pitch scale={scale} />
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
        {/* Shot motion trail — a fading streak behind the ball while it flies. */}
        {shotTrailRef.current.map((t, i) => (
          <Circle
            key={`shot-${i}`}
            cx={t.x * scale}
            cy={t.y * scale}
            r={Math.max(1.5, 6.5 - i)}
            color="#f4f7fa"
            opacity={0.6 * (1 - i / SHOT_TRAIL_LEN)}
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
            <Circle key="impact-core" cx={cx} cy={cy} r={6 + prog * 22} color="#fff2b0" opacity={fade * 0.5} />,
            <Circle
              key="impact-ring"
              cx={cx}
              cy={cy}
              r={9 + prog * 34}
              color="#ffd23a"
              style="stroke"
              strokeWidth={3}
              opacity={fade * 0.7}
            />,
          ];
        })()}
        <Atlas
          image={atlas.image as SkImage}
          sprites={sprites}
          transforms={workletTransforms}
          colors={colors}
          colorBlendMode="modulate"
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
        />
        {debugGrid ? <DebugOverlay state={match} scale={scale} /> : null}
      </Canvas>
      {hud.banner ? (
        <Text style={[styles.banner, hud.bannerTone === 'red' ? styles.bannerThreat : null]}>{hud.banner}</Text>
      ) : null}
      {userHeroes.length > 0 ? (
        <View style={styles.chips}>
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Auto activate super powers"
            accessibilityState={{ checked: autoPower }}
            onPress={() => setAutoPowerBoth(!autoPowerRef.current)}
            style={[styles.autoButton, autoPower ? styles.autoButtonOn : null]}
          >
            <Text style={[styles.autoLabel, autoPower ? styles.autoLabelOn : null]}>AUTO</Text>
            <Text style={[styles.autoState, autoPower ? styles.autoStateOn : null]}>{autoPower ? 'ON' : 'OFF'}</Text>
          </Pressable>
          {userHeroes.map((i) => homeChip(i))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#101418' },
  scorebar: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, paddingTop: 56, paddingRight: 98 },
  scoreText: { color: 'white', fontSize: 18, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  scoreTextFlash: { color: '#f5c518' },
  speedText: { color: 'white', fontSize: 18, padding: 4 },
  banner: { color: '#f5c518', fontSize: 18, fontWeight: 'bold', textAlign: 'center', padding: 8 },
  bannerThreat: { color: '#e8433f' },
  chips: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 16 },
  autoButton: {
    minWidth: 56,
    minHeight: 54,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e2630',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#59636e',
    paddingHorizontal: 8,
  },
  autoButtonOn: { backgroundColor: '#4a3b10', borderColor: '#f5c518' },
  autoLabel: { color: '#aab2bb', fontSize: 11, fontWeight: 'bold' },
  autoLabelOn: { color: '#f5c518' },
  autoState: { color: '#ffffff', fontSize: 13, fontWeight: 'bold', marginTop: 2 },
  autoStateOn: { color: '#f5c518' },
  chip: { backgroundColor: '#1e2630', borderRadius: 12, padding: 12, minWidth: 96, alignItems: 'center' },
  // Rival strip — sits under the scorebar, above the Canvas. Kept slim
  // (reduced padding, smaller text than the home chip) since the Canvas
  // height is width-derived, so any chrome added above it pushes the pitch
  // down.
  rivalStrip: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 4, paddingHorizontal: 12 },
  // The constant transparent border reserves the warm/hot/threat border's
  // space up front: the strip sits above the fixed-height Canvas, so a
  // state-dependent borderWidth would change the chip's height and nudge
  // the whole pitch down and back mid-play. The rival state styles below
  // must therefore only ever change colors, never metrics.
  rivalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1e2630',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  // WARMTH steps (replace the old numeric heat bar — heat-weighted zone entry
  // is a hot-streak mechanic, not a "fills up and fires" gauge). Cold has no
  // entry here: it keeps the plain `chip` look above, unchanged.
  warmingHome: { backgroundColor: '#2b2a24', borderWidth: 1, borderColor: '#6b5b2a' },
  hotHome: { backgroundColor: '#3a2f18', borderWidth: 1, borderColor: '#a8842e' },
  warmingRival: { backgroundColor: '#2f1f1e', borderColor: '#7a3a34' },
  hotRival: { backgroundColor: '#3f2320', borderColor: '#b04a40' },
  chipReady: { backgroundColor: '#4a3b10', borderWidth: 2, borderColor: '#f5c518' },
  chipThreat: { backgroundColor: '#3a1512', borderColor: '#e8433f' },
  chipZoneTap: { transform: [{ scale: 1.08 }] },
  chipDim: { opacity: 0.4 },
  // Early-tap feedback — brief bright-white border flash standing in for the
  // old "flash the heat bar brighter" (there is no bar anymore; see WARMTH).
  chipFlash: { borderWidth: 2, borderColor: '#ffffff' },
  chipName: { color: 'white', fontSize: 14, marginBottom: 6 },
  rivalTag: { color: '#e8433f', fontSize: 11, fontWeight: 'bold' },
  rivalChipName: { color: 'white', fontSize: 11 },
  tapOverlay: {
    position: 'absolute',
    top: -14,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#f5c518',
    fontSize: 18,
    fontWeight: 'bold',
  },
  waitLabel: {
    position: 'absolute',
    bottom: -16,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 11,
  },
});
