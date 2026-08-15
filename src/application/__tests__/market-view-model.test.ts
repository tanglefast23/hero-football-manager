import {
  generateCoachMarket,
  resolveScoutMission,
  startContractNegotiation,
  startScoutMission,
  submitContractOffer,
  type ScoutablePlayer,
  type ValuationPlayer,
} from '../../game/market';
import {
  marketViewModel,
  type MarketViewModelSource,
} from '../market-view-model';

const ATTRS = { pac: 60, sho: 58, pas: 64, def: 48, tec: 66, sta: 62, ref: 30 };

function scoutPlayer(id: string): ScoutablePlayer {
  return {
    id,
    region: 'EUROPE',
    role: 'MID',
    age: 22,
    attrs: { ...ATTRS },
    potential: 4,
    personality: 'PROFESSIONAL',
    contractSeasonsRemaining: 2,
  };
}

function transferPlayer(id: string): ValuationPlayer & { name: string } {
  return {
    id,
    name: 'Milo Vale',
    role: 'MID',
    attrs: { ...ATTRS },
    age: 24,
    potential: 4,
    contractSeasonsRemaining: 2,
  };
}

function baseSource(): MarketViewModelSource {
  return {
    careerSeed: 404,
    season: 2,
    week: 17,
    currentCareerWeek: 47,
    division: 3,
    fame: 350,
    cash: 50_000,
    scoutOfficeLevel: 2,
    scoutOptions: [
      {
        id: 'local-mid',
        region: 'LOCAL',
        focus: { kind: 'POSITION', role: 'MID' },
      },
      { id: 'hero-rumor', region: 'EUROPE', focus: { kind: 'RUMORED_HERO' } },
    ],
    transferListings: [
      {
        player: transferPlayer('target-1'),
        direction: 'BUY',
        sellingClubDivision: 3,
      },
    ],
    coachCandidates: generateCoachMarket({
      careerSeed: 404,
      season: 2,
      division: 3,
      fame: 350,
    }),
  };
}

