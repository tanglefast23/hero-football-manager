import { z } from 'zod';

export const ContentSchemaVersion = z.literal(1);
export const RoleSchema = z.enum(['GK', 'DEF', 'MID', 'FWD']);
export const PowerIdSchema = z.enum([
  'SUPER_SPEED',
  'BLINK_RUN',
  'THUNDER_STRIKE',
  'FIRE_TORCH',
  'PHASE_RUN',
  'PORTAL_PASS',
  'DECOY_DOUBLE',
  'FUTURE_SIGHT',
  'SUPER_STRENGTH',
  'WEB_TRAP',
  'ELASTIC_KEEPER',
  'RALLY_CRY',
  'ICE_RINK',
  'SHADOW_MARK',
  'GRAVITY_WELL',
  'GIANT_GK',
  'GUST',
]);
export const AttributeSchema = z.enum(['pac', 'sho', 'pas', 'def', 'tec', 'sta', 'ref']);
export const ArchetypeSchema = z.enum([
  'Speedster',
  'Sniper',
  'Playmaker',
  'Anchor',
  'Wall',
  'Engine',
  'All-Rounder',
  'Prodigy',
]);

const idSchema = z.string().trim().min(1);
const displayNameSchema = z.string().trim().min(1);
const safeNonnegativeIntegerSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const ratingSchema = z.number().int().min(1).max(99);

export const RatingsSchema = z.strictObject({
  pac: ratingSchema,
  sho: ratingSchema,
  pas: ratingSchema,
  def: ratingSchema,
  tec: ratingSchema,
  sta: ratingSchema,
  ref: ratingSchema,
});

export const LaunchPlayerSchema = z.strictObject({
  id: idSchema,
  name: displayNameSchema,
  role: RoleSchema,
  age: z.number().int().min(16).max(38),
  archetype: ArchetypeSchema,
  ratings: RatingsSchema,
  weeklyWage: safeNonnegativeIntegerSchema,
  contractSeasonsRemaining: z.number().int().min(1).max(3),
  powerId: PowerIdSchema.nullable(),
  licensed: z.boolean(),
  onHeroWage: z.boolean(),
});

export const LaunchClubSchema = z.strictObject({
  id: idSchema,
  name: displayNameSchema,
  shortName: z.string().trim().min(2).max(4),
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9A-F]{6}$/),
  startingCash: safeNonnegativeIntegerSchema,
  fans: safeNonnegativeIntegerSchema,
  ticketPrice: safeNonnegativeIntegerSchema,
  sponsorMonthlyFee: safeNonnegativeIntegerSchema,
  players: z.array(LaunchPlayerSchema).length(16),
  startingLineup: z.array(idSchema).length(11),
}).superRefine((club, context) => {
  addDuplicateIssues(club.players.map(player => player.id), context, ['players'], 'player ID');
  addDuplicateIssues(club.startingLineup, context, ['startingLineup'], 'lineup player ID');
});

export const ClubCatalogSchema = z.strictObject({
  schemaVersion: ContentSchemaVersion,
  clubs: z.array(LaunchClubSchema).length(10),
}).superRefine((catalog, context) => {
  addDuplicateIssues(catalog.clubs.map(club => club.id), context, ['clubs'], 'club ID');
});

export const PowerDefinitionSchema = z.strictObject({
  id: PowerIdSchema,
  name: displayNameSchema,
  tier: z.enum(['starter', 'standard', 'legendary']),
  category: z.enum(['attack', 'defense']),
  description: displayNameSchema,
  usefulContext: z.enum([
    'BREAKAWAY',
    'LAST_DEFENDER',
    'CLEAN_SHOT',
    'MARKED_FINAL_THIRD',
    'UNDER_PRESSURE',
    'BLOCKED_LANE',
    'LOOSE_BALL',
    'PASS_SETUP',
    'EXPECTED_PASS',
    'DANGEROUS_CARRIER',
    'DRIBBLE_LANE',
    'SHOT_INCOMING',
    'TEAMMATES_READY',
  ]),
  requiresTarget: z.boolean(),
  windupTicks: z.number().int().min(1).max(100),
});

export const PowerCatalogSchema = z.strictObject({
  schemaVersion: ContentSchemaVersion,
  awakening: z.strictObject({
    postMatchChancePercent: z.literal(10),
    minimumMatchesBetween: z.literal(3),
  }),
  powers: z.array(PowerDefinitionSchema).min(16).max(20),
}).superRefine((catalog, context) => {
  addDuplicateIssues(catalog.powers.map(power => power.id), context, ['powers'], 'power ID');
});

export const OnboardingContentSchema = z.strictObject({
  schemaVersion: ContentSchemaVersion,
  limp: displayNameSchema,
  triggers: z.array(z.strictObject({
    id: idSchema,
    visual: z.enum([
      'caterpillar',
      'water',
      'cpr',
      'sponge',
      'sneeze',
      'ice',
      'drink',
      'sprinkler',
      'shin-guard',
      'meteor',
      'ball',
      'confetti',
      'feather',
      'thermometer',
      'defibrillator',
    ]),
    kicker: displayNameSchema,
    title: displayNameSchema,
    callout: displayNameSchema,
    detail: displayNameSchema,
    copy: displayNameSchema,
  })).length(15),
  powers: z.array(z.strictObject({
    powerId: PowerIdSchema,
    omen: displayNameSchema,
    reveal: displayNameSchema,
  })).min(16).max(20),
}).superRefine((content, context) => {
  addDuplicateIssues(content.triggers.map(trigger => trigger.id), context, ['triggers'], 'awakening trigger');
  addDuplicateIssues(content.powers.map(power => power.powerId), context, ['powers'], 'power');
  for (const powerId of PowerIdSchema.options) {
    if (!content.powers.some(power => power.powerId === powerId)) {
      addIssue(context, ['powers'], `missing awakening copy for ${powerId}`);
    }
  }
});

