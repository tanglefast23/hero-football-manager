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
      <View className="absolute left-1/2 top-0 h-full w-[3px] bg-paper/10" />
      {wide ? (
        <View className="absolute right-[9%] top-1/2 h-[440px] w-[440px] -translate-y-1/2 rounded-full border-4 border-paper/10" />
      ) : null}
    </View>
  );
}

/** Tilted violet sticker that holds a masthead's payoff word. */
export function StickerWord({ text, wide = false }: { text: string; wide?: boolean }) {
  return (
    <View
      className={wide
        ? 'self-start -rotate-2 border-[3px] border-ink bg-violet px-5 py-2'
        : 'self-start -rotate-2 border-2 border-ink bg-violet px-3 py-1'}
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
      <Text className="font-pixel text-xs uppercase text-pitch-dark">{text}</Text>
    </View>
  );
}
