import { z } from 'zod';

import { validateFacilityGrid } from '../game/facilities';
import { GAME_SCHEMA_VERSION, type GameState } from '../game/types';
import {
  CorruptCareerSaveError,
  InvalidGameStateError,
  UnsupportedGameSchemaError,
} from './errors';

const safeInteger = z
  .number()
  .refine(Number.isSafeInteger, 'must be a safe integer');
const nonnegativeInteger = safeInteger.refine(
  (value) => value >= 0,
  'must be nonnegative',
);
const positiveInteger = safeInteger.refine(
  (value) => value > 0,
  'must be positive',
);
const uint32 = nonnegativeInteger.refine(
  (value) => value <= 4294967295,
  'must fit uint32',
);
const nonemptyString = z.string().min(1);
const playerAttribute = positiveInteger.refine(
  (value) => value <= 99,
  'must be at most 99',
);

const clubSchema = z
  .object({
    id: nonemptyString,
    name: nonemptyString,
    cash: safeInteger,
    fans: nonnegativeInteger,
    ticketPrice: nonnegativeInteger,
    sponsorMonthlyFee: nonnegativeInteger,
    weeklyWages: nonnegativeInteger,
  })
  .passthrough();

const scoreSchema = z
  .object({
    homeGoals: nonnegativeInteger,
    awayGoals: nonnegativeInteger,
  })
  .passthrough();

const fixtureSchema = z
  .object({
    id: nonemptyString,
    season: positiveInteger,
    round: positiveInteger,
    week: positiveInteger,
    homeClubId: nonemptyString,
    awayClubId: nonemptyString,
    matchSeed: uint32,
    status: z.enum(['scheduled', 'played']),
    score: scoreSchema.optional(),
  })
  .passthrough()
  .superRefine((fixture, context) => {
    if (fixture.status === 'played' && fixture.score === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['score'],
        message: 'played fixture needs a score',
      });
    }
    if (fixture.status === 'scheduled' && fixture.score !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['score'],
        message: 'scheduled fixture cannot have a score',
      });
    }
  });

const ledgerLineSchema = z
  .object({
    kind: z.enum([
      'tickets',
      'sponsor',
      'prize',
      'merch',
      'training',
      'facilities',
      'wages',
      'subsidy',
      'emergency-loan',
      'loan-repayment',
    ]),
    label: nonemptyString,
    amount: safeInteger,
  })
  .passthrough();

const ledgerSchema = z
  .object({
    season: positiveInteger,
    week: positiveInteger,
    lines: z.array(ledgerLineSchema),
    balanceAfter: safeInteger,
  })
  .passthrough();

const cashTransactionSchema = z.object({
  id: nonemptyString,
  season: positiveInteger,
  week: positiveInteger,
  kind: z.enum([
    'facility-build',
    'facility-upgrade',
    'facility-relocation',
    'scouting',
    'transfer-buy',
    'transfer-sell',
    'youth-signing',
    'coach-hiring',
  ]),
  label: nonemptyString,
  amount: safeInteger.refine(value => value !== 0, 'must be non-zero'),
  balanceAfter: nonnegativeInteger,
  referenceId: nonemptyString.optional(),
}).passthrough();

const attributesSchema = z
  .object({
    pac: playerAttribute,
    sho: playerAttribute,
    pas: playerAttribute,
    def: playerAttribute,
    tec: playerAttribute,
    sta: playerAttribute,
    ref: playerAttribute,
  })
  .passthrough();

