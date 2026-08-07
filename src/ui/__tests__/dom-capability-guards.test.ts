// Both hooks under test are shared, not web-only files: they are imported by
// App.tsx and ManagementShell.tsx, which also run on the phone. React Native
// defines a global `window` but no `document`, so every DOM read has to be
// feature-detected — `Platform.OS === 'web'` is a cheap first read, never the
// safety check (a prerendered static export is 'web' and has no DOM at all).
//
// Platform is forced to 'web' here so the tests reach the DOM branch itself
// rather than stopping at the platform gate, and React is faked so the effect
// body runs synchronously in this repo's node test environment (no jsdom, and
// no renderer that could mount a component).
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('../../application/store', () => ({ flushPendingCareerSave: jest.fn() }));
jest.mock('react', () => {
  const cleanups: Array<() => void> = [];
  return {
    __cleanups: cleanups,
    useEffect: (effect: () => (() => void) | undefined) => {
      const cleanup = effect();
      if (cleanup !== undefined) cleanups.push(cleanup);
    },
    useRef: (initial: unknown) => ({ current: initial }),
  };
});

import { flushPendingCareerSave } from '../../application/store';
import { useKeyBindings } from '../use-key-bindings';
import { useSuspendFlush } from '../use-suspend-flush';

const effects = jest.requireMock('react') as { __cleanups: Array<() => void> };
const globals = globalThis as unknown as { window?: unknown; document?: unknown };

type Listener = (event: unknown) => void;

/** The addEventListener/removeEventListener pair both hooks reach for. */
function fakeEventTarget() {
  const listeners = new Map<string, Set<Listener>>();
  return {
    addEventListener(type: string, listener: Listener): void {
      const forType = listeners.get(type) ?? new Set<Listener>();
      forType.add(listener);
      listeners.set(type, forType);
    },
    removeEventListener(type: string, listener: Listener): void {
      listeners.get(type)?.delete(listener);
    },
    count(type: string): number {
      return listeners.get(type)?.size ?? 0;
    },
    dispatch(type: string, event: unknown = {}): void {
      for (const listener of [...(listeners.get(type) ?? [])]) listener(event);
    },
  };
}

function installDom({ modalOpen = false } = {}) {
  const view = fakeEventTarget();
  const page = Object.assign(fakeEventTarget(), {
    hidden: false,
    querySelector: (selector: string): unknown =>
      (modalOpen && selector === '[aria-modal="true"]' ? {} : null),
  });
  globals.window = view;
  globals.document = page;
  return { view, page };
}

/** The React Native shape: a global `window`, and no `document` anywhere. */
function installNativeGlobals() {
  const view = fakeEventTarget();
  globals.window = view;
  delete globals.document;
  return view;
}

/** The mirror shape a partial DOM shim gives a prerender: document, no window. */
function installDocumentOnlyGlobals() {
  const page = Object.assign(fakeEventTarget(), {
    hidden: false,
    querySelector: (): unknown => null,
  });
  globals.document = page;
  delete globals.window;
  return page;
}

function runCleanups(): void {
  for (const cleanup of effects.__cleanups.splice(0)) cleanup();
}

beforeEach(() => {
  effects.__cleanups.length = 0;
  jest.clearAllMocks();
});

afterEach(() => {
  delete globals.window;
  delete globals.document;
});

/** A keydown aimed at the page itself, which is what the rules act on. */
function keydown(key: string) {
  return { key, target: { tagName: 'BODY' }, preventDefault: jest.fn() };
}

describe('useKeyBindings DOM capability guard', () => {
  it('binds the key and claims the press when a DOM is there', () => {
    const { view } = installDom();
    const action = jest.fn();

    useKeyBindings({ '1': action });

    expect(view.count('keydown')).toBe(1);
    const event = keydown('1');
    view.dispatch('keydown', event);
    expect(action).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);

    runCleanups();
    expect(view.count('keydown')).toBe(0);
  });

  it('reads the open modal through the document it just verified', () => {
    const { view } = installDom({ modalOpen: true });
    const action = jest.fn();

    useKeyBindings({ '1': action });
    view.dispatch('keydown', keydown('1'));

    expect(action).not.toHaveBeenCalled();
  });

  it('binds nothing where a global window exists but no document does', () => {
    const view = installNativeGlobals();

    expect(() => useKeyBindings({ '1': jest.fn() })).not.toThrow();
    expect(view.count('keydown')).toBe(0);
    expect(effects.__cleanups).toHaveLength(0);
  });

  it('binds nothing where a document exists but no window does', () => {
    const page = installDocumentOnlyGlobals();

    expect(() => useKeyBindings({ '1': jest.fn() })).not.toThrow();
    expect(page.count('keydown')).toBe(0);
    expect(effects.__cleanups).toHaveLength(0);
  });

  it('binds nothing with no DOM globals at all', () => {
    delete globals.window;
    delete globals.document;

    expect(() => useKeyBindings({ '1': jest.fn() })).not.toThrow();
    expect(effects.__cleanups).toHaveLength(0);
  });
});

describe('useSuspendFlush DOM capability guard', () => {
  it('flushes the queued save on hide and on pagehide, then detaches both', () => {
    const { view, page } = installDom();

    useSuspendFlush();

    expect(page.count('visibilitychange')).toBe(1);
    expect(view.count('pagehide')).toBe(1);

    // A visibilitychange back to visible is not a suspend.
    page.dispatch('visibilitychange');
    expect(flushPendingCareerSave).not.toHaveBeenCalled();

    page.hidden = true;
    page.dispatch('visibilitychange');
    view.dispatch('pagehide');
    expect(flushPendingCareerSave).toHaveBeenCalledTimes(2);

    runCleanups();
    expect(page.count('visibilitychange')).toBe(0);
    expect(view.count('pagehide')).toBe(0);
  });

  it('binds nothing where a global window exists but no document does', () => {
    const view = installNativeGlobals();

    expect(() => useSuspendFlush()).not.toThrow();
    expect(view.count('pagehide')).toBe(0);
    expect(effects.__cleanups).toHaveLength(0);
  });

  it('binds nothing where a document exists but no window does', () => {
    // `pagehide` is a window event, so a document alone is not enough to
    // subscribe — the old guard checked only for a document and would have
    // thrown reaching for the missing window.
    const page = installDocumentOnlyGlobals();

    expect(() => useSuspendFlush()).not.toThrow();
    expect(page.count('visibilitychange')).toBe(0);
    expect(effects.__cleanups).toHaveLength(0);
  });

  it('binds nothing with no DOM globals at all', () => {
    delete globals.window;
    delete globals.document;

    expect(() => useSuspendFlush()).not.toThrow();
    expect(effects.__cleanups).toHaveLength(0);
  });
});
