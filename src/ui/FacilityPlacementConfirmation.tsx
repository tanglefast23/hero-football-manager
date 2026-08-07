import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, Metric, PaperPanel, formatCurrency } from './components/Scorecard';
import { FacilitySprite } from './components/FacilitySprite';
import type { ClubFacilityBuildingViewModel, ClubFacilityCatalogViewModel } from './models';
import { useCopy } from '../i18n';

/**
 * The two orders that spend money from the grid. A move charges a relocation
 * fee the moment it is approved, exactly like a build charges its cost, so both
 * ask the same question in the same place.
 */
export type FacilityPlacement =
  | { readonly kind: 'build'; readonly catalog: ClubFacilityCatalogViewModel; readonly x: number; readonly y: number }
  | { readonly kind: 'move'; readonly building: ClubFacilityBuildingViewModel; readonly x: number; readonly y: number };

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
  const t = useCopy();
  const { x, y } = placement;
  const cellLabel = t('facilityPlacementConfirmation.cellLabel', { column: x + 1, row: y + 1 });
  // '▸' is not in Silkscreen, so it stays outside the catalog and is appended
  // to the translated words here.
  const order = placement.kind === 'build'
    ? {
      kicker: t('facilityPlacementConfirmation.buildKicker'),
      title: t('facilityPlacementConfirmation.buildTitle'),
      stamp: t('facilityPlacementConfirmation.buildWeeks', {
        n: placement.catalog.buildWeeks,
        count: placement.catalog.buildWeeks,
      }),
      type: placement.catalog.type,
      level: 1 as const,
      name: placement.catalog.name,
      width: placement.catalog.width,
      height: placement.catalog.height,
      costLabel: t('facilityPlacementConfirmation.costNow'),
      cost: placement.catalog.buildCost,
      upkeep: placement.catalog.weeklyUpkeep,
      effectLabel: placement.catalog.effectLabel,
      confirmLabel: `${t('facilityPlacementConfirmation.approveAndStartWork')}  ▸`,
      confirmHint: t('facilityPlacementConfirmation.a11y.approveBuilding', {
        building: placement.catalog.name,
        cell: cellLabel,
        cost: formatCurrency(placement.catalog.buildCost),
      }),
    }
    : {
      kicker: t('facilityPlacementConfirmation.moveKicker'),
      title: t('facilityPlacementConfirmation.moveTitle'),
      // A move is instant; there are no build weeks to serve.
      stamp: t('facilityPlacementConfirmation.sameDay'),
      type: placement.building.type,
      level: placement.building.level,
      name: placement.building.name,
      width: placement.building.width,
      height: placement.building.height,
      costLabel: t('facilityPlacementConfirmation.feeNow'),
      cost: placement.building.relocationFee,
      upkeep: placement.building.weeklyUpkeep,
      effectLabel: placement.building.effectLabel,
      confirmLabel: `${t('facilityPlacementConfirmation.approveTheMove')}  ▸`,
      confirmHint: t('facilityPlacementConfirmation.a11y.approveMoving', {
        building: placement.building.name,
        cell: cellLabel,
        cost: formatCurrency(placement.building.relocationFee),
      }),
    };

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onCancel}
    >
      <SafeAreaView className="flex-1 justify-center bg-ink/60 px-4 py-6" edges={['top', 'left', 'right', 'bottom']}>
        {/* An outside tap cancels — the safe half of the question. It never
            approves the build, and the chosen square survives the cancel.
            Sibling of the panel so taps on its controls never bubble here. */}
        <Pressable accessible={false} className="absolute inset-0" onPress={onCancel} />
        <View accessibilityViewIsModal className="w-full max-w-[560px] self-center">
          <PaperPanel kicker={order.kicker} title={order.title} stamp={order.stamp.toUpperCase()}>
            <View className="items-center border-y-2 border-ink bg-gold-light py-4">
              <View className="border-2 border-b-4 border-ink bg-white p-2">
                <FacilitySprite type={order.type} level={order.level} />
              </View>
              <Text className="mt-3 font-pixel text-xl uppercase text-ink">{order.name}</Text>
              <Text className="mt-1 font-pixel text-sm uppercase text-blue-dark">
                {cellLabel} · {order.width}×{order.height}
              </Text>
            </View>

            <View className="mt-4 flex-row gap-2">
              <Metric label={order.costLabel} value={formatCurrency(order.cost)} tone="negative" />
              <Metric
                label={t('facilityPlacementConfirmation.upkeep')}
                value={t('clubFinances.perWeekShort', { amount: formatCurrency(order.upkeep) })}
                tone="negative"
              />
            </View>

            <Text className="mt-3 text-center text-base leading-5 text-ink/65">
              {order.effectLabel}
            </Text>

            <View className="mt-4 gap-2">
              <ActionButton
                label={order.confirmLabel}
                accessibilityLabel={order.confirmHint}
                variant="confirm"
                onPress={onConfirm}
              />
              <ActionButton
                label={t('facilityPlacementConfirmation.pickAnotherSpot')}
                accessibilityLabel={t('facilityPlacementConfirmation.a11y.cancelThisPlacementAnd')}
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
