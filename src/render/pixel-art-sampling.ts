import { FilterMode, MipmapMode, type SamplingOptions } from '@shopify/react-native-skia';

/**
 * Pixel art must never blend source texels. Reuse this on every image-backed
 * Skia sprite path so device resolution and fractional layout scaling do not
 * soften edges or pull colours across atlas-cell boundaries.
 */
export const PIXEL_ART_SAMPLING: SamplingOptions = {
  filter: FilterMode.Nearest,
  mipmap: MipmapMode.None,
};
