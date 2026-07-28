/**
 * One place that decides when the app is allowed to make noise.
 *
 * Every looping owner (the menu theme, the match theme, the fire crackle, Bert)
 * used to keep playing after the app went to the background. On iOS the audio
 * session usually silences that for us; a browser tab does not, so a match left
 * open in another tab played its theme indefinitely — the exact failure the
 * project's QA notes keep tripping over. Suspension is owned here rather than by
 * each screen so a new audio owner cannot forget it.
 *
 * Presentation-only and fail-soft: headless Jest and any environment without
 * AppState or `document` simply never suspend, which is the old behaviour.
 */

interface AudioOwner {
  /** Silence now. Called once per transition, never twice in a row. */
  readonly suspend: () => void;
  /** Play again if this owner was making noise when it was suspended. */
  readonly resume: () => void;
}

const owners = new Set<AudioOwner>();
let listening = false;
let suspended = false;

function setSuspended(next: boolean): void {
  if (next === suspended) return;
  suspended = next;
  for (const owner of owners) {
    try {
      if (next) owner.suspend();
      else owner.resume();
    } catch {
      // An owner that cannot pause must not stop the others from pausing.
    }
  }
}

/**
 * AppState covers native backgrounding and, on react-native-web, tab
 * visibility. The raw `visibilitychange` listener is a belt-and-braces addition
 * for web builds where AppState is stubbed out.
 */
function startListening(): void {
  if (listening) return;
  listening = true;

  try {
    const { AppState } = require('react-native') as typeof import('react-native');
    AppState?.addEventListener?.('change', (next: string) => {
      setSuspended(next !== 'active');
    });
  } catch {
    // No AppState (react-native is untransformed under Jest) — the DOM branch
    // below still covers the web build, and headless tests simply never suspend.
  }

  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => setSuspended(document.hidden === true));
  }
}

/** Registers an owner and returns the function that unregisters it. */
export function registerAudioOwner(owner: AudioOwner): () => void {
  owners.add(owner);
  startListening();
  return () => owners.delete(owner);
}

/** True while the app is backgrounded or its tab is hidden. */
export function audioIsSuspended(): boolean {
  return suspended;
}