const playerSchema = z
  .object({
    id: nonemptyString,
    clubId: nonemptyString,
    name: nonemptyString,
    role: z.enum(['GK', 'DEF', 'MID', 'FWD']),
    attrs: attributesSchema,
    power: z.enum(['SUPER_SPEED', 'SUPER_STRENGTH', 'FIRE_TORCH']).optional(),
    powerTier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    licensed: z.boolean(),
    weeklyWage: nonnegativeInteger,
    onHeroWage: z.boolean(),
    contractSeasonsRemaining: nonnegativeInteger,
    morale: nonnegativeInteger.refine(
      (value) => value <= 100,
      'must be at most 100',
    ),
    injuryWeeks: nonnegativeInteger,
    age: positiveInteger.refine((value) => value <= 99, 'must be at most 99').optional(),
    archetype: z.enum([
      'Speedster', 'Sniper', 'Playmaker', 'Anchor', 'Wall', 'Engine', 'All-Rounder', 'Prodigy',
    ]).optional(),
    potential: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
    consistency: nonnegativeInteger.refine((value) => value <= 100, 'must be at most 100').optional(),
    personality: z.enum(['Fiery', 'Loyal', 'Greedy', 'Joker', 'Professional', 'Timid']).optional(),
    condition: nonnegativeInteger.refine((value) => value <= 100, 'must be at most 100').optional(),
    seasonsAtClub: nonnegativeInteger.optional(),
    fame: nonnegativeInteger.optional(),
    retirementAge: positiveInteger.refine((value) => value >= 33 && value <= 38, 'must be from 33 to 38').optional(),
    retirementAnnounced: z.boolean().optional(),
    retirementAnnouncementSeason: positiveInteger.optional(),
    consecutiveLowMoraleWeeks: nonnegativeInteger.optional(),
    transferRequested: z.boolean().optional(),
    motivatorMoraleRemainder: nonnegativeInteger.refine(
      (value) => value < 100,
      'must be at most 99',
    ).optional(),
    signingStatTotal: positiveInteger.optional(),
    facilityStaBonusRemainder: nonnegativeInteger.refine(
      (value) => value < 100,
      'must be at most 99',
    ).optional(),
  })
  .passthrough();

const lineupSchema = z
  .object({
    clubId: nonemptyString,
    playerIds: z.array(nonemptyString),
  })
  .passthrough();

const facilityGridSchema = z
  .object({
    width: z.literal(8),
    height: z.literal(6),
    nextBuildingId: positiveInteger,
    buildings: z.array(z.object({
      id: nonemptyString,
      type: z.enum([
        'training-pitch', 'gym', 'tech-center', 'shooting-range', 'keeper-court',
        'medical-bay', 'dorm', 'scout-office', 'coaching-office', 'youth-field',
        'fan-shop', 'stadium-stand', 'hero-lab',
      ]),
      level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      x: nonnegativeInteger,
      y: nonnegativeInteger,
    }).passthrough()),
    discoveredAdjacencies: z.array(z.enum([
      'gym-dorm', 'fan-shop-stadium', 'medical-training-pitch',
    ])),
  })
  .passthrough()
  .superRefine((grid, context) => {
    try {
      validateFacilityGrid(grid);
    } catch (error) {
      context.addIssue({
        code: 'custom',
        message: error instanceof Error ? error.message : 'invalid facility grid',
      });
    }
  });

const facilitiesSchema = z
  .object({
    trainingGroundBuilt: z.boolean(),
    grid: facilityGridSchema.optional(),
  })
  .passthrough();

const trainingGainsSchema = z
  .strictObject({
    pac: nonnegativeInteger.optional(),
    sho: nonnegativeInteger.optional(),
    pas: nonnegativeInteger.optional(),
    def: nonnegativeInteger.optional(),
    tec: nonnegativeInteger.optional(),
    sta: nonnegativeInteger.optional(),
    ref: nonnegativeInteger.optional(),
  })
  .refine(gains => Object.keys(gains).length > 0, 'must improve at least one attribute');

const trainingDrillSchema = z
  .object({
    id: nonemptyString,
    moneyCost: nonnegativeInteger,
    tpCost: nonnegativeInteger,
    gains: trainingGainsSchema,
  })
  .passthrough();

const trainingRulesSchema = z
  .object({
    maxFocusDrillsPerWeek: positiveInteger,
    baseConditioning: trainingDrillSchema,
  })
  .passthrough();

const trainingPlanSchema = z
  .object({
    assignedPlayerIds: z.array(nonemptyString).min(1),
    drills: z.array(trainingDrillSchema).min(1),
  })
  .passthrough();

const eventClockSchema = z
  .object({
    weeksWithoutEvent: nonnegativeInteger,
    riskyChoices: nonnegativeInteger,
  })
  .passthrough();

const pendingEventSchema = z
  .object({
    eventId: nonemptyString,
    selectedPlayerId: nonemptyString.optional(),
    resolvedChoiceId: nonemptyString.optional(),
    outcomeText: nonemptyString.optional(),
  })
  .passthrough();

