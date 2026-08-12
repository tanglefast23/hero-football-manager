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
export const AttributeSchema = z.enum([
  'pac',
  'sho',
  'pas',
  'def',
  'tec',
  'sta',
  'ref',
]);
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
const safeNonnegativeIntegerSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
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

export const LaunchClubSchema = z
  .strictObject({
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
  })
  .superRefine((club, context) => {
    addDuplicateIssues(
      club.players.map((player) => player.id),
      context,
      ['players'],
      'player ID',
    );
    addDuplicateIssues(
      club.startingLineup,
      context,
      ['startingLineup'],
      'lineup player ID',
    );
  });

export const ClubCatalogSchema = z
  .strictObject({
    schemaVersion: ContentSchemaVersion,
    clubs: z.array(LaunchClubSchema).length(10),
  })
  .superRefine((catalog, context) => {
    addDuplicateIssues(
      catalog.clubs.map((club) => club.id),
      context,
      ['clubs'],
      'club ID',
    );
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

export const PowerCatalogSchema = z
  .strictObject({
    schemaVersion: ContentSchemaVersion,
    awakening: z.strictObject({
      postMatchChancePercent: z.literal(10),
      /**
       * The roll once the season already has one hero. A second in the same
       * season is meant to be a surprise, not the expected second half of the
       * year, so it is a fifth of the first chance rather than a shade off it.
       */
      secondInSeasonChancePercent: z.literal(2),
      /** Counting the campaign's guaranteed first hero: season 1 gets one more. */
      maxPerSeason: z.literal(2),
      minimumMatchesBetween: z.literal(3),
    }),
    powers: z.array(PowerDefinitionSchema).length(17),
  })
  .superRefine((catalog, context) => {
    addDuplicateIssues(
      catalog.powers.map((power) => power.id),
      context,
      ['powers'],
      'power ID',
    );
  });

export const OnboardingContentSchema = z
  .strictObject({
    schemaVersion: ContentSchemaVersion,
    limp: displayNameSchema,
    triggers: z
      .array(
        z.strictObject({
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
        }),
      )
      .length(15),
    powers: z
      .array(
        z.strictObject({
          powerId: PowerIdSchema,
          omen: displayNameSchema,
          reveal: displayNameSchema,
        }),
      )
      .min(16)
      .max(20),
  })
  .superRefine((content, context) => {
    addDuplicateIssues(
      content.triggers.map((trigger) => trigger.id),
      context,
      ['triggers'],
      'awakening trigger',
    );
    addDuplicateIssues(
      content.powers.map((power) => power.powerId),
      context,
      ['powers'],
      'power',
    );
    for (const powerId of PowerIdSchema.options) {
      if (!content.powers.some((power) => power.powerId === powerId)) {
        addIssue(context, ['powers'], `missing awakening copy for ${powerId}`);
      }
    }
  });

export const AssistantGuideSequenceIdSchema = z.enum([
  'management-intro',
  'desk-intro',
  'expired-contract',
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
  /** The two money-making buildings, shown to a club that has just been bailed out. */
  'income-facilities',
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

const AssistantGuidePageSchema = z
  .strictObject({
    kicker: displayNameSchema,
    title: displayNameSchema,
    body: z.array(displayNameSchema).min(1).max(2),
    focus: AssistantGuideFocusSchema,
    objective: displayNameSchema.optional(),
    buttonLabel: displayNameSchema,
    navItems: z
      .array(
        z.strictObject({
          tab: z.enum(['HOME', 'SQUAD', 'CLUB', 'MARKET', 'LEAGUE']),
          detail: displayNameSchema,
        }),
      )
      .length(5)
      .optional(),
  })
  .superRefine((page, context) => {
    if (page.focus === 'navigation' && page.navItems === undefined) {
      addIssue(
        context,
        ['navItems'],
        'navigation guide page requires all five nav items',
      );
    }
    if (page.focus !== 'navigation' && page.navItems !== undefined) {
      addIssue(
        context,
        ['navItems'],
        'only navigation guide pages may define nav items',
      );
    }
  });

/**
 * The sequences Bert delivers by walking onto the screen that raised them, as
 * opposed to the ones the weekly desk hands out.
 *
 * Membership is by exclusion, so adding an id to the enum cannot silently opt it
 * out of the inbox rules — a new sequence is an inbox sequence unless it is
 * named here.
 */
const SCREEN_DELIVERED_SEQUENCE_IDS = [
  'management-intro',
  'desk-intro',
  'expired-contract',
] as const satisfies readonly z.infer<typeof AssistantGuideSequenceIdSchema>[];

const INBOX_DELIVERED_SEQUENCE_IDS: ReadonlySet<string> = new Set(
  AssistantGuideSequenceIdSchema.options.filter(
    (id) => !(SCREEN_DELIVERED_SEQUENCE_IDS as readonly string[]).includes(id),
  ),
);

const AssistantGuideSequenceSchema = z
  .strictObject({
    id: AssistantGuideSequenceIdSchema,
    inbox: z
      .strictObject({
        title: displayNameSchema,
        detail: displayNameSchema,
      })
      .optional(),
    destination: AssistantGuideDestinationSchema.optional(),
    pages: z.array(AssistantGuidePageSchema).min(1).max(4),
  })
  .superRefine((sequence, context) => {
    if (INBOX_DELIVERED_SEQUENCE_IDS.has(sequence.id)) {
      if (sequence.inbox === undefined) {
        addIssue(context, ['inbox'], 'M2 assistant guides require inbox copy');
      }
      if (sequence.destination === undefined) {
        addIssue(
          context,
          ['destination'],
          'M2 assistant guides require a destination',
        );
      }
      return;
    }
    // A sequence Bert delivers by walking onto the screen that raised it has no
    // desk row to title and nowhere to send you — it is already there. Requiring
    // inbox copy would mean authoring a card nothing ever renders.
    if (sequence.inbox !== undefined) {
      addIssue(
        context,
        ['inbox'],
        'screen-delivered assistant guides have no inbox row',
      );
    }
    if (sequence.destination !== undefined) {
      addIssue(
        context,
        ['destination'],
        'screen-delivered assistant guides have no destination',
      );
    }
  });

export const AssistantGuideContentSchema = z
  .strictObject({
    schemaVersion: ContentSchemaVersion,
    assistant: z.strictObject({
      name: displayNameSchema,
      role: displayNameSchema,
      portraitArchetype: z.literal('GAFFER'),
    }),
    m4Fiction: z.strictObject({
      accessibility: z.strictObject({
        title: displayNameSchema,
        body: displayNameSchema,
      }),
      events: z.strictObject({
        title: displayNameSchema,
        body: displayNameSchema,
      }),
      seasonRecap: z.strictObject({
        title: displayNameSchema,
        body: displayNameSchema,
      }),
    }),
    sequences: z
      .array(AssistantGuideSequenceSchema)
      .length(AssistantGuideSequenceIdSchema.options.length),
  })
  .superRefine((content, context) => {
    addDuplicateIssues(
      content.sequences.map((sequence) => sequence.id),
      context,
      ['sequences'],
      'guide sequence ID',
    );
    for (const sequenceId of AssistantGuideSequenceIdSchema.options) {
      if (!content.sequences.some((sequence) => sequence.id === sequenceId)) {
        addIssue(
          context,
          ['sequences'],
          `missing assistant guide sequence ${sequenceId}`,
        );
      }
    }
  });

// The ceiling is the top tier's gain: the per-drill table below pins every
// authored value exactly, so this bound only catches a gain invented outside it.
const MAXIMUM_DRILL_GAIN = 23;
const DrillGainsSchema = z
  .strictObject({
    pac: z.number().int().min(1).max(MAXIMUM_DRILL_GAIN).optional(),
    sho: z.number().int().min(1).max(MAXIMUM_DRILL_GAIN).optional(),
    pas: z.number().int().min(1).max(MAXIMUM_DRILL_GAIN).optional(),
    def: z.number().int().min(1).max(MAXIMUM_DRILL_GAIN).optional(),
    tec: z.number().int().min(1).max(MAXIMUM_DRILL_GAIN).optional(),
    sta: z.number().int().min(1).max(MAXIMUM_DRILL_GAIN).optional(),
    ref: z.number().int().min(1).max(MAXIMUM_DRILL_GAIN).optional(),
  })
  .refine(
    (gains) => Object.keys(gains).length === 1,
    'a drill must improve exactly one attribute',
  );

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
 * The lower keeper ladder preserves that exposure-based distinction. The pin
 * stays exact so content cannot drift; it is per path rather than global.
 */
const FOCUS_DRILL_PATHS = [
  { id: 'sprints', name: 'Sprints', attribute: 'pac' },
  { id: 'finishing', name: 'Finishing', attribute: 'sho' },
  { id: 'rondo', name: 'Rondo', attribute: 'pas' },
  { id: 'duels', name: 'Duels', attribute: 'def' },
  { id: 'first-touch', name: 'First Touch', attribute: 'tec' },
  { id: 'circuit', name: 'Circuit', attribute: 'sta' },
  {
    id: 'keeper-drills',
    name: 'Keeper Drills',
    attribute: 'ref',
    gains: [1, 2, 3, 3, 4],
  },
] as const;
// Tier labels are Arabic digits: the Roman "I" rendered as a bare bar in the
// UI font and read as a serif-less 1.
// The outfield ladder rises by one point per tier. Higher-division facilities
// and player modifiers compound every base point, so the late tiers stay close
// to the opening tier instead of recreating the old late-career acceleration.
const FOCUS_DRILL_TIERS = [
  { suffix: '', label: '1', gain: 3 },
  { suffix: '-ii', label: '2', gain: 4 },
  { suffix: '-iii', label: '3', gain: 5 },
  { suffix: '-iv', label: '4', gain: 6 },
  { suffix: '-v', label: '5', gain: 7 },
] as const;
const EXPECTED_FOCUS_DRILLS = FOCUS_DRILL_PATHS.flatMap((path) =>
  FOCUS_DRILL_TIERS.map((tier, tierIndex) => ({
    id: `${path.id}${tier.suffix}`,
    name: `${path.name} ${tier.label}`,
    attribute: path.attribute,
    gain: 'gains' in path ? path.gains[tierIndex] : tier.gain,
  })),
);

export const TrainingDrillSchema = z.strictObject({
  id: idSchema,
  name: displayNameSchema,
  moneyCost: safeNonnegativeIntegerSchema,
  tpCost: safeNonnegativeIntegerSchema,
  gains: DrillGainsSchema,
});

export const TrainingCatalogSchema = z
  .strictObject({
    schemaVersion: ContentSchemaVersion,
    focusDrills: z
      .array(TrainingDrillSchema)
      .length(FOCUS_DRILL_PATHS.length * FOCUS_DRILL_TIERS.length),
  })
  .superRefine((catalog, context) => {
    addDuplicateIssues(
      catalog.focusDrills.map((drill) => drill.id),
      context,
      ['focusDrills'],
      'drill ID',
    );
    const expectedById = new Map(
      EXPECTED_FOCUS_DRILLS.map((drill) => [drill.id, drill]),
    );
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
      if (
        gains.length === 1 &&
        (gains[0][0] !== expected.attribute || gains[0][1] !== expected.gain)
      ) {
        addIssue(
          context,
          ['focusDrills', index, 'gains'],
          `${drill.id} must grant exactly +${expected.gain} ${expected.attribute.toUpperCase()}`,
        );
      }
    });
    for (const expected of EXPECTED_FOCUS_DRILLS) {
      if (!catalog.focusDrills.some((drill) => drill.id === expected.id)) {
        addIssue(
          context,
          ['focusDrills'],
          `missing focus drill ${expected.id}`,
        );
      }
    }
  });

const EventEffectSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('money'),
    amount: z.number().int().min(-100000).max(100000),
  }),
  /**
   * Sell the selected player for one authored fee.
   *
   * This is not a `money` effect plus suggestive prose. The market transaction
   * also moves the player, repairs the lineup, moves his wage, clears promises
   * and requests, and records the transfer. Keeping that whole meaning in one
   * effect prevents a card from paying a "fee" while the player stays put.
   */
  z.strictObject({
    type: z.literal('playerSale'),
    fee: z.number().int().min(1).max(100000),
  }),
  z.strictObject({
    type: z.literal('tp'),
    amount: z.number().int().min(-1000).max(1000),
  }),
  z.strictObject({
    type: z.literal('morale'),
    amount: z.number().int().min(-100).max(100),
  }),
  z.strictObject({
    type: z.literal('fans'),
    amount: z.number().int().min(-10000).max(10000),
  }),
  z.strictObject({
    type: z.literal('injury'),
    weeks: z.number().int().min(1).max(8),
  }),
  /**
   * A heal. `injury` can only ever lengthen an absence (it resolves through
   * `max`), so shortening one needs its own effect and its own sign.
   */
  z.strictObject({
    type: z.literal('injuryDelta'),
    weeks: z.number().int().min(-3).max(-1),
  }),
  /**
   * Squad-wide morale, said out loud.
   *
   * This used to be implicit: a `morale` effect on an event with no selected
   * player fell through to every player at the club. Two different meanings on
   * one type, distinguished by something the outcome never states. `morale` is
   * now always the selected player; this is always the room.
   */
  z.strictObject({
    type: z.literal('squadMorale'),
    amount: z.number().int().min(-100).max(100),
  }),
  z.strictObject({
    type: z.literal('statDelta'),
    attribute: AttributeSchema,
    amount: z.number().int().min(-10).max(10),
  }),
  /**
   * An attribute change measured in the club's own training sessions.
   *
   * A flat number cannot stay meaningful: the drill ladder runs +4 to +22 a
   * session, so a fixed +2 is 0.7% of a season's training at tier 1 and 0.1% at
   * tier 5 — it decays to noise exactly as the club grows into the content.
   * Sessions hold their value as a fraction of a season at every tier.
   *
   * Resolved against the drill the club has actually bought, never a table
   * copied into the engine — see `resolveSessionPoints`. Losses are capped at
   * one session because two, at tier 5, is 44 points off a single attribute.
   */
  z.strictObject({
    type: z.literal('statDeltaSessions'),
    attribute: AttributeSchema,
    sessions: z.number().int().min(-1).max(4),
  }),
  /**
   * A permanent change to the coach the manager pointed at.
   *
   * `motivator` counts half-levels, not percent, because that is the shape of
   * the plumbing — `coachMotivatorStrengthHalfLevels` returns an integer, two
   * per head level and one per assistant level, and a percent field would have
   * to be converted back and would round wrong.
   */
  z.strictObject({
    type: z.literal('coachBoost'),
    facet: z.enum(['training', 'tp', 'motivator']),
    amount: z.number().int().min(-5).max(5),
  }),
  /**
   * Retraining, not promotion: the coach swaps his second specialty for another
   * one. Same count, same level — only *where* his bonus lands moves, so it can
   * never be a power gain.
   */
  z.strictObject({
    type: z.literal('coachSpecialty'),
    to: z.enum([
      'ATTACK',
      'DEFENSE',
      'FITNESS',
      'TECHNIQUE',
      'GOALKEEPING',
      'MOTIVATOR',
    ]),
  }),
  /**
   * A permanent change to how well one building works. Four named effects
   * rather than one "output" percent because the seven facility benefits are
   * not the same kind of number — the dorm's is four points a level, which no
   * sensible percentage can move.
   */
  z.strictObject({
    type: z.literal('facilityTpBonus'),
    percent: z.number().int().min(-15).max(20),
  }),
  z.strictObject({
    type: z.literal('facilityTrainingBonus'),
    percent: z.number().int().min(-15).max(20),
  }),
  z.strictObject({
    type: z.literal('facilityRecoveryBonus'),
    amount: z.number().int().min(-2).max(3),
  }),
  z.strictObject({
    type: z.literal('facilityIncomeBonus'),
    percent: z.number().int().min(-15).max(20),
  }),
  /** Changes the selected scouted player's selling-club asking fee. */
  z.strictObject({
    type: z.literal('transferFeePercent'),
    percent: z.number().int().min(-20).max(20),
  }),
  z.strictObject({
    type: z.literal('loyalty'),
    amount: z.number().int().min(-25).max(25),
  }),
  z.strictObject({
    type: z.literal('condition'),
    amount: z.number().int().min(-30).max(30),
  }),
  z.strictObject({
    type: z.literal('fame'),
    amount: z.number().int().min(-50).max(50),
  }),
  z.strictObject({
    type: z.literal('flag'),
    flag: idSchema,
    value: z.boolean(),
  }),
]);

