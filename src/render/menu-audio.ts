// Owns the non-match music beds and management UI SFX. App chooses exactly one
// theme from the current top-level screen; MatchScreen continues to own match
// music and match-event SFX.
// Kept fail-soft so headless Jest and an out-of-date native dev client can
// still render the UI even when expo-audio is unavailable.
import type { AudioPlayer, AudioSource } from 'expo-audio';
import type { M1Screen } from '../application/store';
import { audioIsSuspended, registerAudioOwner } from './audio-lifecycle';

export type MenuTheme = 'opening' | 'management' | 'event' | null;
type MenuSfx = 'advance-week' | 'plan-locked' | 'league-champions';

export function menuThemeForScreen(screen: M1Screen, awakeningBeat: number): MenuTheme {
  if (screen === 'welcome' || screen === 'matchday') return 'opening';
  if (screen === 'create-player' || screen === 'management') return 'management';
  // The awakening carries the event bed from the bite onwards. Beat 1 is left
  // to the sad limp cue alone, because that beat IS the silence before it; from
  // beat 2 the bed plays under the limp's tail and stays through the rise, so
  // the scene never drops to nothing while the manager reads. a49f006 dropped
  // this line and left two short one-shots in a tap-paced scene — the reveal
  // card was read in silence.
  if (screen === 'event' || screen === 'legacy' || (screen === 'awakening' && awakeningBeat >= 2)) {
    return 'event';
  }
  return null;
}

const MENU_SOURCES: Record<Exclude<MenuTheme, null>, AudioSource> = {
  opening: require('../../assets/audio/music/opening-theme.m4a'),
  management: require('../../assets/audio/music/management-theme.m4a'),
  event: require('../../assets/audio/music/event-theme.m4a'),
};
const MENU_SFX_SOURCES: Record<MenuSfx, AudioSource> = {
  'advance-week': require('../../assets/audio/sfx/advance-week.m4a'),
  'plan-locked': require('../../assets/audio/sfx/plan-locked-chime.m4a'),
  'league-champions': require('../../assets/audio/sfx/league-champions.m4a'),
};

const MUSIC_VOLUME = 0.5;
const LOOP_WATCHDOG_MS = 500;
const IS_WEB = typeof document !== 'undefined';

const players = new Map<Exclude<MenuTheme, null>, AudioPlayer>();
const sfxPlayers = new Map<MenuSfx, AudioPlayer>();
const warned = new Set<string>();
let activeTheme: MenuTheme = null;
let masterVolume = 1;
let ready = false;
let initAttempted = false;
let webPlaybackUnlocked = !IS_WEB;
let removeWebUnlockListeners: (() => void) | null = null;
let loopWatchdog: ReturnType<typeof setInterval> | null = null;
const recoveringThemes = new Set<Exclude<MenuTheme, null>>();

function warnOnce(context: string, error: unknown): void {
  if (warned.has(context)) return;
  warned.add(context);
  console.warn(`[menu-audio] ${context}`, error);
}

function applyMasterVolume(): void {
  // `muted` alongside `volume`: browsers on iOS ignore programmatic volume, so
  // without it a muted game kept looping its menu theme at device level. This
  // is the module that owns the longest-running loop, so it mattered most here.
  const muted = masterVolume === 0;
  for (const [theme, player] of players) {
    try {
      player.volume = MUSIC_VOLUME * masterVolume;
      player.muted = muted;
    } catch (error) {
      warnOnce(`${theme} volume failed`, error);
    }
  }
  for (const [key, player] of sfxPlayers) {
    try {
      player.volume = masterVolume;
      player.muted = muted;
    } catch (error) {
      warnOnce(`${key} volume failed`, error);
    }
  }
}

const RECOVERY_COOLDOWN_MS = 5000;
let lastRecoveryAt = 0;

