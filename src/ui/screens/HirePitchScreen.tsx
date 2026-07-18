import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, Metric, PaperPanel, StatusChip } from '../components/Scorecard';

/** One self-reported stat tile. `value` is a display string so "99*" / "MAX" both work. */
export interface HirePitchStat {
  label: string;
  value: string;
  tone?: 'normal' | 'hero' | 'positive' | 'negative';
}

/**
 * Minimal player shape for the hire-pitch moment. Kept local (not a
 * SquadPlayerViewModel) because a prospect isn't on the books yet — all we
 * need is who they are, where they play, and a few stats to show off.
 */
export interface HirePitchPlayer {
  name: string;
  position: string;
  age?: number;
  /** Optional over-confident tagline, e.g. "Self-declared wonderkid". */
  tagline?: string;
  /** A few key stats shown as pixel Metric tiles. Falls back to funny defaults. */
  stats?: HirePitchStat[];
}

export interface HirePitchScreenProps {
  player: HirePitchPlayer;
  /** The funny begging speech. Genuinely charming defaults if omitted. */
  lines?: string[];
  /** Override the sign button label (keeps the ▸). Defaults to "Sign him". */
  signLabel?: string;
  onSign: () => void;
  onPass: () => void;
}

// --- Placeholder portrait --------------------------------------------------
// TODO(art): swap this hand-authored chibi stand-in for the real 24×29 atlas
// portrait once the base-head + eye/mouth overlay sheet ships (docs/11-art-style.md
// "Shared foundations"). Render it through the Skia <Atlas> path in src/render,
// not per-pixel Views — this map is only a frame-filler until then.
//
// Track B "heroic chibi": big all-pupil Wonderkid eyes + one sparkle, one blush,
// a hopeful grin. Outlined in a dark tint of the fill (never #000000), 4-value ramps.
const CHIBI_ROWS: readonly string[] = [
  '.....hhhhhh.....',
  '...hhHHHHHHhh...',
  '..hHHHHHHHHHHh..',
  '..hHHHHHHHHHHh..',
  '..hHOOOOOOOOHh..',
  '..hOSSSSSSSSOh..',
  '..OSSSSSSSSSSO..',
  '..OSWEESSEEWSO..',
  '..OSSEESSEESSO..',
  '..OSSSSSSSSSSO..',
  '..OSBSSMMSSBSO..',
  '..OSSSsMMsSSSO..',
  '...OSSSSSSSSO...',
  '....OOSSSSOO....',
  '...jJJJJJJJJj...',
  '..jJJJJWWJJJJj..',
  '..jJJJJWWJJJJj..',
  '..jjJJJJJJJJjj..',
];

// Every colour is a bible ramp value (docs/11-art-style.md). '.' = transparent.
const CHIBI_PALETTE: Record<string, string> = {
  O: '#6a4326', // art outline — dark skin/hair tint
  S: '#eab48c', // skin base
  s: '#cf9268', // skin shadow
  H: '#8a5a30', // hair base
  h: '#6a4326', // hair shadow
  E: '#241f2e', // eye pupil (ink)
  W: '#ffffff', // sparkle / kit number highlight
  B: '#f2938c', // blush (red-light)
  M: '#a83440', // grin (red-dark)
  J: '#5a8fd6', // kit base (blue)
  j: '#3f6fb5', // kit shadow
};

interface PixelSpriteProps {
  rows: readonly string[];
  palette: Record<string, string>;
  pixel: number;
  label: string;
}

/**
 * Draws a small pixel map as a grid of square Views. Cells carry only inline
 * geometry + colour (no className), so there is no className/style collision —
 * the collision rule only fires when both set the *same* property on one node.
 */
