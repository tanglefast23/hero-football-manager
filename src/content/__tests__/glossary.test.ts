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

  it('teaches the instant tap-to-train system, never the removed weekly slots', () => {
    // Training moved to instant tap-resolved drills (trainPlayerInstantly,
    // 2026-07-24). The glossary shipped for weeks still teaching the old
    // weekly-slot plan — "picking a stat commits immediately and repeats every
    // week until you change it" — so pin the semantics, not a phrasing: the
    // training entries must describe drills resolving on the tap, and no entry
    // anywhere may claim a drill commits, schedules, or repeats week over week.
    const categories = loadLaunchContent().glossary.categories;
    const training = categories.find(category => category.id === 'training');
    if (training === undefined) throw new Error('training glossary category missing');

    const trainingText = training.entries
      .map(entry => `${entry.term} ${entry.definition}`.toLowerCase())
      .join(' ');
    expect(trainingText).toMatch(/tap|instant/);
    expect(trainingText).toContain('training points');

    for (const entry of categories.flatMap(category => category.entries)) {
      const text = `${entry.term}: ${entry.definition}`;
      expect(text).not.toMatch(/weekly plan/i);
      expect(text).not.toMatch(/repeats? (?:it )?every week/i);
      expect(text).not.toMatch(/training slot/i);
    }
  });
});
