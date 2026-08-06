import { loadLaunchContent } from '../content';

/**
 * English prose that lives in `content/*.json`, flattened into catalog keys.
 *
 * This is the second half of the single-English-source rule. Content prose —
 * events, tips, the glossary, Bert, player requests, ceremony lines — stays
 * authored where it is authored today; it is NOT copied into `en.json`. Two
 * hand-maintained copies of the same sentence would drift the first time
 * someone fixed a typo in one of them.
 *
 * So English for a content key is read from the content file by id, and only
 * the translations live in `content/i18n/<locale>.json`. Editing an English tip
 * still means editing `tips.json`; editing an English button still means
 * editing `en.json`; neither file ever holds the other's strings.
 *
 * Event outcome keys use the outcome's own stored id rather than its array
 * index, so reordering a choice's outcomes cannot silently reassign a
 * translation to the wrong branch.
 */
let cached: Readonly<Record<string, string>> | undefined;

export function contentStrings(): Readonly<Record<string, string>> {
  if (cached !== undefined) return cached;
  const content = loadLaunchContent();
  const strings: Record<string, string> = {};

  const put = (key: string, value: string | undefined): void => {
    if (value !== undefined && value.trim().length > 0) strings[key] = value;
  };

  for (const event of content.events.events) {
    put(`event.${event.id}.title`, event.title);
    put(`event.${event.id}.body`, event.body);
    for (const choice of event.choices) {
      put(`event.${event.id}.${choice.id}.label`, choice.label);
      for (const outcome of choice.outcomes) {
        put(`event.${event.id}.${choice.id}.${outcome.id}.text`, outcome.text);
        put(`event.${event.id}.${choice.id}.${outcome.id}.headline`, outcome.successHeadline);
      }
    }
  }

  for (const tip of content.tips.tips) {
    put(`tip.${tip.id}.title`, tip.title);
    put(`tip.${tip.id}.body`, tip.body);
  }

  for (const request of content.playerRequests.requests) {
    put(`playerRequest.${request.id}.title`, request.title);
    put(`playerRequest.${request.id}.line`, request.line);
  }

  for (const category of content.glossary.categories) {
    put(`glossary.${category.id}.title`, category.title);
    for (const entry of category.entries) {
      put(`glossary.${category.id}.${glossaryTermSlug(entry.term)}.term`, entry.term);
      put(`glossary.${category.id}.${glossaryTermSlug(entry.term)}.definition`, entry.definition);
    }
  }

  cached = strings;
  return strings;
}

/**
 * Glossary entries are keyed by term, which has no id of its own.
 *
 * Exported because the panel has to build the same key to read it back. Two
 * copies of this would drift silently — the keys would simply stop matching and
 * every glossary entry would fall through to its English, which looks like
 * "translation not done yet" rather than a bug.
 */
export function glossaryTermSlug(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