/**
 * Effect types the engine reads with `.find`, so a second one in the same
 * outcome would be silently dropped rather than summed (`money`, `tp` and
 * `fans` are summed and are deliberately absent from this list).
 *
 * Rejected at build time rather than summed at runtime: the shipped catalog
 * has no duplicates, so the gate costs nothing and removes the whole class.
 */
const SINGULAR_EFFECT_TYPES = [
  'playerSale',
  'morale',
  'squadMorale',
  'injury',
  'injuryDelta',
  'statDelta',
  'loyalty',
  'condition',
  'fame',
  'coachSpecialty',
  'facilityTpBonus',
  'facilityTrainingBonus',
  'facilityRecoveryBonus',
  'facilityIncomeBonus',
  'transferFeePercent',
] as const;

/** Coach effects a story may point at, and the trigger each one requires. */
const COACH_EFFECT_TYPES = ['coachBoost', 'coachSpecialty'] as const;

/** Facility effects, which need a building to point at for the same reason. */
const FACILITY_EFFECT_TYPES = [
  'facilityTpBonus',
  'facilityTrainingBonus',
  'facilityRecoveryBonus',
  'facilityIncomeBonus',
] as const;

/**
 * Which building types actually read each facility effect.
 *
 * The failure this prevents is silent: a story that offers a dorm and pays a
 * training bonus writes a field the dorm's benefit never reads, so the panel
 * says the building improved and not one number moves. An event may only offer
 * types that can read every effect it authors.
 */
