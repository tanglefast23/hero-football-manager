import type { TextStyle } from 'react-native';
import type { TextScale } from '../persistence';

/**
 * Body copy honours the accessibility text-size setting. This returns a plain
 * style and never a className: NativeWind resolves `text-*`/`leading-*` classes
 * into the same style keys, and a Text node carrying both sizes picks a winner
 * unpredictably on native. Callers keep spacing and colour in `className` and
 * hand the font size to this helper alone.
 */
export function scaledBody(
  scale: TextScale,
  fontSize = 16,
  lineHeight = fontSize * 1.5,
): TextStyle {
  return {
    fontSize: Math.round(fontSize * scale),
    lineHeight: Math.round(lineHeight * scale),
  };
}
