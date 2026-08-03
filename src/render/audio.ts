// Owns SFX + match-theme playback for the match screen. Render-ring only —
// sim/ stays pure TS with zero awareness of this module.
//
// Fail-soft by design: expo-audio's native module (requireNativeModule in
// expo-modules-core) throws synchronously the moment ANY code first imports
// a value from 'expo-audio', if the native side isn't linked into the
// running app — which is true of the dev client installed as of T5 (it
// predates this feature; the T6 rebuild adds the native module). A static
// top-level `import { createAudioPlayer } from 'expo-audio'` would therefore
// crash on module load today. initAudio() below loads the module with a
// lazy `require` inside a try/catch instead, so that throw is caught here.
// Every exported function no-ops after a single console.warn if init failed
// (or if a later native call throws) — a missing/broken sound must never
// crash a match.
import type { AudioPlayer, AudioSource } from 'expo-audio';
import type { MatchEvent, PowerId } from '../sim/types';
import { audioIsSuspended, registerAudioOwner } from './audio-lifecycle';

// -- Asset table (the one place SFX filenames are named) --------------------
// SFX are short one-shots. Supplied replacement effects use runtime-optimized
// 24 kHz mono AAC-LC .m4a files with silent tails trimmed; the procedural
// catalog keeps its original .wav fixtures for deterministic audio-pipeline
// checks. The match theme likewise uses its compressed .m4a build. See
// scripts/audio/catalog.mjs for the full SFX inventory — only the subset
// below has a wired trigger.
type SfxKey =
  | 'kickoff-whistle'
  | 'halftime-whistle'
  | 'fulltime-whistle'
  | 'kick-pass'
  | 'kick-shot'
  | 'tackle-thud'
  | 'grunt'
  | 'body-fall'
  | 'duel-scuff'
  | 'goal-fanfare'
  | 'goal-celebration'
  | 'goal-net-hit'
  | 'goal-crowd'
  | 'card-whistle'
  | 'crowd-jeer'
  | 'rally-drums'
  | 'zone-enter'
  | 'positive'
  | 'extinguisher-spray'
  | 'super-speed-whoosh'
  | 'blink-teleport'
  | 'thunder-charge'
  | 'phase-shift'
  | 'portal-warp'
  | 'future-sight-read'
  | 'future-sight-intercept'
  | 'super-strength-boom'
  | 'web-cast'
  | 'web-spring'
  | 'keeper-stretch'
  | 'ice-freeze'
  | 'ice-slide'
  | 'shadow-burrow'
  | 'shadow-emerge'
  | 'giant-grow'
  | 'flame-hit'
  | 'flame-up'
  | 'save-slap'
  | 'crowd-ooh'
  | 'power-interrupt'
  | 'decoy-pop';

