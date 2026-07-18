import { z } from 'zod';

export const ContentSchemaVersion = z.literal(1);
export const RoleSchema = z.enum(['GK', 'DEF', 'MID', 'FWD']);
export const PowerIdSchema = z.enum(['SUPER_SPEED', 'SUPER_STRENGTH', 'FIRE_TORCH']);
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
  players: z.array(LaunchPlayerSchema).length(13),
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
  usefulContext: z.enum(['BREAKAWAY', 'MARKED_FINAL_THIRD', 'DANGEROUS_CARRIER']),
  requiresTarget: z.boolean(),
  windupTicks: z.number().int().min(1).max(100),
});

export const PowerCatalogSchema = z.strictObject({
  schemaVersion: ContentSchemaVersion,
  powers: z.array(PowerDefinitionSchema).length(3),
}).superRefine((catalog, context) => {
  addDuplicateIssues(catalog.powers.map(power => power.id), context, ['powers'], 'power ID');
});

export const OnboardingOriginSchema = z.enum(['CHEMICAL', 'CREATURE', 'SERUM']);
export const OnboardingContentSchema = z.strictObject({
  schemaVersion: ContentSchemaVersion,
  collapse: displayNameSchema,
  prompt: displayNameSchema,
  choices: z.array(z.strictObject({
    origin: OnboardingOriginSchema,
    label: displayNameSchema,
    hint: displayNameSchema,
    reveal: displayNameSchema,
  })).length(3),
}).superRefine((content, context) => {
  addDuplicateIssues(content.choices.map(choice => choice.origin), context, ['choices'], 'origin');
  for (const origin of OnboardingOriginSchema.options) {
    if (!content.choices.some(choice => choice.origin === origin)) {
      addIssue(context, ['choices'], `missing onboarding origin ${origin}`);
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
  z.strictObject({
    type: z.literal('awakenPower'),
    powerIds: z.array(PowerIdSchema).min(1),
  }),
  z.strictObject({ type: z.literal('flag'), flag: idSchema, value: z.boolean() }),
]);

const EventOutcomeSchema = z.strictObject({
  weight: z.number().int().min(1).max(1000),
  text: displayNameSchema,
  effects: z.array(EventEffectSchema),
  nextEventId: idSchema.optional(),
});

const EventChoiceSchema = z.strictObject({
  id: idSchema,
  label: displayNameSchema,
  risky: z.boolean(),
  outcomes: z.array(EventOutcomeSchema).min(1),
}).refine(
  choice => choice.outcomes.reduce((sum, outcome) => sum + outcome.weight, 0) === 100,
  'event outcome weights must total 100',
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
  }).refine(trigger => trigger.minWeek <= trigger.maxWeek, 'event minWeek must not exceed maxWeek'),
  choices: z.array(EventChoiceSchema).min(2).max(3),
}).superRefine((event, context) => {
  addDuplicateIssues(event.choices.map(choice => choice.id), context, ['choices'], 'choice ID');
});

export const EventCatalogSchema = z.strictObject({
  schemaVersion: ContentSchemaVersion,
  tuning: z.strictObject({
    weeklyChancePercent: z.literal(18),
    guaranteeAfterDryWeeks: z.literal(8),
    baseAwakeningChancePercent: z.literal(8),
    pityIncrementPercent: z.literal(6),
  }),
  events: z.array(GameEventSchema).min(2),
}).superRefine((catalog, context) => {
  addDuplicateIssues(catalog.events.map(event => event.id), context, ['events'], 'event ID');
});

export const LaunchContentSchema = z.strictObject({
  clubs: ClubCatalogSchema,
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
        outcome.effects.forEach((effect, effectIndex) => {
          if (effect.type !== 'awakenPower') return;
          effect.powerIds.forEach((powerId, powerIndex) => {
            if (!powerIds.has(powerId)) {
              addIssue(
                context,
                ['events', 'events', eventIndex, 'choices', choiceIndex, 'outcomes', outcomeIndex, 'effects', effectIndex, 'powerIds', powerIndex],
                `unknown awakening power ID ${powerId}`,
              );
            }
          });
        });
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
export type TrainingDrill = z.infer<typeof TrainingDrillSchema>;
export type TrainingCatalog = z.infer<typeof TrainingCatalogSchema>;
export type GameEvent = z.infer<typeof GameEventSchema>;
export type EventCatalog = z.infer<typeof EventCatalogSchema>;
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
