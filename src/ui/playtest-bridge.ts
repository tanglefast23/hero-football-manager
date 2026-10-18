import type { GameState } from '../game/types';
import { ENGINE_VERSION } from '../sim/match';
import { serializeGameState } from '../persistence/game-state-codec';
import { insideDesktopShell, qaRootRoutesEnabled } from './release-surface';

interface PlaytestState {
  readonly career: GameState | null;
  readonly screen: string;
  readonly activeTab: string;
  readonly error: string | null;
  readonly persistenceReady: boolean;
  readonly persistenceLoadError: string | null;
  readonly saving: boolean;
  readonly lastPersistedCareer: GameState | null;
}

interface PlaytestWindow {
  readonly location?: {
    readonly protocol?: string;
    readonly hostname?: string;
    readonly search?: string;
  };
  __HFM_QA__?: { readonly read: () => unknown };
}

/** Explicit local opt-in; the bridge exposes copies, never store actions. */
export function installPlaytestBridge(
  target: PlaytestWindow,
  readState: () => PlaytestState,
  platform: string,
): () => void {
  if (
    platform !== 'web' ||
    !qaRootRoutesEnabled(
      false,
      platform,
      insideDesktopShell(target.location),
      target.location,
    ) ||
    new URLSearchParams(target.location?.search).get('qa') !== 'playtest'
  )
    return () => {};

  const bridge = Object.freeze({
    read: () => {
      const state = readState();
      let career: GameState | null = null;
      let careerSerializationError: string | null = null;
      try {
        career =
          state.career === null
            ? null
            : JSON.parse(serializeGameState(state.career));
      } catch (error) {
        careerSerializationError =
          error instanceof Error ? error.message : String(error);
      }
      return JSON.parse(
        JSON.stringify({
          formatVersion: 1,
          engineVersion: ENGINE_VERSION,
          screen: state.screen,
          activeTab: state.activeTab,
          error: state.error,
          persistenceReady: state.persistenceReady,
          persistenceLoadError: state.persistenceLoadError,
          saving: state.saving,
          careerIsPersisted:
            state.career !== null && state.career === state.lastPersistedCareer,
          career,
          careerSerializationError,
        }),
      );
    },
  });
  Object.defineProperty(target, '__HFM_QA__', {
    value: bridge,
    configurable: true,
  });
  return () => {
    if (target.__HFM_QA__ === bridge) delete target.__HFM_QA__;
  };
}
