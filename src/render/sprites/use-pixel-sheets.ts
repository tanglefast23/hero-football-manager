import { useEffect, useState } from 'react';
import {
  loadPixelSheets,
  peekPixelSheets,
  type PixelSheets,
} from './pixel-sheets';

/**
 * The pixel sheets, or undefined for the one tick before they arrive.
 *
 * On native `peek` answers on the first render and the effect never runs. On
 * web the sheets are chunks, prefetched by App at module eval, so `peek` also
 * answers on the first render of anything drawn after the title. The effect is
 * the cold-start path: a sprite a tick late instead of a crash.
 */
export function usePixelSheets(): PixelSheets | undefined {
  const [sheets, setSheets] = useState(peekPixelSheets);

  useEffect(() => {
    if (sheets !== undefined) return undefined;
    let live = true;
    loadPixelSheets()
      .then((loaded) => {
        if (live) setSheets(loaded);
      })
      .catch((error: unknown) => {
        console.warn('pixel sheets unavailable', error);
      });
    return () => {
      live = false;
    };
  }, [sheets]);

  return sheets;
}
