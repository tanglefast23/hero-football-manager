import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { CrossPlatformModal as Modal } from './CrossPlatformModal';
import { languagePanelRows } from '../language-panel-rows';
import { useCopy, localeMeta, type Locale } from '../../i18n';
import { TYPE_SIZE } from '../ui-tokens';
import { ChunkyControl } from './ChunkyControl';
import { PixelLanguageIcon } from './PixelLanguageIcon';

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
export function LanguageButton({
  value,
  onChange,
  className,
}: LanguageButtonProps) {
  const t = useCopy();
  const [open, setOpen] = useState(false);
  const { height: viewportHeight } = useWindowDimensions();
  const rows = languagePanelRows(value);
  const current = localeMeta(value);

  return (
    <>
      <ChunkyControl
        accessibilityRole="button"
        accessibilityLabel={t('languageButton.a11y.current', {
          language: current.endonym,
        })}
        onPress={() => {
          setOpen(true);
        }}
        compact
        square
        tone="paper"
        className={`min-h-11 flex-row items-center gap-2 px-3 ${className ?? ''}`}
        style={{ minWidth: 44, minHeight: 44 }}
      >
        <PixelLanguageIcon />
        <Text
          className={`min-w-0 uppercase text-ink ${TYPE_SIZE.caption}`}
          style={{ fontFamily: current.faces.display, flexShrink: 1 }}
        >
          {current.endonym}
        </Text>
      </ChunkyControl>

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
            className="w-full max-w-sm border-[3px] border-ink bg-paper p-4"
            style={{ maxHeight: Math.max(180, viewportHeight - 48) }}
          >
            <Text
              className={`mb-1 font-pixel uppercase tracking-[1px] text-ink/60 ${TYPE_SIZE.caption}`}
            >
              {t('creation.language.title')}
            </Text>
            <ScrollView
              className="min-h-0"
              contentContainerStyle={{ gap: 8 }}
              showsVerticalScrollIndicator
            >
              {rows.map((row) => (
                <ChunkyControl
                  key={row.locale}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: row.selected }}
                  accessibilityLabel={row.endonym}
                  onPress={() => {
                    onChange(row.locale);
                    setOpen(false);
                  }}
                  compact
                  square
                  tone={row.selected ? 'primary' : 'paper'}
                  className="min-h-12 flex-row items-center gap-2 px-3"
                  style={{ minHeight: 44 }}
                >
                  <Text
                    className={`${TYPE_SIZE.body} ${row.selected ? 'text-white' : 'text-ink'}`}
                  >
                    {row.selected ? '●' : '○'}
                  </Text>
                  {/* Each row in its OWN face, not the active one. */}
                  <Text
                    className={`min-w-0 flex-1 ${TYPE_SIZE.body} ${row.selected ? 'text-white' : 'text-ink'}`}
                    style={{ fontFamily: row.face }}
                  >
                    {row.endonym}
                  </Text>
                </ChunkyControl>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