export const AssistantGuideSequenceIdSchema = z.enum([
  'management-intro',
  'desk-intro',
  'head-coach-market',
  'head-coach-hire',
  'coaching-office',
  'assistant-coach-hire',
  'facility-placement',
  'facility-upgrade',
  'facility-adjacency',
  'scout-mission',
  'scout-report',
  'roster-cap',
  'transfer-list',
  'transfer-bid',
  'transfer-negotiation',
  'youth-intake',
  'national-cup',
  'division-leaders',
  'sponsor-desk',
  'sponsor-desk-continuity',
  'sponsor-buzz',
  'first-injury',
  'first-emergency-loan',
  'first-transfer-request',
  'retirement',
  'club-legacy',
  'board-ultimatum',
  'board-protection',
  'player-requests',
]);

export const AssistantGuideFocusSchema = z.enum([
  'assistant',
  'money',
  'navigation',
  'desk',
  'training',
  'coach-market',
  'coach-hire',
  'coaching-office',
  'assistant-coach-hire',
  'facility-grid',
  'facility-upgrade',
  'facility-adjacency',
  'scout-mission',
  'scout-report',
  'transfer-list',
  'transfer-bid',
  'transfer-negotiation',
  'youth-intake',
  'national-cup',
  'division-leaders',
  'sponsor-desk',
  'sponsor-summary',
  'sponsor-buzz',
  'squad-requests',
  'injury-lineup',
  'emergency-loan',
  'transfer-request',
  'retirement',
  'club-legacy',
  'board-ultimatum',
  'board-protection',
]);

export const AssistantGuideDestinationSchema = z.enum([
  'coach-market',
  'club-facilities',
  'market-scouting',
  'market-transfers',
  'youth-intake',
  'league-cup',
  'league-leaders',
  'squad',
  'club-legacy',
  'club-finances',
]);

const AssistantGuidePageSchema = z.strictObject({
  kicker: displayNameSchema,
  title: displayNameSchema,
  body: z.array(displayNameSchema).min(1).max(2),
  focus: AssistantGuideFocusSchema,
  objective: displayNameSchema.optional(),
  buttonLabel: displayNameSchema,
  navItems: z.array(z.strictObject({
    tab: z.enum(['HOME', 'SQUAD', 'CLUB', 'MARKET', 'LEAGUE']),
    detail: displayNameSchema,
  })).length(5).optional(),
}).superRefine((page, context) => {
  if (page.focus === 'navigation' && page.navItems === undefined) {
    addIssue(context, ['navItems'], 'navigation guide page requires all five nav items');
  }
  if (page.focus !== 'navigation' && page.navItems !== undefined) {
    addIssue(context, ['navItems'], 'only navigation guide pages may define nav items');
  }
});

const AssistantGuideSequenceSchema = z.strictObject({
  id: AssistantGuideSequenceIdSchema,
  inbox: z.strictObject({
    title: displayNameSchema,
    detail: displayNameSchema,
  }).optional(),
  destination: AssistantGuideDestinationSchema.optional(),
  pages: z.array(AssistantGuidePageSchema).min(1).max(4),
}).superRefine((sequence, context) => {
  const m1Sequence = sequence.id === 'management-intro'
    || sequence.id === 'desk-intro';
  if (!m1Sequence && sequence.inbox === undefined) {
    addIssue(context, ['inbox'], 'M2 assistant guides require inbox copy');
  }
  if (!m1Sequence && sequence.destination === undefined) {
    addIssue(context, ['destination'], 'M2 assistant guides require a destination');
  }
});

export const AssistantGuideContentSchema = z.strictObject({
  schemaVersion: ContentSchemaVersion,
  assistant: z.strictObject({
    name: displayNameSchema,
    role: displayNameSchema,
    portraitArchetype: z.literal('GAFFER'),
  }),
  m4Fiction: z.strictObject({
    accessibility: z.strictObject({ title: displayNameSchema, body: displayNameSchema }),
    events: z.strictObject({ title: displayNameSchema, body: displayNameSchema }),
    seasonRecap: z.strictObject({ title: displayNameSchema, body: displayNameSchema }),
  }),
  sequences: z.array(AssistantGuideSequenceSchema).length(AssistantGuideSequenceIdSchema.options.length),
}).superRefine((content, context) => {
  addDuplicateIssues(content.sequences.map(sequence => sequence.id), context, ['sequences'], 'guide sequence ID');
  for (const sequenceId of AssistantGuideSequenceIdSchema.options) {
    if (!content.sequences.some(sequence => sequence.id === sequenceId)) {
      addIssue(context, ['sequences'], `missing assistant guide sequence ${sequenceId}`);
    }
  }
});

// The ceiling is the top tier's gain: the per-drill table below pins every
// authored value exactly, so this bound only catches a gain invented outside it.
const MAXIMUM_DRILL_GAIN = 23;
const DrillGainsSchema = z.strictObject({
  pac: z.number().int().min(1).max(MAXIMUM_DRILL_GAIN).optional(),
  sho: z.number().int().min(1).max(MAXIMUM_DRILL_GAIN).optional(),
  pas: z.number().int().min(1).max(MAXIMUM_DRILL_GAIN).optional(),
  def: z.number().int().min(1).max(MAXIMUM_DRILL_GAIN).optional(),
  tec: z.number().int().min(1).max(MAXIMUM_DRILL_GAIN).optional(),
  sta: z.number().int().min(1).max(MAXIMUM_DRILL_GAIN).optional(),
  ref: z.number().int().min(1).max(MAXIMUM_DRILL_GAIN).optional(),
}).refine(gains => Object.keys(gains).length === 1, 'a drill must improve exactly one attribute');

