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
    // Engine m1.27 removed the Zone countdown. The entry used to promise a short
    // window that faded and refunded half the hero's Heat; refunding half Heat is
    // the wind-up rule, not this one. Pin the fact, not a turn of phrase.
    expect(definition('The Zone')).toContain('no countdown');
    expect(definition('Energy Use')).toContain('condition');
    expect(entries.length).toBeGreaterThanOrEqual(40);
  });
});
