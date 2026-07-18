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
// SFX are the short one-shot .wav masters; the match theme uses the
// compressed .m4a build (assets/audio/music also keeps a .wav master,
// unused here). See scripts/audio/catalog.mjs for the full 27-SFX
// inventory — only the subset below has a wired trigger today.
type SfxKey =
  | 'kickoff-whistle'
  | 'halftime-whistle'
  | 'fulltime-whistle'
  | 'kick-pass'
  | 'kick-shot'
  | 'tackle-thud'
  | 'grunt'
  | 'goal-fanfare'
  | 'crowd-cheer'
  | 'card-whistle'
  | 'crowd-jeer'
  | 'zone-enter'
  | 'tap-fire'
  | 'extinguisher-spray'
  | 'super-speed-whoosh'
  | 'super-strength-boom'
  | 'fire-torch-ignite';

const SFX_SOURCES: Record<SfxKey, AudioSource> = {
  'kickoff-whistle': require('../../assets/audio/sfx/kickoff-whistle.wav'),
  'halftime-whistle': require('../../assets/audio/sfx/halftime-whistle.wav'),
  'fulltime-whistle': require('../../assets/audio/sfx/fulltime-whistle.wav'),
  'kick-pass': require('../../assets/audio/sfx/kick-pass.wav'),
  'kick-shot': require('../../assets/audio/sfx/kick-shot.wav'),
  'tackle-thud': require('../../assets/audio/sfx/tackle-thud.wav'),
  grunt: require('../../assets/audio/sfx/grunt.wav'),
  'goal-fanfare': require('../../assets/audio/sfx/goal-fanfare.wav'),
  'crowd-cheer': require('../../assets/audio/sfx/crowd-cheer.wav'),
  'card-whistle': require('../../assets/audio/sfx/card-whistle.wav'),
  'crowd-jeer': require('../../assets/audio/sfx/crowd-jeer.wav'),
  'zone-enter': require('../../assets/audio/sfx/zone-enter.wav'),
  'tap-fire': require('../../assets/audio/sfx/tap-fire.wav'),
  'extinguisher-spray': require('../../assets/audio/sfx/extinguisher-spray.wav'),
  'super-speed-whoosh': require('../../assets/audio/sfx/super-speed-whoosh.wav'),
  'super-strength-boom': require('../../assets/audio/sfx/super-strength-boom.wav'),
  'fire-torch-ignite': require('../../assets/audio/sfx/fire-torch-ignite.wav'),
};

const THEME_SOURCE: AudioSource = require('../../assets/audio/music/match-theme.m4a');

// Per-power "fire" sound — plays on every POWER_FIRED regardless of strength
// (see filesForEvent: a manual tap additionally layers 'tap-fire' on top).
const POWER_SFX: Record<PowerId, SfxKey> = {
  SUPER_SPEED: 'super-speed-whoosh',
  SUPER_STRENGTH: 'super-strength-boom',
  FIRE_TORCH: 'fire-torch-ignite',
};

// -- Event -> file table ------------------------------------------------
// The single source of truth for what plays on what: swapping a sound is a
// one-line change here (plus its require() above).
//
// Not every MatchEvent kind is wired: SAVE, MISS, POWER_INTERRUPTED,
// POWER_EXPIRED, IGNITED, and RECOVERED have no assigned sound yet, and
// there is no POST event in m0.4 (see the MatchEvent union in sim/types.ts)
// even though a post-ding SFX asset exists — never invent a sim event to
// reach it.
//
// CARD is paired with crowd-jeer (a booing reaction) on the same
// action+crowd-reaction pattern GOAL uses with crowd-cheer — this specific
// pairing isn't spelled out verbatim in the plan, so flag it for review.
function filesForEvent(e: MatchEvent): readonly SfxKey[] {
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
      return ['goal-fanfare', 'crowd-cheer'];
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
    default:
      return [];
  }
}

// -- Player pool + lifecycle -------------------------------------------------
let ready = false;
let initAttempted = false;
let warned = false;
const sfxPlayers = new Map<SfxKey, AudioPlayer>();
let themePlayer: AudioPlayer | null = null;

function warnOnce(context: string, err: unknown): void {
  if (warned) return;
  warned = true;
  console.warn(`audio: ${context} — sound disabled for this session`, err);
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
    for (const key of Object.keys(SFX_SOURCES) as SfxKey[]) {
      sfxPlayers.set(key, mod.createAudioPlayer(SFX_SOURCES[key]));
    }
    themePlayer = mod.createAudioPlayer(THEME_SOURCE);
    themePlayer.loop = true;
    ready = true;
  } catch (err) {
    sfxPlayers.clear();
    themePlayer = null;
    warnOnce('init failed', err);
  }
}

export function teardownAudio(): void {
  try {
    for (const player of sfxPlayers.values()) player.remove();
    themePlayer?.remove();
  } catch (err) {
    warnOnce('teardown failed', err);
  } finally {
    sfxPlayers.clear();
    themePlayer = null;
    ready = false;
    initAttempted = false; // allow the next mount to retry init
  }
}

export function playForEvent(e: MatchEvent): void {
  if (!ready) return;
  try {
    for (const key of filesForEvent(e)) {
      const player = sfxPlayers.get(key);
      if (!player) continue;
      player.seekTo(0).catch((err: unknown) => warnOnce('seek failed', err));
      player.play();
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
