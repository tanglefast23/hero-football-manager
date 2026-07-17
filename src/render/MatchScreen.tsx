import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Atlas, Canvas, Circle, Fill, Skia, type SkColor, type SkImage, type SkRSXform, type SkRect } from '@shopify/react-native-skia';
import { createMatch, queueInput, tick } from '../sim/match';
import { ROVERS, UNITED } from '../sim/teams';
import { PITCH_W, PITCH_H, TICK_MS, HALF_TICKS, dist2 } from '../sim/geometry';
import type { MatchState } from '../sim/types';
import { buildSpriteAtlas } from './sprites/buildAtlas';
import { lerpFrame, snapshotFrame, type PitchFrame } from './interpolate';
import { Pitch } from './Pitch';

const MY_HEROES = [9, 10]; // Dario Flint (FIRE_TORCH), Zip Vela (SUPER_SPEED)
const RIVAL_HERO = 14; // Rex Bould (SUPER_STRENGTH) — team 1 index 3 (11 + 3)
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

// Player sprite cell width (sprites.json `cell.w`, validated by loadSpriteSheet)
// — used to size the possession/zone rings around a player's sprite.
const PLAYER_CELL_W = 16;

// Side of the plain white square drawn when the sprite pack fails to build
// (the plan's original placeholder texture size).
const FALLBACK_SPRITE = 16;