const FACILITY_EFFECT_READERS: Readonly<Record<string, readonly string[]>> = {
  facilityTpBonus: ['training-pitch'],
  facilityTrainingBonus: [
    'training-pitch',
    'gym',
    'tech-center',
    'shooting-range',
    'keeper-court',
  ],
  facilityRecoveryBonus: ['dorm'],
  facilityIncomeBonus: ['fan-shop', 'stadium-stand'],
};

const EventOutcomeSchema = z
  .strictObject({
    weight: z.number().int().min(1).max(1000),
    /**
     * Stable within its choice, and the anchor for this outcome's translations
     * (`event.<eventId>.<choiceId>.<outcomeId>.text`).
     *
     * Required rather than optional, and stored rather than derived from the
     * array position: keying a translation by index means a later reorder
     * silently reassigns every translated outcome to the wrong branch, and every
     * key would still resolve — so no other gate would catch it.
     */
    id: idSchema,
    text: displayNameSchema,
    /** Bespoke banner for the risky-success cutscene; required on every risky win. */
    successHeadline: displayNameSchema.optional(),
    effects: z.array(EventEffectSchema),
    nextEventId: idSchema.optional(),
  })
  .refine(
    (outcome) =>
      SINGULAR_EFFECT_TYPES.every(
        (type) =>
          outcome.effects.filter((effect) => effect.type === type).length <= 1,
      ),
    'an outcome may carry at most one effect of each singular type — the engine reads them with find(), so a second is dropped rather than summed',
  );

