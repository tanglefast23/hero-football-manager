import { useCallback, useEffect, useRef } from 'react';
import type { View } from 'react-native';
import type { TutorialAnchorLayout } from './tutorial-cue-position';

/**
 * Measures one element so the briefing can cut a hole in its own scrim over it.
 *
 * The spotlight is drawn by an overlay that knows nothing about the screens
 * underneath, so the element being talked about has to report where it is. The
 * measurement is deferred to the next frame because `onLayout` fires before the
 * element has settled into its final window position, and cleared when the
 * anchor stops being relevant so a stale rectangle never keeps a hole open over
 * whatever moved into that spot.
 *
 * Lives here rather than beside its first caller: the money chip is in the
 * management shell and the League screen's sub-tabs are three components away,
 * and both need exactly this.
 */
export function useGuideAnchor(
  enabled: boolean,
  onAnchorChange?: (anchor: TutorialAnchorLayout | null) => void,
) {
  const anchorRef = useRef<View>(null);
  const measurementFrameRef = useRef<number | null>(null);

  const measureAnchor = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) onAnchorChange?.({ x, y, width, height });
    });
  }, [onAnchorChange]);

  const scheduleMeasurement = useCallback(() => {
    if (!enabled || onAnchorChange === undefined) return;
    if (measurementFrameRef.current !== null)
      cancelAnimationFrame(measurementFrameRef.current);
    measurementFrameRef.current = requestAnimationFrame(() => {
      measurementFrameRef.current = null;
      measureAnchor();
    });
  }, [enabled, measureAnchor, onAnchorChange]);

  useEffect(() => {
    if (!enabled) {
      onAnchorChange?.(null);
      return;
    }
    scheduleMeasurement();
    return () => {
      if (measurementFrameRef.current !== null) {
        cancelAnimationFrame(measurementFrameRef.current);
        measurementFrameRef.current = null;
      }
      onAnchorChange?.(null);
    };
  }, [enabled, onAnchorChange, scheduleMeasurement]);

  return { anchorRef, scheduleMeasurement };
}
