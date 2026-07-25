import type { ManagementTab } from './models';
import type { KeyBindings } from './use-key-bindings';

export interface ManagementKeyBindingsInput {
  /** The tab rail in display order — a tab's number key is its position. */
  tabs: ReadonlyArray<{ id: ManagementTab; available: boolean }>;
  onTabChange: (tab: ManagementTab) => void;
  onAdvanceWeek: () => void;
  advanceWeekDisabled: boolean;
}

/** The number key that selects the tab sitting at `index` (0-based). */
export function tabNumberKey(index: number): string {
  return String(index + 1);
}

/**
 * Desktop keymap for the management chrome: the number keys pick a tab and
 * Enter advances the week.
 *
 * Numbers come from rail order so the hover tips and the keys can never
 * disagree, and a locked tab keeps its number instead of shifting every tab
 * after it. Unavailable actions are left unbound rather than bound to a no-op,
 * so a dead key still behaves like a key this screen never claimed.
 */
export function managementKeyBindings({
  tabs,
  onTabChange,
  onAdvanceWeek,
  advanceWeekDisabled,
}: ManagementKeyBindingsInput): KeyBindings {
  const bindings: Record<string, (() => void) | undefined> = {};
  tabs.forEach((tab, index) => {
    if (!tab.available) return;
    bindings[tabNumberKey(index)] = () => onTabChange(tab.id);
  });
  if (!advanceWeekDisabled) bindings.Enter = onAdvanceWeek;
  return bindings;
}
