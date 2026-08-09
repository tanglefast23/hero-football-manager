import { archetypeDevelopmentSummary } from '../archetype-development';
import { PLAYER_ARCHETYPES } from '../../game/archetype-caps';
import { loadCatalog } from '../../i18n';

describe('archetype development summaries', () => {
  it('shows the exact training bonus for every roster archetype', () => {
    expect(
      [
        'Speedster',
        'Sniper',
        'Playmaker',
        'Anchor',
        'Wall',
        'Engine',
        'All-Rounder',
        'Prodigy',
      ].map((archetype) => archetypeDevelopmentSummary(archetype).strengths),
    ).toEqual([
      '+15% PAC',
      '+15% SHO',
      '+15% PAS & TEC',
      '+15% DEF & STA',
      '+15% REF & DEF',
      '+15% STA & PAC',
      '+5% ALL STATS',
      '+20% ALL STATS',
    ]);
  });

  /**
   * The guard the split exists for.
   *
   * The table is keyed by the persisted archetype ID. Pass it a display name —
   * which is what happened for as long as the two were the same string, and
   * which translating the display would have made permanent — and every player
   * on the roster lands on the same "+ BALANCED / - UNKNOWN" row at once.
   * Nothing throws and nothing looks broken, so only an explicit assertion
   * catches it.
   */
  it('resolves every shipped archetype id to a real row, never the fallback', () => {
    const fallback = archetypeDevelopmentSummary('no-such-archetype');
    expect(fallback.strengths).toBe('+ BALANCED');

    const swallowed = PLAYER_ARCHETYPES.filter(
      (archetype) =>
        archetypeDevelopmentSummary(archetype).strengthsKey ===
        fallback.strengthsKey,
    );
    expect(swallowed).toEqual([]);
    expect(PLAYER_ARCHETYPES.length).toBeGreaterThan(0);
  });

  it('names a catalog key for every line it draws', () => {
    const english = loadCatalog('en').strings;
    const missing = [...PLAYER_ARCHETYPES, 'no-such-archetype']
      .flatMap((archetype) => {
        const summary = archetypeDevelopmentSummary(archetype);
        return [summary.strengthsKey, summary.weaknessesKey];
      })
      .filter((key) => english[key] === undefined);
    expect(missing).toEqual([]);
  });
});
