/**
 * Public support contact, shared with Joe's other published apps. Confirmed
 * for release on 2026-08-19 — no game-specific address is planned.
 */
export const SUPPORT_EMAIL = 'mrjoevu@hotmail.com';

/**
 * The exact policy App Store Connect submits for this app.
 *
 * Apple requires the metadata URL and an easily accessible in-app link to be
 * the same page, so this constant is the single source both sides read. If the
 * App Store Connect value ever changes, change it here in the same commit.
 */
export const PRIVACY_POLICY_URL =
  'https://tanglefast23.github.io/hero-football-manager-legal/privacy.html';

export function supportEmailUrl(): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Hero Football Manager support')}`;
}