/**
 * iOS tears down the audio-session server while the app sits in the background
 * (and a dev reload strands the previous context's players): every play() then
 * throws "Session lookup failed" / "Server was dead when activation request was
 * made". Dead native objects can't be revived, so recovery re-activates the
 * session and rebuilds every player, preserving the requested theme. The
 * cooldown keeps a device whose audio is genuinely broken fail-soft instead of
 * rebuilding six players on every tap.
 */
function tryRecoverMenuAudio(): boolean {
  const now = Date.now();
  if (now - lastRecoveryAt < RECOVERY_COOLDOWN_MS) return false;
  lastRecoveryAt = now;
  const theme = activeTheme;
  stopLoopWatchdog();
  for (const [, player] of players) {
    try {
      player.remove();
      player.release();
    } catch {
      // Already dead — that is why we are recovering.
    }
  }
  for (const [, player] of sfxPlayers) {
    try {
      player.remove();
      player.release();
    } catch {
      // Already dead — that is why we are recovering.
    }
  }
  players.clear();
  sfxPlayers.clear();
  ready = false;
  initAttempted = false;
  initMenuAudio();
  activeTheme = theme;
  return ready;
}

function playActiveTheme(): void {
  if (!ready || activeTheme === null || audioIsSuspended()) return;
  try {
    players.get(activeTheme)?.play();
  } catch (error) {
    if (tryRecoverMenuAudio()) {
      try {
        players.get(activeTheme)?.play();
        return;
      } catch (retryError) {
        warnOnce(`${activeTheme} playback failed after recovery`, retryError);
        return;
      }
    }
    warnOnce(`${activeTheme} playback failed`, error);
  }
}

/**
 * The menu theme is the loop most likely to be forgotten: a management screen
 * left open in a background tab kept playing for as long as the tab lived.
 * `activeTheme` still records which theme the app wants, so coming back to the
 * front resumes exactly that one.
 */
registerAudioOwner({
  suspend: () => {
    if (!ready || activeTheme === null) return;
    stopLoopWatchdog();
    try {
      players.get(activeTheme)?.pause();
    } catch (error) {
      warnOnce(`${activeTheme} background suspend failed`, error);
    }
  },
  resume: () => {
    if (!ready || activeTheme === null) return;
    playActiveTheme();
    startLoopWatchdog();
  },
});

function startLoopWatchdog(): void {
  if (loopWatchdog !== null) return;
  loopWatchdog = setInterval(() => {
    const theme = activeTheme;
    if (!ready || theme === null || recoveringThemes.has(theme)) return;
    const player = players.get(theme);
    if (player === undefined) return;
    try {
      // Expo Audio should loop natively. Reassert the flag and recover if a
      // platform player still lands at the end instead of wrapping around.
      player.loop = true;
      const duration = player.duration;
      const ended = player.isLoaded
        && !player.playing
        && Number.isFinite(duration)
        && duration > 0
        && player.currentTime >= duration - 0.05;
      if (!ended) return;
      recoveringThemes.add(theme);
      player.seekTo(0)
        .then(() => {
          if (ready && activeTheme === theme) {
            player.loop = true;
            player.play();
          }
        })
        .catch((error: unknown) => warnOnce(`${theme} loop recovery failed`, error))
        .finally(() => recoveringThemes.delete(theme));
    } catch (error) {
      recoveringThemes.delete(theme);
      warnOnce(`${theme} loop watchdog failed`, error);
    }
  }, LOOP_WATCHDOG_MS);
}

function stopLoopWatchdog(): void {
  if (loopWatchdog !== null) clearInterval(loopWatchdog);
  loopWatchdog = null;
  recoveringThemes.clear();
}

function armWebAudioUnlock(): void {
  if (
    !IS_WEB
    || webPlaybackUnlocked
    || removeWebUnlockListeners !== null
    || typeof document === 'undefined'
  ) return;

  const unlock = () => {
    webPlaybackUnlocked = true;
    removeWebUnlockListeners?.();
    removeWebUnlockListeners = null;
    initMenuAudio();
    playActiveTheme();
  };
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
  removeWebUnlockListeners = () => {
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('keydown', unlock);
  };
}

