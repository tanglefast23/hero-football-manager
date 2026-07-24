import { archetypeDevelopmentSummary } from '../archetype-development';

describe('archetype development summaries', () => {
  it('shows the exact training bonus for every roster archetype', () => {
    expect([
      'Speedster',
      'Sniper',
      'Playmaker',
      'Anchor',
      'Wall',
      'Engine',
      'All-Rounder',
      'Prodigy',
    ].map(archetype => archetypeDevelopmentSummary(archetype).strengths)).toEqual([
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
});
