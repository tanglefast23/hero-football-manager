export interface ArchetypeDevelopmentSummary {
  strengths: string;
  weaknesses: string;
}

const ARCHETYPE_DEVELOPMENT: Readonly<Record<string, ArchetypeDevelopmentSummary>> = {
  Speedster: { strengths: '+ PAC', weaknesses: '− DEF − SHO' },
  Sniper: { strengths: '+ SHO', weaknesses: '− DEF − PAS' },
  Playmaker: { strengths: '+ PAS + TEC', weaknesses: '− DEF − SHO' },
  Anchor: { strengths: '+ DEF + STA', weaknesses: '− SHO − PAC' },
  Wall: { strengths: '+ REF + DEF', weaknesses: '− PAC − SHO' },
  Engine: { strengths: '+ STA + PAC', weaknesses: '− SHO − DEF' },
  'All-Rounder': { strengths: '+ ALL STATS', weaknesses: '− NO WEAK SPOT' },
  Prodigy: { strengths: '+ ALL STATS', weaknesses: '− NONE' },
};

export function archetypeDevelopmentSummary(archetype: string): ArchetypeDevelopmentSummary {
  return ARCHETYPE_DEVELOPMENT[archetype]
    ?? { strengths: '+ BALANCED', weaknesses: '− UNKNOWN' };
}
