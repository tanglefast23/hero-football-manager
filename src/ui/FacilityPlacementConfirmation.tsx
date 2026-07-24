import { Modal, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, Metric, PaperPanel, formatCurrency } from './components/Scorecard';
import { FacilitySprite } from './components/FacilitySprite';
import type { ClubFacilityCatalogViewModel } from './models';

export interface FacilityPlacement {
  readonly catalog: ClubFacilityCatalogViewModel;
  readonly x: number;
  readonly y: number;
}

/** Placing a building spends money and books the club's only works crew, and
 * neither can be undone once the order is approved — so the grid tap proposes
 * the spot and this panel is where the money is actually committed. */
export function FacilityPlacementConfirmation({
  placement,
  reduceMotion = false,
  onConfirm,
  onCancel,
}: {
  placement: FacilityPlacement;
  reduceMotion?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { catalog, x, y } = placement;
  const cellLabel = `Column ${x + 1}, row ${y + 1}`;
  const weeksLabel = `${catalog.buildWeeks} ${catalog.buildWeeks === 1 ? 'week' : 'weeks'}`;

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onCancel}
    >
      <SafeAreaView className="flex-1 justify-center bg-ink/60 px-4 py-6" edges={['top', 'left', 'right', 'bottom']}>
        <View accessibilityViewIsModal className="w-full max-w-[560px] self-center">
          <PaperPanel kicker="Works order" title="Approve this build?" stamp={weeksLabel.toUpperCase()}>
            <View className="items-center border-y-2 border-ink bg-gold-light py-4">
              <View className="border-2 border-b-4 border-ink bg-white p-2">
                <FacilitySprite type={catalog.type} level={1} />
              </View>
              <Text className="mt-3 font-pixel text-xl uppercase text-ink">{catalog.name}</Text>
              <Text className="mt-1 font-mono text-sm font-bold uppercase text-blue-dark">
                {cellLabel} · {catalog.width}×{catalog.height}
              </Text>
            </View>

            <View className="mt-4 flex-row gap-2">
              <Metric label="Cost now" value={formatCurrency(catalog.buildCost)} tone="negative" />
              <Metric label="Upkeep" value={`${formatCurrency(catalog.weeklyUpkeep)}/wk`} tone="negative" />
            </View>

            <Text className="mt-3 text-center text-base leading-5 text-ink/65">
              {catalog.effectLabel}
            </Text>

            <View className="mt-4 gap-2">
              <ActionButton
                label="Approve & start work  ▸"
                accessibilityLabel={`Approve building ${catalog.name} at ${cellLabel} for ${formatCurrency(catalog.buildCost)}`}
                variant="confirm"
                onPress={onConfirm}
              />
              <ActionButton
                label="Pick another spot"
                accessibilityLabel="Cancel this placement and keep choosing"
                variant="paper"
                onPress={onCancel}
              />
            </View>
          </PaperPanel>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