const SFX_SOURCES: Record<SfxKey, AudioSource> = {
  'kickoff-whistle': require('../../assets/audio/sfx/kickoff-whistle.m4a'),
  'halftime-whistle': require('../../assets/audio/sfx/halftime-whistle.wav'),
  'fulltime-whistle': require('../../assets/audio/sfx/fulltime-whistle.wav'),
  'kick-pass': require('../../assets/audio/sfx/kick-pass.wav'),
  'kick-shot': require('../../assets/audio/sfx/kick-shot.m4a'),
  'tackle-thud': require('../../assets/audio/sfx/tackle-thud.m4a'),
  grunt: require('../../assets/audio/sfx/grunt.wav'),
  'body-fall': require('../../assets/audio/sfx/body-fall.m4a'),
  'duel-scuff': require('../../assets/audio/sfx/duel-scuff.wav'),
  'goal-fanfare': require('../../assets/audio/sfx/goal-fanfare.m4a'),
  'goal-celebration': require('../../assets/audio/sfx/goal-celebration.m4a'),
  // The ball going in, cut to the 0.35s of actual hit plus its tail — the
  // supplied recording is two seconds, and all but the front of it is silence.
  'goal-net-hit': require('../../assets/audio/sfx/goal-net-hit.m4a'),
  'goal-crowd': require('../../assets/audio/sfx/goal-crowd.m4a'),
  'card-whistle': require('../../assets/audio/sfx/card-whistle.wav'),
  'crowd-jeer': require('../../assets/audio/sfx/crowd-jeer.wav'),
  'rally-drums': require('../../assets/audio/sfx/rally-drums.m4a'),
  'zone-enter': require('../../assets/audio/sfx/zone-enter.m4a'),
  positive: require('../../assets/audio/sfx/positive.m4a'),
  'extinguisher-spray': require('../../assets/audio/sfx/extinguisher-spray.wav'),
  'super-speed-whoosh': require('../../assets/audio/sfx/super-speed-whoosh.wav'),
  'blink-teleport': require('../../assets/audio/sfx/blink-teleport.wav'),
  'thunder-charge': require('../../assets/audio/sfx/thunder-charge.wav'),
  'phase-shift': require('../../assets/audio/sfx/phase-shift.wav'),
  'portal-warp': require('../../assets/audio/sfx/portal-warp.wav'),
  'future-sight-read': require('../../assets/audio/sfx/future-sight-read.wav'),
  'future-sight-intercept': require('../../assets/audio/sfx/future-sight-intercept.wav'),
  'super-strength-boom': require('../../assets/audio/sfx/super-strength-boom.wav'),
  'web-cast': require('../../assets/audio/sfx/web-cast.wav'),
  'web-spring': require('../../assets/audio/sfx/web-spring.wav'),
  'keeper-stretch': require('../../assets/audio/sfx/keeper-stretch.wav'),
  'ice-freeze': require('../../assets/audio/sfx/ice-freeze.wav'),
  'ice-slide': require('../../assets/audio/sfx/ice-slide.wav'),
  'shadow-burrow': require('../../assets/audio/sfx/shadow-burrow.wav'),
  'shadow-emerge': require('../../assets/audio/sfx/shadow-emerge.wav'),
  'giant-grow': require('../../assets/audio/sfx/giant-grow.wav'),
  'flame-hit': require('../../assets/audio/sfx/flame-hit.wav'),
  'flame-up': require('../../assets/audio/sfx/flame-up.wav'),
  'save-slap': require('../../assets/audio/sfx/save-slap.wav'),
  'crowd-ooh': require('../../assets/audio/sfx/crowd-ooh.wav'),
  'power-interrupt': require('../../assets/audio/sfx/power-interrupt.wav'),
  'decoy-pop': require('../../assets/audio/sfx/decoy-pop.wav'),
};

const THEME_SOURCE: AudioSource = require('../../assets/audio/music/match-theme.m4a');

// Crackling fire bed, looped for as long as a Fire Torch hero is ablaze
// (started/stopped by MatchScreen off the caster's 'active' state, not a
// one-shot event). Its own dedicated looping player, like THEME_SOURCE.
// Owner-supplied recording (2026-07-26): it plays under the flame visuals for
// exactly as long as they are on the pitch.
const FIRE_LOOP_SOURCE: AudioSource = require('../../assets/audio/sfx/flame-loop.m4a');

// Music sits at half volume under the SFX (which play at the 1.0 ceiling) —
// the mix balance, not a fix for the earlier silence (that was the seek/play
// ordering in playForEvent). Tune here if the bed still competes.
const MUSIC_VOLUME = 0.5;
// The fire crackle rides above the music bed but below the one-shot SFX.
const FIRE_LOOP_VOLUME = 0.7;
// Multiplies the existing mix without changing its balance. The dev overlay
// owns the five user-facing steps; keeping this as a plain 0..1 number makes
// the audio layer usable by a future release settings screen too.
let masterVolume = 1;