const pendingAwakeningSchema = z
  .object({
    fixtureId: nonemptyString,
    playerId: nonemptyString,
    power: z.enum(['SUPER_SPEED', 'SUPER_STRENGTH', 'FIRE_TORCH']),
    triggerId: nonemptyString,
    firstHero: z.boolean(),
  })
  .passthrough();

const awakeningSchema = z
  .object({
    matchesSinceLastAwakening: nonnegativeInteger,
    usedTriggerIds: z.array(nonemptyString).optional(),
    pending: pendingAwakeningSchema.optional(),
  })
  .passthrough();

const onboardingSchema = z
  .object({
    stage: z.enum(['create-player', 'first-match', 'collapse', 'reveal', 'complete']),
    createdPlayerId: nonemptyString.optional(),
    firstFixtureId: nonemptyString.optional(),
    selectedOrigin: z.enum(['CHEMICAL', 'CREATURE', 'SERUM']).optional(),
    awakenedPower: z.enum(['SUPER_SPEED', 'SUPER_STRENGTH', 'FIRE_TORCH']).optional(),
  })
  .passthrough()
  .superRefine((onboarding, context) => {
    if (onboarding.stage === 'create-player') return;
    if (onboarding.createdPlayerId === undefined) {
      context.addIssue({ code: 'custom', path: ['createdPlayerId'], message: 'is required after creation' });
    }
    if (onboarding.firstFixtureId === undefined) {
      context.addIssue({ code: 'custom', path: ['firstFixtureId'], message: 'is required after creation' });
    }
    if (onboarding.stage === 'reveal' || onboarding.stage === 'complete') {
      if (onboarding.awakenedPower === undefined) {
        context.addIssue({ code: 'custom', path: ['awakenedPower'], message: 'is required after awakening' });
      }
    }
  });

const seasonGoalTallySchema = z
  .object({
    season: positiveInteger,
    playerId: nonemptyString,
    goals: nonnegativeInteger,
  })
  .passthrough();

const divisionLevelSchema = z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
]);
const pyramidPlayerSchema = z.object({
  id: nonemptyString,
  clubId: nonemptyString,
  name: nonemptyString,
  role: z.enum(['GK', 'DEF', 'MID', 'FWD']),
  attrs: attributesSchema,
  archetype: z.enum([
    'Speedster', 'Sniper', 'Playmaker', 'Anchor', 'Wall', 'Engine', 'All-Rounder', 'Prodigy',
  ]),
  personality: z.enum(['Fiery', 'Loyal', 'Greedy', 'Joker', 'Professional', 'Timid']),
  age: positiveInteger,
  fame: nonnegativeInteger,
  seasonsAtClub: nonnegativeInteger,
  morale: nonnegativeInteger.refine(value => value <= 100, 'must be at most 100'),
  condition: nonnegativeInteger.refine(value => value <= 100, 'must be at most 100'),
  consecutiveLowMoraleWeeks: nonnegativeInteger,
  retirementAnnouncementSeason: positiveInteger.optional(),
}).passthrough();
const pyramidClubSchema = z.object({
  id: nonemptyString,
  name: nonemptyString,
  division: divisionLevelSchema,
  squadStrength: positiveInteger.refine(value => value <= 99, 'must be at most 99'),
  squad: z.array(pyramidPlayerSchema),
}).passthrough();
const cupFixtureSchema = z.object({
  id: nonemptyString,
  season: positiveInteger,
  round: positiveInteger,
  homeClubId: nonemptyString,
  awayClubId: nonemptyString,
  matchSeed: uint32,
  status: z.enum(['scheduled', 'played']),
  score: scoreSchema.optional(),
  winnerClubId: nonemptyString.optional(),
}).passthrough();
const nationalCupSchema = z.object({
  careerSeed: uint32,
  season: positiveInteger,
  rounds: z.array(z.object({
    number: positiveInteger,
    label: z.enum(['Play-in', 'Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final']),
    entrantClubIds: z.array(nonemptyString),
    byeClubIds: z.array(nonemptyString),
    fixtures: z.array(cupFixtureSchema),
  }).passthrough()).min(1),
  championClubId: nonemptyString.optional(),
}).passthrough();
const m2CareerSchema = z.object({
  schemaVersion: z.literal(1),
  careerSeed: uint32,
  userClubId: nonemptyString,
  pyramid: z.object({
    careerSeed: uint32,
    divisions: z.array(z.object({
      level: divisionLevelSchema,
      clubs: z.array(pyramidClubSchema).length(10),
    }).passthrough()).length(5),
  }).passthrough(),
  nationalCups: z.array(nationalCupSchema),
}).passthrough();

