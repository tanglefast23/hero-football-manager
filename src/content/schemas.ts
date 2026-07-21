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
  'MAGNET_TOUCH',
  'DECOY_DOUBLE',
  'FUTURE_SIGHT',
  'SUPER_STRENGTH',
  'WEB_TRAP',
  'ELASTIC_KEEPER',
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
  powers: z.array(PowerDefinitionSchema).length(12),
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
  })).length(12),
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
  'first-injury',
  'first-emergency-loan',
  'first-transfer-request',
  'retirement',
  'club-legacy',
  'board-ultimatum',
  'board-protection',
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
    creation: z.strictObject({ title: displayNameSchema, body: displayNameSchema }),
    difficulty: z.strictObject({ title: displayNameSchema, body: displayNameSchema }),
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

const DrillGainsSchema = z.strictObject({
  pac: z.number().int().min(1).max(9).optional(),
  sho: z.number().int().min(1).max(9).optional(),
  pas: z.number().int().min(1).max(9).optional(),
  def: z.number().int().min(1).max(9).optional(),
  tec: z.number().int().min(1).max(9).optional(),
  sta: z.number().int().min(1).max(9).optional(),
  ref: z.number().int().min(1).max(9).optional(),
}).refine(gains => Object.keys(gains).length > 0, 'a drill must improve at least one attribute');

export const TrainingDrillSchema = z.strictObject({
  id: idSchema,
  name: displayNameSchema,
  moneyCost: safeNonnegativeIntegerSchema,
  tpCost: safeNonnegativeIntegerSchema,
  gains: DrillGainsSchema,
});

export const TrainingCatalogSchema = z.strictObject({
  schemaVersion: ContentSchemaVersion,
  maxFocusDrillsPerWeek: z.literal(3),
  baseConditioning: TrainingDrillSchema,
  focusDrills: z.array(TrainingDrillSchema).length(6),
}).superRefine((catalog, context) => {
  addDuplicateIssues(
    [catalog.baseConditioning.id, ...catalog.focusDrills.map(drill => drill.id)],
    context,
    ['focusDrills'],
    'drill ID',
  );
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

export const LaunchContentSchema = z.strictObject({
  assistantGuide: AssistantGuideContentSchema,
  clubs: ClubCatalogSchema,
  glossary: GlossaryCatalogSchema,
  onboarding: OnboardingContentSchema,
  powers: PowerCatalogSchema,
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
    if (event.trigger.requiredFlag !== undefined && !producedFlags.has(event.trigger.requiredFlag)) {
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
export type TrainingDrill = z.infer<typeof TrainingDrillSchema>;
export type TrainingCatalog = z.infer<typeof TrainingCatalogSchema>;
export type GameEvent = z.infer<typeof GameEventSchema>;
export type EventCatalog = z.infer<typeof EventCatalogSchema>;
export type GlossaryCatalog = z.infer<typeof GlossaryCatalogSchema>;
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