// Activation and impact are separate so a power-up never impersonates the
// later ball/body contact. Instant spatial powers intentionally sound only on
// POWER_IMPACT, so their one cue lands on the moment the player can see.
const POWER_AUDIO: Record<PowerId, {
  readonly activation: readonly SfxKey[];
  readonly impact: readonly SfxKey[];
}> = {
  SUPER_SPEED: { activation: ['super-speed-whoosh'], impact: [] },
  BLINK_RUN: { activation: [], impact: ['blink-teleport'] },
  THUNDER_STRIKE: { activation: ['thunder-charge'], impact: [] },
  FIRE_TORCH: { activation: ['flame-up'], impact: [] },
  PHASE_RUN: { activation: [], impact: ['phase-shift'] },
  PORTAL_PASS: { activation: [], impact: ['portal-warp'] },
  DECOY_DOUBLE: { activation: ['zone-enter'], impact: [] },
  FUTURE_SIGHT: { activation: ['future-sight-read'], impact: ['future-sight-intercept'] },
  SUPER_STRENGTH: { activation: ['super-strength-boom'], impact: [] },
  WEB_TRAP: { activation: ['web-cast'], impact: ['web-spring'] },
  ELASTIC_KEEPER: { activation: ['keeper-stretch'], impact: [] },
  // The one activation that is not a short sting. Rally Cry lifts a stand
  // rather than hitting a ball, and 4.3s of drums is the sound of it building —
  // the supplied cue, kept at its own length rather than clipped to match the
  // sub-second whooshes and booms around it.
  RALLY_CRY: { activation: ['rally-drums'], impact: [] },
  ICE_RINK: { activation: ['ice-freeze'], impact: ['ice-slide'] },
  SHADOW_MARK: { activation: ['shadow-burrow'], impact: ['shadow-emerge'] },
  GRAVITY_WELL: { activation: ['super-strength-boom'], impact: [] },
  GIANT_GK: { activation: ['giant-grow'], impact: [] },
  GUST: { activation: ['super-speed-whoosh'], impact: [] },
};

// -- Event -> file table ------------------------------------------------
// The single source of truth for what plays on what: swapping a sound is a
// one-line change here (plus its require() above).
//
// There is no POST event in m0.4 (see the MatchEvent union in sim/types.ts)
// even though a post-ding SFX asset exists — never invent a sim event to
// reach it.
//
// CARD is paired with crowd-jeer (a booing reaction) on the same
// action+crowd-reaction pattern GOAL uses: the ball hits the net, the fanfare
// and its celebration land on top, and the stand answers.
export function filesForEvent(e: MatchEvent): readonly SfxKey[] {
  switch (e.kind) {
    case 'KICKOFF':
      return ['kickoff-whistle'];
    case 'HALF_TIME':
      return ['halftime-whistle'];
    case 'FULL_TIME':
      return ['fulltime-whistle'];
    case 'PASS':
      return ['kick-pass'];
    case 'SHOT':
      return ['kick-shot'];
    case 'SLIDE_STARTED':
      return [];
    case 'TACKLE':
      if (!e.contact) return [];
      // A standing challenge fires every 1.7s of match time, and 96 of ~121 a
      // match changed nothing — playing the full body impact on all of them is
      // what made the duel read as noise. Only this style is tiered; slide and
      // power contact are genuine collisions and keep the thud they always had.
      if (e.style !== 'standing' || e.won) return ['tackle-thud', 'grunt'];
      return e.dropped ? ['body-fall'] : ['duel-scuff'];
    case 'GOAL':
      // Everything in a list fires at once, so this is a chord rather than a
      // sequence: contact, fanfare, celebration, crowd.
      return ['goal-net-hit', 'goal-fanfare', 'goal-celebration', 'goal-crowd'];
    case 'CARD':
      return ['card-whistle', 'crowd-jeer'];
    case 'POWER_READY':
      return ['zone-enter'];
    case 'EXTINGUISHED':
      return ['extinguisher-spray'];
    case 'POWER_FIRED':
      // Powers always fire automatically in a watched match, so there is no
      // tap-confirm layer — every activation gets just the power's own sound.
      return POWER_AUDIO[e.power].activation;
    case 'POWER_IMPACT':
      return POWER_AUDIO[e.power].impact;
    case 'SAVE':
      return ['save-slap'];       // keeper stops it
    case 'MISS':
      return ['crowd-ooh'];       // shot off target — crowd groans
    case 'POWER_INTERRUPTED':
      return ['power-interrupt']; // wind-up tackled off
    case 'GUST_REDIRECT':
      return ['super-speed-whoosh']; // the incoming pass audibly bends on the wind
    case 'GUST_PUNT':
      return ['kick-shot']; // a full-blooded keeper clearance, not an ordinary pass tap
    case 'DECOY_POP':
      return ['decoy-pop'];
    case 'IGNITED':
      return ['flame-hit']; // a defender catches fire (distinct from the caster's flame-up)
    // RECOVERED (a player getting back up) has no matching asset — deliberately
    // silent, an explicit case (not a catch-all) so the exhaustiveness check
    // below stays meaningful.
    //
    // POWER_EXPIRED is silent because it can no longer reach a played match:
    // the Zone stopped counting down at m1.27, so the sole remaining emit (the
    // 'armed' branch of sim/powers.ts) is entered only from a POWER_TAP, which
    // survives as test instrumentation alone (docs/04). Its zone-expire.wav
    // deliberately stays in scripts/audio/catalog.mjs — that catalog seeds its
    // generators by array index, so dropping the entry would re-roll every
    // sound after it.
    case 'RECOVERED':
    case 'POWER_EXPIRED':
    case 'FORMATION_CHANGED':
    case 'MENTALITY_CHANGED':
    case 'ENERGY_USE_CHANGED':
    case 'SUBSTITUTION':
      return [];
    default: {
      // Exhaustiveness — adding a MatchEvent kind fails compilation here
      // until a sound (or explicit silence above) is chosen for it, the same
      // self-enforcement Record<PowerId, SfxKey> gives POWER_SFX.
      const unhandled: never = e;
      return unhandled;
    }
  }
}

