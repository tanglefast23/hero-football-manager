import type { ImageSourcePropType } from 'react-native';
import { ImageBackground, Text, View } from 'react-native';

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

const SPIDER_SUCCESS = require('../../../assets/art/events/event-giant-spider-success.jpg') as ImageSourcePropType;

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
  const source = success && artKey === 'event-giant-spider-success'
    ? SPIDER_SUCCESS
    : CATEGORY_ART[category];
  const motif = eventMotif(artKey);

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
        className="absolute h-24 w-24 rounded-full border-4 border-gold/70"
        style={{ left: `${motif.left}%`, top: `${motif.top}%`, transform: [{ rotate: `${motif.rotation}deg` }] }}
      >
        <View className="absolute left-1/2 top-0 h-full w-1 bg-gold/50" />
        <View className="absolute left-0 top-1/2 h-1 w-full bg-gold/50" />
        <View className="absolute inset-0 items-center justify-center">
          <Text className="font-mono text-2xl font-bold text-paper">{eventGlyph(artKey)}</Text>
        </View>
      </View>
      {children}
    </ImageBackground>
  );
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
