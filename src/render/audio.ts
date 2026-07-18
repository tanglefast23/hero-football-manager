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

// -- Asset table (the one place SFX filenames are named) --------------------
// SFX are short one-shots. Supplied replacement effects use runtime-optimized
// 24 kHz mono AAC-LC .m4a files with silent tails trimmed; the procedural
// catalog keeps its original .wav fixtures for deterministic audio-pipeline
// checks. The match theme likewise uses its compressed .m4a build. See
// scripts/audio/catalog.mjs for the full 27-SFX inventory — only the subset
// below has a wired trigger.
type SfxKey =
  | 'kickoff-whistle'
  | 'halftime-whistle'
  | 'fulltime-whistle'
  | 'kick-pass'
  | 'kick-shot'
  | 'tackle-thud'
  | 'grunt'
  | 'goal-fanfare'
  | 'goal-celebration'
  | 'crowd-cheer'
  | 'card-whistle'
  | 'crowd-jeer'
  | 'zone-enter'
  | 'tap-fire'
  | 'extinguisher-spray'
  | 'super-speed-whoosh'
  | 'super-strength-boom'
  | 'flame-hit'
  | 'flame-up'
  | 'save-slap'
  | 'crowd-ooh'
  | 'power-interrupt'
  | 'zone-expire';

const SFX_SOURCES: Record<SfxKey, AudioSource> = {
  'kickoff-whistle': require('../../assets/audio/sfx/kickoff-whistle.m4a'),
  'halftime-whistle': require('../../assets/audio/sfx/halftime-whistle.wav'),
  'fulltime-whistle': require('../../assets/audio/sfx/fulltime-whistle.wav'),
  'kick-pass': require('../../assets/audio/sfx/kick-pass.wav'),
  'kick-shot': require('../../assets/audio/sfx/kick-shot.m4a'),
  'tackle-thud': require('../../assets/audio/sfx/tackle-thud.m4a'),
  grunt: require('../../assets/audio/sfx/grunt.wav'),
  'goal-fanfare': require('../../assets/audio/sfx/goal-fanfare.m4a'),
  'goal-celebration': require('../../assets/audio/sfx/goal-celebration.m4a'),
  'crowd-cheer': require('../../assets/audio/sfx/crowd-cheer.wav'),
  'card-whistle': require('../../assets/audio/sfx/card-whistle.wav'),
  'crowd-jeer': require('../../assets/audio/sfx/crowd-jeer.wav'),
  'zone-enter': require('../../assets/audio/sfx/zone-enter.m4a'),
  'tap-fire': require('../../assets/audio/sfx/tap-fire.wav'),
  'extinguisher-spray': require('../../assets/audio/sfx/extinguisher-spray.wav'),
  'super-speed-whoosh': require('../../assets/audio/sfx/super-speed-whoosh.wav'),
  'super-strength-boom': require('../../assets/audio/sfx/super-strength-boom.wav'),
  'flame-hit': require('../../assets/audio/sfx/flame-hit.wav'),
  'flame-up': require('../../assets/audio/sfx/flame-up.wav'),
  'save-slap': require('../../assets/audio/sfx/save-slap.wav'),
  'crowd-ooh': require('../../assets/audio/sfx/crowd-ooh.wav'),
  'power-interrupt': require('../../assets/audio/sfx/power-interrupt.wav'),
  'zone-expire': require('../../assets/audio/sfx/zone-expire.wav'),
};

const THEME_SOURCE: AudioSource = require('../../assets/audio/music/match-theme.m4a');

// Crackling fire bed, looped for as long as a Fire Torch hero is ablaze
// (started/stopped by MatchScreen off the caster's 'active' state, not a
// one-shot event). Its own dedicated looping player, like THEME_SOURCE.
const FIRE_LOOP_SOURCE: AudioSource = require('../../assets/audio/sfx/flame-loop.wav');

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

// Per-power "fire" sound — plays on every POWER_FIRED regardless of strength
// (see filesForEvent: a manual tap additionally layers 'tap-fire' on top).
const POWER_SFX: Record<PowerId, SfxKey> = {
  SUPER_SPEED: 'super-speed-whoosh',
  SUPER_STRENGTH: 'super-strength-boom',
  FIRE_TORCH: 'flame-up', // Flint bursting into flames as the power switches on
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
// action+crowd-reaction pattern GOAL uses with crowd-cheer — this specific
// pairing isn't spelled out verbatim in the plan, so flag it for review.
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
    case 'TACKLE':
      return ['tackle-thud', 'grunt'];
    case 'GOAL':
      return ['goal-fanfare', 'goal-celebration', 'crowd-cheer'];
    case 'CARD':
      return ['card-whistle', 'crowd-jeer'];
    case 'POWER_READY':
      return ['zone-enter'];
    case 'EXTINGUISHED':
      return ['extinguisher-spray'];
    case 'POWER_FIRED':
      // strength === 1 is TAP_STRENGTH (sim/powers.ts) — a manual tap-confirm,
      // which layers the click on top of the power's own sound. Auto-fires
      // (CONTEXT_AUTO_STRENGTH 0.85 / LAPSE_STRENGTH 0.75) get just the
      // power sound.
      return e.strength === 1 ? ['tap-fire', POWER_SFX[e.power]] : [POWER_SFX[e.power]];
    case 'SAVE':
      return ['save-slap'];       // keeper stops it
    case 'MISS':
      return ['crowd-ooh'];       // shot off target — crowd groans
    case 'POWER_INTERRUPTED':
      return ['power-interrupt']; // wind-up tackled off
    case 'POWER_EXPIRED':
      return ['zone-expire'];     // an un-fired Zone window lapses
    case 'IGNITED':
      return ['flame-hit']; // a defender catches fire (distinct from the caster's flame-up)
    // RECOVERED (a player getting back up) has no matching asset — deliberately
    // silent, an explicit case (not a catch-all) so the exhaustiveness check
    // below stays meaningful.
    case 'RECOVERED':
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
}

export function playForEvent(e: MatchEvent): void {
  if (!ready) return;
  try {
    for (const key of filesForEvent(e)) {
      const player = sfxPlayers.get(key);
      if (!player) continue;
      // Chain play() AFTER the async seek resolves — NOT two separate
      // statements. seekTo(0) is a native async call and play() is sync, so
      // `seekTo(0); play()` runs play-then-seek on device: replaying a
      // finished sub-second clip no-ops the play() (already at the end), then
      // the late seek rewinds it while stopped — silent restarts (was the
      // "no SFX on device" bug). Rewind first, then play from 0.
      player.seekTo(0).then(() => player.play()).catch((err: unknown) => warnOnce('seek/play failed', err));
    }
  } catch (err) {
    warnOnce('playback failed', err);
  }
}

export function startTheme(): void {
  if (!ready || !themePlayer) return;
  try {
    themePlayer.play();
  } catch (err) {
    warnOnce('theme playback failed', err);
  }
}

export function stopTheme(): void {
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
  if (!ready || !fireLoopPlayer) return;
  const p = fireLoopPlayer;
  try {
    p.seekTo(0).then(() => p.play()).catch((err: unknown) => warnOnce('fire loop start failed', err));
  } catch (err) {
    warnOnce('fire loop start failed', err);
  }
}

export function stopFireAmbience(): void {
  if (!ready || !fireLoopPlayer) return;
  try {
    fireLoopPlayer.pause();
  } catch (err) {
    warnOnce('fire loop stop failed', err);
  }
}