/**
 * `gains` overrides the shared tier ladder for one path.
 *
 * Keeper Drills is the only override, and it exists because REF is not read as
 * often as the other six attributes — it is read far more. A keeper's rating
 * contests every opposing shot, 14 a match at the opening fixture, while a
 * striker's SHO touches only his own 2.6. Measured at the real opening roster
 * (250 paired seeds, 2026-07-30) the uniform ladder therefore made a TP spent
 * on Keeper Drills worth roughly 14x a TP spent on Finishing, and seven keeper
 * taps alone moved the opening match from 88% losses to 34%.
 *
 * Pricing the ladder by exposure rather than uniformly brings the two within
 * 1.6x once the comparison is normalised per contest. The pin stays exact so
 * content still cannot drift; it is now per path rather than global.
 */
const FOCUS_DRILL_PATHS = [
  { id: 'sprints', name: 'Sprints', attribute: 'pac' },
  { id: 'finishing', name: 'Finishing', attribute: 'sho' },
  { id: 'rondo', name: 'Rondo', attribute: 'pas' },
  { id: 'duels', name: 'Duels', attribute: 'def' },
  { id: 'first-touch', name: 'First Touch', attribute: 'tec' },
  { id: 'circuit', name: 'Circuit', attribute: 'sta' },
  { id: 'keeper-drills', name: 'Keeper Drills', attribute: 'ref', gains: [2, 3, 5, 7, 9] },
] as const;
// Tier labels are Arabic digits: the Roman "I" rendered as a bare bar in the
// UI font and read as a serif-less 1.
// The outfield ladder was 5/8/12/17/23 and is now that curve scaled by 4/5, so
// tier 1 grants 4. Rounding to whole points cancels out across the five rungs:
// the ladder still totals exactly four fifths of what it used to (52 of 65).
const FOCUS_DRILL_TIERS = [
  { suffix: '', label: '1', gain: 4 },
  { suffix: '-ii', label: '2', gain: 6 },
  { suffix: '-iii', label: '3', gain: 10 },
  { suffix: '-iv', label: '4', gain: 14 },
  { suffix: '-v', label: '5', gain: 18 },
] as const;
const EXPECTED_FOCUS_DRILLS = FOCUS_DRILL_PATHS.flatMap(path => (
  FOCUS_DRILL_TIERS.map((tier, tierIndex) => ({
    id: `${path.id}${tier.suffix}`,
    name: `${path.name} ${tier.label}`,
    attribute: path.attribute,
    gain: 'gains' in path ? path.gains[tierIndex] : tier.gain,
  }))
));

export const TrainingDrillSchema = z.strictObject({
  id: idSchema,
  name: displayNameSchema,
  moneyCost: safeNonnegativeIntegerSchema,
  tpCost: safeNonnegativeIntegerSchema,
  gains: DrillGainsSchema,
});

export const TrainingCatalogSchema = z.strictObject({
  schemaVersion: ContentSchemaVersion,
  focusDrills: z.array(TrainingDrillSchema).length(
    FOCUS_DRILL_PATHS.length * FOCUS_DRILL_TIERS.length,
  ),
}).superRefine((catalog, context) => {
  addDuplicateIssues(
    catalog.focusDrills.map(drill => drill.id),
    context,
    ['focusDrills'],
    'drill ID',
  );
  const expectedById = new Map(EXPECTED_FOCUS_DRILLS.map(drill => [drill.id, drill]));
  catalog.focusDrills.forEach((drill, index) => {
    const expected = expectedById.get(drill.id);
    if (expected === undefined) {
      addIssue(
        context,
        ['focusDrills', index, 'id'],
        'focus drill ID must identify one of the seven five-tier drill paths',
      );
      return;
    }
    if (drill.name !== expected.name) {
      addIssue(
        context,
        ['focusDrills', index, 'name'],
        `${drill.id} must be named ${expected.name}`,
      );
    }
    const gains = Object.entries(drill.gains);
    if (gains.length === 1 && (
      gains[0][0] !== expected.attribute || gains[0][1] !== expected.gain
    )) {
      addIssue(
        context,
        ['focusDrills', index, 'gains'],
        `${drill.id} must grant exactly +${expected.gain} ${expected.attribute.toUpperCase()}`,
      );
    }
  });
  for (const expected of EXPECTED_FOCUS_DRILLS) {
    if (!catalog.focusDrills.some(drill => drill.id === expected.id)) {
      addIssue(context, ['focusDrills'], `missing focus drill ${expected.id}`);
    }
  }
});

const EventEffectSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('money'), amount: z.number().int().min(-100000).max(100000) }),
  z.strictObject({ type: z.literal('tp'), amount: z.number().int().min(-1000).max(1000) }),
  z.strictObject({ type: z.literal('morale'), amount: z.number().int().min(-100).max(100) }),
  z.strictObject({ type: z.literal('fans'), amount: z.number().int().min(-10000).max(10000) }),
  z.strictObject({ type: z.literal('injury'), weeks: z.number().int().min(1).max(8) }),
  z.strictObject({
    type: z.literal('statDelta'),
    attribute: AttributeSchema,
    amount: z.number().int().min(-10).max(10),
  }),
  z.strictObject({ type: z.literal('flag'), flag: idSchema, value: z.boolean() }),
]);

