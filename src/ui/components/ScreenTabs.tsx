import { useId, type RefObject } from 'react';
import { Platform, View } from 'react-native';
import { SfxPressable as Pressable } from './SfxPressable';
import { PixelText } from './PixelText';

export interface ScreenTab<Id extends string> {
  readonly id: Id;
  readonly label: string;
  /** Read out instead of the label when the label alone is too terse. */
  readonly accessibilityLabel?: string;
}

export interface ScreenTabsProps<Id extends string> {
  readonly tabs: readonly ScreenTab<Id>[];
  readonly activeId: Id;
  readonly onSelect: (id: Id) => void;
  /**
   * The tab a briefing is pointing at, measured so the scrim lifts off it.
   * Without this the tab Bert has just selected sits under the same dimming as
   * everything he is not talking about.
   */
  readonly anchor?: {
    readonly id: Id;
    readonly ref: RefObject<View | null>;
    readonly onLayout: () => void;
  };
  readonly className?: string;
  /** Stable DOM/native IDs used to link each tab to its matching panel. */
  readonly idPrefix?: string;
  /** Emit tab-to-panel links only when the caller renders those panel IDs. */
  readonly linkPanels?: boolean;
  /** A one-slot Sponsor Desk is still a real tab/panel relationship. */
  readonly showSingleTab?: boolean;
}

/**
 * The one tab strip every management screen wears.
 *
 * League, Market and Club all divide a desk into two to four boards, and each
 * had grown its own strip — League's at the top, Market's a glyph docket buried
 * under the registration panel. One component means one visual language: the
 * manager learns the control once and finds it in the same place on every door.
 */
export function ScreenTabs<Id extends string>({
  tabs,
  activeId,
  onSelect,
  anchor,
  className = 'mt-4 flex-row gap-1',
  idPrefix,
  linkPanels = false,
  showSingleTab = false,
}: ScreenTabsProps<Id>) {
  const generatedId = useId().replace(/:/g, '');
  const tabSetId = idPrefix ?? `screen-tabs-${generatedId}`;
  // A lone tab is a control that cannot do anything: it reads as a title in a
  // button, and the Market wears exactly that shape in week 1, when Coaches is
  // the only desk unlocked.
  if (tabs.length < 2 && !showSingleTab) return null;
  return (
    <View accessibilityRole="tablist" className={className}>
      {tabs.map((tab, index) => {
        const selected = tab.id === activeId;
        const tabId = `${tabSetId}-tab-${tab.id}`;
        const panelId = `${tabSetId}-panel-${tab.id}`;
        return (
          <Pressable
            key={tab.id}
            ref={
              anchor !== undefined && tab.id === anchor.id
                ? anchor.ref
                : undefined
            }
            onLayout={
              anchor !== undefined && tab.id === anchor.id
                ? anchor.onLayout
                : undefined
            }
            accessibilityRole="tab"
            accessibilityLabel={tab.accessibilityLabel ?? tab.label}
            accessibilityState={{ selected }}
            nativeID={linkPanels ? tabId : undefined}
            {...webTabProps({
              selected,
              tabId,
              panelId: linkPanels ? panelId : undefined,
              onKeyDown: (key) => {
                let nextIndex = index;
                if (key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
                else if (key === 'ArrowLeft')
                  nextIndex = (index - 1 + tabs.length) % tabs.length;
                else if (key === 'Home') nextIndex = 0;
                else if (key === 'End') nextIndex = tabs.length - 1;
                else return false;
                const next = tabs[nextIndex];
                onSelect(next.id);
                // Every tab already exists in the strip, so focus it before
                // React commits the new selected state. RN Web otherwise
                // leaves the keyboard cursor on the old tab even though
                // aria-selected has moved to the new one.
                if (typeof document !== 'undefined') {
                  document
                    .getElementById(`${tabSetId}-tab-${next.id}`)
                    ?.focus();
                }
                // A caller may remount its strip with the new panel. Repeat
                // after commit so that variant receives focus as well.
                requestAnimationFrame(() => {
                  if (typeof document !== 'undefined') {
                    document
                      .getElementById(`${tabSetId}-tab-${next.id}`)
                      ?.focus();
                  }
                });
                return true;
              },
            })}
            onPress={() => onSelect(tab.id)}
            // min-h-14 is load-bearing: the pressed style below is
            // function-form, which drops NativeWind layout on iOS if
            // height ever depends on it.
            className={
              selected
                ? 'min-h-14 flex-1 items-center justify-center border-2 border-b-4 border-blue-dark bg-blue-light px-1'
                : 'min-h-14 flex-1 items-center justify-center border-2 border-b-4 border-ink/40 bg-white px-1'
            }
            style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
          >
            <PixelText
              className={
                selected
                  ? 'text-sm uppercase text-ink'
                  : 'text-sm uppercase text-ink/70'
              }
            >
              {tab.label}
            </PixelText>
          </Pressable>
        );
      })}
    </View>
  );
}

function webTabProps(input: {
  readonly selected: boolean;
  readonly tabId: string;
  readonly panelId?: string;
  readonly onKeyDown: (key: string) => boolean;
}): object {
  if (Platform.OS !== 'web') return {};
  return {
    id: input.tabId,
    ...(input.panelId === undefined ? {} : { 'aria-controls': input.panelId }),
    'aria-selected': input.selected,
    tabIndex: input.selected ? 0 : -1,
    onKeyDown: (event: { key: string; preventDefault?: () => void }) => {
      if (!input.onKeyDown(event.key)) return;
      event.preventDefault?.();
    },
  };
}
