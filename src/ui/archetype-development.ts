export interface ArchetypeDevelopmentSummary {
  strengths: string;
  weaknesses: string;
}

const ARCHETYPE_DEVELOPMENT: Readonly<Record<string, ArchetypeDevelopmentSummary>> = {
  Speedster: { strengths: '+15% PAC', weaknesses: 'OTHER STATS +0%' },
  Sniper: { strengths: '+15% SHO', weaknesses: 'OTHER STATS +0%' },
  Playmaker: { strengths: '+15% PAS & TEC', weaknesses: 'OTHER STATS +0%' },
  Anchor: { strengths: '+15% DEF & STA', weaknesses: 'OTHER STATS +0%' },
  Wall: { strengths: '+15% REF & DEF', weaknesses: 'OTHER STATS +0%' },
  Engine: { strengths: '+15% STA & PAC', weaknesses: 'OTHER STATS +0%' },
  'All-Rounder': { strengths: '+5% ALL STATS', weaknesses: 'NO WEAK SPOT' },
  Prodigy: { strengths: '+20% ALL STATS', weaknesses: 'NO WEAK SPOT' },
};

export function archetypeDevelopmentSummary(archetype: string): ArchetypeDevelopmentSummary {
  return ARCHETYPE_DEVELOPMENT[archetype]
    ?? { strengths: '+ BALANCED', weaknesses: '- UNKNOWN' };
}