export function setMenuMasterVolume(volume: number): void {
  masterVolume = Math.max(0, Math.min(1, volume));
  applyMasterVolume();
}

export function initMenuAudio(): void {
  if (initAttempted) return;
  initAttempted = true;
  try {
    const audio = require('expo-audio') as typeof import('expo-audio');
    audio.setAudioModeAsync({ playsInSilentMode: false })
      .catch((error: unknown) => warnOnce('setAudioModeAsync failed', error));

    for (const theme of Object.keys(MENU_SOURCES) as Array<Exclude<MenuTheme, null>>) {
      try {
        const player = audio.createAudioPlayer(MENU_SOURCES[theme]);
        player.loop = true;
        players.set(theme, player);
      } catch (error) {
        warnOnce(`createAudioPlayer failed (${theme})`, error);
      }
    }
    for (const key of Object.keys(MENU_SFX_SOURCES) as MenuSfx[]) {
      try {
        sfxPlayers.set(key, audio.createAudioPlayer(MENU_SFX_SOURCES[key]));
      } catch (error) {
        warnOnce(`createAudioPlayer failed (${key})`, error);
      }
    }
    ready = true;
    applyMasterVolume();
    startLoopWatchdog();
  } catch (error) {
    players.clear();
    sfxPlayers.clear();
    ready = false;
    warnOnce('init failed — menu audio disabled for this session', error);
  }
}

export function playAdvanceWeekSfx(): void {
  playMenuSfx('advance-week');
}

export function playPlanLockedSfx(): void {
  playMenuSfx('plan-locked');
}

export function playLeagueChampionsSfx(): void {
  playMenuSfx('league-champions');
}

export function stopLeagueChampionsSfx(): void {
  initMenuAudio();
  if (!ready) return;
  try {
    sfxPlayers.get('league-champions')?.pause();
  } catch (error) {
    warnOnce('league-champions stop failed', error);
  }
}

function playMenuSfx(key: MenuSfx): void {
  initMenuAudio();
  if (!ready) return;
  const attempt = (isRetry: boolean): void => {
    const recoverOr = (label: string, error: unknown): void => {
      if (!isRetry && tryRecoverMenuAudio()) {
        // The music bed died with the same session — resume it, then the cue.
        playActiveTheme();
        attempt(true);
        return;
      }
      warnOnce(label, error);
    };
    try {
      const player = sfxPlayers.get(key);
      if (!player) return;
      player.seekTo(0)
        .then(() => player.play())
        .catch((error: unknown) => recoverOr(`${key} seek/play failed`, error));
    } catch (error) {
      recoverOr(`${key} playback failed`, error);
    }
  };
  attempt(false);
}

export function setMenuTheme(theme: MenuTheme): void {
  if (theme === activeTheme) return;

  if (activeTheme !== null) {
    try {
      players.get(activeTheme)?.pause();
    } catch (error) {
      warnOnce(`${activeTheme} stop failed`, error);
    }
  }

  activeTheme = theme;
  if (theme === null) return;

  if (!webPlaybackUnlocked) {
    armWebAudioUnlock();
    return;
  }

  initMenuAudio();
  playActiveTheme();
}

export function teardownMenuAudio(): void {
  stopLoopWatchdog();
  removeWebUnlockListeners?.();
  removeWebUnlockListeners = null;
  for (const [theme, player] of players) {
    try {
      player.pause();
      player.remove();
      player.release();
    } catch (error) {
      warnOnce(`${theme} teardown failed`, error);
    }
  }
  for (const [key, player] of sfxPlayers) {
    try {
      player.remove();
      player.release();
    } catch (error) {
      warnOnce(`${key} teardown failed`, error);
    }
  }
  players.clear();
  sfxPlayers.clear();
  activeTheme = null;
  ready = false;
  initAttempted = false;
  lastRecoveryAt = 0;
}
