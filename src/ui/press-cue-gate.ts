/**
 * One cue per activation, played as early as the platform allows.
 *
 * The sound belongs to the finger going down. Held until the release it stops
 * being the press and becomes a report on it, which is what made the whole UI
 * feel a beat behind the hand. So a press cues on the way down.
 *
 * The completed press stays an owner as well, because React Native Web will not
 * promise every activation a press-in phase: a keyboard or synthetic activation
 * arrives as a bare press, and cueing on press-in alone once left the creation
 * steppers silent while their value still changed. It stands down only when a
 * press phase was seen a moment ago — exactly the case where the way down has
 * already cued.
 *
 * The record is a timestamp rather than a flag the release clears, because the
 * release runs BEFORE the press: a flag would already be gone by the time the
 * press consulted it and every tap would sound twice. Recording the release too
 * (not just the press-in) is what keeps a long hold to one cue — the gap this
 * has to span is release-to-activation, never the length of the hold.
 */

/**
 * How recently a press phase must have been seen for a completed press to be
 * read as that same press finishing.
 *
 * React Native dispatches press-out and press from one handler, so the gap this
 * bridges is sub-frame and the rest is slack. It is kept short because it
 * doubles as the time before an abandoned press — a finger dragged off, which
 * gets its release and no activation — lets that control answer a keyboard
 * press again. Every millisecond here is a millisecond a real keyboard press
 * could go unheard.
 */
export const PRESS_PHASE_WINDOW_MS = 500;

export interface PressCueGate {
  /** The finger went down: cue now, and remember that this press has spoken. */
  pressIn: (play: () => void) => void;
  /** The finger came up. Recorded so a long hold cannot cue twice. */
  pressOut: () => void;
  /** The activation completed: cue only if no press phase already did. */
  press: (play: () => void) => void;
}

/**
 * A gate per control, never per screen: a keyboard activation here must be
 * judged by this button's own presses, not by a tap somewhere else.
 */
export function createPressCueGate(): PressCueGate {
  let lastPhaseAt = Number.NEGATIVE_INFINITY;
  return {
    pressIn(play) {
      lastPhaseAt = Date.now();
      play();
    },
    pressOut() {
      lastPhaseAt = Date.now();
    },
    press(play) {
      if (Date.now() - lastPhaseAt < PRESS_PHASE_WINDOW_MS) return;
      play();
    },
  };
}
