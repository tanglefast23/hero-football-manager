import { Text, View } from 'react-native';
import { PaperPanel } from './Scorecard';
import { SfxPressable as Pressable } from './SfxPressable';
import { languagePanelRows } from '../language-panel-rows';
import { localeMeta, type Locale } from '../../i18n';

export interface LanguagePanelProps {
  value: Locale;
  onChange: (locale: Locale) => void;
  className?: string;
}

/**
 * The language chooser, shown where the manager signs their first player and
 * again in Settings.
 *
 * Deliberately the same furniture as the difficulty radio group two panels up:
 * a `PaperPanel`, `accessibilityRole="radiogroup"`, and the ●/○ glyphs — which
 * are in neither Silkscreen weight and fall back to the system face on purpose,
 * rather than flipping the label's typeface mid-string.
 */
export function LanguagePanel({ value, onChange, className }: LanguagePanelProps) {
  const rows = languagePanelRows(value);

  return (
    <PaperPanel
      kicker="Before you sign"
      title="Language"
      stamp={localeMeta(value).endonym}
      className={className}
    >
      <View accessibilityRole="radiogroup" accessibilityLabel="Language" className="gap-3">
        {rows.map(row => (
          <Pressable
            key={row.locale}
            accessibilityRole="radio"
            accessibilityState={{ checked: row.selected }}
            accessibilityLabel={row.endonym}
            onPress={() => {
              onChange(row.locale);
            }}
            className={row.selected
              ? 'min-h-14 border-2 border-ink bg-blue px-3 py-3'
              : 'min-h-14 border-2 border-ink/30 bg-white px-3 py-3'}
          >
            <View className="flex-row items-center gap-2">
              <Text className={row.selected ? 'text-base text-white' : 'text-base text-ink'}>
                {row.selected ? '●' : '○'}
              </Text>
              {/* The face comes from the row, not from the active language:
                  "Tiếng Việt" contains glyphs Silkscreen does not have, so that
                  row draws in Handjet even while the UI is still English. */}
              <Text
                className={row.selected ? 'text-base text-white' : 'text-base text-ink'}
                style={{ fontFamily: row.face }}
              >
                {row.endonym}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </PaperPanel>
  );
}