// -- Player pool + lifecycle -------------------------------------------------
let ready = false;
let initAttempted = false;
let warned = false;
const sfxPlayers = new Map<SfxKey, AudioPlayer>();
let themePlayer: AudioPlayer | null = null;
let fireLoopPlayer: AudioPlayer | null = null;
/** What the match asked for, so backgrounding can pause and returning can restore. */
let themeWanted = false;
let fireWanted = false;

// Only the first failure of the session warns (whatever it is) — the point
// is one diagnostic line, not a per-frame warning flood.
function warnOnce(context: string, err: unknown): void {
  if (warned) return;
  warned = true;
  console.warn(`audio: ${context}`, err);
}

function setPlayerVolume(player: AudioPlayer, baseVolume: number, context: string): void {
  try {
    player.volume = baseVolume * masterVolume;
    // Browsers on iOS refuse programmatic volume outright — expo-audio's web
    // player logs the setter as unsupported and leaves playback at device
    // level. Volume 0 there meant the slider read 0% while the match theme
    // kept playing, with no way to stop it from inside the game. `muted` is
    // honoured on every platform, so it carries the mute; `volume` still
    // carries the levels in between.
    player.muted = masterVolume === 0;
  } catch (err) {
    warnOnce(`${context} volume failed`, err);
  }
}

function applyMasterVolume(): void {
  for (const player of sfxPlayers.values()) {
    setPlayerVolume(player, 1, 'SFX');
  }
  if (themePlayer) setPlayerVolume(themePlayer, MUSIC_VOLUME, 'theme');
  if (fireLoopPlayer) setPlayerVolume(fireLoopPlayer, FIRE_LOOP_VOLUME, 'fire loop');
}

export function setMasterVolume(volume: number): void {
  masterVolume = Math.max(0, Math.min(1, volume));
  applyMasterVolume();
}

