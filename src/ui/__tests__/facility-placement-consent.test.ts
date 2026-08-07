import { readFileSync } from 'fs';
import { join } from 'path';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

/**
 * Two rules for the facilities grid, both about a tap telling the truth:
 * spending is always confirmed first, and a square that cannot take the
 * building says so instead of clicking and doing nothing.
 */
describe('facility placement consent and feedback', () => {
  it('confirms a relocation fee instead of spending it on the destination tap', () => {
    const screen = source('src/ui/screens/ClubFinancesScreen.tsx');
    const panel = source('src/ui/FacilityPlacementConfirmation.tsx');

    // The grid tap proposes; only the confirmation calls the store.
    expect(screen).toContain("setPendingPlacement({ kind: 'move', building: relocatingBuilding, x, y })");
    expect(screen).toMatch(
      /confirmPendingPlacement[\s\S]*?pendingPlacement\.kind === 'move'[\s\S]*?onRelocateFacility\?\.\(/,
    );
    // The old immediate spend, straight from the cell handler, must not return.
    expect(screen).not.toContain('onRelocateFacility?.(relocatingBuildingId, x, y)');

    // The panel names the fee it is about to take.
    // The words are catalog keys now — '▸' stays in the source because
    // Silkscreen has no glyph for it.
    expect(panel).toContain("costLabel: t('facilityPlacementConfirmation.feeNow')");
    expect(panel).toContain('cost: placement.building.relocationFee');
    expect(panel).toContain("confirmLabel: `${t('facilityPlacementConfirmation.approveTheMove')}  ▸`");
  });

  it('answers a blocked square with a refusal cue and a reason', () => {
    const screen = source('src/ui/screens/ClubFinancesScreen.tsx');
    const pressable = source('src/ui/components/SfxPressable.tsx');

    expect(screen).toContain("pressSfx={buildable ? 'click' : 'warning'}");
    expect(screen).toContain("t('clubFinances.squareTaken')");
    expect(screen).toContain("t('clubFinances.squareDoesNotFit')");
    // The reason takes over the placement hint line rather than adding layout.
    expect(screen).toContain(
      "{placementRejection ?? t('clubFinances.tapAnyPlusSquareAbove')}",
    );
    // Approving a square clears whatever the last refusal said.
    expect(screen).toContain('setPlacementRejection(null);');

    expect(pressable).toContain("else if (pressSfx === 'warning') playManagementActionSfx('warning');");
  });
});
