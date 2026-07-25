import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Key name (exactly as `KeyboardEvent.key` reports it) → what pressing it does.
 * A key that is absent, or mapped to `undefined`, stays the browser's.
 */
export type KeyBindings = Readonly<Record<string, (() => void) | undefined>>;

/**
 * The parts of a keydown the decision below reads. Declared structurally rather
 * than as a DOM `KeyboardEvent` so the rules can be tested headlessly, with no
 * browser and no component tree.
 */
export interface KeyBindingEvent {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  target?: unknown;
}

export interface KeyBindingContext {
  /** Pass false to suspend the whole set at once. Defaults to true. */
  enabled?: boolean;
  /** True while a modal owns the screen — its own controls keep the keyboard. */
  modalOpen?: boolean;
}

/**
 * Keys react-native-web already delivers to whichever control holds focus
 * (see PressResponder.isValidKeyPress). A global binding for them would run two
 * actions from one press, so the focused control wins.
 */
const FOCUSED_CONTROL_KEYS: ReadonlySet<string> = new Set(['Enter', ' ', 'Spacebar']);

/** Uppercased tag name of a DOM-ish target, or '' when it has none. */
function tagNameOf(target: unknown): string {
  if (target === null || typeof target !== 'object') return '';
  const { tagName } = target as { tagName?: unknown };
  return typeof tagName === 'string' ? tagName.toUpperCase() : '';
}

/**
 * True while the keystroke belongs to a text field. The player types a club and
 * manager name into a real input, so a shortcut must never eat those letters.
 */
function isTypingTarget(target: unknown): boolean {
  if (target !== null && typeof target === 'object') {
    const { isContentEditable } = target as { isContentEditable?: unknown };
    if (isContentEditable === true) return true;
  }
  const tagName = tagNameOf(target);
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
}

/**
 * True when something other than the page itself holds keyboard focus. Keydown
 * targets the focused element, so anything but body/html means a control is
 * focused and may act on the key by itself.
 */
function hasFocusedControl(target: unknown): boolean {
  const tagName = tagNameOf(target);
  return tagName !== '' && tagName !== 'BODY' && tagName !== 'HTML';
}

/**
 * Which bound action a keydown should run, or `undefined` to leave the
 * keystroke alone. Exported as a pure function so every rule below is testable
 * without a browser.
 */
export function resolveKeyBinding(
  event: KeyBindingEvent,
  bindings: KeyBindings,
  context: KeyBindingContext = {},
): (() => void) | undefined {
  const { enabled = true, modalOpen = false } = context;
  if (!enabled || modalOpen) return undefined;
  // Browser and OS shortcuts (⌘1, Ctrl+R, Alt+←) stay with the browser.
  if (event.ctrlKey === true || event.metaKey === true || event.altKey === true) return undefined;
  if (isTypingTarget(event.target)) return undefined;
  if (FOCUSED_CONTROL_KEYS.has(event.key) && hasFocusedControl(event.target)) return undefined;
  return bindings[event.key];
}

/**
 * True while a react-native-web `Modal` is on screen. RNW only mounts modal
 * content while it is visible, so the ARIA attribute doubles as "a modal owns
 * the screen" — that keeps shortcuts from quietly acting on the screen behind.
 */
function isModalOpen(): boolean {
  return document.querySelector('[aria-modal="true"]') !== null;
}

/**
 * Desktop keyboard shortcuts for a screen. Web only: a phone has no hardware
 * keyboard to listen to, so this is a complete no-op on native.
 *
 * @param bindings key → action. Rebuild it freely on every render; the listener
 *   is attached once and always reads the newest map.
 * @param enabled pass false to suspend the whole set.
 */
export function useKeyBindings(bindings: KeyBindings, enabled = true): void {
  // One listener for the life of the screen, so it reads the current map and
  // flag through a ref instead of re-subscribing on every render.
  const latest = useRef({ bindings, enabled });
  latest.current = { bindings, enabled };

  useEffect(() => {
    // Platform is resolved here, not at module scope: several UI tests mock
    // react-native without it and an import-time read breaks them at load
    // (the same trap documented on SfxPressable).
    if (Platform?.OS !== 'web' || typeof window === 'undefined') return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      const action = resolveKeyBinding(event, latest.current.bindings, {
        enabled: latest.current.enabled,
        modalOpen: isModalOpen(),
      });
      if (action === undefined) return;
      // The key is ours: don't also scroll the page or re-activate a control.
      event.preventDefault();
      action();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