export function initAudio(): void {
  if (initAttempted) return; // one attempt per mount; teardownAudio() resets this
  initAttempted = true;
  try {
    // Lazy `require`, not a static import — see the file header comment for
    // why this specific call must be the one wrapped in try/catch.
    const mod = require('expo-audio') as typeof import('expo-audio');
    // expo-audio defaults `playsInSilentMode` to true (ignores the hardware
    // mute switch) — set it false so match audio respects the switch.
    mod.setAudioModeAsync({ playsInSilentMode: false }).catch((err: unknown) => warnOnce('setAudioModeAsync failed', err));
    // keepAudioSessionActive is deliberately NOT passed here (settled at the
    // T5 review — don't re-litigate at T6): native deactivateSession() only
    // fires when NO registered player isPlaying (after a 100ms grace), and
    // the looping match theme holds that guard true for the whole match;
    // every play() re-activates the session anyway.
    //
    // Per-player try/catch: one bad asset/player must not abort the rest
    // (playForEvent already skips missing map entries).
    for (const key of Object.keys(SFX_SOURCES) as SfxKey[]) {
      try {
        sfxPlayers.set(key, mod.createAudioPlayer(SFX_SOURCES[key]));
      } catch (err) {
        warnOnce(`createAudioPlayer failed (${key})`, err);
      }
    }
    try {
      themePlayer = mod.createAudioPlayer(THEME_SOURCE);
      themePlayer.loop = true;
    } catch (err) {
      themePlayer = null;
      warnOnce('createAudioPlayer failed (match-theme)', err);
    }
    try {
      fireLoopPlayer = mod.createAudioPlayer(FIRE_LOOP_SOURCE);
      fireLoopPlayer.loop = true;
    } catch (err) {
      fireLoopPlayer = null;
      warnOnce('createAudioPlayer failed (flame-loop)', err);
    }
    ready = true;
    // Preserve a dev volume chosen before the match screen mounted. This also
    // establishes every player's base level in one place.
    applyMasterVolume();
  } catch (err) {
    // Reachable only from require() / a synchronous setAudioModeAsync throw —
    // player creation failures are caught per-player above, so nothing here
    // needs remove()-ing.
    sfxPlayers.clear();
    themePlayer = null;
    fireLoopPlayer = null;
    warnOnce('init failed — sound disabled for this session', err);
  }
}

export function teardownAudio(): void {
  // Per-player try/catch mirrors initAudio's: one bad player must not leave
  // the rest un-removed. release() after remove() detaches the JS wrapper so
  // native destruction is deterministic instead of waiting on GC — safe here
  // because the end-of-match hold in MatchScreen means teardown no longer
  // races the fulltime whistle.
  for (const player of sfxPlayers.values()) {
    try {
      player.remove();
      player.release();
    } catch (err) {
      warnOnce('player teardown failed', err);
    }
  }
  try {
    themePlayer?.remove();
    themePlayer?.release();
  } catch (err) {
    warnOnce('theme teardown failed', err);
  }
  try {
    fireLoopPlayer?.remove();
    fireLoopPlayer?.release();
  } catch (err) {
    warnOnce('fire loop teardown failed', err);
  }
  sfxPlayers.clear();
  themePlayer = null;
  fireLoopPlayer = null;
  ready = false;
  initAttempted = false; // allow the next mount to retry init
  lastRecoveryAt = 0;
}

const RECOVERY_COOLDOWN_MS = 5000;
let lastRecoveryAt = 0;

/**
 * iOS tears down the audio-session server while the app sits in the background
 * (and a dev reload strands the previous context's players): every seek/play
 * then fails with "Session lookup failed". Dead native objects can't be
 * revived, so recovery releases every player and rebuilds them through the
 * normal init, which also re-activates the session via setAudioModeAsync —
 * then resumes whichever loops the match still wants. Releases stay silent:
 * warnOnce here is a single slot, and it must be kept for the failure that
 * survives the retry. The cooldown keeps a device whose audio is genuinely
 * broken fail-soft instead of rebuilding ~40 players on every event.
 */
function tryRecoverMatchAudio(): boolean {
  const now = Date.now();
  if (now - lastRecoveryAt < RECOVERY_COOLDOWN_MS) return false;
  lastRecoveryAt = now;
  for (const player of [...sfxPlayers.values(), themePlayer, fireLoopPlayer]) {
    if (!player) continue;
    try {
      player.remove();
      player.release();
    } catch {
      // Already dead — that is why we are recovering.
    }
  }
  sfxPlayers.clear();
  themePlayer = null;
  fireLoopPlayer = null;
  ready = false;
  initAttempted = false;
  initAudio();
  if (!ready) return false;
  resumeWantedLoops();
  return true;
}