const EventOutcomeSchema = z.strictObject({
  weight: z.number().int().min(1).max(1000),
  text: displayNameSchema,
  /** Bespoke banner for the risky-success cutscene; required on every risky win. */
  successHeadline: displayNameSchema.optional(),
  effects: z.array(EventEffectSchema),
  nextEventId: idSchema.optional(),
});

const EventRequirementSchema = z.strictObject({
  minMoney: safeNonnegativeIntegerSchema.optional(),
  requiredFacility: z.enum([
    'training-pitch', 'gym', 'tech-center', 'shooting-range', 'keeper-court', 'medical-bay',
    'dorm', 'scout-office', 'coaching-office', 'youth-field', 'fan-shop', 'stadium-stand',
  ]).optional(),
  requiredPersonality: z.enum(['Fiery', 'Loyal', 'Greedy', 'Joker', 'Professional', 'Timid']).optional(),
  requiresHero: z.boolean().optional(),
});

const EventChoiceSchema = z.strictObject({
  id: idSchema,
  label: displayNameSchema,
  risky: z.boolean(),
  requires: EventRequirementSchema.optional(),
  outcomes: z.array(EventOutcomeSchema).min(1),
}).refine(
  choice => choice.outcomes.reduce((sum, outcome) => sum + outcome.weight, 0) === 100,
  'event outcome weights must total 100',
).refine(
  choice => !choice.risky || choice.outcomes.length === 2,
  'risky event choices must define success first and setback second',
).refine(
  choice => !choice.risky || choice.outcomes[0]?.effects.some(
    effect => effect.type === 'flag' && effect.value,
  ) === true,
  'a risky event choice must mark its first outcome as the authored success',
).refine(
  choice => !choice.risky || (choice.outcomes[0]?.successHeadline?.trim().length ?? 0) > 0,
  'a risky event choice must author a bespoke success headline for its cutscene',
);

export const GameEventSchema = z.strictObject({
  id: idSchema,
  category: z.enum(['mystery', 'club', 'media', 'sponsor', 'player', 'medical', 'fan']),
  rarity: z.enum(['common', 'rare', 'legendary']),
  art: idSchema,
  title: displayNameSchema,
  body: displayNameSchema,
  trigger: z.strictObject({
    season: z.number().int().min(1).max(2),
    minWeek: z.number().int().min(1).max(30),
    maxWeek: z.number().int().min(1).max(30),
    requiredFlag: idSchema.optional(),
    minDivision: z.number().int().min(1).max(5).optional(),
    maxDivision: z.number().int().min(1).max(5).optional(),
    minMoney: safeNonnegativeIntegerSchema.optional(),
    requiredFacility: EventRequirementSchema.shape.requiredFacility,
    requiredPersonality: EventRequirementSchema.shape.requiredPersonality,
    requiresHero: z.boolean().optional(),
    requiresPlayer: z.boolean().optional(),
    repeatable: z.boolean().optional(),
  }).superRefine((trigger, context) => {
    if (trigger.minWeek > trigger.maxWeek) addIssue(context, ['minWeek'], 'event minWeek must not exceed maxWeek');
    if (trigger.minDivision !== undefined && trigger.maxDivision !== undefined && trigger.minDivision > trigger.maxDivision) {
      addIssue(context, ['minDivision'], 'event minDivision must not exceed maxDivision');
    }
  }),
  choices: z.array(EventChoiceSchema).min(2).max(3),
}).superRefine((event, context) => {
  addDuplicateIssues(event.choices.map(choice => choice.id), context, ['choices'], 'choice ID');
});

export const EventCatalogSchema = z.strictObject({
  schemaVersion: ContentSchemaVersion,
  tuning: z.strictObject({
    weeklyChancePercent: z.number().int().min(1).max(100),
    guaranteeAfterDryWeeks: z.number().int().min(1).max(30),
  }),
  events: z.array(GameEventSchema).min(1),
}).superRefine((catalog, context) => {
  addDuplicateIssues(catalog.events.map(event => event.id), context, ['events'], 'event ID');
});

/**
 * Flag namespaces the engine records itself rather than an authored outcome.
 * Career milestones are derived from played results in
 * `src/game/career-events.ts`, so a recognition story may gate on one even
 * though nothing in this catalog produces it.
 */
export const ENGINE_PRODUCED_FLAG_PREFIXES = ['milestone:'] as const;

const GlossaryEntrySchema = z.strictObject({
  term: displayNameSchema,
  definition: z.string().trim().min(1).max(500),
});

const GlossaryCategorySchema = z.strictObject({
  id: idSchema,
  title: displayNameSchema,
  entries: z.array(GlossaryEntrySchema).min(1),
}).superRefine((category, context) => {
  addDuplicateIssues(category.entries.map(entry => entry.term), context, ['entries'], 'glossary term');
});

export const GlossaryCatalogSchema = z.strictObject({
  schemaVersion: ContentSchemaVersion,
  categories: z.array(GlossaryCategorySchema).min(1),
}).superRefine((catalog, context) => {
  addDuplicateIssues(catalog.categories.map(category => category.id), context, ['categories'], 'glossary category');
});

/**
 * A manager's tip: one non-obvious rule, stated once, in the plainest words it
 * fits into. The body is bounded so a tip stays a card on a quiet desk rather
 * than becoming a second glossary — 200 rather than the old 400, because at
 * 400 the cards had grown into paragraphs nobody reads on a phone.
 */
