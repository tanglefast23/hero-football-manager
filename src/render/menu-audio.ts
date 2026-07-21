// Owns the non-match music beds and management UI SFX. App chooses exactly one
// theme from the current top-level screen; MatchScreen continues to own match
// music and match-event SFX.
// Kept fail-soft so headless Jest and an out-of-date native dev client can
// still render the UI even when expo-audio is unavailable.
import type { AudioPlayer, AudioSource } from 'expo-audio';
import type { M1Screen } from '../application/store';

export type MenuTheme = 'opening' | 'management' | 'event' | null;
type MenuSfx = 'advance-week' | 'plan-locked' | 'league-champions';

export function menuThemeForScreen(screen: M1Screen, awakeningBeat: number): MenuTheme {
  if (screen === 'welcome') return 'opening';
  if (screen === 'create-player' || screen === 'management') return 'management';
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
  for (const [theme, player] of players) {
    try {
      player.volume = MUSIC_VOLUME * masterVolume;
    } catch (error) {
      warnOnce(`${theme} volume failed`, error);
    }
  }
  for (const [key, player] of sfxPlayers) {
    try {
      player.volume = masterVolume;
    } catch (error) {
      warnOnce(`${key} volume failed`, error);
    }
  }
}

function playActiveTheme(): void {
  if (!ready || activeTheme === null) return;
  try {
    players.get(activeTheme)?.play();
  } catch (error) {
    warnOnce(`${activeTheme} playback failed`, error);
  }
}

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
  try {
    const player = sfxPlayers.get(key);
    if (!player) return;
    player.seekTo(0)
      .then(() => player.play())
      .catch((error: unknown) => warnOnce(`${key} seek/play failed`, error));
  } catch (error) {
    warnOnce(`${key} playback failed`, error);
  }
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
}
