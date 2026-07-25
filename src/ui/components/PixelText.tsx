import { Text, type TextProps } from 'react-native';

/**
 * The three type voices from docs/11-art-style.md, in one place.
 *
 * React Native does not inherit `fontFamily` through a `<View>`, so every text
 * node has to name its own face. A bare `<Text>` therefore renders in SF Pro /
 * Roboto — the OS font, inside a pixel-art game. This component exists so a
 * call site picks a *voice* instead of remembering a class name.
 *
 * - `display` (default) — Silkscreen **Bold**. Buttons, labels, headings,
 *   eyebrows, chips, table headers. Per the art bible this is the game's
 *   default voice, which is why it is the default variant here.
 * - `data` — Silkscreen Regular. Money, stats, scores, table cells: anything
 *   that has to line up in a column.
 * - `body` — no pixel face at all, i.e. the platform sans. Long prose is
 *   deliberately *not* pixel type ("pixel fonts are exhausting to read").
 *
 * Never add `font-bold` on top of these. Silkscreen ships one weight per file,
 * so a bold request on the regular cut produces synthetic faux-bold, which
 * smears a 1-bit bitmap font. `display` already *is* the bold cut.
 */
export type PixelTextVariant = 'display' | 'data' | 'body';

const VARIANT_CLASS: Record<PixelTextVariant, string> = {
  display: 'font-pixel',
  data: 'font-mono',
  body: '',
};

export type PixelTextProps = TextProps & {
  variant?: PixelTextVariant;
  className?: string;
};

/**
 * The variant class is emitted *before* the caller's className so a call site
 * can still override the face for a one-off (NativeWind resolves conflicting
 * utilities last-wins). The font is applied via className and never via
 * `style`, because mixing the two for one visual property lets either win
 * unpredictably on native.
 */
export function PixelText({ variant = 'display', className, ...props }: PixelTextProps) {
  const face = VARIANT_CLASS[variant];
  const merged = className === undefined || className.length === 0
    ? face
    : face.length === 0
      ? className
      : `${face} ${className}`;

  return <Text {...props} className={merged.length === 0 ? undefined : merged} />;
}
