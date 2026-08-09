import { compareIds, compareStandings } from './ordering';
import type { DivisionLevel } from './pyramid';
import type {
  SponsorContractSnapshot,
  SponsorObjectiveKind,
  SponsorObjectiveSnapshot,
  SponsorOfferSnapshot,
  SponsorProfileId,
  SponsorRules,
  SponsorshipState,
} from './club-business-types';
import type { DifficultyMode, LeagueFixture } from './types';

export const SPONSOR_OFFER_LAST_WEEK = 4;
export const SPONSOR_OFFER_EXPIRY_WEEK = 5;
export const SPONSOR_PAYMENT_WEEKS = [4, 8, 12, 16, 20, 24, 28] as const;

const SPONSOR_PROFILES: readonly SponsorProfileId[] = [
  'STEADY',
  'BALANCED',
  'BOLD',
];
const UINT32_MAX = 4_294_967_295;
const MONEY_PERCENT_DENOMINATOR = 100;

type ManagedSponsorCapacity = 0 | 1 | 2 | 3;

interface SponsorSeasonContext {
  readonly rules: SponsorRules;
  readonly careerSeed: number;
  readonly season: number;
  readonly division: DivisionLevel;
  readonly difficulty: DifficultyMode;
  /** Best (numerically lowest) division the club has reached in its career. */
  readonly highestDivisionReached: DivisionLevel;
  /**
   * Exact nominal scalar to preserve. New seasons normally pass the division
   * anchor; migrations pass the value stored in the schema-3 club instead.
   */
  readonly nominalAnchor: number;
}

interface SponsorOfferGenerationContext {
  readonly rules: SponsorRules;
  readonly careerSeed: number;
  readonly season: number;
  readonly division: DivisionLevel;
  readonly difficulty: DifficultyMode;
  readonly activeContracts: readonly SponsorContractSnapshot[];
}

interface AcceptSponsorOfferContext {
  readonly offerId: string;
  readonly season: number;
  readonly week: number;
}

interface SponsorPaymentAllocation {
  readonly contractId: string;
  readonly sponsorName: string;
  readonly slot: number;
  readonly nominalAmount: number;
  readonly actualAmount: number;
}

interface SponsorObjectiveProgress {
  readonly kind: SponsorObjectiveKind;
  readonly target: number;
  /** Wins, goals, or current/final table position according to `kind`. */
  readonly value: number;
  readonly met: boolean;
}

interface SponsorObjectiveSettlement {
  readonly sponsorship: SponsorshipState;
  /** Only met, newly settled objectives produce payment rows. */
  readonly payments: SponsorPaymentAllocation[];
}

/**
 * Managed slots are a permanent achievement, not a current-division perk.
 * Passing the best division reached is what lets a relegated D5 club retain
 * the one slot it first unlocked in D4.
 */
export function managedSponsorCapacity(
  highestDivisionReached: DivisionLevel,
): ManagedSponsorCapacity {
  validateDivision(highestDivisionReached, 'highest division reached');
  if (highestDivisionReached <= 2) return 3;
  if (highestDivisionReached === 3) return 2;
  if (highestDivisionReached === 4) return 1;
  return 0;
}

/** The nominal scalar the existing economy assigns to each division. */
export function divisionSponsorAnchor(division: DivisionLevel): number {
  validateDivision(division, 'sponsor division');
  return ({ 5: 3_000, 4: 4_000, 3: 6_000, 2: 8_000, 1: 10_000 } as const)[
    division
  ];
}

/**
 * Split an exact scalar into stable slots. Any indivisible remainder belongs
 * wholly to slot zero, matching the approved D2/D1 examples.
 */
