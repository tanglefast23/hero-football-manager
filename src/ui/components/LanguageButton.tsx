import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { SfxPressable } from './SfxPressable';
import { languagePanelRows } from '../language-panel-rows';
import { useCopy, localeMeta, type Locale } from '../../i18n';

export interface LanguageButtonProps {
  value: Locale;
  onChange: (locale: Locale) => void;
  className?: string;
}

/**
 * The language control on the title screen — the one screen every player lands
 * on, every launch.
 *
 * It shows the current language **in that language**, in that language's own
 * pixel face. That is not decoration: Silkscreen cannot draw "Tiếng Việt", so a
 * button rendering every endonym in the active face would show the mid-word
 * typeface substitution this whole feature exists to prevent.
 *
 * Tapping opens a short list rather than cycling. A cycle is fine for two
 * options and unusable at seven, and the player should be able to see their
 * language before choosing it, not step past it.
 */
export function LanguageButton({ value, onChange, className }: LanguageButtonProps) {
  const t = useCopy();
  const [open, setOpen] = useState(false);
  const rows = languagePanelRows(value);
  const current = localeMeta(value);

  return (
    <>
      <SfxPressable
        accessibilityRole="button"
        accessibilityLabel={t('languageButton.a11y.current', { language: current.endonym })}
        onPress={() => {
          setOpen(true);
        }}
        className={`min-h-9 flex-row items-center gap-2 border-2 border-ink bg-paper px-3 py-1 ${className ?? ''}`}
      >
        {/* Not in either Silkscreen weight, so it falls back to the system face
            on purpose — the same choice the difficulty radio makes for ●/○. */}
        <Text className="text-xs text-ink/60">⌘</Text>
        <Text className="text-xs uppercase text-ink" style={{ fontFamily: current.faces.display }}>
          {current.endonym}
        </Text>
      </SfxPressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setOpen(false);
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('languageButton.a11y.closePicker')}
          onPress={() => {
            setOpen(false);
          }}
          className="flex-1 items-center justify-center bg-ink/70 px-6"
        >
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t('creation.language.title')}
            className="w-full max-w-sm gap-2 border-[3px] border-ink bg-paper p-4"
          >
            <Text className="font-pixel mb-1 text-[10px] uppercase tracking-[1px] text-ink/60">
              {t('creation.language.title')}
            </Text>
            {rows.map(row => (
              <SfxPressable
                key={row.locale}
                accessibilityRole="radio"
                accessibilityState={{ checked: row.selected }}
                accessibilityLabel={row.endonym}
                onPress={() => {
                  onChange(row.locale);
                  setOpen(false);
                }}
                className={row.selected
                  ? 'min-h-12 flex-row items-center gap-2 border-2 border-ink bg-blue px-3 py-2'
                  : 'min-h-12 flex-row items-center gap-2 border-2 border-ink/30 bg-white px-3 py-2'}
              >
                <Text className={row.selected ? 'text-base text-white' : 'text-base text-ink'}>
                  {row.selected ? '●' : '○'}
                </Text>
                {/* Each row in its OWN face, not the active one. */}
                <Text
                  className={row.selected ? 'text-base text-white' : 'text-base text-ink'}
                  style={{ fontFamily: row.face }}
                >
                  {row.endonym}
                </Text>
              </SfxPressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