const marketPersonalitySchema = z.enum([
  'FIERY', 'LOYAL', 'GREEDY', 'JOKER', 'PROFESSIONAL', 'TIMID',
]);
const scoutFocusSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('POSITION'), role: z.enum(['GK', 'DEF', 'MID', 'FWD']) }),
  z.object({ kind: z.literal('AGE'), minimumAge: positiveInteger, maximumAge: positiveInteger }),
  z.object({ kind: z.literal('RUMORED_HERO') }),
]);
const scoutMissionSchema = z.object({
  id: nonemptyString,
  missionSeed: uint32,
  startWeek: positiveInteger,
  dueWeek: positiveInteger,
  cost: nonnegativeInteger,
  region: z.enum(['LOCAL', 'EUROPE', 'SOUTH_AMERICA', 'AFRICA', 'ASIA']),
  focus: scoutFocusSchema,
  scoutOfficeLevel: divisionLevelSchema.refine(value => value <= 3, 'must be at most 3'),
}).passthrough();
const scoutedRangeSchema = z.object({ minimum: positiveInteger, maximum: positiveInteger }).passthrough();
const scoutReportSchema = z.object({
  playerId: nonemptyString,
  role: z.enum(['GK', 'DEF', 'MID', 'FWD']),
  age: positiveInteger,
  statRanges: z.object({
    pac: scoutedRangeSchema,
    sho: scoutedRangeSchema,
    pas: scoutedRangeSchema,
    def: scoutedRangeSchema,
    tec: scoutedRangeSchema,
    sta: scoutedRangeSchema,
    ref: scoutedRangeSchema,
  }).passthrough(),
  potentialRange: scoutedRangeSchema,
  power: z.enum(['SUPER_SPEED', 'SUPER_STRENGTH', 'FIRE_TORCH']).optional(),
  powerTier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  rumoredHeroLead: z.literal(true).optional(),
}).passthrough();
const coachCandidateSchema = z.object({
  id: nonemptyString,
  name: nonemptyString,
  specialties: z.tuple([z.enum([
    'ATTACK', 'DEFENSE', 'FITNESS', 'TECHNIQUE', 'GOALKEEPING', 'MOTIVATOR',
  ]), z.enum([
    'ATTACK', 'DEFENSE', 'FITNESS', 'TECHNIQUE', 'GOALKEEPING', 'MOTIVATOR',
  ])]),
  level: divisionLevelSchema,
  weeklyWage: nonnegativeInteger,
  personality: marketPersonalitySchema,
  requiredDivision: divisionLevelSchema,
  requiredFame: nonnegativeInteger,
  loyaltyDiscountPercent: nonnegativeInteger.refine(value => value <= 100, 'must be at most 100'),
  unlockId: nonemptyString.optional(),
  retiredLegendPlayerId: nonemptyString.optional(),
}).passthrough();
const contractOfferSchema = z.object({
  weeklyWage: positiveInteger,
  termSeasons: positiveInteger.refine(value => value <= 3, 'must be at most 3'),
  perk: z.enum(['GUARANTEED_STARTER', 'CAPTAINCY', 'TRAINING_PRIORITY', 'JERSEY_10']),
}).passthrough();
const negotiationSchema = z.object({
  id: nonemptyString,
  playerId: nonemptyString,
  personality: marketPersonalitySchema,
  weeklyAsk: positiveInteger,
  round: nonnegativeInteger.refine(value => value <= 3, 'must be at most 3'),
  mood: z.enum(['ANGRY', 'UNHAPPY', 'NEUTRAL', 'PLEASED', 'THRILLED']),
  pitchInfluencePercent: safeInteger,
  pitchCards: z.array(z.enum(['FLATTERY', 'TROPHY_PROMISE', 'HOMETOWN_TIES', 'MONEY_TALKS', 'STRAIGHT_TALK'])),
  usedPitchCards: z.array(z.enum(['FLATTERY', 'TROPHY_PROMISE', 'HOMETOWN_TIES', 'MONEY_TALKS', 'STRAIGHT_TALK'])),
  status: z.enum(['OPEN', 'ACCEPTED', 'REJECTED']),
  history: z.array(z.object({ round: positiveInteger, offer: contractOfferSchema }).passthrough()),
  acceptedOffer: contractOfferSchema.optional(),
  consequence: z.object({
    moraleDelta: safeInteger,
    clubFameDelta: safeInteger,
  }).passthrough().optional(),
}).passthrough();
const careerMarketSchema = z.object({
  nextMissionNumber: positiveInteger,
  activeScoutMission: scoutMissionSchema.optional(),
  scoutReports: z.array(scoutReportSchema),
  coachCandidates: z.array(coachCandidateSchema),
  headCoach: coachCandidateSchema.optional(),
  headCoachSeasonsEmployed: nonnegativeInteger.optional(),
  unlockedCoachContentIds: z.array(nonemptyString).optional(),
  clubFameAdjustment: safeInteger.optional(),
  transferTalks: z.object({
    playerId: nonemptyString,
    transferQuote: z.object({
      playerId: nonemptyString,
      valuation: nonnegativeInteger,
      fee: nonnegativeInteger,
      bandPercent: nonnegativeInteger,
    }).passthrough(),
    negotiation: negotiationSchema,
    consequenceApplied: z.boolean().optional(),
  }).passthrough().optional(),
  renewalTalks: z.object({
    playerId: nonemptyString,
    negotiation: negotiationSchema,
    consequenceApplied: z.boolean().optional(),
  }).passthrough().optional(),
}).passthrough();