function PixelSprite({ rows, palette, pixel, label }: PixelSpriteProps) {
  return (
    <View accessibilityRole="image" accessibilityLabel={label}>
      {rows.map((row, y) => (
        <View key={y} className="flex-row">
          {Array.from(row).map((ch, x) => (
            <View
              key={x}
              style={{ width: pixel, height: pixel, backgroundColor: palette[ch] ?? 'transparent' }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// --- Copy defaults ---------------------------------------------------------
const DEFAULT_LINES: string[] = [
  'Gaffer! You found me! I have been waiting by the training-ground gate since Tuesday.',
  'I am basically three legends in one kit. I lost count of the other two during warm-ups.',
  'Both feet, my head, and — on a good day — sheer force of personality. All lethal.',
  'I will score the goals, mop the changing room, and befriend every pigeon in the stand.',
  'Please. My mum already told the whole street I signed. Do not make a liar of a lovely woman.',
];

const DEFAULT_STATS: HirePitchStat[] = [
  { label: 'Pace', value: '99*' },
  { label: 'Shooting', value: '98*' },
  { label: 'Humility', value: '11', tone: 'negative' },
  { label: 'Snacks', value: 'MAX', tone: 'positive' },
];

/**
 * The "hire pitch": a hopeful prospect introduces themselves and openly begs
 * for a contract. A big pixel portrait, a self-reported scouting card, a funny
 * speech bubble, and Sign / Pass. Meant to make the player smile.
 */
export function HirePitchScreen({ player, lines, signLabel, onSign, onPass }: HirePitchScreenProps) {
  const speech = lines && lines.length > 0 ? lines : DEFAULT_LINES;
  const stats = player.stats && player.stats.length > 0 ? player.stats : DEFAULT_STATS;
  const usingDefaultStats = !(player.stats && player.stats.length > 0);
  const tagline = player.tagline ?? 'Free trial. No refunds requested.';
  const subLine = player.age !== undefined
    ? `${player.position} · Age ${player.age}`
    : player.position;

  return (
    <SafeAreaView className="flex-1 bg-ink" edges={['top', 'left', 'right', 'bottom']}>
      <View className="border-b-2 border-signal bg-ink-soft px-5 py-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-xs font-bold uppercase tracking-[3px] text-signal">Trial · unsolicited</Text>
            <Text className="mt-2 text-2xl font-bold uppercase leading-7 tracking-wide text-paper">
              Sign me. Please.
            </Text>
          </View>
          <View className="-rotate-3 border-2 border-stamp px-3 py-2">
            <Text className="text-xs font-bold uppercase tracking-widest text-stamp">Trialist</Text>
          </View>
        </View>
        <Text className="mt-3 max-w-sm text-sm leading-5 text-paper/65">{tagline}</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        {/* Portrait — beveled ink frame holding the chibi placeholder */}
        <View className="items-center pt-1 pb-2">
          <View className="relative border-2 border-b-4 border-ink bg-paper-dark p-3">
            <View pointerEvents="none" className="absolute left-1 right-1 top-1 h-1.5 bg-white/70" />
            <View className="items-center justify-center border-2 border-ink bg-paper px-3 py-3">
              <PixelSprite rows={CHIBI_ROWS} palette={CHIBI_PALETTE} pixel={10} label={`${player.name} portrait`} />
            </View>
          </View>

          <View className="-mt-3 border-2 border-b-4 border-ink bg-ink-soft px-5 py-2">
            <Text className="text-center text-lg font-bold uppercase tracking-wide text-paper" numberOfLines={1}>
              {player.name}
            </Text>
          </View>
          <Text className="mt-2 font-mono text-xs font-bold uppercase tracking-[2px] text-sky">{subLine}</Text>
          <View className="mt-3">
            <StatusChip label="Wonderkid (his words)" tone="hero" />
          </View>
        </View>

        {/* Scouting card — a few key stats as pixel Metric tiles */}
        <PaperPanel kicker="Scouting card" title="What he brings" stamp="Trial" className="mt-4">
          <View className="gap-2">
            <View className="flex-row gap-2">
              {stats.slice(0, 2).map(stat => (
                <Metric key={stat.label} label={stat.label} value={stat.value} tone={stat.tone} />
              ))}
            </View>
            {stats.length > 2 ? (
              <View className="flex-row gap-2">
                {stats.slice(2, 4).map(stat => (
                  <Metric key={stat.label} label={stat.label} value={stat.value} tone={stat.tone} />
                ))}
              </View>
            ) : null}
          </View>
          {usingDefaultStats ? (
            <Text className="mt-3 text-xs leading-4 text-ink/50">* Self-reported. Wildly. Verify before wiring wages.</Text>
          ) : null}
        </PaperPanel>

        {/* Speech bubble — his desperate, lovable pitch */}
        <View className="relative mt-6 border-2 border-b-4 border-ink bg-paper p-4">
          <View
            pointerEvents="none"
            className="absolute -top-2 left-8 h-4 w-4 rotate-45 border-l-2 border-t-2 border-ink bg-paper"
          />
          <Text className="font-mono text-xs font-bold uppercase tracking-[2px] text-stamp">The pitch</Text>
          <View className="mt-2 gap-3">
            {speech.map((line, index) => (
              <Text
                key={index}
                className={index === 0 ? 'text-base font-bold leading-5 text-ink' : 'text-sm leading-5 text-ink/75'}
              >
                {line}
              </Text>
            ))}
          </View>
        </View>
      </ScrollView>

      <View className="flex-row items-stretch gap-3 border-t-2 border-signal bg-ink-soft p-3">
        <View className="w-28">
          <ActionButton label="Pass" accessibilityLabel={`Pass on ${player.name}`} variant="paper" onPress={onPass} />
        </View>
        <View className="flex-1">
          <ActionButton
            label={`${signLabel ?? 'Sign him'}  ▸`}
            accessibilityLabel={`Sign ${player.name}`}
            variant="confirm"
            onPress={onSign}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
