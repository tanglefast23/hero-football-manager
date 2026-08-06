/**
 * Public support contact already published for Joe's existing Liquid Calendar
 * app. Keep it in one place so it is trivial to replace if Joe chooses a
 * game-specific address before the final archive.
 */
export const SUPPORT_EMAIL = 'mrjoevu@hotmail.com';

export function supportEmailUrl(): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Hero Football Manager support')}`;
}