const ManagerTipDestinationSchema = z.enum(['drill-shop', 'overall-sort']);
const ManagerTipSchema = z.strictObject({
  id: idSchema,
  title: displayNameSchema,
  body: z.string().trim().min(1).max(200),
  /** Only tips with somewhere useful to demonstrate the rule declare a route. */
  destination: ManagerTipDestinationSchema.optional(),
});

export const ManagerTipCatalogSchema = z.strictObject({
  schemaVersion: ContentSchemaVersion,
  tips: z.array(ManagerTipSchema).min(1),
}).superRefine((catalog, context) => {
  addDuplicateIssues(catalog.tips.map(tip => tip.id), context, ['tips'], 'manager tip');
});

/**
 * What a player says on the award rostrum: one pool for whoever won a board,
 * one for a runner-up from the manager's own squad.
 *
 * Both ceilings are duplicated rather than imported — `src/content/` must not
 * import from `src/ui/`. 64 is `MAX_ARRIVAL_LINE_LENGTH`
 * (`src/ui/player-arrival-lines.ts`), the width of one speech bubble; 30 is the
 * pool depth the in-ceremony de-dup probe is sized against. Both are asserted
 * against their UI-side counterparts in
 * `src/ui/__tests__/award-ceremony-lines.test.ts`.
 */
const MAX_CEREMONY_LINE_LENGTH = 64;
const CEREMONY_LINE_POOL_SIZE = 30;
const ceremonyLineSchema = z.string().trim().min(1).max(MAX_CEREMONY_LINE_LENGTH);

export const AwardCeremonyLinesSchema = z.strictObject({
  schemaVersion: ContentSchemaVersion,
  winner: z.array(ceremonyLineSchema).length(CEREMONY_LINE_POOL_SIZE),
  runnerUp: z.array(ceremonyLineSchema).length(CEREMONY_LINE_POOL_SIZE),
}).superRefine((pools, context) => {
  addDuplicateIssues(pools.winner, context, ['winner'], 'winner ceremony line');
  addDuplicateIssues(pools.runnerUp, context, ['runnerUp'], 'runner-up ceremony line');
});

/**
 * What the gaffer says when he decides the assistant lost it for him.
 *
 * One pool, twenty lines, no scoring or weighting: the full-time report picks
 * one by fixture so the same match always produces the same outburst. Bounded
 * to the ceremony length because it has to fit in a speech bubble beside a
 * 24-pixel-wide coach on a phone.
 */
const BLAME_LINE_POOL_SIZE = 20;

export const FulltimeBlameLinesSchema = z.strictObject({
  schemaVersion: ContentSchemaVersion,
  lines: z.array(ceremonyLineSchema).length(BLAME_LINE_POOL_SIZE),
}).superRefine((pool, context) => {
  addDuplicateIssues(pool.lines, context, ['lines'], 'full-time blame line');
});

/**
 * What the gaffer says about the result itself, one pool per kind of afternoon.
 *
 * The league reads a result by how heavily it went; the cup reads it by who it
 * was against, because a knockout tie is remembered for the opponent and a
 * Tuesday in the league is remembered for the margin. That is why the two
 * competitions bucket on different axes rather than sharing one ladder.
 *
 * Fifteen a pool is shallow enough to write well and deep enough that a season
 * of wins does not repeat itself. Bounded to the ceremony length for the same
 * reason the blame lines are: one speech bubble, one phone.
 */
const COACH_LINE_POOL_SIZE = 15;

const coachLinePool = z.array(ceremonyLineSchema).length(COACH_LINE_POOL_SIZE);

export const FulltimeCoachLinesSchema = z.strictObject({
  schemaVersion: ContentSchemaVersion,
  /** Won by three or more. */
  leagueWinBig: coachLinePool,
  /** Won by one or two. */
  leagueWinClose: coachLinePool,
  leagueDraw: coachLinePool,
  /** Lost by one or two. */
  leagueLossClose: coachLinePool,
  /** Lost by three or more. */
  leagueLossBig: coachLinePool,
  /** Beat a club a division or more above us. */
  cupWinGiant: coachLinePool,
  /** Beat a club a little above us. */
  cupWinBetter: coachLinePool,
  /** Beat a club level with us or a little below. */
  cupWinSlight: coachLinePool,
  /** Beat a club well below us. */
  cupWinRoutine: coachLinePool,
  /** Lost to a club a division or more above us. */
  cupLossStrong: coachLinePool,
  /** Lost to a club near enough our own size. */
  cupLossEven: coachLinePool,
  /** Lost to a club well below us: the tie nobody lets you forget. */
  cupLossWeak: coachLinePool,
}).superRefine((pools, context) => {
  for (const [name, lines] of Object.entries(pools)) {
    if (name === 'schemaVersion') continue;
    addDuplicateIssues(lines as readonly string[], context, [name], `${name} coach line`);
  }
});

/**
 * Sprite names a request may reference for its artwork.
 *
 * Duplicated from `src/ui/event-pixel-sprites.ts` on purpose: `src/content/`
 * must not import from `src/ui/`. A name that drifts out of this list is caught
 * by the coverage test in `src/ui/__tests__/event-pixel-sprites.test.ts`, which
 * checks the shipped catalog against the real sprite table.
 */
const REQUEST_ART_SPRITES = new Set([
  'banner-flag', 'boot', 'briefcase', 'burger', 'camera', 'chef-hat', 'cone',
  'dog', 'drink-can', 'drone', 'envelope', 'headphones', 'letter',
  'massage-table', 'microphone', 'money-bag', 'palm-tree', 'party-hat', 'plane',
  'rain-cloud', 'scarf', 'scissors', 'shirt', 'spatula', 'speaker',
  'sports-car', 'star-sparkle', 'sunglasses', 'tactics-board', 'tape-roll',
  'ticket', 'tuning-fork', 'tv',
]);

