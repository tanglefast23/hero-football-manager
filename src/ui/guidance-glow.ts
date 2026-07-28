import type { ViewStyle } from 'react-native';

/**
 * The halo that says "this one, here" on a control the guide just named.
 *
 * The geometry is the Train button's, so the two read as one vocabulary. The
 * colour is not: `docs/08-ui-ux.md` reserves hero gold for hero and power
 * elements — *"the accent literally means hero; nothing else may use it"* —
 * and names blue as the action and guidance colour. A guided inbox row is
 * guidance, so it glows blue.
 *
 * The Train button's existing gold predates that reading and is left alone
 * here; sweeping it is a separate change to a screen this one does not touch.
 */
export const GUIDED_ALERT_GLOW: ViewStyle = {
  boxShadow: '0 0 12px 4px rgba(63, 111, 181, 0.9)',
  shadowColor: '#3f6fb5',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 1,
  shadowRadius: 9,
  elevation: 10,
};
