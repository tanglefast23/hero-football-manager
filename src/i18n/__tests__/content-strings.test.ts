import {
  contentStrings,
  glossaryTermSlug,
  powerCopySlug,
  proseSlug,
} from '../content-strings';
import { briefingBeats } from '../../ui/bert-briefing-beats';
import { copyFor } from '../use-copy';
import { resolveCopy } from '../resolve';
import { loadLaunchContent } from '../../content';

describe('content prose as catalog keys', () => {
  test('every event, choice and outcome is reachable by key', () => {
    const strings = contentStrings();
    const events = loadLaunchContent().events.events;

    for (const event of events) {
      expect({ id: event.id, body: strings[`event.${event.id}.body`] }).toEqual(
        { id: event.id, body: event.body },
      );
      for (const choice of event.choices) {
        for (const outcome of choice.outcomes) {
          const key = `event.${event.id}.${choice.id}.${outcome.id}.text`;
          expect({ key, text: strings[key] }).toEqual({
            key,
            text: outcome.text,
          });
        }
      }
    }
  });

  test('outcome keys carry the stored id, not the array position', () => {
    // The whole point of the ids: reordering a choice's outcomes must not
    // silently reassign a translation to the other branch.
    const strings = contentStrings();
    expect(
      Object.keys(strings).some((key) =>
        /\.(success|setback|only)\.text$/.test(key),
      ),
    ).toBe(true);
    expect(Object.keys(strings).some((key) => /\.\d+\.text$/.test(key))).toBe(
      false,
    );
  });

  test('English resolves through the resolver without living in en.json', () => {
    const t = copyFor('en');
    const request = loadLaunchContent().playerRequests.requests[0]!;
    expect(t(`playerRequest.${request.id}.title`)).toBe(request.title);
  });

  test('content prose is NOT duplicated into en.json', () => {
    // Two hand-maintained copies of the same sentence drift the first time
    // someone fixes a typo in one of them.
    const catalogKeys = new Set(
      Object.keys(require('../../../content/i18n/en.json').strings),
    );
    const overlap = Object.keys(contentStrings()).filter((key) =>
      catalogKeys.has(key),
    );
    expect(overlap).toEqual([]);
  });

  test('a content key added ahead of its translation still shows the English', () => {
    // This used to point at a real untranslated event. Every one of them is
    // translated now, so it pointed at nothing and passed by accident of
    // coverage. What it has to prove is what the resolver does when new content
    // lands before its translations — the normal state of a content edit, and
    // not something a finished catalog can demonstrate on its own.
    //
    // So it builds that state instead of hunting for it: an English string the
    // locale catalogs have never seen resolves to the English.
    const key = 'event.written-today-translated-tomorrow.body';
    const english = { [key]: 'A brand new event nobody has translated yet.' };
    expect(resolveCopy('vi', {}, english, key)).toBe(english[key]);
  });
});

