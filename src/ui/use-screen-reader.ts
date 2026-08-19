import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Null means the platform answer has not arrived yet.
 *
 * Timed story content treats that unknown state as enabled so a slow
 * accessibility query can never dismiss information before it is read.
 */
export function useScreenReaderEnabled(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((value) => {
        if (active) setEnabled(value);
      })
      // A platform that cannot answer stays null — treated as enabled by
      // timed story content, which is the safe side.
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setEnabled,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return enabled;
}