const EventRequirementSchema = z.strictObject({
  minMoney: safeNonnegativeIntegerSchema.optional(),
  requiredFacility: z
    .enum([
      'training-pitch',
      'gym',
      'tech-center',
      'shooting-range',
      'keeper-court',
      'medical-bay',
      'dorm',
      'scout-office',
      'coaching-office',
      'youth-field',
      'fan-shop',
      'stadium-stand',
    ])
    .optional(),
  requiredPersonality: z
    .enum(['Fiery', 'Loyal', 'Greedy', 'Joker', 'Professional', 'Timid'])
    .optional(),
  requiresHero: z.boolean().optional(),
});

const EventChoiceSchema = z
  .strictObject({
    id: idSchema,
    label: displayNameSchema,
    risky: z.boolean(),
    requires: EventRequirementSchema.optional(),
    outcomes: z.array(EventOutcomeSchema).min(1),
  })
  .refine(
    (choice) =>
      choice.outcomes.reduce((sum, outcome) => sum + outcome.weight, 0) === 100,
    'event outcome weights must total 100',
  )
  .refine(
    (choice) => !choice.risky || choice.outcomes.length === 2,
    'risky event choices must define success first and setback second',
  )
  .refine(
    (choice) =>
      !choice.risky ||
      choice.outcomes[0]?.effects.some(
        (effect) => effect.type === 'flag' && effect.value,
      ) === true,
    'a risky event choice must mark its first outcome as the authored success',
  )
  .refine(
    (choice) =>
      !choice.risky ||
      (choice.outcomes[0]?.successHeadline?.trim().length ?? 0) > 0,
    'a risky event choice must author a bespoke success headline for its cutscene',
  );

export const GameEventSchema = z
  .strictObject({
    id: idSchema,
    category: z.enum([
      'mystery',
      'club',
      'media',
      'sponsor',
      'player',
      'medical',
      'fan',
    ]),
    rarity: z.enum(['common', 'rare', 'legendary']),
    art: idSchema,
    title: displayNameSchema,
    body: displayNameSchema,
    trigger: z
      .strictObject({
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
        /** Uses a Market list instead of the signed first-team squad. */
        requiresPlayerSource: z
          .enum(['YOUTH_OFFERS', 'TRANSFER_TARGETS'])
          .optional(),
        /** Prose that names a position: the picker offers only that role. */
        requiresPlayerRole: RoleSchema.optional(),
        /**
         * Drops the club's heroes from the picker, for a story whose prose has
         * the hero standing opposite the chosen player rather than being him.
         * Without it, a club whose only hero is a defender can be handed a card
         * asking him to mark himself.
         */
        excludesHeroes: z.boolean().optional(),
        /** The card asks the manager to point at the head coach or the assistant. */
        requiresCoach: z.boolean().optional(),
        /** Optional staff-slot restriction for prose that explicitly names one role. */
        requiresCoachRole: z.enum(['HEAD', 'ASSISTANT']).optional(),
        /**
         * The story is about the two of them disagreeing, so it needs both slots
         * filled — which means it cannot appear before the Coaching Office is up.
         */
        requiresBothCoaches: z.boolean().optional(),
        /**
         * The card asks the manager to point at a building. The list narrows which
         * types are offered; an event that admits several must map every one of
         * them to an effect, or the picker could hand it a building it cannot act
         * on. Scout Office and Coaching Office are not targetable — a shortlist
         * size and a boolean unlock cannot take a percentage.
         */
        requiresFacility: z
          .array(
            z.enum([
              'training-pitch',
              'gym',
              'tech-center',
              'shooting-range',
              'keeper-court',
              'dorm',
              'youth-field',
              'fan-shop',
              'stadium-stand',
            ]),
          )
          .min(1)
          .optional(),
        repeatable: z.boolean().optional(),
      })
      .superRefine((trigger, context) => {
        if (trigger.minWeek > trigger.maxWeek)
          addIssue(
            context,
            ['minWeek'],
            'event minWeek must not exceed maxWeek',
          );
        if (
          trigger.minDivision !== undefined &&
          trigger.maxDivision !== undefined &&
          trigger.minDivision > trigger.maxDivision
        ) {
          addIssue(
            context,
            ['minDivision'],
            'event minDivision must not exceed maxDivision',
          );
        }
        if (
          trigger.requiresCoachRole !== undefined &&
          trigger.requiresCoach !== true
        ) {
          addIssue(
            context,
            ['requiresCoachRole'],
            'requiresCoachRole requires requiresCoach',
          );
        }
        if (
          trigger.requiresPlayerSource !== undefined &&
          trigger.requiresPlayer !== true
        ) {
          addIssue(
            context,
            ['requiresPlayerSource'],
            'requiresPlayerSource requires requiresPlayer',
          );
        }
      }),
    choices: z.array(EventChoiceSchema).min(2).max(3),
  })
  .superRefine((event, context) => {
    addDuplicateIssues(
      event.choices.map((choice) => choice.id),
      context,
      ['choices'],
      'choice ID',
    );
    const targetKinds = [
      event.trigger.requiresPlayer === true,
      event.trigger.requiresCoach === true,
      event.trigger.requiresFacility !== undefined,
    ].filter(Boolean).length;
    if (targetKinds > 1) {
      addIssue(
        context,
        ['trigger'],
        'an event may require only one target kind',
      );
    }
    /**
     * A player effect needs a player, and the engine will not guess one.
     *
     * `morale`, `injury` and `statDelta` all land on the event's selected player.
     * Before this rule, an event that authored one without `requiresPlayer` did
     * not fail — `morale` quietly became a squad-wide effect and the other two
     * were dropped on the floor. Both readings are now unreachable: squad morale
     * is its own type, and this rejects the rest at build time.
     */
    const PLAYER_EFFECT_TYPES = [
      'playerSale',
      'morale',
      'injury',
      'injuryDelta',
      'statDelta',
      'statDeltaSessions',
      'loyalty',
      'condition',
      'fame',
    ] as const;
    /**
     * A coach effect needs a coach, for the same reason a player effect needs a
     * player: the engine will not guess which one the story meant.
     */
    event.choices.forEach((choice, choiceIndex) => {
      choice.outcomes.forEach((outcome, outcomeIndex) => {
        if (
          outcome.effects.some((effect) => effect.type === 'playerSale') &&
          outcome.effects.some((effect) => effect.type === 'money')
        ) {
          addIssue(
            context,
            ['choices', choiceIndex, 'outcomes', outcomeIndex, 'effects'],
            'a playerSale already pays its fee, so the same outcome must not also author a money effect',
          );
        }
        const facets = outcome.effects
          .filter((effect) => effect.type === 'coachBoost')
          .map((effect) => (effect.type === 'coachBoost' ? effect.facet : ''));
        if (new Set(facets).size !== facets.length) {
          addIssue(
            context,
            ['choices', choiceIndex, 'outcomes', outcomeIndex, 'effects'],
            'an outcome may carry at most one coachBoost per facet',
          );
        }
        const facilityEffect = outcome.effects.find((effect) =>
          (FACILITY_EFFECT_TYPES as readonly string[]).includes(effect.type),
        );
        const transferFeeEffect = outcome.effects.find(
          (effect) => effect.type === 'transferFeePercent',
        );
        if (
          transferFeeEffect !== undefined &&
          event.trigger.requiresPlayerSource !== 'TRANSFER_TARGETS'
        ) {
          addIssue(
            context,
            ['choices', choiceIndex, 'outcomes', outcomeIndex, 'effects'],
            `a "transferFeePercent" effect requires ${event.id} to target TRANSFER_TARGETS`,
          );
        }
        if (
          facilityEffect !== undefined &&
          event.trigger.requiresFacility === undefined
        ) {
          addIssue(
            context,
            ['choices', choiceIndex, 'outcomes', outcomeIndex, 'effects'],
            `a "${facilityEffect.type}" effect targets the selected building, so ${event.id} must set trigger.requiresFacility`,
          );
        }
        const offered = event.trigger.requiresFacility ?? [];
        for (const effect of outcome.effects) {
          const readers = FACILITY_EFFECT_READERS[effect.type];
          if (readers === undefined) continue;
          const deaf = offered.filter((type) => !readers.includes(type));
          if (deaf.length === 0) continue;
          addIssue(
            context,
            ['choices', choiceIndex, 'outcomes', outcomeIndex, 'effects'],
            `${event.id} may offer ${deaf.join(', ')}, which cannot read a "${effect.type}" — the boost would be stored and never read`,
          );
        }
        if (event.trigger.requiresCoach === true) return;
        const coachEffect = outcome.effects.find((effect) =>
          (COACH_EFFECT_TYPES as readonly string[]).includes(effect.type),
        );
        if (coachEffect === undefined) return;
        addIssue(
          context,
          ['choices', choiceIndex, 'outcomes', outcomeIndex, 'effects'],
          `a "${coachEffect.type}" effect targets the selected coach, so ${event.id} must set trigger.requiresCoach`,
        );
      });
    });
    if (event.trigger.requiresPlayer === true) return;
    event.choices.forEach((choice, choiceIndex) => {
      choice.outcomes.forEach((outcome, outcomeIndex) => {
        const offender = outcome.effects.find((effect) =>
          (PLAYER_EFFECT_TYPES as readonly string[]).includes(effect.type),
        );
        if (offender === undefined) return;
        addIssue(
          context,
          ['choices', choiceIndex, 'outcomes', outcomeIndex, 'effects'],
          `a "${offender.type}" effect targets the selected player, so ${event.id} must set trigger.requiresPlayer (use "squadMorale" for a club-wide mood change)`,
        );
      });
    });
  });

