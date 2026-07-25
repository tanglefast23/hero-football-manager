import { Text, View } from 'react-native';

/**
 * The shared "nothing here yet" card.
 *
 * A section heading or a table header row usually lives *outside* the `.map()`
 * that renders the rows, so an empty collection leaves the heading stranded
 * above blank space — or a bordered box with a header and no body. Render this
 * instead of the list (heading included, for table-shaped sections) so the
 * empty state says what would appear here and when.
 */
export function EmptyDocket({ title, detail }: { title: string; detail: string }) {
  return (
    <View className="items-center border-2 border-dashed border-ink/30 bg-white/50 px-5 py-10">
      <Text className="font-mono text-3xl text-ink/25">□</Text>
      <Text className="mt-3 font-pixel text-base uppercase text-ink">{title}</Text>
      <Text className="mt-2 text-center text-sm leading-5 text-ink/55">{detail}</Text>
    </View>
  );
}
