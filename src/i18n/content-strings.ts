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
 *
 * **Namespaces and the voice they imply.** `voice.ts` reads the prefix to decide
 * which face a key is drawn in, and the glyph gate checks the translation
 * against that face. A namespace is therefore chosen to match how the string is
 * actually rendered, not by which file it came from — which is why the awakening
 * cutscene's short pixel labels sit under `awakening.` beside their existing
 * chrome siblings while the same trigger's sans-serif prose sits under
 * `story.awakening.`.
 *
 * **What is deliberately NOT keyed.**
 * - Names: `assistant.name` ("Bert Rudge"), club, player and city names.
 * - Guide-page `kicker`, `title`, `objective`, `buttonLabel` and `navItems`.
 *   The briefing walk-on replaced the framed window that drew them, and nothing
 *   in the shipped UI reads them any more (only `body` and `focus` survive, via
 *   `briefingBeats`). Keying them would put ~110 sentences nobody can see into
 *   the coverage denominator and ask six translators to write them.
 * - Everything in `sponsors.json`. `sponsorName` and `offerLine` are written
 *   into `SponsorContractSnapshot`, which is persisted, and `sponsorName` is
 *   copied again into every sponsor ledger line's `labelParams` — so a
 *   translated value freezes into the save in whatever language that season was
 *   played. `objectives[].labelTemplate` is persisted the same way through
 *   `sponsorRules`. See the TODO in `src/game/sponsors.ts`.
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
      put(`glossary.${category.id}.${proseSlug(entry.term)}.term`, entry.term);
      put(`glossary.${category.id}.${proseSlug(entry.term)}.definition`, entry.definition);
    }
  }

  // Bert. The assistant's own name stays English; his job title does not.
  const guide = content.assistantGuide;
  put('bert.role', guide.assistant.role);
  for (const [slot, copy] of Object.entries(guide.m4Fiction)) {
    put(`bert.fiction.${slot}.title`, copy.title);
    put(`bert.fiction.${slot}.body`, copy.body);
  }
  for (const sequence of guide.sequences) {
    put(`bert.guide.${sequence.id}.inbox.title`, sequence.inbox?.title);
    put(`bert.guide.${sequence.id}.inbox.detail`, sequence.inbox?.detail);
    /**
     * A page has no id of its own, and its position IS its identity: a briefing
     * is a linear slideshow, page 2 follows page 1 because it answers it. There
     * is no reorder here that preserves the English, so unlike an event's
     * outcomes there is nothing an ordinal key can silently misassign — a
     * rewrite reads as a rewrite in both languages.
     */
    sequence.pages.forEach((page, pageIndex) => {
      page.body.forEach((paragraph, bodyIndex) => {
        put(`bert.guide.${sequence.id}.page${pageIndex + 1}.body${bodyIndex + 1}`, paragraph);
      });
    });
  }

  // The awakening cutscene, split by the face it draws in: the topline kicker,
  // beat title and bite callout are pixel type, like the `awakening.beat.*`
  // chrome they sit beside; the story paragraphs and the callout's detail line
  // are platform sans.
  const onboarding = content.onboarding;
  put('story.awakening.limp', onboarding.limp);
  for (const trigger of onboarding.triggers) {
    put(`awakening.trigger.${trigger.id}.kicker`, trigger.kicker);
    put(`awakening.trigger.${trigger.id}.title`, trigger.title);
    put(`awakening.trigger.${trigger.id}.callout`, trigger.callout);
    put(`story.awakening.trigger.${trigger.id}.detail`, trigger.detail);
    put(`story.awakening.trigger.${trigger.id}.copy`, trigger.copy);
  }
  for (const power of onboarding.powers) {
    put(`story.awakening.power.${power.powerId}.omen`, power.omen);
    put(`story.awakening.power.${power.powerId}.reveal`, power.reveal);
  }

  /**
   * Power NAMES already live in `en.json` as `powerEffect.<slug>.name` and are
   * translated in all six locales — the match overlay needs them without
   * loading the content catalog. Only the description is added here, into the
   * same namespace, so there is never a second competing name for a power.
   */
  for (const power of content.powers.powers) {
    put(`powerEffect.${powerCopySlug(power.id)}.description`, power.description);
  }

  for (const drill of content.training.focusDrills) {
    put(`drill.${drill.id}.name`, drill.name);
  }

  /**
   * The gaffer's and the players' spoken pools have no ids at all — they are
   * bare arrays of sentences, pinned to an exact length by the schema. Keying
   * them by index would mean that rewriting line 7 leaves six stale
   * translations attached to a sentence nobody wrote, and every one of them
   * would still resolve, so no gate could see it. Keying on the English instead
   * makes a rewrite what it is: a new key, untranslated, which gate 10 counts.
   */
  for (const [pool, lines] of Object.entries(content.fulltimeCoachLines)) {
    if (!Array.isArray(lines)) continue; // schemaVersion
    for (const line of lines as readonly string[]) {
      put(`coach.fulltime.${pool}.${proseSlug(line)}`, line);
    }
  }
  for (const line of content.fulltimeBlameLines.lines) {
    put(`coach.blame.${proseSlug(line)}`, line);
  }
  for (const line of content.awardCeremonyLines.winner) {
    put(`ceremony.winner.${proseSlug(line)}`, line);
  }
  for (const line of content.awardCeremonyLines.runnerUp) {
    put(`ceremony.runnerUp.${proseSlug(line)}`, line);
  }

  cached = strings;
  return strings;
}

/**
 * A stable key fragment for a string that has no id of its own.
 *
 * Exported because every consumer has to build the same fragment to read its
 * entry back. Two copies of this would drift silently — the keys would simply
 * stop matching and every affected line would fall through to its English,
 * which looks like "translation not done yet" rather than a bug.
 */
export function proseSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Glossary entries are keyed by term, which has no id of its own. */
export const glossaryTermSlug = proseSlug;

/**
 * The catalog segment for each power's spoken copy.
 *
 * Spelled out rather than derived from the id, because a key a translator sees
 * should be readable and stable, and `SUPER_SPEED` → `superSpeed` is exactly the
 * kind of derivation that quietly renames every key the day an id changes.
 *
 * It lives here rather than beside the render table it used to sit in because
 * three keys now hang off it — the power's name, its screen-reader sentence and
 * its description — and the first two are read from `src/render`. One table in
 * the copy ring is what stops a power's description landing under a different
 * spelling from its name.
 */
const POWER_COPY_SLUG: Readonly<Record<string, string>> = {
  SUPER_SPEED: 'superSpeed',
  BLINK_RUN: 'blinkRun',
  THUNDER_STRIKE: 'thunderStrike',
  FIRE_TORCH: 'fireTorch',
  PHASE_RUN: 'phaseRun',
  PORTAL_PASS: 'portalPass',
  DECOY_DOUBLE: 'decoyDouble',
  FUTURE_SIGHT: 'futureSight',
  SUPER_STRENGTH: 'superStrength',
  WEB_TRAP: 'webTrap',
  ELASTIC_KEEPER: 'elasticKeeper',
  RALLY_CRY: 'rallyCry',
  ICE_RINK: 'iceRink',
  SHADOW_MARK: 'shadowMark',
  GRAVITY_WELL: 'gravityWell',
  GIANT_GK: 'giantGk',
  GUST: 'gust',
};

export function powerCopySlug(powerId: string): string {
  const slug = POWER_COPY_SLUG[powerId];
  if (slug === undefined) throw new Error(`no copy slug for power ${powerId}`);
  return slug;
}