export function MatchScreen({ seed, onDone }: { seed: number; onDone: (state: MatchState) => void }) {
  const { width } = useWindowDimensions();
  const scale = width / PITCH_W;
  const pitchH = PITCH_H * scale;

  // Ledger item 1 — lazy init: never `useRef(createMatch(...))`, whose
  // argument expression would run (creating and discarding a fresh match)
  // on every render. Guard-then-assign only ever creates one match per mount.
  const stateRef = useRef<MatchState | null>(null);
  if (stateRef.current === null) {
    stateRef.current = createMatch(seed, ROVERS, UNITED);
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
  const bannerRef = useRef<{ text: string; untilTick: number }>({ text: '', untilTick: 0 });
  const expiredAtRef = useRef<Record<number, number>>({});
  const scoreFlashUntilRef = useRef<number>(0);

  const [frame, setFrame] = useState<PitchFrame>(() => prevRef.current!);
  const [hud, setHud] = useState({ score: [0, 0] as [number, number], tick: 0, banner: '', scoreFlash: false });
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const speedRef = useRef(1);
  const pausedRef = useRef(false);
  speedRef.current = speed;

  // Ledger item 2 — single pause setter: sets React state AND pausedRef
  // together. There is deliberately NO render-time `pausedRef.current = paused`
  // write-back: that pattern silently un-paused the match after backgrounding,
  // because the AppState listener below only touched the ref while `paused`
  // (state) stayed false, and the very next render's write-back stomped the
  // ref back to false, undoing the pause one frame after it took effect.
  const setPausedBoth = (v: boolean) => {
    pausedRef.current = v;
    setPaused(v);
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
      const surface = Skia.Surface.MakeOffscreen(FALLBACK_SPRITE, FALLBACK_SPRITE);
      if (!surface) throw err; // Skia itself is broken — nothing could render anyway
      const canvas = surface.getCanvas();
      const paint = Skia.Paint();
      paint.setColor(Skia.Color('#ffffff'));
      canvas.drawRect(Skia.XYWHRect(0, 0, FALLBACK_SPRITE, FALLBACK_SPRITE), paint);
      surface.flush();
      return {
        // MakeOffscreen is GPU-backed; makeNonTextureImage() copies the
        // snapshot into a portable, CPU-backed image so it actually renders
        // inside the match <Canvas>'s own separate GPU context (see the
        // matching comment in buildAtlas.ts's SkiaImageLike).
        image: surface.makeImageSnapshot().makeNonTextureImage() as unknown,
        rectFor: (_key: string) => ({ x: 0, y: 0, w: FALLBACK_SPRITE, h: FALLBACK_SPRITE }),
        fallbackMode: true,
      };
    }
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

      // No pausedRef check needed here: the early return above already ran,
      // and the flag cannot flip mid-invocation on a single-threaded runtime.
      while (acc >= TICK_MS && s.phase !== 'fulltime') {
        const before = nextRef.current!.players;
        prevRef.current = nextRef.current;
        tick(s);
        nextRef.current = snapshotFrame(s, before);

        for (let i = 0; i < 22; i++) {
          if (dist2(prevRef.current!.players[i], nextRef.current.players[i]) > SNAP_DIST2) {
            snap = true;
            break;
          }
        }

        const speedster = s.players.find((p, i) => nextRef.current!.statuses[i] === 'active' && p.def.power === 'SUPER_SPEED');
        trailRef.current = speedster ? [{ ...speedster.pos }, ...trailRef.current].slice(0, 3) : [];

        acc -= TICK_MS;
      }

      const newEvents = s.events.slice(eventsBefore);
      for (const e of newEvents) {
        if (e.kind === 'GOAL' || e.kind === 'MISS' || e.kind === 'HALF_TIME') snap = true;
        if (e.kind === 'GOAL') {
          const scorerName = e.by >= 0 && e.by < 22 ? s.players[e.by].def.name : 'Unknown';
          bannerRef.current = { text: `GOAL! ${scorerName}`, untilTick: e.t + FLASH_TICKS };
          scoreFlashUntilRef.current = e.t + FLASH_TICKS;
        }
        if (e.kind === 'POWER_FIRED') {
          bannerRef.current = {
            text: `${e.power.replace(/_/g, ' ')} — ${s.players[e.player].def.name}`,
            untilTick: e.t + FLASH_TICKS,
          };
        }
        if (e.kind === 'HALF_TIME') bannerRef.current = { text: 'HALF TIME', untilTick: e.t + FLASH_TICKS };
        if (e.kind === 'POWER_EXPIRED') expiredAtRef.current[e.player] = e.t;
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

      setFrame(lerpFrame(prevRef.current!, nextRef.current!, Math.min(1, acc / TICK_MS)));
      setHud({
        score: [...s.score] as [number, number],
        tick: s.tick,
        banner: s.tick <= bannerRef.current.untilTick ? bannerRef.current.text : '',
        scoreFlash: s.tick <= scoreFlashUntilRef.current,
      });

      if (s.phase === 'fulltime') {
        onDone(s);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      sub.remove();
    };
  }, [onDone]);

  // Ledger item 4 — per-player sprite key: `${id}:run${frame}`, 2-frame cycle
  // while the player moved this tick, run0 (idle pose) when stationary. Ball
  // is the 23rd atlas entry (index 22), sharing the same texture/draw call.
  const sprites: SkRect[] = useMemo(() => {
    const ball = atlas.rectFor('ball');
    return [
      ...match.players.map((p, i) => {
        const runFrame = frame.moved[i] ? Math.floor(hud.tick / 5) % 2 : 0;
        const r = atlas.rectFor(`${p.def.id}:run${runFrame}`);
        return Skia.XYWHRect(r.x, r.y, r.w, r.h);
      }),
      Skia.XYWHRect(ball.x, ball.y, ball.w, ball.h),
    ];
  }, [frame, hud.tick, atlas, match]);

  const transforms: SkRSXform[] = useMemo(() => {
    const scos = scale * PLAYER_DRAW_SCALE;
    const ballScos = scale * BALL_DRAW_SCALE;
    const ball = atlas.rectFor('ball');
    return [
      ...match.players.map((p, i) => {
        const runFrame = frame.moved[i] ? Math.floor(hud.tick / 5) % 2 : 0;
        const r = atlas.rectFor(`${p.def.id}:run${runFrame}`);
        const pos = frame.players[i];
        return Skia.RSXform(scos, 0, pos.x * scale - (r.w * scos) / 2, pos.y * scale - (r.h * scos) / 2);
      }),
      Skia.RSXform(
        ballScos,
        0,
        frame.ball.x * scale - (ball.w * ballScos) / 2,
        frame.ball.y * scale - (ball.h * ballScos) / 2
      ),
    ];
  }, [frame, hud.tick, atlas, match, scale]);

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
  const pulse = hud.tick % 20 < 10 ? 1 : 0.55;
  const ringR = (PLAYER_CELL_W * scale * PLAYER_DRAW_SCALE) / 2 + 4;

  const chip = (idx: number, tappable: boolean) => {
    const p = match.players[idx];
    // Ledger item 5 — no 'ready' state exists; a hero is chip-highlighted
    // while its powerState.kind is 'zone'. Rival chip glows red, not gold —
    // starving his window is the counterplay, so the threat read matters.
    const inZone = p.powerState.kind === 'zone';
    const dimmed = match.tick - (expiredAtRef.current[idx] ?? -Infinity) < FLASH_TICKS;
    return (
      <Pressable
        key={idx}
        disabled={!tappable}
        style={[styles.chip, inZone ? (tappable ? styles.chipReady : styles.chipThreat) : null, dimmed ? styles.chipDim : null]}
        onPress={() => queueInput(match, { tick: match.tick + 1, kind: 'POWER_TAP', player: idx })}
      >
        <Text style={styles.chipName}>{(tappable ? '' : '⚠ ') + p.def.name.split(' ')[1]}</Text>
        <View style={styles.gaugeTrack}>
          <View
            style={[
              styles.gaugeFill,
              !tappable ? styles.gaugeFillThreat : null,
              // Ledger item 5 — heat runs past 100 (it never gates firing), so the bar must clamp.
              { width: `${Math.min(100, Math.round(p.gauge))}%` },
            ]}
          />
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <Pressable style={styles.scorebar} onPress={() => setPausedBoth(!pausedRef.current)}>
        <Text style={[styles.scoreText, hud.scoreFlash ? styles.scoreTextFlash : null]}>
          ROV {hud.score[0]} – {hud.score[1]} UNI · {minute}'{stoppage ? '+' : ''}
          {paused ? ' ⏸' : ''}
        </Text>
        <Pressable onPress={() => setSpeed((x) => (x === 1 ? 2 : 1))}>
          <Text style={styles.speedText}>×{speed}</Text>
        </Pressable>
      </Pressable>
      <Canvas style={{ width, height: pitchH }}>
        <Fill color="#2e7d3a" />
        <Pitch scale={scale} />
        {trailRef.current.map((t, i) => (
          <Circle key={i} cx={t.x * scale} cy={t.y * scale} r={4 - i} color="#ffffff" opacity={0.5 - i * 0.15} />
        ))}
        {frame.statuses.map((st, i) =>
          st === 'zone' ? (
            <Circle
              key={`zone-${i}`}
              cx={frame.players[i].x * scale}
              cy={frame.players[i].y * scale}
              r={ringR}
              color={i < 11 ? '#f5c518' : '#e8433f'}
              style="stroke"
              strokeWidth={2}
              opacity={frame.zoneFraction[i] * pulse}
            />
          ) : null
        )}
        <Atlas
          image={atlas.image as SkImage}
          sprites={sprites}
          transforms={transforms}
          colors={colors}
          colorBlendMode="modulate"
        />
        {frame.carrier >= 0 ? (
          <Circle
            cx={frame.players[frame.carrier].x * scale}
            cy={frame.players[frame.carrier].y * scale}
            r={ringR + 2}
            color="#ffffff"
            style="stroke"
            strokeWidth={2}
          />
        ) : null}
      </Canvas>
      {hud.banner ? <Text style={styles.banner}>⚡ {hud.banner}</Text> : null}
      <View style={styles.chips}>
        {MY_HEROES.map((i) => chip(i, true))}
        {chip(RIVAL_HERO, false)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#101418' },
  scorebar: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, paddingTop: 56 },
  scoreText: { color: 'white', fontSize: 18, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  scoreTextFlash: { color: '#f5c518' },
  speedText: { color: 'white', fontSize: 18, padding: 4 },
  banner: { color: '#f5c518', fontSize: 18, fontWeight: 'bold', textAlign: 'center', padding: 8 },
  chips: { flexDirection: 'row', justifyContent: 'space-around', padding: 16 },
  chip: { backgroundColor: '#1e2630', borderRadius: 12, padding: 12, minWidth: 96, alignItems: 'center' },
  chipReady: { backgroundColor: '#4a3b10', borderWidth: 2, borderColor: '#f5c518' },
  chipThreat: { backgroundColor: '#3a1512', borderWidth: 2, borderColor: '#e8433f' },
  chipDim: { opacity: 0.4 },
  chipName: { color: 'white', fontSize: 14, marginBottom: 6 },
  gaugeTrack: { width: 72, height: 8, backgroundColor: '#0a0e12', borderRadius: 4, overflow: 'hidden' },
  gaugeFill: { height: 8, backgroundColor: '#f5c518' },
  gaugeFillThreat: { backgroundColor: '#e8433f' },
});
