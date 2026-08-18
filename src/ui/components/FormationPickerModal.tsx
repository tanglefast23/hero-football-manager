import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CrossPlatformModal as Modal } from './CrossPlatformModal';
import { SfxPressable } from './SfxPressable';
import { FormationDiagram } from './FormationDiagram';
import { PixelText } from './PixelText';
import { ActionButton } from './Scorecard';
import { useCopy } from '../../i18n';
import type { FormationId } from '../../sim/tactics';

export interface FormationPickerModalProps {
  /** Null when closed. Otherwise the shapes this club may pick from. */
  readonly options: readonly FormationId[] | null;
  readonly selected: FormationId;
  readonly onSelect: (formation: FormationId) => void;
  readonly onDismiss: () => void;
}

/**
 * The matchday formation picker.
 *
 * The chip used to cycle: one tap, a new number, no idea what you had chosen.
 * Every shape is now on screen at once with its diagram and its name — "3-4-3,
 * All-out attack" — so the choice is read rather than discovered.
 *
 * All copy is existing keys (`matchScreen.formation`, `formation.*.blurb`,
 * `substitutionBoard.cancel`), so the picker ships translated in all seven
 * languages the day it lands.
 */
export function FormationPickerModal({
  options,
  selected,
  onSelect,
  onDismiss,
}: FormationPickerModalProps) {
  const t = useCopy();
  const open = options !== null;
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View className="flex-1 bg-ink/70">
        {/* Tapping the darkened pitch behind the card backs out, the same way
            every other sheet in the game closes. */}
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="absolute inset-0"
          onPress={onDismiss}
        />
        <SafeAreaView className="flex-1 items-center justify-center px-5">
          <View className="w-full max-w-[420px] border-[3px] border-ink bg-paper px-4 py-5">
            <PixelText className="text-sm uppercase text-ink/60">
              {t('matchScreen.formation')}
            </PixelText>
            <ScrollView className="mt-3 max-h-[420px]">
              <View className="gap-2">
                {(options ?? []).map((formation) => {
                  const blurb = t(`formation.${formation}.blurb`);
                  const isSelected = formation === selected;
                  return (
                    <SfxPressable
                      key={formation}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={t('matchRail.a11y.formation', {
                        formation,
                        blurb,
                      })}
                      onPress={() => onSelect(formation)}
                      className={
                        isSelected
                          ? 'flex-row items-center gap-3 border-2 border-gold-dark bg-gold-light px-3 py-2'
                          : 'flex-row items-center gap-3 border-2 border-ink bg-paper-dark px-3 py-2'
                      }
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.7 : undefined,
                      })}
                    >
                      <FormationDiagram formation={formation} compact />
                      <View className="flex-1">
                        <PixelText className="text-base text-ink">
                          {formation}
                        </PixelText>
                        <PixelText
                          className="mt-1 text-xs uppercase text-ink/60"
                          numberOfLines={2}
                        >
                          {blurb}
                        </PixelText>
                      </View>
                    </SfxPressable>
                  );
                })}
              </View>
            </ScrollView>
            <View className="mt-4">
              <ActionButton
                label={t('substitutionBoard.cancel')}
                accessibilityLabel={t('substitutionBoard.cancel')}
                onPress={onDismiss}
                variant="paper"
                compact
              />
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
