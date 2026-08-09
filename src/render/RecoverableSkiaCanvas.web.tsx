import { useEffect, useRef, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';

export interface RecoverableSkiaCanvasProps extends ComponentProps<
  typeof Canvas
> {
  generation: number;
  onContextLost: (generation: number) => void;
  onContextReady?: (generation: number) => void;
}

interface CanvasHost {
  querySelector(selector: string): HTMLCanvasElement | null;
}

/**
 * Skia's public ref does not expose its DOM canvas. The host is narrow on
 * purpose: it finds only the canvas rendered by this component and owns the
 * listener for exactly that canvas generation.
 */
export function RecoverableSkiaCanvas({
  generation,
  onContextLost,
  onContextReady,
  style,
  ...props
}: RecoverableSkiaCanvasProps) {
  const hostRef = useRef<CanvasHost | null>(null);

  useEffect(() => {
    let disposed = false;
    let frame = 0;
    let canvas: HTMLCanvasElement | null = null;

    const lost = (event: Event) => {
      // CanvasKit deliberately loses its context while disposing a canvas.
      // At that point the element is detached. Treating that as a crash would
      // turn every normal screen change into a recovery loop.
      if (disposed || canvas === null || !canvas.isConnected) return;
      event.preventDefault();
      onContextLost(generation);
    };

    const attach = () => {
      if (disposed) return;
      canvas = hostRef.current?.querySelector('canvas') ?? null;
      if (canvas === null) {
        frame = requestAnimationFrame(attach);
        return;
      }
      canvas.addEventListener('webglcontextlost', lost, { passive: false });
      onContextReady?.(generation);
    };

    attach();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      canvas?.removeEventListener('webglcontextlost', lost);
    };
  }, [generation, onContextLost, onContextReady]);

  return (
    <View
      ref={(value) => {
        hostRef.current = value as unknown as CanvasHost | null;
      }}
      style={style}
    >
      <Canvas {...props} style={StyleSheet.absoluteFill} />
    </View>
  );
}