export function sponsorBaselineShares(
  nominalTotal: number,
  capacity: Exclude<ManagedSponsorCapacity, 0>,
): number[] {
  validateMoney(nominalTotal, 'sponsor nominal total');
  validatePositiveInteger(capacity, 'sponsor slot capacity');
  if (capacity > 3) throw new Error('sponsor slot capacity cannot exceed 3');

  const base = Math.floor(nominalTotal / capacity);
  const remainder = nominalTotal - base * capacity;
  return Array.from(
    { length: capacity },
    (_, slot) => base + (slot === 0 ? remainder : 0),
  );
}

/**
 * Income-preserving placeholders created before the player chooses offers.
 * They carry no objective, so migration never invents a retroactive bonus.
 *
 * @i18n-fallback — these two strings are NOT a brand. `'continuity'` matches no
 * row in `sponsors.json`, and the words are the UI's way of saying "the deal you
 * already have", so they resolve through the CHROME keys
 * `clubFinances.sponsorContinuityName` / `.sponsorContinuityNameNumbered` /
 * `.sponsorContinuityTerms` — see `clubSponsorshipViewModel` in
 * `application/view-models.ts`, which special-cases the id. Deliberately not
 * synthetic content keys: the whole of `sponsors.json` is persisted per career
 * as `sponsorRules`, so a fake brand row there would be a gameplay object, not
 * copy. The English stays here because `sponsorContractSnapshotSchema` is a
 * `z.strictObject` with no `*Key` field beside `sponsorName`/`offerLine`, and
 * widening it would be the save-format change this work proved unnecessary —
 * the resolution belongs at the render boundary instead.
 */
export function createProvisionalSponsorPortfolio(
  nominalTotal: number,
  capacity: Exclude<ManagedSponsorCapacity, 0>,
  season: number,
): SponsorContractSnapshot[] {
  validatePositiveInteger(season, 'sponsor portfolio season');
  return sponsorBaselineShares(nominalTotal, capacity).map(
    (nominalMonthlyFee, slot) => ({
      contractId: `continuity-s${season}-slot${slot}`,
      sponsorContentId: 'continuity',
      sponsorName:
        capacity === 1 ? 'Current Sponsor' : `Current Sponsor ${slot + 1}`,
      offerLine: 'Your existing sponsor terms continue.',
      season,
      slot,
      nominalMonthlyFee,
      provisional: true,
    }),
  );
}

/** Opens one season's managed portfolio from the exact scalar supplied by its caller. */
export function createSeasonSponsorship(
  context: SponsorSeasonContext,
): SponsorshipState {
  validateSponsorSeasonContext(context);
  const capacity = managedSponsorCapacity(context.highestDivisionReached);
  if (capacity === 0) {
    return {
      activeContracts: [],
      offers: [],
      portfolioSeason: context.season,
    };
  }

  const activeContracts = createProvisionalSponsorPortfolio(
    context.nominalAnchor,
    capacity,
    context.season,
  );
  return {
    activeContracts,
    offers: generateSponsorOffers({
      rules: context.rules,
      careerSeed: context.careerSeed,
      season: context.season,
      division: context.division,
      difficulty: context.difficulty,
      activeContracts,
    }),
    portfolioSeason: context.season,
    offerSeason: context.season,
  };
}

/**
 * Three deterministic candidates for every still-provisional slot.
 *
 * This deliberately owns a tiny hash stream instead of borrowing the match or
 * event RNG. Offer reconciliation can run repeatedly without consuming any
 * simulation value, and the same persisted inputs rebuild byte-identical terms.
 */
