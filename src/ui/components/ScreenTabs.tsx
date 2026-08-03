import type { RefObject } from 'react';
import { View } from 'react-native';
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
}: ScreenTabsProps<Id>) {
  // A lone tab is a control that cannot do anything: it reads as a title in a
  // button, and the Market wears exactly that shape in week 1, when Coaches is
  // the only desk unlocked.
  if (tabs.length < 2) return null;
  return (
    <View className={className}>
      {tabs.map(tab => {
        const selected = tab.id === activeId;
        return (
          <Pressable
            key={tab.id}
            ref={anchor !== undefined && tab.id === anchor.id ? anchor.ref : undefined}
            onLayout={anchor !== undefined && tab.id === anchor.id ? anchor.onLayout : undefined}
            accessibilityRole="tab"
            accessibilityLabel={tab.accessibilityLabel ?? tab.label}
            accessibilityState={{ selected }}
            onPress={() => onSelect(tab.id)}
            // min-h-14 is load-bearing: the pressed style below is
            // function-form, which drops NativeWind layout on iOS if
            // height ever depends on it.
            className={selected
              ? 'min-h-14 flex-1 items-center justify-center border-2 border-b-4 border-blue-dark bg-blue-light px-1'
              : 'min-h-14 flex-1 items-center justify-center border-2 border-b-4 border-ink/40 bg-white px-1'}
            style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
          >
            <PixelText className={selected
              ? 'text-sm uppercase text-ink'
              : 'text-sm uppercase text-ink/50'}>
              {tab.label}
            </PixelText>
          </Pressable>
        );
      })}
    </View>
  );
}
