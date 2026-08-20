import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { CrossPlatformModal } from './components/CrossPlatformModal';
import { SfxPressable as Pressable } from './components/SfxPressable';
import { PixelText } from './components/PixelText';
import { ActionButton, PaperPanel } from './components/Scorecard';
import { PixelPortrait } from './components/PixelPortrait';
import { ClubKitProvider } from './club-kit-context';
import { useCopy } from '../i18n';
import {
  KIT_SHAPES,
  KIT_SWATCHES,
  swatchById,
  type ClubKitChoice,
  type KitShape,
  type KitSwatch,
} from '../render/sprites/club-kit';
import type { PortraitRole } from './pixel-portrait-model';

const SHAPE_NAME_KEY: Record<KitShape, string> = {
  PLAIN: 'kit.pattern.plain',
  STRIPES: 'kit.pattern.striped',
  CHECKS: 'kit.pattern.checked',
};

export const DEFAULT_CLUB_KIT: ClubKitChoice = {
  base: 'CRIMSON',
  pattern: 'PLAIN',
  patternColor: 'STONE',
};

/**
 * Whether picking this colour will put opponents in their change strip.
 *
 * Shown before the choice is made rather than discovered on a match day: a
 * manager who picks blue should know their blue opponents will change, not
 * wonder why a team looks wrong.
 */
function warnsAboutClash(swatch: KitSwatch): boolean {
  return swatch.clashesHomeStock || swatch.clashesAwayStock;
}

function SwatchGrid({
  label,
  selected,
  disabled,
  onSelect,
}: {
  label: string;
  selected: string;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  const t = useCopy();
  return (
    <View className={disabled ? 'opacity-40' : undefined}>
      <PixelText className="mb-2 text-xs uppercase text-ink">{label}</PixelText>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        className="flex-row flex-wrap gap-2"
      >
        {KIT_SWATCHES.map((swatch) => {
          const isSelected = swatch.id === selected;
          return (
            <Pressable
              key={swatch.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected, disabled }}
              accessibilityLabel={t(swatch.nameKey)}
              disabled={disabled}
              pressSfx="stat-step"
              onPress={() => onSelect(swatch.id)}
              // Explicit points, not h-11: NativeWind's rem is 14pt, so the
              // class alone lands under the 44pt touch minimum.
              style={{ minWidth: 44, minHeight: 44 }}
              className={
                isSelected
                  ? 'items-center justify-center border-4 border-ink'
                  : 'items-center justify-center border-2 border-ink/40'
              }
            >
              {/* The body step, not the shade: this is the colour the shirt
                  reads as from the touchline. */}
              <View
                style={{
                  width: 30,
                  height: 30,
                  backgroundColor: swatch.ramp[1],
                }}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function KitEditorModal({
  visible,
  kit,
  previewPlayerId,
  previewRole,
  previewLookId,
  onCancel,
  onDone,
}: {
  visible: boolean;
  kit: ClubKitChoice;
  previewPlayerId: string;
  previewRole: PortraitRole;
  previewLookId?: string;
  onCancel: () => void;
  onDone: (kit: ClubKitChoice) => void;
}) {
  const t = useCopy();
  // Held locally so Cancel is a real cancel. Keyed on `visible` through the
  // reset below rather than on mount, because the modal stays mounted.
  const [draft, setDraft] = useState(kit);
  const [openedWith, setOpenedWith] = useState(kit);
  if (visible && openedWith !== kit) {
    setOpenedWith(kit);
    setDraft(kit);
  }

  const baseSwatch = swatchById(draft.base);
  const patternDisabled = draft.pattern === 'PLAIN';

  return (
    <CrossPlatformModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View className="flex-1 items-center justify-center bg-ink/70 p-4">
        <PaperPanel title={t('kit.editorTitle')} className="w-full max-w-md">
          <ScrollView className="max-h-[70vh]">
            <View className="mb-4 flex-row justify-center">
              {/* A nested provider, because onboarding runs before a career
                  exists: the app-level kit has nothing to show yet. */}
              <ClubKitProvider kit={draft}>
                <View className="border-2 border-ink bg-blue-light">
                  <PixelPortrait
                    playerId={previewPlayerId}
                    role={previewRole}
                    lookId={previewLookId}
                  />
                </View>
              </ClubKitProvider>
            </View>

            <PixelText className="mb-2 text-xs uppercase text-ink">
              {t('kit.pattern')}
            </PixelText>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={t('kit.pattern')}
              className="mb-4 flex-row gap-2"
            >
              {KIT_SHAPES.map((shape) => (
                <Pressable
                  key={shape}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: draft.pattern === shape }}
                  accessibilityLabel={t(SHAPE_NAME_KEY[shape])}
                  pressSfx="stat-step"
                  onPress={() => setDraft({ ...draft, pattern: shape })}
                  style={{ minHeight: 44 }}
                  className={
                    draft.pattern === shape
                      ? 'flex-1 items-center justify-center border-2 border-ink bg-blue px-2'
                      : 'flex-1 items-center justify-center border-2 border-ink/40 bg-white px-2'
                  }
                >
                  <PixelText
                    className={
                      draft.pattern === shape
                        ? 'text-xs uppercase text-white'
                        : 'text-xs uppercase text-ink'
                    }
                    numberOfLines={1}
                  >
                    {t(SHAPE_NAME_KEY[shape])}
                  </PixelText>
                </Pressable>
              ))}
            </View>

            <View className="gap-4">
              <SwatchGrid
                label={t('kit.baseColor')}
                selected={draft.base}
                disabled={false}
                onSelect={(base) => setDraft({ ...draft, base })}
              />
              <SwatchGrid
                label={t('kit.patternColor')}
                selected={draft.patternColor}
                disabled={patternDisabled}
                onSelect={(patternColor) =>
                  setDraft({ ...draft, patternColor })
                }
              />
            </View>

            {baseSwatch !== undefined && warnsAboutClash(baseSwatch) ? (
              <Text className="mt-3 text-sm leading-5 text-ink/75">
                {t('kit.changeStripNote')}
              </Text>
            ) : null}
          </ScrollView>

          <View className="mt-4 flex-row gap-3">
            <ActionButton
              label={t('kit.cancel')}
              accessibilityLabel={t('kit.a11y.cancelKit')}
              variant="paper"
              onPress={onCancel}
            />
            <ActionButton
              label={t('kit.done')}
              accessibilityLabel={t('kit.a11y.saveKit')}
              onPress={() => onDone(draft)}
            />
          </View>
        </PaperPanel>
      </View>
    </CrossPlatformModal>
  );
}