export function generateSponsorOffers(
  context: SponsorOfferGenerationContext,
): SponsorOfferSnapshot[] {
  validateOfferGenerationContext(context);
  const brandIds = new Set(context.rules.brands.map((brand) => brand.id));
  const usedBrandIds = new Set(
    context.activeContracts
      .map((contract) => contract.sponsorContentId)
      .filter((contentId) => brandIds.has(contentId)),
  );
  const offers: SponsorOfferSnapshot[] = [];

  const provisionalContracts = [...context.activeContracts]
    .filter(
      (contract) => contract.season === context.season && contract.provisional,
    )
    .sort(
      (left, right) =>
        left.slot - right.slot || compareIds(left.contractId, right.contractId),
    );

  for (const contract of provisionalContracts) {
    const objectiveOffset = deterministicSponsorIndex(
      context,
      contract.slot,
      'objective-family',
      context.rules.objectives.length,
    );

    for (
      let candidateIndex = 0;
      candidateIndex < SPONSOR_PROFILES.length;
      candidateIndex += 1
    ) {
      const profile = SPONSOR_PROFILES[candidateIndex];
      const brand = chooseSponsorBrand(
        context,
        contract.slot,
        profile,
        candidateIndex,
        usedBrandIds,
      );
      usedBrandIds.add(brand.id);

      const objectiveDefinition =
        context.rules.objectives[
          (objectiveOffset + candidateIndex) % context.rules.objectives.length
        ];
      const profileDefinition = context.rules.profiles[profile];
      const target = objectiveTarget(
        objectiveDefinition.kind,
        objectiveDefinition.targets[profileDefinition.objectiveLevel],
        objectiveDefinition.chairmanDelta,
        context,
      );
      const nominalMonthlyFee = percentOfMoney(
        contract.nominalMonthlyFee,
        profileDefinition.monthlyPercent,
        'sponsor monthly offer',
      );
      const nominalBonus = percentOfMoney(
        contract.nominalMonthlyFee,
        profileDefinition.bonusPercentByObjective?.[objectiveDefinition.kind] ??
          profileDefinition.bonusPercent,
        'sponsor objective bonus',
      );

      offers.push({
        offerId: `offer-s${context.season}-slot${contract.slot}-${profile.toLowerCase()}-${brand.id}`,
        sponsorContentId: brand.id,
        sponsorName: brand.name,
        offerLine: brand.offerLine,
        season: context.season,
        slot: contract.slot,
        profile,
        nominalMonthlyFee,
        objective: {
          kind: objectiveDefinition.kind,
          // The dual write, made at GENERATION rather than on accept: an
          // unaccepted offer is drawn on the sponsor desk for four weeks, and a
          // key written only when a deal is signed leaves every card the player
          // is choosing between in English.
          label: objectiveDefinition.labelTemplate.replace(
            '{target}',
            String(target),
          ),
          labelKey: `sponsor.objective.${objectiveDefinition.id}.label`,
          labelParams: { target },
          target,
          nominalBonus,
        },
      });
    }
  }

  return offers;
}

/**
 * Atomically signs one candidate. All guards run before a new object is built,
 * so stale/replayed actions leave both cash and sponsorship state untouched.
 */
export function acceptSponsorOffer(
  sponsorship: SponsorshipState,
  context: AcceptSponsorOfferContext,
): SponsorshipState {
  validatePositiveInteger(context.season, 'sponsor acceptance season');
  validatePositiveInteger(context.week, 'sponsor acceptance week');
  if (context.week > SPONSOR_OFFER_LAST_WEEK) {
    throw new Error('sponsor offers can only be accepted in Weeks 1-4');
  }
  if (
    typeof context.offerId !== 'string' ||
    context.offerId.trim().length === 0
  ) {
    throw new Error('sponsor offer ID must be a non-empty string');
  }
  if (
    sponsorship.portfolioSeason !== context.season ||
    sponsorship.offerSeason !== context.season
  ) {
    throw new Error('sponsor offer season does not match the active portfolio');
  }

  const offer = sponsorship.offers.find(
    (candidate) => candidate.offerId === context.offerId,
  );
  if (offer === undefined || offer.season !== context.season) {
    throw new Error(`sponsor offer ${context.offerId} is no longer available`);
  }
  const contractsForSlot = sponsorship.activeContracts.filter(
    (contract) =>
      contract.season === context.season && contract.slot === offer.slot,
  );
  if (contractsForSlot.length !== 1) {
    throw new Error(
      `sponsor slot ${offer.slot} does not have exactly one active contract`,
    );
  }
  const continuity = contractsForSlot[0];
  if (!continuity.provisional) {
    throw new Error(`sponsor slot ${offer.slot} is already locked`);
  }

  const signed: SponsorContractSnapshot = {
    contractId: `contract-${offer.offerId}`,
    sponsorContentId: offer.sponsorContentId,
    sponsorName: offer.sponsorName,
    offerLine: offer.offerLine,
    season: offer.season,
    slot: offer.slot,
    nominalMonthlyFee: offer.nominalMonthlyFee,
    profile: offer.profile,
    objective: { ...offer.objective },
    provisional: false,
    signedSeason: context.season,
    signedWeek: context.week,
    replacedContinuity: true,
  };

  return {
    ...sponsorship,
    activeContracts: sponsorship.activeContracts.map((contract) =>
      contract === continuity ? signed : contract,
    ),
    offers: sponsorship.offers.filter(
      (candidate) => candidate.slot !== offer.slot,
    ),
  };
}

