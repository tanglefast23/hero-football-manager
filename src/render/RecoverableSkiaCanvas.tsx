import { useEffect, type ComponentProps } from 'react';
import { Canvas } from '@shopify/react-native-skia';

export interface RecoverableSkiaCanvasProps
  extends ComponentProps<typeof Canvas> {
  generation: number;
  onContextLost: (generation: number) => void;
  onContextReady?: (generation: number) => void;
}

/** Native Skia does not expose a WebGL context-loss event. */
export function RecoverableSkiaCanvas({
  generation,
  onContextLost: _onContextLost,
  onContextReady,
  ...props
}: RecoverableSkiaCanvasProps) {
  useEffect(() => {
    onContextReady?.(generation);
  }, [generation, onContextReady]);

  return <Canvas {...props} />;
}
