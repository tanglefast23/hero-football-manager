import { loadLaunchContent } from '../load';

describe('launch glossary', () => {
  it('explains the wired development and career mechanics in plain language', () => {
    const entries = loadLaunchContent().glossary.categories.flatMap(category => category.entries);
    const definition = (term: string) => entries.find(entry => entry.term === term)?.definition;

    expect(definition('Archetype')).toContain('exact training bonus');
    expect(definition('Archetype')).toContain('without limiting');
    expect(definition('Personality')).toContain('wage demands');
    expect(definition('Fame')).toContain('club legend');
    expect(definition('Potential')).toContain('development speed');
    expect(definition('Potential')).toContain('not how high');
    expect(definition('Potential')).toContain('A+');
    expect(definition('The Zone')).toContain('activation window');
    expect(definition('Energy Use')).toContain('condition');
    expect(entries.length).toBeGreaterThanOrEqual(40);
  });
});
