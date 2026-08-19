import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** App preference and the operating-system accessibility setting are additive. */
export function useReducedMotion(preferenceEnabled: boolean): boolean {
  const [systemEnabled, setSystemEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setSystemEnabled(enabled);
      })
      // A platform that cannot answer keeps the default (motion on).
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setSystemEnabled,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return preferenceEnabled || systemEnabled;
}