/** After a rebuild, restart whatever the match still wants playing. */
function resumeWantedLoops(): void {
  if (audioIsSuspended()) return;
  try {
    if (themeWanted) themePlayer?.play();
  } catch (err) {
    warnOnce('theme resume after recovery failed', err);
  }
  const fire = fireLoopPlayer;
  if (fireWanted && fire) {
    try {
      fire.seekTo(0).then(() => fire.play()).catch((err: unknown) => warnOnce('fire loop resume after recovery failed', err));
    } catch (err) {
      warnOnce('fire loop resume after recovery failed', err);
    }
  }
}

function playSfxKey(key: SfxKey, isRetry: boolean): void {
  const player = sfxPlayers.get(key);
  if (!player) return;
  const recoverOr = (label: string, err: unknown): void => {
    if (!isRetry && tryRecoverMatchAudio()) {
      playSfxKey(key, true);
      return;
    }
    warnOnce(label, err);
  };
  try {
    // Chain play() AFTER the async seek resolves — NOT two separate
    // statements. seekTo(0) is a native async call and play() is sync, so
    // `seekTo(0); play()` runs play-then-seek on device: replaying a
    // finished sub-second clip no-ops the play() (already at the end), then
    // the late seek rewinds it while stopped — silent restarts (was the
    // "no SFX on device" bug). Rewind first, then play from 0.
    player.seekTo(0).then(() => player.play()).catch((err: unknown) => recoverOr('seek/play failed', err));
  } catch (err) {
    recoverOr('playback failed', err);
  }
}

export function playForEvent(e: MatchEvent): void {
  if (!ready) return;
  // A muted match still issued a seek and a play for every event — hundreds of
  // native round-trips per match to produce silence.
  if (masterVolume === 0) return;
  for (const key of filesForEvent(e)) {
    playSfxKey(key, false);
  }
}

export function startTheme(): void {
  themeWanted = true;
  if (!ready || !themePlayer || audioIsSuspended()) return;
  try {
    themePlayer.play();
  } catch (err) {
    // Recovery resumes the wanted loops itself, so success needs no retry here.
    if (tryRecoverMatchAudio()) return;
    warnOnce('theme playback failed', err);
  }
}

export function stopTheme(): void {
  themeWanted = false;
  if (!ready || !themePlayer) return;
  try {
    themePlayer.pause();
  } catch (err) {
    warnOnce('theme stop failed', err);
  }
}

// Fire crackle loop — MatchScreen calls startFireAmbience() when a Fire Torch
// hero becomes active and stopFireAmbience() when the last one stops burning.
// Both are idempotent-safe (play()/pause() on an already-playing/paused looping
// player is a no-op), so the caller can reconcile once per frame without
// tracking edges itself. seekTo(0) before play so each ignition restarts the
// crackle from the top rather than resuming wherever the last burn paused.
export function startFireAmbience(): void {
  fireWanted = true;
  if (!ready || !fireLoopPlayer || audioIsSuspended()) return;
  const p = fireLoopPlayer;
  const recoverOr = (err: unknown): void => {
    // Recovery restarts the wanted fire loop itself, so success needs no retry.
    if (tryRecoverMatchAudio()) return;
    warnOnce('fire loop start failed', err);
  };
  try {
    p.seekTo(0).then(() => p.play()).catch((err: unknown) => recoverOr(err));
  } catch (err) {
    recoverOr(err);
  }
}

export function stopFireAmbience(): void {
  fireWanted = false;
  if (!ready || !fireLoopPlayer) return;
  try {
    fireLoopPlayer.pause();
  } catch (err) {
    warnOnce('fire loop stop failed', err);
  }
}

/**
 * Backgrounding the app or hiding the tab silences the loops without forgetting
 * that the match wants them: `themeWanted`/`fireWanted` are what the match asked
 * for, and coming back to the front honours that request again. A one-shot event
 * SFX needs nothing here — it has already finished.
 */
registerAudioOwner({
  suspend: () => {
    if (!ready) return;
    try {
      themePlayer?.pause();
      fireLoopPlayer?.pause();
    } catch (err) {
      warnOnce('background suspend failed', err);
    }
  },
  resume: () => {
    if (!ready) return;
    try {
      if (themeWanted) themePlayer?.play();
      if (fireWanted) fireLoopPlayer?.play();
    } catch (err) {
      warnOnce('foreground resume failed', err);
    }
  },
});