/** Locks untouched continuity and expires every unresolved candidate from Week 5 onward. */
export function expireSponsorOfferWindow(
  sponsorship: SponsorshipState,
  season: number,
  week: number,
): SponsorshipState {
  validatePositiveInteger(season, 'sponsor expiry season');
  validatePositiveInteger(week, 'sponsor expiry week');
  if (week < SPONSOR_OFFER_EXPIRY_WEEK) return sponsorship;
  if (sponsorship.portfolioSeason !== season) {
    throw new Error(
      'cannot expire offers for a different sponsor portfolio season',
    );
  }

  const hasOffers = sponsorship.offers.some((offer) => offer.season === season);
  const hasProvisional = sponsorship.activeContracts.some(
    (contract) => contract.season === season && contract.provisional,
  );
  if (!hasOffers && !hasProvisional) return sponsorship;

  return {
    ...sponsorship,
    activeContracts: sponsorship.activeContracts.map((contract) =>
      contract.season === season && contract.provisional
        ? { ...contract, provisional: false }
        : contract,
    ),
    offers: sponsorship.offers.filter((offer) => offer.season !== season),
  };
}

/**
 * One portfolio-level difficulty calculation, then exact deterministic lines.
 * The largest fractional remainders receive the spare dollars; ties use slots.
 */
export function allocateSponsorPortfolioPayment(
  contracts: readonly SponsorContractSnapshot[],
  sponsorIncomePercent: number,
): SponsorPaymentAllocation[] {
  return allocateSponsorAmounts(
    contracts.map((contract) => ({
      contractId: contract.contractId,
      sponsorName: contract.sponsorName,
      slot: contract.slot,
      nominalAmount: contract.nominalMonthlyFee,
    })),
    sponsorIncomePercent,
  );
}

export function nominalSponsorPortfolioIncome(
  contracts: readonly Pick<SponsorContractSnapshot, 'nominalMonthlyFee'>[],
): number {
  return contracts.reduce(
    (total, contract) =>
      checkedAdd(
        total,
        contract.nominalMonthlyFee,
        'nominal sponsor portfolio',
      ),
    0,
  );
}

export function actualSponsorPortfolioIncome(
  contracts: readonly SponsorContractSnapshot[],
  sponsorIncomePercent: number,
): number {
  return allocateSponsorPortfolioPayment(
    contracts,
    sponsorIncomePercent,
  ).reduce(
    (total, allocation) =>
      checkedAdd(total, allocation.actualAmount, 'actual sponsor portfolio'),
    0,
  );
}

