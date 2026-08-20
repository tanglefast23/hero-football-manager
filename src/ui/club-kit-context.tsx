import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useM1Store } from '../application/store';
import {
  clubKitPlan,
  type ClubKitChoice,
  type KitPlan,
  type KitPrefix,
  type KitSideRewrite,
} from '../render/sprites/club-kit';

export interface ClubKitValue {
  /**
   * The plan for one fixture. A function, not a stored plan: the post-match
   * ledger draws an AWAY fixture, so which side the club's kit belongs on is
   * the caller's question, not this module's.
   */
  planFor(userSide: KitPrefix): KitPlan;
  /**
   * The club's shirt on its own, with no colour-safe amber.
   *
   * Portraits use this. Folding the amber in would flip every own-player
   * portrait from red to amber for a career that never picked a kit — a visible
   * change to shipped saves, under a setting that defaults ON, that nobody
   * asked for. The pitch does take the amber, because there the stock red is
   * the inconsistency.
   */
  readonly ownKit?: KitSideRewrite;
}

/**
 * Colour-safe kits, pushed in from App rather than read through a provider.
 *
 * Same shape as `setHapticsEnabled`, and for the same reason: one preference
 * needed by code far from where preferences live. A React provider at the root
 * would have wrapped the entire app tree in a new element and reindented 1,400
 * lines of App.tsx for a boolean.
 */
let colorSafeKits = true;

export function setClubKitColorSafe(enabled: boolean): void {
  colorSafeKits = enabled;
}

/** Set only by the previews below, which have no career to read from. */
const ClubKitOverride = createContext<ClubKitValue | undefined>(undefined);

/**
 * Overrides the club's kit for its children.
 *
 * Used by the kit editor and the create-a-player preview: onboarding runs
 * before a career exists, so there is nothing in the store to draw yet.
 */
export function ClubKitProvider({
  kit,
  children,
}: {
  kit?: ClubKitChoice;
  children: ReactNode;
}) {
  const value = useMemo<ClubKitValue>(
    () => ({
      planFor: (userSide) =>
        clubKitPlan({ kit, userSide, colorSafeKits: false }),
      ownKit: clubKitPlan({ kit, userSide: 'r', colorSafeKits: false }).r,
    }),
    [kit],
  );
  return (
    <ClubKitOverride.Provider value={value}>
      {children}
    </ClubKitOverride.Provider>
  );
}

export function useClubKit(): ClubKitValue {
  const override = useContext(ClubKitOverride);
  const kit = useM1Store((state) => state.career?.clubKit);
  const value = useMemo<ClubKitValue>(
    () => ({
      planFor: (userSide) => clubKitPlan({ kit, userSide, colorSafeKits }),
      ownKit: clubKitPlan({ kit, userSide: 'r', colorSafeKits: false }).r,
    }),
    [kit],
  );
  return override ?? value;
}
