import { View } from 'react-native';

const LANGUAGE_ICON = [
  '..KKKK..',
  '.K....K.',
  'K..KK..K',
  'K.K..K.K',
  'K.K..K.K',
  'K..KK..K',
  '.K....K.',
  '..KKKK..',
] as const;

/** Authored 8×8 globe. It cannot be mistaken for a keyboard shortcut. */
export function PixelLanguageIcon({ size = 16 }: { size?: number }) {
  const pixel = size / 8;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ width: size, height: size }}
    >
      {LANGUAGE_ICON.flatMap((row, y) =>
        [...row].map((token, x) =>
          token === 'K' ? (
            <View
              key={`${x}:${y}`}
              style={{
                position: 'absolute',
                left: x * pixel,
                top: y * pixel,
                width: pixel,
                height: pixel,
                backgroundColor: '#241f2e',
              }}
            />
          ) : null,
        ),
      )}
    </View>
  );
}