const youthIntakeSchema = z.object({
  schemaVersion: z.literal(1),
  season: positiveInteger,
  status: z.enum(['OPEN', 'CLOSED']),
  offers: z.array(z.object({
    player: playerSchema,
    signingBonus: nonnegativeInteger,
  }).passthrough()).max(2),
  signedPlayerIds: z.array(nonemptyString),
  declined: z.boolean(),
}).passthrough();

const gameStateSchema = z
  .object({
    schemaVersion: z.literal(GAME_SCHEMA_VERSION),
    careerSeed: uint32,
    userClubId: nonemptyString,
    season: positiveInteger,
    week: positiveInteger,
    phase: z.enum(['manage', 'matchday', 'season-end', 'complete']),
    clubs: z.array(clubSchema).length(10),
    fixtures: z.array(fixtureSchema),
    players: z.array(playerSchema),
    lineups: z.array(lineupSchema),
    facilities: facilitiesSchema,
    trainingRules: trainingRulesSchema.optional(),
    trainingPlan: trainingPlanSchema.optional(),
    eventClock: eventClockSchema,
    eventFlags: z.array(nonemptyString),
    resolvedEventIds: z.array(nonemptyString),
    pendingEvent: pendingEventSchema.optional(),
    // Optional at decode time so pre-cutscene schema-1 saves can be upgraded
    // by the application reconciliation pass without being treated as corrupt.
    awakening: awakeningSchema.optional(),
    onboarding: onboardingSchema.optional(),
    trainingPoints: nonnegativeInteger,
    heroEssence: nonnegativeInteger,
    ledgers: z.array(ledgerSchema),
    cashTransactions: z.array(cashTransactionSchema).optional(),
    seasonGoalTallies: z.array(seasonGoalTallySchema).optional(),
    careerMode: z.enum(['m1-slice', 'full']).optional(),
    m2: m2CareerSchema.optional(),
    market: careerMarketSchema.optional(),
    youthIntake: youthIntakeSchema.optional(),
    retiredPlayers: z.array(playerSchema).optional(),
    pendingLegacyPlayerIds: z.array(nonemptyString).optional(),
    financialSafety: z.object({
      consecutiveNegativeWeeks: nonnegativeInteger,
      emergencyLoanUsed: z.boolean(),
      loan: z.object({
        originalAmount: positiveInteger,
        remainingBalance: nonnegativeInteger,
        repaymentStartsSeason: positiveInteger,
        remainingWeeks: nonnegativeInteger,
      }).passthrough().optional(),
    }).passthrough().optional(),
  })
  .passthrough()
  .superRefine((state, context) => {
    if (state.careerMode === 'full' && (state.m2 === undefined || state.market === undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['careerMode'],
        message: 'full careers require M2 pyramid and market state',
      });
    }
    if (state.m2 !== undefined && state.m2.userClubId !== state.userClubId) {
      context.addIssue({
        code: 'custom',
        path: ['m2', 'userClubId'],
        message: 'must match the active user club',
      });
    }
    if (state.youthIntake !== undefined) {
      if (state.youthIntake.season !== state.season) {
        context.addIssue({
          code: 'custom',
          path: ['youthIntake', 'season'],
          message: 'must match the active season',
        });
      }
      if (state.youthIntake.status === 'OPEN' && state.youthIntake.offers.length === 0) {
        context.addIssue({
          code: 'custom',
          path: ['youthIntake', 'offers'],
          message: 'open youth intake needs an offer',
        });
      }
      if (state.youthIntake.status === 'CLOSED' && state.youthIntake.offers.length > 0) {
        context.addIssue({
          code: 'custom',
          path: ['youthIntake', 'offers'],
          message: 'closed youth intake cannot retain offers',
        });
      }
      const youthOfferIds = new Set<string>();
      for (let index = 0; index < state.youthIntake.offers.length; index += 1) {
        const offer = state.youthIntake.offers[index];
        if (youthOfferIds.has(offer.player.id)) {
          context.addIssue({
            code: 'custom',
            path: ['youthIntake', 'offers', index, 'player', 'id'],
            message: 'youth offer player ID must be unique',
          });
        }
        youthOfferIds.add(offer.player.id);
        if (offer.player.clubId !== state.userClubId) {
          context.addIssue({
            code: 'custom',
            path: ['youthIntake', 'offers', index, 'player', 'clubId'],
            message: 'must match the active user club',
          });
        }
      }
    }
    const cashTransactionIds = new Set<string>();
    for (let index = 0; index < (state.cashTransactions ?? []).length; index += 1) {
      const transaction = state.cashTransactions![index];
      if (cashTransactionIds.has(transaction.id)) {
        context.addIssue({
          code: 'custom',
          path: ['cashTransactions', index, 'id'],
          message: 'cash transaction ID must be unique',
        });
      }
      cashTransactionIds.add(transaction.id);
    }

    const clubIds = new Set<string>();
    for (let index = 0; index < state.clubs.length; index += 1) {
      const clubId = state.clubs[index].id;
      if (clubIds.has(clubId)) {
        context.addIssue({
          code: 'custom',
          path: ['clubs', index, 'id'],
          message: 'club ID must be unique',
        });
      }
      clubIds.add(clubId);
    }

    const goalTallyKeys = new Set<string>();
    for (let index = 0; index < (state.seasonGoalTallies ?? []).length; index += 1) {
      const tally = state.seasonGoalTallies![index];
      const key = `${tally.season}:${tally.playerId}`;
      if (goalTallyKeys.has(key)) {
        context.addIssue({
          code: 'custom',
          path: ['seasonGoalTallies', index],
          message: 'season and player ID must be unique',
        });
      }
      goalTallyKeys.add(key);
    }
    if (!clubIds.has(state.userClubId)) {
      context.addIssue({
        code: 'custom',
        path: ['userClubId'],
        message: 'user club does not exist',
      });
    }

    const fixtureIds = new Set<string>();
    for (let index = 0; index < state.fixtures.length; index += 1) {
      const fixture = state.fixtures[index];
      if (fixtureIds.has(fixture.id)) {
        context.addIssue({
          code: 'custom',
          path: ['fixtures', index, 'id'],
          message: 'fixture ID must be unique',
        });
      }
      fixtureIds.add(fixture.id);
      if (
        !clubIds.has(fixture.homeClubId) ||
        !clubIds.has(fixture.awayClubId)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['fixtures', index],
          message: 'fixture references an unknown club',
        });
      }
      if (fixture.homeClubId === fixture.awayClubId) {
        context.addIssue({
          code: 'custom',
          path: ['fixtures', index],
          message: 'fixture clubs must be different',
        });
      }
    }

    const playerIds = new Set<string>();
    const playerClubById = new Map<string, string>();
    for (let index = 0; index < state.players.length; index += 1) {
      const player = state.players[index];
      if (playerIds.has(player.id)) {
        context.addIssue({
          code: 'custom',
          path: ['players', index, 'id'],
          message: 'player ID must be unique',
        });
      }
      playerIds.add(player.id);
      playerClubById.set(player.id, player.clubId);
      if (!clubIds.has(player.clubId)) {
        context.addIssue({
          code: 'custom',
          path: ['players', index, 'clubId'],
          message: 'player references an unknown club',
        });
      }
    }

    if (state.onboarding?.createdPlayerId !== undefined
      && !playerIds.has(state.onboarding.createdPlayerId)) {
      context.addIssue({
        code: 'custom',
        path: ['onboarding', 'createdPlayerId'],
        message: 'created player does not exist',
      });
    }
    if (state.onboarding?.firstFixtureId !== undefined
      && !fixtureIds.has(state.onboarding.firstFixtureId)) {
      context.addIssue({
        code: 'custom',
        path: ['onboarding', 'firstFixtureId'],
        message: 'first fixture does not exist',
      });
    }
    if (state.awakening?.pending !== undefined) {
      const pending = state.awakening.pending;
      if (!fixtureIds.has(pending.fixtureId)) {
        context.addIssue({
          code: 'custom',
          path: ['awakening', 'pending', 'fixtureId'],
          message: 'awakening fixture does not exist',
        });
      }
      const awakeningPlayer = state.players.find(player => player.id === pending.playerId);
      if (awakeningPlayer?.clubId !== state.userClubId || awakeningPlayer.power !== pending.power) {
        context.addIssue({
          code: 'custom',
          path: ['awakening', 'pending', 'playerId'],
          message: 'pending awakening must match a user-club hero',
        });
      }
    }
    const onboardingPlayer = state.onboarding?.createdPlayerId === undefined
      ? undefined
      : state.players.find(player => player.id === state.onboarding?.createdPlayerId);
    if (onboardingPlayer !== undefined && onboardingPlayer.clubId !== state.userClubId) {
      context.addIssue({
        code: 'custom',
        path: ['onboarding', 'createdPlayerId'],
        message: 'created player must belong to the user club',
      });
    }
    if (
      state.onboarding?.awakenedPower !== undefined
      && (
        onboardingPlayer?.power !== state.onboarding.awakenedPower
        || onboardingPlayer.licensed !== true
      )
    ) {
      context.addIssue({
        code: 'custom',
        path: ['onboarding', 'awakenedPower'],
        message: 'awakened power must be licensed on the created player',
      });
    }

    const lineupClubIds = new Set<string>();
    if ((state.players.length === 0) !== (state.lineups.length === 0)) {
      context.addIssue({
        code: 'custom',
        path: ['lineups'],
        message: 'career players and lineups must be present together',
      });
    }
    if (
      state.players.length > 0 &&
      state.lineups.length !== state.clubs.length
    ) {
      context.addIssue({
        code: 'custom',
        path: ['lineups'],
        message: 'full career state needs one lineup per club',
      });
    }
    for (let index = 0; index < state.lineups.length; index += 1) {
      const lineup = state.lineups[index];
      if (!clubIds.has(lineup.clubId)) {
        context.addIssue({
          code: 'custom',
          path: ['lineups', index, 'clubId'],
          message: 'lineup references an unknown club',
        });
      }
      if (lineupClubIds.has(lineup.clubId)) {
        context.addIssue({
          code: 'custom',
          path: ['lineups', index, 'clubId'],
          message: 'club can have only one lineup',
        });
      }
      lineupClubIds.add(lineup.clubId);

      if (lineup.playerIds.length !== 11) {
        context.addIssue({
          code: 'custom',
          path: ['lineups', index, 'playerIds'],
          message: 'lineup must contain 11 players',
        });
      }

      const lineupPlayerIds = new Set<string>();
      for (
        let playerIndex = 0;
        playerIndex < lineup.playerIds.length;
        playerIndex += 1
      ) {
        const playerId = lineup.playerIds[playerIndex];
        if (lineupPlayerIds.has(playerId)) {
          context.addIssue({
            code: 'custom',
            path: ['lineups', index, 'playerIds', playerIndex],
            message: 'lineup player ID must be unique',
          });
        }
        lineupPlayerIds.add(playerId);
        if (!playerIds.has(playerId)) {
          context.addIssue({
            code: 'custom',
            path: ['lineups', index, 'playerIds', playerIndex],
            message: 'lineup references an unknown player',
          });
        } else if (playerClubById.get(playerId) !== lineup.clubId) {
          context.addIssue({
            code: 'custom',
            path: ['lineups', index, 'playerIds', playerIndex],
            message: 'lineup player belongs to another club',
          });
        }
      }
    }

    if (state.trainingPlan !== undefined) {
      const maxDrills = state.trainingRules?.maxFocusDrillsPerWeek ?? 3;
      const assignedIds = new Set<string>();
      const drillIds = new Set<string>();
      if (state.trainingPlan.drills.length > maxDrills) {
        context.addIssue({
          code: 'custom',
          path: ['trainingPlan', 'drills'],
          message: `cannot contain more than ${maxDrills} drills`,
        });
      }
      for (let index = 0; index < state.trainingPlan.assignedPlayerIds.length; index += 1) {
        const playerId = state.trainingPlan.assignedPlayerIds[index];
        if (assignedIds.has(playerId)) {
          context.addIssue({
            code: 'custom',
            path: ['trainingPlan', 'assignedPlayerIds', index],
            message: 'assigned player ID must be unique',
          });
        }
        assignedIds.add(playerId);
        if (!playerIds.has(playerId) || playerClubById.get(playerId) !== state.userClubId) {
          context.addIssue({
            code: 'custom',
            path: ['trainingPlan', 'assignedPlayerIds', index],
            message: 'assigned player must belong to the user club',
          });
        }
      }
      for (let index = 0; index < state.trainingPlan.drills.length; index += 1) {
        const drillId = state.trainingPlan.drills[index].id;
        if (drillIds.has(drillId)) {
          context.addIssue({
            code: 'custom',
            path: ['trainingPlan', 'drills', index, 'id'],
            message: 'training drill ID must be unique',
          });
        }
        drillIds.add(drillId);
      }
    }
  });