/** Current wins/goals/table place, reconstructed only from persisted league fixtures. */
export function sponsorObjectiveProgressFromFixtures(
  objective: SponsorObjectiveSnapshot,
  fixtures: readonly LeagueFixture[],
  userClubId: string,
  season: number,
): SponsorObjectiveProgress {
  validateObjectiveSnapshot(objective);
  validatePositiveInteger(season, 'sponsor objective season');
  if (typeof userClubId !== 'string' || userClubId.trim().length === 0) {
    throw new Error(
      'sponsor objective user club ID must be a non-empty string',
    );
  }

  const table = leagueTableFromFixtures(fixtures, season);
  const user = table.find((row) => row.clubId === userClubId);
  if (user === undefined)
    throw new Error(`league fixtures do not contain user club ${userClubId}`);

  const value =
    objective.kind === 'LEAGUE_WINS'
      ? user.won
      : objective.kind === 'LEAGUE_GOALS'
        ? user.goalsFor
        : user.position;
  const met =
    objective.kind === 'LEAGUE_FINISH'
      ? value <= objective.target
      : value >= objective.target;
  return { kind: objective.kind, target: objective.target, value, met };
}

/**
 * Finalizes each current contract exactly once at Week 30. Failed targets keep
 * an honest persisted outcome but deliberately create no zero-dollar line.
 */
export function settleSponsorObjectivesAtWeek30(
  sponsorship: SponsorshipState,
  fixtures: readonly LeagueFixture[],
  userClubId: string,
  season: number,
  week: number,
  sponsorIncomePercent: number,
): SponsorObjectiveSettlement {
  validatePositiveInteger(season, 'sponsor objective settlement season');
  validatePositiveInteger(week, 'sponsor objective settlement week');
  if (week !== 30) throw new Error('sponsor objectives settle only in Week 30');
  if (sponsorship.portfolioSeason !== season) {
    throw new Error(
      'sponsor objective season does not match the active portfolio',
    );
  }

  const unresolved = sponsorship.activeContracts.filter(
    (contract) =>
      contract.season === season &&
      contract.objective !== undefined &&
      contract.objectiveOutcome === undefined,
  );
  if (unresolved.length === 0) return { sponsorship, payments: [] };

  const progressByContractId = new Map(
    unresolved.map((contract) => [
      contract.contractId,
      sponsorObjectiveProgressFromFixtures(
        contract.objective!,
        fixtures,
        userClubId,
        season,
      ),
    ]),
  );
  const met = unresolved.filter(
    (contract) => progressByContractId.get(contract.contractId)!.met,
  );
  const payments = allocateSponsorAmounts(
    met.map((contract) => ({
      contractId: contract.contractId,
      sponsorName: contract.sponsorName,
      slot: contract.slot,
      nominalAmount: contract.objective!.nominalBonus,
    })),
    sponsorIncomePercent,
  );
  const actualByContractId = new Map(
    payments.map((payment) => [payment.contractId, payment.actualAmount]),
  );

  return {
    sponsorship: {
      ...sponsorship,
      activeContracts: sponsorship.activeContracts.map((contract) => {
        const progress = progressByContractId.get(contract.contractId);
        if (progress === undefined) return contract;
        return {
          ...contract,
          objectiveOutcome: {
            met: progress.met,
            settledSeason: season,
            actualBonus: actualByContractId.get(contract.contractId) ?? 0,
          },
        };
      }),
    },
    payments,
  };
}

interface SponsorAmount {
  readonly contractId: string;
  readonly sponsorName: string;
  readonly slot: number;
  readonly nominalAmount: number;
}