describe('marketViewModel', () => {
  it('offers one unaffordable first scouting trip for free, then blocks later trips', () => {
    const first = marketViewModel({
      ...baseSource(),
      cash: 0,
      firstScoutFavorAvailable: true,
    });
    const later = marketViewModel({
      ...baseSource(),
      cash: 0,
      firstScoutFavorAvailable: false,
    });

    expect(first.scouting.choices[0]).toMatchObject({
      available: true,
      feeWaived: true,
    });
    expect(first.scouting.choices[0].blockedReason).toBeUndefined();
    expect(later.scouting.choices[0]).toMatchObject({
      available: false,
      feeWaived: false,
      blockedReason: 'Not enough money.',
    });
  });

  it('presents an active scouting trip and locks new mission choices', () => {
    const source = baseSource();
    const mission = startScoutMission({
      careerSeed: source.careerSeed,
      missionId: 'active-trip',
      startWeek: 46,
      region: 'LOCAL',
      focus: { kind: 'POSITION', role: 'MID' },
      scoutOfficeLevel: 2,
      division: 3,
    });
    const viewModel = marketViewModel({
      ...source,
      activeScoutMission: mission,
    });

    expect(viewModel.scouting.status.kind).toBe('IN_PROGRESS');
    expect(viewModel.scouting.status.progressLabel).toMatch(/week/);
    expect(
      viewModel.scouting.choices.every((choice) => !choice.available),
    ).toBe(true);
    expect(viewModel.scouting.choices[0].blockedReason).toBe('Scout Sent');
  });

  it('turns resolved fuzzy reports into compact, serializable player dossiers', () => {
    const source = baseSource();
    const player = scoutPlayer('scout-1');
    const mission = startScoutMission({
      careerSeed: source.careerSeed,
      missionId: 'filed-trip',
      startWeek: 42,
      region: 'EUROPE',
      focus: { kind: 'POSITION', role: 'MID' },
      scoutOfficeLevel: 2,
      division: 3,
    });
    const scoutResult = resolveScoutMission(mission, mission.dueWeek, [player]);
    const viewModel = marketViewModel({
      ...source,
      scoutResult,
      scoutedPlayerIdentities: [{ id: player.id, name: 'Nico Haze' }],
    });

    expect(viewModel.scouting.status.kind).toBe('COMPLETED');
    expect(viewModel.scouting.reports[0]).toMatchObject({
      playerName: 'Nico Haze',
      role: 'MID',
      ageLabel: 'Age 22',
    });
    expect(viewModel.scouting.reports[0].potentialLabel).toBe('B-–A+');
    expect(viewModel.scouting.reports[0].stats).toHaveLength(6);
    expect(JSON.parse(JSON.stringify(viewModel))).toEqual(viewModel);
  });

  it('shows a new active trip even while an older report remains on the desk', () => {
    const source = baseSource();
    const mission = startScoutMission({
      careerSeed: source.careerSeed,
      missionId: 'new-trip',
      startWeek: 46,
      region: 'EUROPE',
      focus: { kind: 'POSITION', role: 'MID' },
      scoutOfficeLevel: 2,
      division: 3,
    });
    const oldResult = resolveScoutMission(
      { ...mission, id: 'old-trip' },
      mission.dueWeek,
      [scoutPlayer('old-player')],
    );
    const viewModel = marketViewModel({
      ...source,
      activeScoutMission: mission,
      scoutResult: oldResult,
      scoutedPlayerIdentities: [{ id: 'old-player', name: 'Old Scout Target' }],
    });

    expect(viewModel.scouting.status.kind).toBe('IN_PROGRESS');
    expect(viewModel.scouting.reports).toHaveLength(1);
    expect(
      viewModel.scouting.choices.every((choice) => !choice.available),
    ).toBe(true);
  });

  it('shows deterministic transfer quotes and closes their actions outside a window', () => {
    const open = marketViewModel(baseSource());
    const closed = marketViewModel({ ...baseSource(), week: 12 });

    expect(open.window.label).toBe('Window open');
    expect(open.transfers[0].available).toBe(true);
    expect(open.transfers[0].quote).toBeGreaterThan(
      open.transfers[0].valuation,
    );
    expect(open).toEqual(marketViewModel(baseSource()));
    expect(closed.window.label).toBe('Window closed');
    expect(closed.window.weeksUntilOpen).toBe(5);
    expect(closed.transfers[0]).toMatchObject({
      available: false,
      blockedReason: 'Registration window closed.',
    });
  });

  it('keeps an unaffordable transfer pressable so the desk can explain the refusal', () => {
    const listing = marketViewModel({ ...baseSource(), cash: 0 }).transfers[0];

    expect(listing).toMatchObject({
      available: true,
      blockedReason: 'Transfer fee exceeds current cash.',
    });
  });

  it('presents coach specialties, gates, and retired-legend loyalty', () => {
    const source = baseSource();
    const coachCandidates = generateCoachMarket({
      careerSeed: 8,
      season: 4,
      division: 2,
      fame: 800,
      retiredLegends: [
        {
          playerId: 'legend-1',
          name: 'Ari Flint',
          personality: 'LOYAL',
          fame: 750,
          seasonsAtClub: 8,
          specialties: ['ATTACK', 'MOTIVATOR'],
        },
      ],
    });
    const viewModel = marketViewModel({
      ...source,
      division: 2,
      fame: 800,
      coachCandidates,
    });
    const legend = viewModel.coaches.find((coach) => coach.retiredLegend);

    expect(
      viewModel.coaches.every((coach) => coach.specialtyLabels.length === 2),
    ).toBe(true);
    expect(legend).toMatchObject({
      name: 'Ari Flint',
      loyaltyLabel: '25% loyalty discount',
      available: true,
      headEffectLabels: [
        'SHO training +40%',
        'Morale loss -20% · Hero Gauge +20%',
        '+8 TP weekly',
      ],
      assistantEffectLabels: [
        'SHO training +20%',
        'Morale loss -10% · Hero Gauge +10%',
        '+4 TP weekly',
      ],
    });
  });

  it('keeps a taught formation readable as a shape rather than loose digits', () => {
    const source = baseSource();
    const coachCandidates = generateCoachMarket({
      careerSeed: 8,
      season: 4,
      division: 2,
      fame: 800,
      unlockIds: ['formation:4-3-3'],
    });
    const viewModel = marketViewModel({
      ...source,
      division: 2,
      fame: 800,
      coachCandidates,
    });
    const teacher = viewModel.coaches.find(
      (coach) => coach.unlockLabel !== undefined,
    );

    expect(teacher?.unlockLabel).toBe('Unlocks 4-3-3 in Settings');
  });

  it('never presents more than three coach choices', () => {
    const source = baseSource();
    const expanded = Array.from({ length: 5 }, (_, index) => ({
      ...source.coachCandidates[index % source.coachCandidates.length],
      id: `shortlist-${index}`,
      name: `Coach ${index}`,
    }));

    expect(
      marketViewModel({ ...source, coachCandidates: expanded }).coaches.map(
        (coach) => coach.id,
      ),
    ).toEqual(['shortlist-0', 'shortlist-1', 'shortlist-2']);
  });

  it('locks every hire action while one head coach is employed', () => {
    const source = baseSource();
    const currentCoach = source.coachCandidates[0];
    const viewModel = marketViewModel({ ...source, headCoach: currentCoach });

    expect(viewModel.coaches.every((coach) => !coach.available)).toBe(true);
    expect(
      viewModel.coaches.every(
        (coach) =>
          coach.blockedReason === `Dismiss ${currentCoach.name} first.`,
      ),
    ).toBe(true);
  });

  // Narrowed 2026-08-06 rather than deleted. The ask stays hidden for TRANSFERS,
  // which is what this view model builds; renewals now publish it deliberately
  // (see docs/06-economy.md and `careerRenewalWeeklyAsk`), because a manager
  // knows what their own player wants and does not know what a stranger wants.
  it('exposes a usable transfer mood/card panel without leaking the hidden weekly ask', () => {
    const initial = startContractNegotiation({
      careerSeed: 55,
      negotiationId: 'talks-55',
      playerId: 'target-1',
      personality: 'PROFESSIONAL',
      weeklyAsk: 1000,
    });
    const countered = submitContractOffer(initial, {
      weeklyWage: 700,
      termSeasons: 1,
      perk: 'JERSEY_10',
    });
    const viewModel = marketViewModel({
      ...baseSource(),
      negotiation: {
        state: countered,
        playerName: 'Milo Vale',
        openingWeeklyWage: 600,
        wageStep: 50,
      },
    });

    expect(viewModel.negotiation).toMatchObject({
      playerName: 'Milo Vale',
      moodLabel: 'Unhappy',
      roundLabel: 'Round 2 of 3',
      initialWeeklyWage: 700,
      wageStep: 50,
      status: 'OPEN',
    });
    expect(viewModel.negotiation?.cards).toHaveLength(3);
    expect(viewModel.negotiation?.perks).toHaveLength(4);
    expect(viewModel.negotiation).not.toHaveProperty('weeklyAsk');
  });

  describe('youth prospect stats', () => {
    function withYouth(
      role: 'GK' | 'DEF' | 'MID' | 'FWD',
    ): MarketViewModelSource {
      return {
        ...baseSource(),
        youthIntake: {
          status: 'OPEN',
          declined: false,
          rosterCount: 15,
          rosterCapacity: 17,
          offers: [
            {
              player: {
                id: 'kid-1',
                name: 'Cal Hart',
                role,
                age: 17,
                potential: 2,
                archetype: 'Anchor',
                weeklyWage: 202,
                attrs: { ...ATTRS },
              },
              signingBonus: 500,
            },
          ],
        },
      };
    }

    it('states the prospect exact stats rather than a scouted range', () => {
      const offer = marketViewModel(withYouth('FWD')).youth?.offers[0];

      expect(offer?.stats).toEqual([
        { label: 'PAC', value: ATTRS.pac },
        { label: 'SHO', value: ATTRS.sho },
        { label: 'PAS', value: ATTRS.pas },
        { label: 'DEF', value: ATTRS.def },
        { label: 'TEC', value: ATTRS.tec },
        { label: 'STA', value: ATTRS.sta },
      ]);
      // No hedging: every value is a number the card can print as-is.
      expect(offer?.stats.every((stat) => Number.isInteger(stat.value))).toBe(
        true,
      );
    });

    it('shows a keeper reflexes in place of finishing', () => {
      const offer = marketViewModel(withYouth('GK')).youth?.offers[0];

      expect(offer?.stats.map((stat) => stat.label)).toEqual([
        'PAC',
        'REF',
        'PAS',
        'DEF',
        'TEC',
        'STA',
      ]);
      expect(offer?.stats.find((stat) => stat.label === 'REF')?.value).toBe(
        ATTRS.ref,
      );
      expect(offer?.stats.some((stat) => stat.label === 'SHO')).toBe(false);
    });
  });
});