describe('the story and glossary screens read the keys that exist', () => {
  test('every key StoryEventScreen builds resolves for every event', () => {
    const strings = contentStrings();
    for (const event of loadLaunchContent().events.events) {
      expect({
        id: event.id,
        title: strings[`event.${event.id}.title`] !== undefined,
      }).toEqual({ id: event.id, title: true });
      for (const choice of event.choices) {
        const key = `event.${event.id}.${choice.id}.label`;
        expect({ key, present: strings[key] !== undefined }).toEqual({
          key,
          present: true,
        });
      }
    }
  });

  test('every key a briefing beat builds resolves', () => {
    // The walk-on is the only thing that draws Bert now, and it builds its keys
    // from the sequence id and the paragraph's position. A key that stops
    // matching does not fail anywhere — the beat quietly reverts to English —
    // so the match has to be asserted here.
    const strings = contentStrings();
    for (const sequence of loadLaunchContent().assistantGuide.sequences) {
      sequence.pages.forEach((page, pageIndex) => {
        page.body.forEach((paragraph, bodyIndex) => {
          const key = `bert.guide.${sequence.id}.page${pageIndex + 1}.body${bodyIndex + 1}`;
          expect({ key, text: strings[key] }).toEqual({ key, text: paragraph });
        });
      });
      if (sequence.inbox === undefined) continue;
      expect(strings[`bert.guide.${sequence.id}.inbox.title`]).toBe(
        sequence.inbox.title,
      );
      expect(strings[`bert.guide.${sequence.id}.inbox.detail`]).toBe(
        sequence.inbox.detail,
      );
    }
  });

  test('nothing renders the guide-page fields that are deliberately unkeyed', () => {
    /**
     * `kicker`, `title`, `objective`, `buttonLabel` and `navItems` survive in
     * assistant-guide.json from the framed window the walk-on replaced. They are
     * not in `contentStrings()`, by the decision recorded there — roughly 110
     * sentences nobody can see.
     *
     * That decision is only safe while it stays true. The day a screen draws
     * `page.buttonLabel`, Bert ships an English button to six languages and no
     * gate notices, because an unkeyed string cannot fail a coverage floor. So
     * assert the premise rather than the conclusion: these fields have no
     * reader. If one gains a reader, key it in `content-strings.ts` first.
     */
    const unkeyed = ['kicker', 'objective', 'buttonLabel', 'navItems'] as const;
    const strings = contentStrings();
    for (const sequence of loadLaunchContent().assistantGuide.sequences) {
      for (const page of sequence.pages) {
        for (const field of unkeyed) {
          const value = page[field];
          if (value === undefined) continue;
          const text = typeof value === 'string' ? value : JSON.stringify(value);
          expect({ field, keyed: Object.values(strings).includes(text) }).toEqual(
            { field, keyed: false },
          );
        }
      }
    }
    // The reader-side half. `briefingBeats` is the only door a guide page goes
    // through on its way to a screen, so it is the only place a newly-rendered
    // field can appear. Every beat must still be a body paragraph and nothing
    // else — a beat that started carrying a kicker or a button label would show
    // up here as text no `page.body` contains.
    for (const sequence of loadLaunchContent().assistantGuide.sequences) {
      const bodies = new Set(sequence.pages.flatMap((page) => page.body));
      for (const beat of briefingBeats(
        loadLaunchContent().assistantGuide,
        sequence.id,
      )) {
        expect({
          sequence: sequence.id,
          fromBody: bodies.has(beat.text),
        }).toEqual({ sequence: sequence.id, fromBody: true });
        expect(Object.keys(beat).sort()).toEqual([
          'focus',
          'kind',
          'pageIndex',
          'text',
        ]);
      }
    }
  });

  test('every spoken pool line is reachable by the slug its speaker builds', () => {
    // These pools have no ids: the key is the sentence. Two lines that slugged
    // the same would silently share one translation, and the schema's
    // uniqueness check works on the raw text, not the slug.
    const strings = contentStrings();
    const content = loadLaunchContent();
    const pools: [string, readonly string[]][] = [
      ['ceremony.winner', content.awardCeremonyLines.winner],
      ['ceremony.runnerUp', content.awardCeremonyLines.runnerUp],
      ['coach.blame', content.fulltimeBlameLines.lines],
      ...Object.entries(content.fulltimeCoachLines)
        .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]))
        .map(([pool, lines]): [string, readonly string[]] => [
          `coach.fulltime.${pool}`,
          lines,
        ]),
    ];

    for (const [namespace, lines] of pools) {
      const keys = lines.map((line) => `${namespace}.${proseSlug(line)}`);
      expect({ namespace, unique: new Set(keys).size }).toEqual({
        namespace,
        unique: lines.length,
      });
      lines.forEach((line, index) => {
        expect({ key: keys[index]!, text: strings[keys[index]!] }).toEqual({
          key: keys[index]!,
          text: line,
        });
      });
    }
  });

  test('a power name and its description share one slug', () => {
    // Names were translated first and live in `en.json`; descriptions arrived
    // later and live here. Two spellings of the same power would put them in
    // different namespaces and translate only half of it.
    const strings = contentStrings();
    const catalog = require('../../../content/i18n/en.json').strings as Record<
      string,
      string
    >;
    for (const power of loadLaunchContent().powers.powers) {
      const slug = powerCopySlug(power.id);
      expect({
        id: power.id,
        name: catalog[`powerEffect.${slug}.name`],
      }).toEqual({ id: power.id, name: power.name });
      expect({
        id: power.id,
        description: strings[`powerEffect.${slug}.description`],
      }).toEqual({ id: power.id, description: power.description });
    }
  });

  test('every key GlossaryPanel builds resolves', () => {
    const strings = contentStrings();
    for (const category of loadLaunchContent().glossary.categories) {
      for (const entry of category.entries) {
        const key = `glossary.${category.id}.${glossaryTermSlug(entry.term)}.definition`;
        expect({ key, present: strings[key] !== undefined }).toEqual({
          key,
          present: true,
        });
      }
    }
  });
});