function allocateSponsorAmounts(
  amounts: readonly SponsorAmount[],
  sponsorIncomePercent: number,
): SponsorPaymentAllocation[] {
  if (
    !Number.isSafeInteger(sponsorIncomePercent) ||
    sponsorIncomePercent < 0 ||
    sponsorIncomePercent > 100
  ) {
    throw new Error('sponsor income percent must be an integer from 0 to 100');
  }

  const ordered = [...amounts].sort(
    (left, right) =>
      left.slot - right.slot || compareIds(left.contractId, right.contractId),
  );
  const slots = new Set<number>();
  const contractIds = new Set<string>();
  let nominalTotal = 0;
  const working = ordered.map((amount) => {
    validateMoney(amount.nominalAmount, `${amount.contractId} sponsor amount`);
    if (!Number.isSafeInteger(amount.slot) || amount.slot < 0) {
      throw new Error(
        `${amount.contractId} sponsor slot must be a nonnegative safe integer`,
      );
    }
    if (
      typeof amount.contractId !== 'string' ||
      amount.contractId.trim().length === 0
    ) {
      throw new Error('sponsor contract ID must be a non-empty string');
    }
    if (slots.has(amount.slot))
      throw new Error(`duplicate sponsor slot ${amount.slot}`);
    if (contractIds.has(amount.contractId)) {
      throw new Error(`duplicate sponsor contract ID ${amount.contractId}`);
    }
    slots.add(amount.slot);
    contractIds.add(amount.contractId);
    nominalTotal = checkedAdd(
      nominalTotal,
      amount.nominalAmount,
      'nominal sponsor portfolio',
    );
    const numerator = checkedMultiply(
      amount.nominalAmount,
      sponsorIncomePercent,
      `${amount.contractId} sponsor difficulty numerator`,
    );
    return {
      ...amount,
      actualAmount: Math.floor(numerator / MONEY_PERCENT_DENOMINATOR),
      remainder: numerator % MONEY_PERCENT_DENOMINATOR,
    };
  });

  const portfolioNumerator = checkedMultiply(
    nominalTotal,
    sponsorIncomePercent,
    'sponsor portfolio difficulty numerator',
  );
  const actualTotal = Math.floor(
    portfolioNumerator / MONEY_PERCENT_DENOMINATOR,
  );
  const flooredTotal = working.reduce(
    (total, amount) =>
      checkedAdd(total, amount.actualAmount, 'floored sponsor portfolio'),
    0,
  );
  let dollarsToAllocate = actualTotal - flooredTotal;
  const largestRemainders = [...working].sort(
    (left, right) =>
      right.remainder - left.remainder ||
      left.slot - right.slot ||
      compareIds(left.contractId, right.contractId),
  );
  const receivesDollar = new Set<string>();
  for (
    let index = 0;
    index < largestRemainders.length && dollarsToAllocate > 0;
    index += 1
  ) {
    receivesDollar.add(largestRemainders[index].contractId);
    dollarsToAllocate -= 1;
  }
  if (dollarsToAllocate !== 0) {
    throw new Error('sponsor largest-remainder allocation did not resolve');
  }

  return working.map((amount) => ({
    contractId: amount.contractId,
    sponsorName: amount.sponsorName,
    slot: amount.slot,
    nominalAmount: amount.nominalAmount,
    actualAmount:
      amount.actualAmount + (receivesDollar.has(amount.contractId) ? 1 : 0),
  }));
}

function chooseSponsorBrand(
  context: SponsorOfferGenerationContext,
  slot: number,
  profile: SponsorProfileId,
  candidateIndex: number,
  usedBrandIds: ReadonlySet<string>,
): SponsorRules['brands'][number] {
  const ordered = context.rules.brands
    .map((brand) => ({
      brand,
      rank: sponsorHash([
        context.careerSeed,
        context.season,
        context.division,
        slot,
        profile,
        candidateIndex,
        brand.id,
        'brand',
      ]),
    }))
    .sort(
      (left, right) =>
        left.rank - right.rank || compareIds(left.brand.id, right.brand.id),
    );
  const unused = ordered.find(
    (candidate) => !usedBrandIds.has(candidate.brand.id),
  );
  return (unused ?? ordered[0]).brand;
}

function deterministicSponsorIndex(
  context: Pick<
    SponsorOfferGenerationContext,
    'careerSeed' | 'season' | 'division'
  >,
  slot: number,
  discriminator: string,
  upperExclusive: number,
): number {
  validatePositiveInteger(upperExclusive, 'sponsor choice upper bound');
  return (
    sponsorHash([
      context.careerSeed,
      context.season,
      context.division,
      slot,
      discriminator,
    ]) % upperExclusive
  );
}

