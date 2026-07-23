import { useWindowDimensions } from 'react-native';
import { layoutModeForWidth, type LayoutMode } from './layout-mode';

export type { LayoutMode } from './layout-mode';

/** Auto-detects the management layout and re-renders live on window resize. */
export function useLayoutMode(): LayoutMode {
  const { width } = useWindowDimensions();
  return layoutModeForWidth(width);
}
