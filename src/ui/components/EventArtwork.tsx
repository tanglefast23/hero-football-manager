import type { ImageSourcePropType } from 'react-native';
import { ImageBackground, Text, View } from 'react-native';
import { eventSuccessMotif, type EventSuccessPalette } from '../event-success-art';

export type EventArtCategory = 'mystery' | 'club' | 'media' | 'sponsor' | 'player' | 'medical' | 'fan';

const CATEGORY_ART: Record<EventArtCategory, ImageSourcePropType> = {
  mystery: require('../../../assets/art/events/event-category-mystery.jpg'),
  club: require('../../../assets/art/events/event-category-club.jpg'),
  media: require('../../../assets/art/events/event-category-media-sponsor.jpg'),
  sponsor: require('../../../assets/art/events/event-category-media-sponsor.jpg'),
  player: require('../../../assets/art/events/event-category-player.jpg'),
  medical: require('../../../assets/art/events/event-category-medical.jpg'),
  fan: require('../../../assets/art/events/event-category-fan.jpg'),
};

/**
 * Painted risky-success artwork, keyed by the event's `<art>-success` key.
 * Metro needs literal `require` paths. The remaining events use their authored
 * comic composition from `event-success-art.ts` over the category painting.
 */
const SUCCESS_ART: Record<string, ImageSourcePropType> = {
  'event-giant-spider-success': require('../../../assets/art/events/event-giant-spider-success.jpg'),
};

interface EventArtworkProps {
  artKey: string;
  category: EventArtCategory;
  success?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/** Generated cutscene art plus a deterministic event-specific comic motif. */
export function EventArtwork({
  artKey,
  category,
  success = false,
  className,
  children,
}: EventArtworkProps) {
  const source = (success ? SUCCESS_ART[artKey] : undefined) ?? CATEGORY_ART[category];
  const motif = eventMotif(artKey);
  const successMotif = success ? eventSuccessMotif(artKey) : undefined;
  const palette = successMotif === undefined ? undefined : successPalette(successMotif.palette);

  return (
    <ImageBackground
      source={source}
      resizeMode="cover"
      className={className}
      accessibilityIgnoresInvertColors
    >
      <View className="absolute inset-0 bg-ink/20" />
      <View
        pointerEvents="none"
        className={successMotif === undefined
          ? 'absolute h-24 w-24 rounded-full border-4 border-gold/70'
          : 'absolute h-36 w-36 border-4'}
        style={{
          left: `${motif.left}%`,
          top: `${motif.top}%`,
          transform: [{ rotate: `${motif.rotation}deg` }],
          ...(palette === undefined ? {} : {
            backgroundColor: palette.dark,
            borderColor: palette.light,
          }),
        }}
      >
        <View
          className="absolute left-1/2 top-0 h-full w-1"
          style={palette === undefined ? { backgroundColor: '#edb54a88' } : { backgroundColor: palette.base }}
        />
        <View
          className="absolute left-0 top-1/2 h-1 w-full"
          style={palette === undefined ? { backgroundColor: '#edb54a88' } : { backgroundColor: palette.base }}
        />
        <View className="absolute inset-0 items-center justify-center px-2">
          <Text className={successMotif === undefined
            ? 'font-mono text-2xl font-bold text-paper'
            : 'font-mono text-3xl font-bold text-paper'}>
            {successMotif?.symbol ?? eventGlyph(artKey)}
          </Text>
          {successMotif === undefined ? null : (
            <Text className="mt-2 text-center font-mono text-xs font-bold uppercase text-paper">
              {successMotif.caption}
            </Text>
          )}
        </View>
      </View>
      {children}
    </ImageBackground>
  );
}

function successPalette(palette: EventSuccessPalette): { dark: string; base: string; light: string } {
  if (palette === 'red') return { dark: '#a83440', base: '#d94f52', light: '#f2938c' };
  if (palette === 'blue') return { dark: '#3f6fb5', base: '#5a8fd6', light: '#a3c8f0' };
  if (palette === 'gold') return { dark: '#c8862a', base: '#edb54a', light: '#f7d894' };
  if (palette === 'pitch') return { dark: '#3f8a4a', base: '#5cb85c', light: '#8fd98f' };
  if (palette === 'grey') return { dark: '#6b6675', base: '#9a95a4', light: '#c9c5d0' };
  return { dark: '#5b3a91', base: '#9a63d6', light: '#c9a6ec' };
}

function eventGlyph(key: string): string {
  const words = key.split('-').filter(word => (
    word !== 'event' && word !== 'success' && word !== 'category'
  ));
  return words.slice(0, 2).map(word => word[0]?.toUpperCase() ?? '').join('') || '★';
}

function eventMotif(key: string): { left: number; top: number; rotation: number } {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const unsigned = hash >>> 0;
  return {
    left: 4 + (unsigned % 54),
    top: 14 + ((unsigned >>> 8) % 38),
    rotation: (unsigned >>> 16) % 45,
  };
}
