import { Text, View } from 'react-native';

/**
 * The title screen's dark-pitch stage, shared by every landing screen:
 * chalk circles and a halfway line behind floating paper panels.
 */
export function ChalkboardBackdrop({ wide = false }: { wide?: boolean }) {
  return (
    <View pointerEvents="none" className="absolute inset-0 overflow-hidden">
      <View className="absolute -left-28 top-16 h-72 w-72 rounded-full border-4 border-paper/15" />
      <View className="absolute -right-24 top-64 h-64 w-64 rounded-full border-4 border-paper/10" />
      {wide ? (
        <View className="absolute right-[9%] top-1/2 h-[440px] w-[440px] -translate-y-1/2 rounded-full border-4 border-paper/10" />
      ) : null}
    </View>
  );
}

/** Tilted blue sticker that holds a masthead's payoff word. */
export function StickerWord({ text, wide = false }: { text: string; wide?: boolean }) {
  return (
    <View
      className={wide
        ? 'self-start -rotate-2 border-[3px] border-ink bg-blue px-5 py-2'
        : 'self-start -rotate-2 border-2 border-ink bg-blue px-3 py-1'}
    >
      <Text className={wide ? 'font-pixel text-4xl uppercase text-white' : 'font-pixel text-2xl uppercase text-white'}>
        {text}
      </Text>
    </View>
  );
}

/** Small tilted paper chip, e.g. the crest or a corner label on the stage. */
export function PaperSticker({ text, className = '' }: { text: string; className?: string }) {
  return (
    <View className={`-rotate-2 border-2 border-ink bg-paper px-3 py-2 ${className}`}>
      <Text className="font-pixel text-xs uppercase text-pitch-ink">{text}</Text>
    </View>
  );
}

/** On-stage section header: gold pixel eyebrow over a white pixel title. */
export function StageSection({
  eyebrow,
  title,
  right,
  className = '',
}: {
  eyebrow: string;
  title: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <View className={`mb-3 flex-row items-end justify-between gap-3 ${className}`}>
      <View className="flex-1">
        <Text className="font-pixel text-xs uppercase tracking-[2px] text-gold-light">{eyebrow}</Text>
        <Text accessibilityRole="header" className="mt-1 font-pixel text-lg uppercase text-white">
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}