/**
 * What granting a request costs. Five archetypes, no status perks: a request
 * must never write `contractPromise`, which holds a single object per player,
 * so granting one would destroy whatever was agreed at the negotiating table.
 */
const RequestCostSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('MONEY_PLAYER'),
    wageMultiple: z.number().int().min(1).max(50),
  }),
  z.strictObject({
    kind: z.literal('MONEY_SQUAD'),
    billMultiplePercent: z.number().int().min(5).max(300),
  }),
  z.strictObject({ kind: z.literal('ABSENCE'), weeks: z.number().int().min(1).max(4) }),
  z.strictObject({ kind: z.literal('CONDITION_SQUAD'), amount: z.number().int().min(1).max(30) }),
  z.strictObject({
    kind: z.literal('DRILL_PLAYER'),
    multiplierPercent: z.number().int().min(10).max(99),
    weeks: z.number().int().min(1).max(8),
  }),
  z.strictObject({
    kind: z.literal('DRILL_SQUAD'),
    multiplierPercent: z.number().int().min(10).max(99),
    weeks: z.number().int().min(1).max(8),
  }),
]);

/** A themed reward a few squad requests carry, on top of loyalty and morale. */
const RequestGrantBonusSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('CONDITION_SQUAD'), amount: z.number().int().min(1).max(20) }),
  z.strictObject({ kind: z.literal('MORALE_SQUAD'), amount: z.number().int().min(1).max(10) }),
]);

const PlayerRequestSchema = z.strictObject({
  id: idSchema,
  title: displayNameSchema,
  line: z.string().trim().min(1).max(160),
  art: z.tuple([idSchema, idSchema]),
  cost: RequestCostSchema,
  grantBonus: RequestGrantBonusSchema.optional(),
});

const RequestCadenceSchema = z.strictObject({
  minWeeks: z.number().int().min(1).max(30),
  guaranteeWeeks: z.number().int().min(2).max(40),
  starMinWeeks: z.number().int().min(1).max(30),
  starGuaranteeWeeks: z.number().int().min(2).max(40),
}).superRefine((cadence, context) => {
  if (cadence.minWeeks >= cadence.guaranteeWeeks) {
    addIssue(context, ['minWeeks'], 'cadence minWeeks must be below guaranteeWeeks');
  }
  if (cadence.starMinWeeks >= cadence.starGuaranteeWeeks) {
    addIssue(context, ['starMinWeeks'], 'star cadence minWeeks must be below guaranteeWeeks');
  }
  if (cadence.starMinWeeks > cadence.minWeeks) {
    addIssue(context, ['starMinWeeks'], 'a squad with a star must not wait longer');
  }
});

export const PlayerRequestCatalogSchema = z.strictObject({
  schemaVersion: ContentSchemaVersion,
  tuning: z.strictObject({
    startSeason: z.number().int().min(1).max(10),
    startWeek: z.number().int().min(1).max(30),
    baseChancePercent: z.number().int().min(1).max(100),
    /**
     * The bound is `FAME_CEILING` from `src/game/pyramid.ts`, restated rather
     * than imported: nothing in `src/content/` depends on the game ring, and
     * one zod bound is not worth opening that door. A threshold above the
     * ceiling is one no player can ever cross, which would silently retire the
     * star half of `cadence` — the mirror of what the shipped 50 did to the
     * non-star half while fame still saturated at 99.
     */
    starFameThreshold: z.number().int().min(0).max(999),
    starGoalRank: z.number().int().min(1).max(5),
    /**
     * Seasons, not weeks: `CareerPlayer` carries `seasonsAtClub` and nothing
     * finer, so a week-level knob would be config that silently did nothing.
     *
     * Ships as 1: a player has to have been at the club through a season
     * transition before they start making demands. `mergeCareerPlayer`
     * (`src/game/m2-career.ts`) increments the field each transition, so a
     * launch-squad player reads 1 by season 2 — which is when requests begin —
     * while someone signed mid-season waits until the next rollover.
     */
    minSeasonsAtClub: z.number().int().min(0).max(5),
    answerWeeks: z.number().int().min(1).max(5),
    cadence: z.strictObject({
      COZY: RequestCadenceSchema,
      CHAIRMAN: RequestCadenceSchema,
    }),
  }),
  requests: z.array(PlayerRequestSchema).min(1),
}).superRefine((catalog, context) => {
  addDuplicateIssues(catalog.requests.map(request => request.id), context, ['requests'], 'request ID');
  catalog.requests.forEach((request, index) => {
    request.art.forEach((sprite, spriteIndex) => {
      if (!REQUEST_ART_SPRITES.has(sprite)) {
        addIssue(context, ['requests', index, 'art', spriteIndex], `unknown request art sprite ${sprite}`);
      }
    });
  });
});

export type PlayerRequestCatalog = z.infer<typeof PlayerRequestCatalogSchema>;
export type PlayerRequestDefinition = z.infer<typeof PlayerRequestSchema>;
export type RequestCost = z.infer<typeof RequestCostSchema>;
export type RequestGrantBonus = z.infer<typeof RequestGrantBonusSchema>;

export const SponsorProfileIdSchema = z.enum(['STEADY', 'BALANCED', 'BOLD']);
export const SponsorObjectiveLevelSchema = z.enum(['EASY', 'NORMAL', 'HARD']);
export const SponsorObjectiveKindSchema = z.enum([
  'LEAGUE_WINS',
  'LEAGUE_GOALS',
  'LEAGUE_FINISH',
]);

