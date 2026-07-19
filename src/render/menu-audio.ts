// Owns the non-match music beds and management UI SFX. App chooses exactly one
// theme from the current top-level screen; MatchScreen continues to own match
// music and match-event SFX.
// Kept fail-soft so headless Jest and an out-of-date native dev client can
// still render the UI even when expo-audio is unavailable.
import type { AudioPlayer, AudioSource } from 'expo-audio';

export type MenuTheme = 'opening' | 'management' | 'event' | null;
type MenuSfx = 'advance-week';

const MENU_SOURCES: Record<Exclude<MenuTheme, null>, AudioSource> = {
  opening: require('../../assets/audio/music/opening-theme.m4a'),
  management: require('../../assets/audio/music/management-theme.m4a'),
  event: require('../../assets/audio/music/event-theme.m4a'),
};
const MENU_SFX_SOURCES: Record<MenuSfx, AudioSource> = {
  'advance-week': require('../../assets/audio/sfx/advance-week.m4a'),
};

const MUSIC_VOLUME = 0.5;

const players = new Map<Exclude<MenuTheme, null>, AudioPlayer>();
const sfxPlayers = new Map<MenuSfx, AudioPlayer>();
const warned = new Set<string>();
let activeTheme: MenuTheme = null;
let masterVolume = 1;
let ready = false;
let initAttempted = false;

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
  } catch (error) {
    players.clear();
    sfxPlayers.clear();
    ready = false;
    warnOnce('init failed — menu audio disabled for this session', error);
  }
}

export function playAdvanceWeekSfx(): void {
  initMenuAudio();
  if (!ready) return;
  try {
    const player = sfxPlayers.get('advance-week');
    if (!player) return;
    player.seekTo(0)
      .then(() => player.play())
      .catch((error: unknown) => warnOnce('advance-week seek/play failed', error));
  } catch (error) {
    warnOnce('advance-week playback failed', error);
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

  initMenuAudio();
  if (!ready) return;
  try {
    players.get(theme)?.play();
  } catch (error) {
    warnOnce(`${theme} playback failed`, error);
  }
}

export function teardownMenuAudio(): void {
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
