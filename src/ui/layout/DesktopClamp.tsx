import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { useLayoutMode } from './use-layout-mode';

/**
 * Nothing spans a desktop window edge to edge.
 *
 * Wide viewports get the two-column reading width and centre inside it — the
 * same measure the Advance Week button and the management columns already use.
 * A full-bleed row on a 2000px monitor is unreadable, and worse it disagrees
 * with the columns directly above it: the eye reads them as different pages.
 *
 * Phones are untouched. There the content already IS the window width, so the
 * clamp would be a no-op wrapper.
 */
export const DESKTOP_CONTENT_MAX_WIDTH = 1180;

/**
 * For a ScrollView's contentContainerStyle, which is where most screens set
 * their padding. Composing a style beats wrapping the children in another View:
 * it clamps the measure without changing the tree, so no flex behaviour moves.
 */
export function useDesktopContentStyle(): ViewStyle | null {
  return useLayoutMode() === 'twoColumn'
    ? {
        width: '100%',
        maxWidth: DESKTOP_CONTENT_MAX_WIDTH,
        alignSelf: 'center',
      }
    : null;
}

export interface DesktopClampProps {
  children: ReactNode;
  /** Extra classes for the clamp itself, e.g. padding the caller owned before. */
  className?: string;
}

/** The same measure as a wrapper, for callers that are not a scroll container. */
export function DesktopClamp({ children, className }: DesktopClampProps) {
  const wide = useLayoutMode() === 'twoColumn';
  const measure = wide ? 'w-full max-w-[1180px] self-center' : 'w-full';
  return (
    <View
      className={className === undefined ? measure : `${measure} ${className}`}
    >
      {children}
    </View>
  );
}
