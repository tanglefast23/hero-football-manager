import { archetypeDevelopmentSummary } from '../archetype-development';

describe('archetype development summaries', () => {
  it('explains every roster archetype in compact player-facing terms', () => {
    expect(archetypeDevelopmentSummary('Wall')).toEqual({
      strengths: '+ REF + DEF',
      weaknesses: '− PAC − SHO',
    });
    expect(archetypeDevelopmentSummary('Playmaker')).toEqual({
      strengths: '+ PAS + TEC',
      weaknesses: '− DEF − SHO',
    });
    expect(archetypeDevelopmentSummary('Prodigy')).toEqual({
      strengths: '+ ALL STATS',
      weaknesses: '− NONE',
    });
  });
});