function sponsorHash(parts: readonly (number | string)[]): number {
  let hash = 2_166_136_261;
  const value = parts.join('|');
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  // One final avalanche prevents adjacent slot/profile text from clustering.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  return hash >>> 0;
}

function objectiveTarget(
  kind: SponsorObjectiveKind,
  authoredTarget: number,
  chairmanDelta: number,
  context: Pick<SponsorOfferGenerationContext, 'difficulty'>,
): number {
  validatePositiveInteger(authoredTarget, 'sponsor objective target');
  if (context.difficulty !== 'CHAIRMAN') return authoredTarget;
  const adjusted = authoredTarget + chairmanDelta;
  return kind === 'LEAGUE_FINISH' ? Math.max(1, adjusted) : adjusted;
}

interface FixtureStanding {
  readonly position: number;
  readonly clubId: string;
  readonly played: number;
  readonly won: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly goalDifference: number;
  readonly points: number;
}

function leagueTableFromFixtures(
  fixtures: readonly LeagueFixture[],
  season: number,
): FixtureStanding[] {
  interface MutableRow {
    clubId: string;
    played: number;
    won: number;
    goalsFor: number;
    goalsAgainst: number;
    points: number;
  }
  const rows = new Map<string, MutableRow>();
  const seenFixtureIds = new Set<string>();
  const ensureClub = (clubId: string): MutableRow => {
    const existing = rows.get(clubId);
    if (existing !== undefined) return existing;
    const created = {
      clubId,
      played: 0,
      won: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    };
    rows.set(clubId, created);
    return created;
  };

  for (const fixture of fixtures) {
    if (fixture.season !== season) continue;
    if (seenFixtureIds.has(fixture.id))
      throw new Error(`duplicate league fixture ${fixture.id}`);
    seenFixtureIds.add(fixture.id);
    const home = ensureClub(fixture.homeClubId);
    const away = ensureClub(fixture.awayClubId);
    if (fixture.status !== 'played') continue;
    if (fixture.score === undefined)
      throw new Error(`played fixture ${fixture.id} is missing its score`);
    validateFixtureGoals(fixture.score.homeGoals, `${fixture.id} home goals`);
    validateFixtureGoals(fixture.score.awayGoals, `${fixture.id} away goals`);
    home.played = checkedAdd(home.played, 1, `${home.clubId} matches played`);
    away.played = checkedAdd(away.played, 1, `${away.clubId} matches played`);
    home.goalsFor = checkedAdd(
      home.goalsFor,
      fixture.score.homeGoals,
      `${home.clubId} goals for`,
    );
    home.goalsAgainst = checkedAdd(
      home.goalsAgainst,
      fixture.score.awayGoals,
      `${home.clubId} goals against`,
    );
    away.goalsFor = checkedAdd(
      away.goalsFor,
      fixture.score.awayGoals,
      `${away.clubId} goals for`,
    );
    away.goalsAgainst = checkedAdd(
      away.goalsAgainst,
      fixture.score.homeGoals,
      `${away.clubId} goals against`,
    );
    if (fixture.score.homeGoals > fixture.score.awayGoals) {
      home.won = checkedAdd(home.won, 1, `${home.clubId} wins`);
      home.points = checkedAdd(home.points, 3, `${home.clubId} points`);
    } else if (fixture.score.awayGoals > fixture.score.homeGoals) {
      away.won = checkedAdd(away.won, 1, `${away.clubId} wins`);
      away.points = checkedAdd(away.points, 3, `${away.clubId} points`);
    } else {
      home.points = checkedAdd(home.points, 1, `${home.clubId} points`);
      away.points = checkedAdd(away.points, 1, `${away.clubId} points`);
    }
  }
  if (rows.size === 0)
    throw new Error(`league fixtures do not contain season ${season}`);

  return [...rows.values()]
    .map((row) => ({
      ...row,
      goalDifference: row.goalsFor - row.goalsAgainst,
    }))
    .sort(compareStandings)
    .map((row, index) => ({ ...row, position: index + 1 }));
}

