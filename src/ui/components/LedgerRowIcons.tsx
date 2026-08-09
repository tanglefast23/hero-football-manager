import { View, Text } from 'react-native';
import type { LedgerIconViewModel } from '../models';
import { FacilitySprite } from './FacilitySprite';
import { ManagementSprite } from './ManagementSprite';
import { PlayerSprite } from './PlayerSprite';

/**
 * The pictures on a statement row: the buildings, staff, and squad the money
 * went to, drawn at the size of the words beside them.
 *
 * One strip shared by both statements — the Weekly Review and the Financial
 * Report print the same ledger, and two copies of this rule would drift the
 * first time a row gained a new kind of icon.
 *
 * A count reads `×17` rather than repeating the sprite: identical icons past
 * about three stop being countable and become texture. Icons that differ (the
 * upkeep row's buildings, a head coach and an assistant) each get drawn,
 * because there the picture is the information.
 */

/** Matches the row's body text; the badge should read as punctuation, not art. */
const ICON_SIZE = 16;

/**
 * Buildings past this are summed into `+N`.
 *
 * A full grounds is twelve buildings, and twelve 16-px sprites plus gaps is
 * wider than the amount column on a phone — the row would wrap and the money
 * would stop being the first thing read.
 */
const MAX_DRAWN_ICONS = 6;

export function LedgerRowIcons({
  icons,
}: {
  icons: readonly LedgerIconViewModel[];
}) {
  if (icons.length === 0) return null;
  const drawn = icons.slice(0, MAX_DRAWN_ICONS);
  const overflow = icons.length - drawn.length;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      // `mr-3` is load-bearing: without it the trailing `+N` sat flush against
      // the amount and read as part of the money.
      className="ml-2 mr-3 shrink-0 flex-row items-center gap-1"
    >
      {drawn.map((icon) => (
        <View key={icon.id} className="flex-row items-center">
          <LedgerIcon icon={icon} />
          {icon.count !== undefined && icon.count > 1 ? (
            <Text className="ml-0.5 font-mono text-xs text-ink/60">
              ×{icon.count}
            </Text>
          ) : null}
        </View>
      ))}
      {overflow > 0 ? (
        <Text className="font-mono text-xs text-ink/60">+{overflow}</Text>
      ) : null}
    </View>
  );
}

function LedgerIcon({ icon }: { icon: LedgerIconViewModel }) {
  if (icon.kind === 'facility') {
    // Level pips belong on the grounds map, not on a one-line ledger badge.
    return (
      <FacilitySprite type={icon.facility} size={ICON_SIZE} showLevel={false} />
    );
  }
  if (icon.kind === 'coach') {
    return (
      <ManagementSprite
        spriteKey={`coach:${icon.portraitId}:rest`}
        width={ICON_SIZE}
      />
    );
  }
  return <PlayerSprite size={ICON_SIZE} />;
}
