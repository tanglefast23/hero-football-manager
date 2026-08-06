import { contentStrings, glossaryTermSlug } from '../content-strings';
import { copyFor } from '../use-copy';
import { loadLaunchContent } from '../../content';

describe('content prose as catalog keys', () => {
  test('every event, choice and outcome is reachable by key', () => {
    const strings = contentStrings();
    const events = loadLaunchContent().events.events;

    for (const event of events) {
      expect({ id: event.id, body: strings[`event.${event.id}.body`] })
        .toEqual({ id: event.id, body: event.body });
      for (const choice of event.choices) {
        for (const outcome of choice.outcomes) {
          const key = `event.${event.id}.${choice.id}.${outcome.id}.text`;
          expect({ key, text: strings[key] }).toEqual({ key, text: outcome.text });
        }
      }
    }
  });

  test('outcome keys carry the stored id, not the array position', () => {
    // The whole point of the ids: reordering a choice's outcomes must not
    // silently reassign a translation to the other branch.
    const strings = contentStrings();
    expect(Object.keys(strings).some(key => /\.(success|setback|only)\.text$/.test(key)))
      .toBe(true);
    expect(Object.keys(strings).some(key => /\.\d+\.text$/.test(key))).toBe(false);
  });

  test('English resolves through the resolver without living in en.json', () => {
    const t = copyFor('en');
    const request = loadLaunchContent().playerRequests.requests[0]!;
    expect(t(`playerRequest.${request.id}.title`)).toBe(request.title);
  });

  test('content prose is NOT duplicated into en.json', () => {
    // Two hand-maintained copies of the same sentence drift the first time
    // someone fixes a typo in one of them.
    const catalogKeys = new Set(Object.keys(require('../../../content/i18n/en.json').strings));
    const overlap = Object.keys(contentStrings()).filter(key => catalogKeys.has(key));
    expect(overlap).toEqual([]);
  });

  test('a locale with no translation still shows the English content', () => {
    const request = loadLaunchContent().playerRequests.requests[0]!;
    expect(copyFor('vi')(`playerRequest.${request.id}.title`)).toBe(request.title);
  });
});

describe('the story and glossary screens read the keys that exist', () => {
  test('every key StoryEventScreen builds resolves for every event', () => {
    const strings = contentStrings();
    for (const event of loadLaunchContent().events.events) {
      expect({ id: event.id, title: strings[`event.${event.id}.title`] !== undefined })
        .toEqual({ id: event.id, title: true });
      for (const choice of event.choices) {
        const key = `event.${event.id}.${choice.id}.label`;
        expect({ key, present: strings[key] !== undefined }).toEqual({ key, present: true });
      }
    }
  });

  test('every key GlossaryPanel builds resolves', () => {
    const strings = contentStrings();
    for (const category of loadLaunchContent().glossary.categories) {
      for (const entry of category.entries) {
        const key = `glossary.${category.id}.${glossaryTermSlug(entry.term)}.definition`;
        expect({ key, present: strings[key] !== undefined }).toEqual({ key, present: true });
      }
    }
  });
});