function validateSponsorSeasonContext(context: SponsorSeasonContext): void {
  validateOfferContextBase(context);
  validateDivision(context.highestDivisionReached, 'highest division reached');
  validateMoney(context.nominalAnchor, 'sponsor nominal anchor');
}

function validateOfferGenerationContext(
  context: SponsorOfferGenerationContext,
): void {
  validateOfferContextBase(context);
  if (context.rules.brands.length === 0)
    throw new Error('sponsor rules require at least one brand');
  if (context.rules.objectives.length !== SPONSOR_PROFILES.length) {
    throw new Error('sponsor rules require exactly three objective families');
  }
  const kinds = new Set(
    context.rules.objectives.map((objective) => objective.kind),
  );
  if (kinds.size !== SPONSOR_PROFILES.length) {
    throw new Error('sponsor objective families must be unique');
  }
  const slots = new Set<number>();
  for (const contract of context.activeContracts) {
    validateMoney(
      contract.nominalMonthlyFee,
      `${contract.contractId} monthly sponsor fee`,
    );
    if (
      !Number.isSafeInteger(contract.slot) ||
      contract.slot < 0 ||
      contract.slot > 2
    ) {
      throw new Error(`${contract.contractId} sponsor slot must be 0, 1, or 2`);
    }
    if (contract.season === context.season) {
      if (slots.has(contract.slot))
        throw new Error(`duplicate sponsor slot ${contract.slot}`);
      slots.add(contract.slot);
    }
  }
}

function validateOfferContextBase(
  context: Pick<
    SponsorOfferGenerationContext,
    'rules' | 'careerSeed' | 'season' | 'division' | 'difficulty'
  >,
): void {
  if (
    !Number.isInteger(context.careerSeed) ||
    context.careerSeed < 0 ||
    context.careerSeed > UINT32_MAX
  ) {
    throw new Error('sponsor career seed must be a uint32');
  }
  validatePositiveInteger(context.season, 'sponsor season');
  validateDivision(context.division, 'sponsor division');
  if (context.difficulty !== 'COZY' && context.difficulty !== 'CHAIRMAN') {
    throw new Error(`unknown sponsor difficulty ${String(context.difficulty)}`);
  }
  if (!context.rules || typeof context.rules !== 'object') {
    throw new Error('sponsor rules must be provided');
  }
}

function validateObjectiveSnapshot(objective: SponsorObjectiveSnapshot): void {
  if (
    objective.kind !== 'LEAGUE_WINS' &&
    objective.kind !== 'LEAGUE_GOALS' &&
    objective.kind !== 'LEAGUE_FINISH'
  ) {
    throw new Error(`unknown sponsor objective ${String(objective.kind)}`);
  }
  validatePositiveInteger(objective.target, 'sponsor objective target');
  validateMoney(objective.nominalBonus, 'sponsor objective bonus');
}

function validateFixtureGoals(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative safe integer`);
  }
}

function validateDivision(
  value: number,
  label: string,
): asserts value is DivisionLevel {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error(`${label} must be an integer from 1 to 5`);
  }
}

function validatePositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

function validateMoney(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative safe integer`);
  }
}

function percentOfMoney(value: number, percent: number, label: string): number {
  validateMoney(value, label);
  if (!Number.isSafeInteger(percent) || percent < 0) {
    throw new Error(`${label} percent must be a nonnegative safe integer`);
  }
  return Math.round(
    checkedMultiply(value, percent, `${label} numerator`) / 100,
  );
}

function checkedAdd(left: number, right: number, label: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result))
    throw new Error(`${label} exceeds the safe integer range`);
  return result;
}

function checkedMultiply(left: number, right: number, label: string): number {
  const result = left * right;
  if (!Number.isSafeInteger(result))
    throw new Error(`${label} exceeds the safe integer range`);
  return result;
}