export function serializeGameState(state: GameState): string {
  assertSupportedSchema(state, false);
  let validation: z.ZodSafeParseResult<unknown>;
  try {
    validation = gameStateSchema.safeParse(state);
  } catch {
    throw new InvalidGameStateError('validation failed unexpectedly');
  }
  if (!validation.success) {
    throw new InvalidGameStateError(formatIssues(validation.error.issues));
  }

  try {
    const serialized = JSON.stringify(state);
    if (serialized === undefined)
      throw new Error('JSON.stringify returned undefined');
    return serialized;
  } catch {
    throw new InvalidGameStateError('state is not JSON-serializable');
  }
}

export function parseStoredGameState(serialized: string): GameState {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new CorruptCareerSaveError('state_json is not valid JSON');
  }

  assertSupportedSchema(value, true);
  let validation: z.ZodSafeParseResult<unknown>;
  try {
    validation = gameStateSchema.safeParse(value);
  } catch {
    throw new CorruptCareerSaveError('state validation failed unexpectedly');
  }
  if (!validation.success) {
    throw new CorruptCareerSaveError(formatIssues(validation.error.issues));
  }
  const parsed = validation.data as Omit<GameState, 'awakening'> & {
    awakening?: Omit<GameState['awakening'], 'usedTriggerIds'> & { usedTriggerIds?: string[] };
  };
  return {
    ...parsed,
    awakening: parsed.awakening === undefined
      ? { matchesSinceLastAwakening: 0, usedTriggerIds: [] }
      : {
          ...parsed.awakening,
          usedTriggerIds: parsed.awakening.usedTriggerIds ?? [],
        },
  };
}

function assertSupportedSchema(value: unknown, stored: boolean): void {
  if (!isRecord(value) || !Number.isSafeInteger(value.schemaVersion)) {
    if (stored)
      throw new CorruptCareerSaveError('schemaVersion is missing or invalid');
    throw new InvalidGameStateError('schemaVersion is missing or invalid');
  }
  if (value.schemaVersion !== GAME_SCHEMA_VERSION) {
    throw new UnsupportedGameSchemaError(
      value.schemaVersion as number,
      GAME_SCHEMA_VERSION,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatIssues(issues: z.core.$ZodIssue[]): string {
  return issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || 'state'} ${issue.message}`)
    .join('; ');
}