export const EventCatalogSchema = z
  .strictObject({
    schemaVersion: ContentSchemaVersion,
    tuning: z.strictObject({
      weeklyChancePercent: z.number().int().min(1).max(100),
      guaranteeAfterDryWeeks: z.number().int().min(1).max(30),
    }),
    events: z.array(GameEventSchema).min(1),
  })
  .superRefine((catalog, context) => {
    addDuplicateIssues(
      catalog.events.map((event) => event.id),
      context,
      ['events'],
      'event ID',
    );
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

const GlossaryCategorySchema = z
  .strictObject({
    id: idSchema,
    title: displayNameSchema,
    entries: z.array(GlossaryEntrySchema).min(1),
  })
  .superRefine((category, context) => {
    addDuplicateIssues(
      category.entries.map((entry) => entry.term),
      context,
      ['entries'],
      'glossary term',
    );
  });

export const GlossaryCatalogSchema = z
  .strictObject({
    schemaVersion: ContentSchemaVersion,
    categories: z.array(GlossaryCategorySchema).min(1),
  })
  .superRefine((catalog, context) => {
    addDuplicateIssues(
      catalog.categories.map((category) => category.id),
      context,
      ['categories'],
      'glossary category',
    );
  });

/**
 * A manager's tip: one non-obvious rule, stated once, in the plainest words it
 * fits into. The body is bounded so a tip stays a card on a quiet desk rather
 * than becoming a second glossary — 200 rather than the old 400, because at
 * 400 the cards had grown into paragraphs nobody reads on a phone.
 */
const ManagerTipDestinationSchema = z.enum(['drill-shop']);
const ManagerTipSchema = z.strictObject({
  id: idSchema,
  title: displayNameSchema,
  body: z.string().trim().min(1).max(200),
  /** Only tips with somewhere useful to demonstrate the rule declare a route. */
  destination: ManagerTipDestinationSchema.optional(),
});

export const ManagerTipCatalogSchema = z
  .strictObject({
    schemaVersion: ContentSchemaVersion,
    tips: z.array(ManagerTipSchema).min(1),
  })
  .superRefine((catalog, context) => {
    addDuplicateIssues(
      catalog.tips.map((tip) => tip.id),
      context,
      ['tips'],
      'manager tip',
    );
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
const ceremonyLineSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_CEREMONY_LINE_LENGTH);

export const AwardCeremonyLinesSchema = z
  .strictObject({
    schemaVersion: ContentSchemaVersion,
    winner: z.array(ceremonyLineSchema).length(CEREMONY_LINE_POOL_SIZE),
    runnerUp: z.array(ceremonyLineSchema).length(CEREMONY_LINE_POOL_SIZE),
  })
  .superRefine((pools, context) => {
    addDuplicateIssues(
      pools.winner,
      context,
      ['winner'],
      'winner ceremony line',
    );
    addDuplicateIssues(
      pools.runnerUp,
      context,
      ['runnerUp'],
      'runner-up ceremony line',
    );
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

/**
 * The agent's closing ultimatum, one line per negotiation.
 *
 * Longer than a ceremony line because it is not shouted across a pitch — he is
 * standing in front of the manager in the same bubble Bert speaks out of, and
 * every line has to carry a number as well as an attitude. Bounded all the same
 * so a translation cannot grow into a wall of text over a 104-pixel sprite.
 */
const MAX_AGENT_FINAL_LINE_LENGTH = 100;
const AGENT_FINAL_LINE_POOL_SIZE = 15;

export const AgentFinalLinesSchema = z
  .strictObject({
    schemaVersion: ContentSchemaVersion,
    lines: z
      .array(z.string().trim().min(1).max(MAX_AGENT_FINAL_LINE_LENGTH))
      .length(AGENT_FINAL_LINE_POOL_SIZE),
  })
  .superRefine((pool, context) => {
    addDuplicateIssues(pool.lines, context, ['lines'], 'agent final line');
    // The whole point of the beat is that he names a figure. A line that lost its
    // placeholder in a rewrite would deliver an ultimatum with no number in it.
    pool.lines.forEach((line, index) => {
      if (!line.includes('{wage}')) {
        addIssue(
          context,
          ['lines', index],
          'agent final lines must name the wage with {wage}',
        );
      }
    });
  });

export const FulltimeBlameLinesSchema = z
  .strictObject({
    schemaVersion: ContentSchemaVersion,
    lines: z.array(ceremonyLineSchema).length(BLAME_LINE_POOL_SIZE),
  })
  .superRefine((pool, context) => {
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

export const FulltimeCoachLinesSchema = z
  .strictObject({
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
  })
  .superRefine((pools, context) => {
    for (const [name, lines] of Object.entries(pools)) {
      if (name === 'schemaVersion') continue;
      addDuplicateIssues(
        lines as readonly string[],
        context,
        [name],
        `${name} coach line`,
      );
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
  'banner-flag',
  'boot',
  'briefcase',
  'burger',
  'camera',
  'chef-hat',
  'cone',
  'dog',
  'drink-can',
  'drone',
  'envelope',
  'headphones',
  'letter',
  'massage-table',
  'microphone',
  'money-bag',
  'palm-tree',
  'party-hat',
  'plane',
  'rain-cloud',
  'scarf',
  'scissors',
  'shirt',
  'spatula',
  'speaker',
  'sports-car',
  'star-sparkle',
  'sunglasses',
  'tactics-board',
  'tape-roll',
  'ticket',
  'tuning-fork',
  'tv',
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
  z.strictObject({
    kind: z.literal('ABSENCE'),
    weeks: z.number().int().min(1).max(4),
  }),
  z.strictObject({
    kind: z.literal('CONDITION_SQUAD'),
    amount: z.number().int().min(1).max(30),
  }),
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
  z.strictObject({
    kind: z.literal('CONDITION_SQUAD'),
    amount: z.number().int().min(1).max(20),
  }),
  z.strictObject({
    kind: z.literal('MORALE_SQUAD'),
    amount: z.number().int().min(1).max(10),
  }),
]);

const PlayerRequestSchema = z.strictObject({
  id: idSchema,
  title: displayNameSchema,
  line: z.string().trim().min(1).max(160),
  art: z.tuple([idSchema, idSchema]),
  cost: RequestCostSchema,
  grantBonus: RequestGrantBonusSchema.optional(),
});

const RequestCadenceSchema = z
  .strictObject({
    minWeeks: z.number().int().min(1).max(30),
    guaranteeWeeks: z.number().int().min(2).max(40),
    starMinWeeks: z.number().int().min(1).max(30),
    starGuaranteeWeeks: z.number().int().min(2).max(40),
  })
  .superRefine((cadence, context) => {
    if (cadence.minWeeks >= cadence.guaranteeWeeks) {
      addIssue(
        context,
        ['minWeeks'],
        'cadence minWeeks must be below guaranteeWeeks',
      );
    }
    if (cadence.starMinWeeks >= cadence.starGuaranteeWeeks) {
      addIssue(
        context,
        ['starMinWeeks'],
        'star cadence minWeeks must be below guaranteeWeeks',
      );
    }
    if (cadence.starMinWeeks > cadence.minWeeks) {
      addIssue(
        context,
        ['starMinWeeks'],
        'a squad with a star must not wait longer',
      );
    }
  });

export const PlayerRequestCatalogSchema = z
  .strictObject({
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
  })
  .superRefine((catalog, context) => {
    addDuplicateIssues(
      catalog.requests.map((request) => request.id),
      context,
      ['requests'],
      'request ID',
    );
    catalog.requests.forEach((request, index) => {
      request.art.forEach((sprite, spriteIndex) => {
        if (!REQUEST_ART_SPRITES.has(sprite)) {
          addIssue(
            context,
            ['requests', index, 'art', spriteIndex],
            `unknown request art sprite ${sprite}`,
          );
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
  bonusPercentByObjective: z
    .strictObject({
      LEAGUE_WINS: z.number().int().nonnegative().max(1_000).optional(),
      LEAGUE_GOALS: z.number().int().nonnegative().max(1_000).optional(),
      LEAGUE_FINISH: z.number().int().nonnegative().max(1_000).optional(),
    })
    .optional(),
});

const SponsorObjectiveSchema = z.strictObject({
  id: idSchema,
  kind: SponsorObjectiveKindSchema,
  labelTemplate: z
    .string()
    .trim()
    .min(1)
    .max(72)
    .refine(
      (label) => label.includes('{target}'),
      'sponsor objective label must include {target}',
    ),
  targets: z.strictObject({
    EASY: z.number().int().positive().max(100),
    NORMAL: z.number().int().positive().max(100),
    HARD: z.number().int().positive().max(100),
  }),
  chairmanDelta: z.number().int().min(-10).max(10),
});

export const SponsorCatalogSchema = z
  .strictObject({
    schemaVersion: ContentSchemaVersion,
    brands: z
      .array(
        z.strictObject({
          id: idSchema,
          name: z.string().trim().min(1).max(28),
          offerLine: z.string().trim().min(1).max(96),
        }),
      )
      .min(9),
    profiles: z.strictObject({
      STEADY: SponsorProfileSchema,
      BALANCED: SponsorProfileSchema,
      BOLD: SponsorProfileSchema,
    }),
    objectives: z.array(SponsorObjectiveSchema).length(3),
  })
  .superRefine((catalog, context) => {
    addDuplicateIssues(
      catalog.brands.map((brand) => brand.id),
      context,
      ['brands'],
      'sponsor brand ID',
    );
    addDuplicateIssues(
      catalog.brands.map((brand) => brand.name),
      context,
      ['brands'],
      'sponsor brand name',
    );
    addDuplicateIssues(
      catalog.objectives.map((objective) => objective.id),
      context,
      ['objectives'],
      'sponsor objective ID',
    );
    addDuplicateIssues(
      catalog.objectives.map((objective) => objective.kind),
      context,
      ['objectives'],
      'sponsor objective kind',
    );

    const expectedProfiles = {
      STEADY: {
        monthlyPercent: 105,
        objectiveLevel: 'EASY',
        bonusPercent: { LEAGUE_WINS: 25, LEAGUE_GOALS: 27, LEAGUE_FINISH: 25 },
      },
      BALANCED: {
        monthlyPercent: 100,
        objectiveLevel: 'NORMAL',
        bonusPercent: {
          LEAGUE_WINS: 85,
          LEAGUE_GOALS: 100,
          LEAGUE_FINISH: 110,
        },
      },
      BOLD: {
        monthlyPercent: 99,
        objectiveLevel: 'HARD',
        bonusPercent: {
          LEAGUE_WINS: 650,
          LEAGUE_GOALS: 650,
          LEAGUE_FINISH: 280,
        },
      },
    } as const;
    for (const profile of SponsorProfileIdSchema.options) {
      const actual = catalog.profiles[profile];
      const expected = expectedProfiles[profile];
      if (
        actual.monthlyPercent !== expected.monthlyPercent ||
        actual.objectiveLevel !== expected.objectiveLevel ||
        SponsorObjectiveKindSchema.options.some(
          (kind) =>
            (actual.bonusPercentByObjective?.[kind] ?? actual.bonusPercent) !==
            expected.bonusPercent[kind],
        )
      ) {
        addIssue(
          context,
          ['profiles', profile],
          `${profile} sponsor profile does not match the approved trade-off`,
        );
      }
    }

    catalog.objectives.forEach((objective, index) => {
      const { EASY, NORMAL, HARD } = objective.targets;
      const ordered =
        objective.kind === 'LEAGUE_FINISH'
          ? EASY > NORMAL && NORMAL > HARD && objective.chairmanDelta === -1
          : EASY < NORMAL && NORMAL < HARD && objective.chairmanDelta > 0;
      if (!ordered) {
        addIssue(
          context,
          ['objectives', index],
          'sponsor objective difficulty targets are not ordered correctly',
        );
      }
    });
  });

export type SponsorCatalog = z.infer<typeof SponsorCatalogSchema>;

/** The five division-headline rivals who receive a first-meeting scene. */
export const RivalHeroIntroHeroIdSchema = z.enum([
  'special-f171',
  'special-f178',
  'special-f174',
  'special-f176',
  'special-f168',
]);

const RivalHeroIntroSchema = z
  .strictObject({
    heroId: RivalHeroIntroHeroIdSchema,
    /** One compact speech bubble, not a branching dialogue tree. */
    taunt: z.string().trim().min(1).max(160),
    /** The full-time recap draws one stable line from this small authored pool. */
    victoryLines: z.array(z.string().trim().min(1).max(160)).length(2),
  })
  .superRefine((intro, context) => {
    addDuplicateIssues(
      intro.victoryLines,
      context,
      ['victoryLines'],
      'rival victory line',
    );
  });

export const RivalHeroIntroCatalogSchema = z
  .strictObject({
    schemaVersion: ContentSchemaVersion,
    intros: z
      .array(RivalHeroIntroSchema)
      .length(RivalHeroIntroHeroIdSchema.options.length),
  })
  .superRefine((catalog, context) => {
    addDuplicateIssues(
      catalog.intros.map((intro) => intro.heroId),
      context,
      ['intros'],
      'rival hero ID',
    );
    const present = new Set(catalog.intros.map((intro) => intro.heroId));
    RivalHeroIntroHeroIdSchema.options.forEach((heroId) => {
      if (!present.has(heroId))
        addIssue(context, ['intros'], `missing rival hero intro ${heroId}`);
    });
  });

export const LaunchContentSchema = z
  .strictObject({
    assistantGuide: AssistantGuideContentSchema,
    awardCeremonyLines: AwardCeremonyLinesSchema,
    fulltimeBlameLines: FulltimeBlameLinesSchema,
    agentFinalLines: AgentFinalLinesSchema,
    fulltimeCoachLines: FulltimeCoachLinesSchema,
    clubs: ClubCatalogSchema,
    glossary: GlossaryCatalogSchema,
    onboarding: OnboardingContentSchema,
    powers: PowerCatalogSchema,
    playerRequests: PlayerRequestCatalogSchema,
    rivalHeroIntros: RivalHeroIntroCatalogSchema,
    sponsors: SponsorCatalogSchema,
    tips: ManagerTipCatalogSchema,
    training: TrainingCatalogSchema,
    events: EventCatalogSchema,
  })
  .superRefine((content, context) => {
    const powerIds = new Set(content.powers.powers.map((power) => power.id));
    const eventIds = new Set(content.events.events.map((event) => event.id));
    const producedFlags = new Set(
      content.events.events.flatMap((event) =>
        event.choices.flatMap((choice) =>
          choice.outcomes.flatMap((outcome) =>
            outcome.effects.flatMap((effect) =>
              effect.type === 'flag' ? [effect.flag] : [],
            ),
          ),
        ),
      ),
    );
    const globalPlayerIds = new Set<string>();

    content.clubs.clubs.forEach((club, clubIndex) => {
      const playerById = new Map(
        club.players.map((player) => [player.id, player]),
      );
      club.players.forEach((player, playerIndex) => {
        if (globalPlayerIds.has(player.id)) {
          addIssue(
            context,
            ['clubs', 'clubs', clubIndex, 'players', playerIndex, 'id'],
            `duplicate global player ID ${player.id}`,
          );
        }
        globalPlayerIds.add(player.id);
        if (player.powerId !== null && !powerIds.has(player.powerId)) {
          addIssue(
            context,
            ['clubs', 'clubs', clubIndex, 'players', playerIndex, 'powerId'],
            `unknown power ID ${player.powerId}`,
          );
        }
        if (player.licensed && player.powerId === null) {
          addIssue(
            context,
            ['clubs', 'clubs', clubIndex, 'players', playerIndex, 'licensed'],
            'licensed player must own a power',
          );
        }
        if (player.onHeroWage && player.powerId === null) {
          addIssue(
            context,
            ['clubs', 'clubs', clubIndex, 'players', playerIndex, 'onHeroWage'],
            'hero wage requires a power',
          );
        }
      });

      const lineup = club.startingLineup.map((playerId, lineupIndex) => {
        const player = playerById.get(playerId);
        if (player === undefined) {
          addIssue(
            context,
            ['clubs', 'clubs', clubIndex, 'startingLineup', lineupIndex],
            `unknown lineup player ID ${playerId}`,
          );
        }
        return player;
      });
      if (lineup[0] !== undefined && lineup[0].role !== 'GK') {
        addIssue(
          context,
          ['clubs', 'clubs', clubIndex, 'startingLineup', 0],
          'starting lineup slot 0 must be a goalkeeper',
        );
      }
      if (lineup.filter((player) => player?.role === 'GK').length !== 1) {
        addIssue(
          context,
          ['clubs', 'clubs', clubIndex, 'startingLineup'],
          'starting lineup must contain exactly one goalkeeper',
        );
      }
      lineup.forEach((player, lineupIndex) => {
        if (player?.powerId !== null && player?.licensed === false) {
          addIssue(
            context,
            ['clubs', 'clubs', clubIndex, 'startingLineup', lineupIndex],
            'starting hero must be licensed',
          );
        }
      });
      const licensedHeroes = lineup.filter(
        (player) => player?.licensed && player.powerId !== null,
      ).length;
      if (licensedHeroes > 2) {
        addIssue(
          context,
          ['clubs', 'clubs', clubIndex, 'startingLineup'],
          'M1 starting lineup cannot exceed two licensed heroes',
        );
      }
    });

    content.events.events.forEach((event, eventIndex) => {
      const requiredFlag = event.trigger.requiredFlag;
      const engineProduced =
        requiredFlag !== undefined &&
        ENGINE_PRODUCED_FLAG_PREFIXES.some((prefix) =>
          requiredFlag.startsWith(prefix),
        );
      if (
        requiredFlag !== undefined &&
        !engineProduced &&
        !producedFlags.has(requiredFlag)
      ) {
        addIssue(
          context,
          ['events', 'events', eventIndex, 'trigger', 'requiredFlag'],
          `unknown required flag ${event.trigger.requiredFlag}`,
        );
      }
      event.choices.forEach((choice, choiceIndex) => {
        choice.outcomes.forEach((outcome, outcomeIndex) => {
          if (
            outcome.nextEventId !== undefined &&
            !eventIds.has(outcome.nextEventId)
          ) {
            addIssue(
              context,
              [
                'events',
                'events',
                eventIndex,
                'choices',
                choiceIndex,
                'outcomes',
                outcomeIndex,
                'nextEventId',
              ],
              `unknown next event ID ${outcome.nextEventId}`,
            );
          }
          if (outcome.nextEventId !== undefined) {
            const followUp = content.events.events.find(
              (candidate) => candidate.id === outcome.nextEventId,
            );
            if (followUp !== undefined) {
              const targetKind = (candidate: typeof event) =>
                candidate.trigger.requiresPlayer === true
                  ? 'player'
                  : candidate.trigger.requiresCoach === true
                    ? 'coach'
                    : candidate.trigger.requiresFacility !== undefined
                      ? 'facility'
                      : 'none';
              const openerKind = targetKind(event);
              const followUpKind = targetKind(followUp);
              if (openerKind !== followUpKind && followUpKind !== 'none') {
                addIssue(
                  context,
                  [
                    'events',
                    'events',
                    eventIndex,
                    'choices',
                    choiceIndex,
                    'outcomes',
                    outcomeIndex,
                    'nextEventId',
                  ],
                  `targeted follow-up ${followUp.id} must use the opener's target kind`,
                );
              }
            }
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
export type AssistantGuideSequenceId = z.infer<
  typeof AssistantGuideSequenceIdSchema
>;
export type AssistantGuideFocus = z.infer<typeof AssistantGuideFocusSchema>;
export type AssistantGuideDestination = z.infer<
  typeof AssistantGuideDestinationSchema
>;
export type AssistantGuideContent = z.infer<typeof AssistantGuideContentSchema>;
export type AwardCeremonyLines = z.infer<typeof AwardCeremonyLinesSchema>;
export type FulltimeBlameLines = z.infer<typeof FulltimeBlameLinesSchema>;
export type AgentFinalLines = z.infer<typeof AgentFinalLinesSchema>;
export type FulltimeCoachLines = z.infer<typeof FulltimeCoachLinesSchema>;
/** Which pool of the gaffer's lines an afternoon draws from. */
export type FulltimeCoachLinePool = Exclude<
  keyof FulltimeCoachLines,
  'schemaVersion'
>;
export type TrainingDrill = z.infer<typeof TrainingDrillSchema>;
export type TrainingCatalog = z.infer<typeof TrainingCatalogSchema>;
export type GameEvent = z.infer<typeof GameEventSchema>;
export type EventCatalog = z.infer<typeof EventCatalogSchema>;
export type GlossaryCatalog = z.infer<typeof GlossaryCatalogSchema>;
export type ManagerTipDestination = z.infer<typeof ManagerTipDestinationSchema>;
export type ManagerTipCatalog = z.infer<typeof ManagerTipCatalogSchema>;
export type RivalHeroIntroHeroId = z.infer<typeof RivalHeroIntroHeroIdSchema>;
export type RivalHeroIntroCatalog = z.infer<typeof RivalHeroIntroCatalogSchema>;
export type LaunchContent = z.infer<typeof LaunchContentSchema>;

function addDuplicateIssues(
  values: readonly string[],
  context: z.RefinementCtx,
  path: PropertyKey[],
  label: string,
): void {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value))
      addIssue(
        context,
        [...path, index],
        `${label}s must be unique; duplicate ${value}`,
      );
    seen.add(value);
  });
}

function addIssue(
  context: z.RefinementCtx,
  path: PropertyKey[],
  message: string,
): void {
  context.addIssue({ code: 'custom', path, message });
}
