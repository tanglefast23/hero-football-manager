// Deliberately mocked without `Platform`: useKeyBindings must resolve it lazily,
// so importing the module here would throw if the read ever moved to module
// scope (the trap already hit once on SfxPressable).
jest.mock('react-native', () => ({}));

import { readFileSync } from 'fs';
import { join } from 'path';
import { managementKeyBindings, tabNumberKey } from '../management-key-bindings';
import { resolveKeyBinding, type KeyBindingContext, type KeyBindings } from '../use-key-bindings';

const RAIL = [
  { id: 'home', available: true },
  { id: 'squad', available: true },
  { id: 'club', available: true },
  { id: 'market', available: true },
  { id: 'league', available: true },
] as const;

/** Nothing focused: a keydown then targets the page body. */
const BODY = { tagName: 'BODY' };

/** Fires the key the way the listener would, and reports whether it acted. */
function press(
  key: string,
  bindings: KeyBindings,
  event: { target?: unknown; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean } = {},
  context?: KeyBindingContext,
): boolean {
  const action = resolveKeyBinding({ key, target: BODY, ...event }, bindings, context);
  action?.();
  return action !== undefined;
}

describe('management chrome keymap', () => {
  it('puts each tab on its position number and the week on Enter', () => {
    const onTabChange = jest.fn();
    const onAdvanceWeek = jest.fn();
    const bindings = managementKeyBindings({
      tabs: RAIL,
      onTabChange,
      onAdvanceWeek,
      advanceWeekDisabled: false,
    });

    for (const key of ['1', '2', '3', '4', '5']) press(key, bindings);
    expect(onTabChange.mock.calls.map(call => call[0]))
      .toEqual(['home', 'squad', 'club', 'market', 'league']);

    expect(press('Enter', bindings)).toBe(true);
    expect(onAdvanceWeek).toHaveBeenCalledTimes(1);
  });

  it('leaves keys the chrome does not claim to the browser', () => {
    const bindings = managementKeyBindings({
      tabs: RAIL,
      onTabChange: jest.fn(),
      onAdvanceWeek: jest.fn(),
      advanceWeekDisabled: false,
    });

    expect(press('6', bindings)).toBe(false);
    expect(press('0', bindings)).toBe(false);
    expect(press('h', bindings)).toBe(false);
  });

  it('does nothing on Enter while advancing is disabled', () => {
    const onAdvanceWeek = jest.fn();
    const bindings = managementKeyBindings({
      tabs: RAIL,
      onTabChange: jest.fn(),
      onAdvanceWeek,
      advanceWeekDisabled: true,
    });

    expect(press('Enter', bindings)).toBe(false);
    expect(onAdvanceWeek).not.toHaveBeenCalled();
    // The tabs keep working while the week is held.
    expect(press('2', bindings)).toBe(true);
  });

  it('skips a locked tab without shifting the tabs after it', () => {
    const onTabChange = jest.fn();
    const bindings = managementKeyBindings({
      tabs: [
        { id: 'home', available: true },
        { id: 'squad', available: false },
        { id: 'club', available: true },
      ],
      onTabChange,
      onAdvanceWeek: jest.fn(),
      advanceWeekDisabled: false,
    });

    expect(press('2', bindings)).toBe(false);
    expect(press('3', bindings)).toBe(true);
    expect(onTabChange).toHaveBeenCalledTimes(1);
    expect(onTabChange).toHaveBeenCalledWith('club');
  });

  it('numbers tabs from one', () => {
    expect(tabNumberKey(0)).toBe('1');
    expect(tabNumberKey(4)).toBe('5');
  });
});

describe('key binding rules', () => {
  const action = jest.fn();
  const bindings: KeyBindings = { '1': action, Enter: action, ' ': action };

  beforeEach(() => action.mockClear());

  it('ignores every key while the set is disabled', () => {
    expect(press('1', bindings, {}, { enabled: false })).toBe(false);
    expect(press('Enter', bindings, {}, { enabled: false })).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it('ignores every key while a modal owns the screen', () => {
    expect(press('1', bindings, {}, { modalOpen: true })).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it('leaves browser and OS shortcuts alone', () => {
    expect(press('1', bindings, { metaKey: true })).toBe(false);
    expect(press('1', bindings, { ctrlKey: true })).toBe(false);
    expect(press('1', bindings, { altKey: true })).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it('never eats a keystroke aimed at a text field', () => {
    for (const tagName of ['INPUT', 'input', 'TEXTAREA', 'SELECT']) {
      expect(press('1', bindings, { target: { tagName } })).toBe(false);
    }
    expect(press('1', bindings, { target: { tagName: 'DIV', isContentEditable: true } })).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it('hands Enter to a focused control so one press runs one action', () => {
    const focusedButton = { tagName: 'DIV' };
    expect(press('Enter', bindings, { target: focusedButton })).toBe(false);
    expect(press(' ', bindings, { target: focusedButton })).toBe(false);
    // A number key is not an activation key, so focus does not swallow it.
    expect(press('1', bindings, { target: focusedButton })).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('acts on Enter when the page itself holds focus', () => {
    expect(press('Enter', bindings, { target: { tagName: 'BODY' } })).toBe(true);
    expect(press('Enter', bindings, { target: null })).toBe(true);
    expect(action).toHaveBeenCalledTimes(2);
  });
});

describe('management shell wiring', () => {
  const shell = readFileSync(
    join(process.cwd(), 'src/ui/ManagementShell.tsx'),
    'utf8',
  );
  const hook = readFileSync(join(process.cwd(), 'src/ui/use-key-bindings.ts'), 'utf8');

  it('drives the real tab rail and advance action from the keymap', () => {
    expect(shell).toContain('managementKeyBindings({ tabs: TABS, onTabChange, onAdvanceWeek, advanceWeekDisabled })');
    expect(shell).toContain('keyboardShortcutsEnabled');
  });

  it('shows the shortcut on hover so the keymap is discoverable', () => {
    // Both tips are catalog copy now. The wiring this test guards is that the
    // hover tip still carries the tab's number key, and that the advance button
    // still has a tip at all.
    expect(shell).toContain('key: tabNumberKey(index),');
    expect(shell).toContain("t('managementShell.tabTipWithKey'");
    expect(shell).toContain("const ADVANCE_WEEK_TIP_KEY = 'managementShell.advanceWeekTip';");
    expect(shell).toContain('tip={advanceWeekDisabled ? undefined : t(ADVANCE_WEEK_TIP_KEY)}');
  });

  it('attaches one listener and removes it again', () => {
    expect(hook.match(/window\.addEventListener/g)).toHaveLength(1);
    expect(hook).toContain("window.addEventListener('keydown', onKeyDown)");
    expect(hook).toContain("return () => window.removeEventListener('keydown', onKeyDown)");
    expect(hook).toContain("Platform?.OS !== 'web'");
  });
});
