import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { POTENTIAL_GRADES, superTrainingChancePercent } from '../../game';
import { loadCatalog } from '../../i18n';
import { loadLaunchContent } from '../load';

describe('launch glossary', () => {
  it('explains the wired development and career mechanics in plain language', () => {
    const entries = loadLaunchContent().glossary.categories.flatMap(
      (category) => category.entries,
    );
    const definition = (term: string) =>
      entries.find((entry) => entry.term === term)?.definition;

    expect(definition('Archetype')).toContain('exact training bonus');
    expect(definition('Archetype')).toContain('without limiting');
    expect(definition('Personality')).toContain('wage demands');
    expect(definition('Fame')).toContain('club legend');
    expect(definition('Potential')).toContain("drill's SUPER chance");
    expect(definition('Potential')).toContain(
      'does not add to an ordinary drill',
    );
    expect(definition('Potential')).toContain('limit how high');
    // Engine m1.27 removed the Zone countdown. The entry used to promise a short
    // window that faded and refunded half the hero's Heat; refunding half Heat is
    // the wind-up rule, not this one. Pin the fact, not a turn of phrase.
    expect(definition('The Zone')).toContain('no countdown');
    expect(definition('Energy Use')).toContain('condition');
    expect(entries.length).toBeGreaterThanOrEqual(40);
  });

  it('takes every Potential explanation from the current runtime rule', () => {
    const floor = superTrainingChancePercent(POTENTIAL_GRADES[0]);
    const ceiling = superTrainingChancePercent(
      POTENTIAL_GRADES[POTENTIAL_GRADES.length - 1],
    );
    const staleBonus =
      /(?:0\s*%|14\s*%|training bonus|bonus (?:al|de|do|latihan|treino|d'entraînement|khi tập)|Trainingsbonus|thưởng tập)/i;
    const english = loadLaunchContent();
    const potential =
      english.glossary.categories
        .flatMap((category) => category.entries)
        .find((entry) => entry.term === 'Potential')?.definition ?? '';
    const tip =
      english.tips.tips.find(
        (entry) => entry.id === 'potential-is-speed-not-ceiling',
      )?.body ?? '';

    for (const text of [potential, tip]) {
      expect(text).toContain(`${floor}%`);
      expect(text).toContain(`${ceiling}%`);
      expect(text).not.toMatch(staleBonus);
    }

    for (const locale of ['es', 'id', 'vi', 'pt-BR', 'fr', 'de'] as const) {
      const strings = loadCatalog(locale).strings;
      for (const key of [
        'glossary.players.potential.definition',
        'tip.potential-is-speed-not-ceiling.body',
      ]) {
        const text = strings[key] ?? '';
        expect(text.replaceAll(' ', '')).toContain(`${floor}%`);
        expect(text.replaceAll(' ', '')).toContain(`${ceiling}%`);
        expect(text).not.toMatch(staleBonus);
      }
    }

    const rawSources = [
      'content/glossary.json',
      'content/tips.json',
      ...['es', 'id', 'vi', 'pt-BR', 'fr', 'de'].map(
        (locale) => `content/i18n/${locale}.json`,
      ),
    ]
      .map((path) => readFileSync(join(process.cwd(), path), 'utf8'))
      .join('\n');
    expect(rawSources).not.toMatch(
      /Potential.{0,160}14%|Potencial.{0,160}14%|Potensi.{0,160}14%|Potentiel.{0,160}14%|Potenzial.{0,160}14%|Tiềm năng.{0,160}14%/i,
    );
  });

  it('teaches the instant tap-to-train system, never the removed weekly slots', () => {
    // Training moved to instant tap-resolved drills (trainPlayerInstantly,
    // 2026-07-24). The glossary shipped for weeks still teaching the old
    // weekly-slot plan — "picking a stat commits immediately and repeats every
    // week until you change it" — so pin the semantics, not a phrasing: the
    // training entries must describe drills resolving on the tap, and no entry
    // anywhere may claim a drill commits, schedules, or repeats week over week.
    const categories = loadLaunchContent().glossary.categories;
    const training = categories.find((category) => category.id === 'training');
    if (training === undefined)
      throw new Error('training glossary category missing');

    const trainingText = training.entries
      .map((entry) => `${entry.term} ${entry.definition}`.toLowerCase())
      .join(' ');
    expect(trainingText).toMatch(/tap|instant/);
    expect(trainingText).toContain('training points');

    for (const entry of categories.flatMap((category) => category.entries)) {
      const text = `${entry.term}: ${entry.definition}`;
      expect(text).not.toMatch(/weekly plan/i);
      expect(text).not.toMatch(/repeats? (?:it )?every week/i);
      expect(text).not.toMatch(/training slot/i);
    }
  });
});