const SponsorProfileSchema = z.strictObject({
  monthlyPercent: z.number().int().min(1).max(500),
  objectiveLevel: SponsorObjectiveLevelSchema,
  bonusPercent: z.number().int().nonnegative().max(1_000),
  bonusPercentByObjective: z.strictObject({
    LEAGUE_WINS: z.number().int().nonnegative().max(1_000).optional(),
    LEAGUE_GOALS: z.number().int().nonnegative().max(1_000).optional(),
    LEAGUE_FINISH: z.number().int().nonnegative().max(1_000).optional(),
  }).optional(),
});

const SponsorObjectiveSchema = z.strictObject({
  id: idSchema,
  kind: SponsorObjectiveKindSchema,
  labelTemplate: z.string().trim().min(1).max(72).refine(
    label => label.includes('{target}'),
    'sponsor objective label must include {target}',
  ),
  targets: z.strictObject({
    EASY: z.number().int().positive().max(100),
    NORMAL: z.number().int().positive().max(100),
    HARD: z.number().int().positive().max(100),
  }),
  chairmanDelta: z.number().int().min(-10).max(10),
});

export const SponsorCatalogSchema = z.strictObject({
  schemaVersion: ContentSchemaVersion,
  brands: z.array(z.strictObject({
    id: idSchema,
    name: z.string().trim().min(1).max(28),
    offerLine: z.string().trim().min(1).max(96),
  })).min(9),
  profiles: z.strictObject({
    STEADY: SponsorProfileSchema,
    BALANCED: SponsorProfileSchema,
    BOLD: SponsorProfileSchema,
  }),
  objectives: z.array(SponsorObjectiveSchema).length(3),
}).superRefine((catalog, context) => {
  addDuplicateIssues(catalog.brands.map(brand => brand.id), context, ['brands'], 'sponsor brand ID');
  addDuplicateIssues(catalog.brands.map(brand => brand.name), context, ['brands'], 'sponsor brand name');
  addDuplicateIssues(catalog.objectives.map(objective => objective.id), context, ['objectives'], 'sponsor objective ID');
  addDuplicateIssues(catalog.objectives.map(objective => objective.kind), context, ['objectives'], 'sponsor objective kind');

  const expectedProfiles = {
    STEADY: {
      monthlyPercent: 105,
      objectiveLevel: 'EASY',
      bonusPercent: { LEAGUE_WINS: 25, LEAGUE_GOALS: 27, LEAGUE_FINISH: 25 },
    },
    BALANCED: {
      monthlyPercent: 100,
      objectiveLevel: 'NORMAL',
      bonusPercent: { LEAGUE_WINS: 85, LEAGUE_GOALS: 100, LEAGUE_FINISH: 110 },
    },
    BOLD: {
      monthlyPercent: 99,
      objectiveLevel: 'HARD',
      bonusPercent: { LEAGUE_WINS: 650, LEAGUE_GOALS: 650, LEAGUE_FINISH: 280 },
    },
  } as const;
  for (const profile of SponsorProfileIdSchema.options) {
    const actual = catalog.profiles[profile];
    const expected = expectedProfiles[profile];
    if (actual.monthlyPercent !== expected.monthlyPercent
      || actual.objectiveLevel !== expected.objectiveLevel
      || SponsorObjectiveKindSchema.options.some(kind => (
        (actual.bonusPercentByObjective?.[kind] ?? actual.bonusPercent)
        !== expected.bonusPercent[kind]
      ))) {
      addIssue(context, ['profiles', profile], `${profile} sponsor profile does not match the approved trade-off`);
    }
  }

  catalog.objectives.forEach((objective, index) => {
    const { EASY, NORMAL, HARD } = objective.targets;
    const ordered = objective.kind === 'LEAGUE_FINISH'
      ? EASY > NORMAL && NORMAL > HARD && objective.chairmanDelta === -1
      : EASY < NORMAL && NORMAL < HARD && objective.chairmanDelta > 0;
    if (!ordered) {
      addIssue(context, ['objectives', index], 'sponsor objective difficulty targets are not ordered correctly');
    }
  });
});

export type SponsorCatalog = z.infer<typeof SponsorCatalogSchema>;

export const LaunchContentSchema = z.strictObject({
  assistantGuide: AssistantGuideContentSchema,
  awardCeremonyLines: AwardCeremonyLinesSchema,
  fulltimeBlameLines: FulltimeBlameLinesSchema,
  fulltimeCoachLines: FulltimeCoachLinesSchema,
  clubs: ClubCatalogSchema,
  glossary: GlossaryCatalogSchema,
  onboarding: OnboardingContentSchema,
  powers: PowerCatalogSchema,
  playerRequests: PlayerRequestCatalogSchema,
  sponsors: SponsorCatalogSchema,
  tips: ManagerTipCatalogSchema,
  training: TrainingCatalogSchema,
  events: EventCatalogSchema,
}).superRefine((content, context) => {
  const powerIds = new Set(content.powers.powers.map(power => power.id));
  const eventIds = new Set(content.events.events.map(event => event.id));
  const producedFlags = new Set(
    content.events.events.flatMap(event => event.choices.flatMap(choice => choice.outcomes.flatMap(
      outcome => outcome.effects.flatMap(effect => effect.type === 'flag' ? [effect.flag] : []),
    ))),
  );
  const globalPlayerIds = new Set<string>();

  content.clubs.clubs.forEach((club, clubIndex) => {
    const playerById = new Map(club.players.map(player => [player.id, player]));
    club.players.forEach((player, playerIndex) => {
      if (globalPlayerIds.has(player.id)) {
        addIssue(context, ['clubs', 'clubs', clubIndex, 'players', playerIndex, 'id'], `duplicate global player ID ${player.id}`);
      }
      globalPlayerIds.add(player.id);
      if (player.powerId !== null && !powerIds.has(player.powerId)) {
        addIssue(context, ['clubs', 'clubs', clubIndex, 'players', playerIndex, 'powerId'], `unknown power ID ${player.powerId}`);
      }
      if (player.licensed && player.powerId === null) {
        addIssue(context, ['clubs', 'clubs', clubIndex, 'players', playerIndex, 'licensed'], 'licensed player must own a power');
      }
      if (player.onHeroWage && player.powerId === null) {
        addIssue(context, ['clubs', 'clubs', clubIndex, 'players', playerIndex, 'onHeroWage'], 'hero wage requires a power');
      }
    });

    const lineup = club.startingLineup.map((playerId, lineupIndex) => {
      const player = playerById.get(playerId);
      if (player === undefined) {
        addIssue(context, ['clubs', 'clubs', clubIndex, 'startingLineup', lineupIndex], `unknown lineup player ID ${playerId}`);
      }
      return player;
    });
    if (lineup[0] !== undefined && lineup[0].role !== 'GK') {
      addIssue(context, ['clubs', 'clubs', clubIndex, 'startingLineup', 0], 'starting lineup slot 0 must be a goalkeeper');
    }
    if (lineup.filter(player => player?.role === 'GK').length !== 1) {
      addIssue(context, ['clubs', 'clubs', clubIndex, 'startingLineup'], 'starting lineup must contain exactly one goalkeeper');
    }
    lineup.forEach((player, lineupIndex) => {
      if (player?.powerId !== null && player?.licensed === false) {
        addIssue(context, ['clubs', 'clubs', clubIndex, 'startingLineup', lineupIndex], 'starting hero must be licensed');
      }
    });
    const licensedHeroes = lineup.filter(player => player?.licensed && player.powerId !== null).length;
    if (licensedHeroes > 2) {
      addIssue(context, ['clubs', 'clubs', clubIndex, 'startingLineup'], 'M1 starting lineup cannot exceed two licensed heroes');
    }
  });

  content.events.events.forEach((event, eventIndex) => {
    const requiredFlag = event.trigger.requiredFlag;
    const engineProduced = requiredFlag !== undefined
      && ENGINE_PRODUCED_FLAG_PREFIXES.some(prefix => requiredFlag.startsWith(prefix));
    if (requiredFlag !== undefined && !engineProduced && !producedFlags.has(requiredFlag)) {
      addIssue(
        context,
        ['events', 'events', eventIndex, 'trigger', 'requiredFlag'],
        `unknown required flag ${event.trigger.requiredFlag}`,
      );
    }
    event.choices.forEach((choice, choiceIndex) => {
      choice.outcomes.forEach((outcome, outcomeIndex) => {
        if (outcome.nextEventId !== undefined && !eventIds.has(outcome.nextEventId)) {
          addIssue(
            context,
            ['events', 'events', eventIndex, 'choices', choiceIndex, 'outcomes', outcomeIndex, 'nextEventId'],
            `unknown next event ID ${outcome.nextEventId}`,
          );
        }
      });
    });
  });
});

export type LaunchPlayer = z.infer<typeof LaunchPlayerSchema>;
export type LaunchClub = z.infer<typeof LaunchClubSchema>;
export type ClubCatalog = z.infer<typeof ClubCatalogSchema>;
export type PowerDefinition = z.infer<typeof PowerDefinitionSchema>;
export type PowerCatalog = z.infer<typeof PowerCatalogSchema>;
export type OnboardingContent = z.infer<typeof OnboardingContentSchema>;
export type AssistantGuideSequenceId = z.infer<typeof AssistantGuideSequenceIdSchema>;
export type AssistantGuideFocus = z.infer<typeof AssistantGuideFocusSchema>;
export type AssistantGuideDestination = z.infer<typeof AssistantGuideDestinationSchema>;
export type AssistantGuideContent = z.infer<typeof AssistantGuideContentSchema>;
export type AwardCeremonyLines = z.infer<typeof AwardCeremonyLinesSchema>;
export type FulltimeBlameLines = z.infer<typeof FulltimeBlameLinesSchema>;
export type FulltimeCoachLines = z.infer<typeof FulltimeCoachLinesSchema>;
/** Which pool of the gaffer's lines an afternoon draws from. */
export type FulltimeCoachLinePool = Exclude<keyof FulltimeCoachLines, 'schemaVersion'>;
export type TrainingDrill = z.infer<typeof TrainingDrillSchema>;
export type TrainingCatalog = z.infer<typeof TrainingCatalogSchema>;
export type GameEvent = z.infer<typeof GameEventSchema>;
export type EventCatalog = z.infer<typeof EventCatalogSchema>;
export type GlossaryCatalog = z.infer<typeof GlossaryCatalogSchema>;
export type ManagerTipDestination = z.infer<typeof ManagerTipDestinationSchema>;
export type ManagerTipCatalog = z.infer<typeof ManagerTipCatalogSchema>;
export type LaunchContent = z.infer<typeof LaunchContentSchema>;

function addDuplicateIssues(
  values: readonly string[],
  context: z.RefinementCtx,
  path: PropertyKey[],
  label: string,
): void {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value)) addIssue(context, [...path, index], `${label}s must be unique; duplicate ${value}`);
    seen.add(value);
  });
}

function addIssue(context: z.RefinementCtx, path: PropertyKey[], message: string): void {
  context.addIssue({ code: 'custom', path, message });
}
