import {
  generateCoachMarket,
  resolveScoutMission,
  startContractNegotiation,
  startScoutMission,
  submitContractOffer,
  type ScoutablePlayer,
  type ValuationPlayer,
} from '../../game/market';
import { marketViewModel, type MarketViewModelSource } from '../market-view-model';

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
      { id: 'local-mid', region: 'LOCAL', focus: { kind: 'POSITION', role: 'MID' } },
      { id: 'hero-rumor', region: 'EUROPE', focus: { kind: 'RUMORED_HERO' } },
    ],
    transferListings: [{
      player: transferPlayer('target-1'),
      direction: 'BUY',
      sellingClubDivision: 3,
    }],
    coachCandidates: generateCoachMarket({
      careerSeed: 404,
      season: 2,
      division: 3,
      fame: 350,
    }),
  };
}

describe('marketViewModel', () => {
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
    const viewModel = marketViewModel({ ...source, activeScoutMission: mission });

    expect(viewModel.scouting.status.kind).toBe('IN_PROGRESS');
    expect(viewModel.scouting.status.progressLabel).toMatch(/week/);
    expect(viewModel.scouting.choices.every(choice => !choice.available)).toBe(true);
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
      activeScoutMission: mission,
      scoutResult,
      scoutedPlayerIdentities: [{ id: player.id, name: 'Nico Haze' }],
    });

    expect(viewModel.scouting.status.kind).toBe('COMPLETED');
    expect(viewModel.scouting.reports[0]).toMatchObject({
      playerName: 'Nico Haze',
      role: 'MID',
      ageLabel: 'Age 22',
    });
    expect(viewModel.scouting.reports[0]).not.toHaveProperty('potentialLabel');
    expect(viewModel.scouting.reports[0].stats).toHaveLength(6);
    expect(JSON.parse(JSON.stringify(viewModel))).toEqual(viewModel);
  });

  it('shows deterministic transfer quotes and closes their actions outside a window', () => {
    const open = marketViewModel(baseSource());
    const closed = marketViewModel({ ...baseSource(), week: 12 });

    expect(open.window.label).toBe('Window open');
    expect(open.transfers[0].available).toBe(true);
    expect(open.transfers[0].quote).toBeGreaterThan(open.transfers[0].valuation);
    expect(open).toEqual(marketViewModel(baseSource()));
    expect(closed.window.label).toBe('Window closed');
    expect(closed.transfers[0]).toMatchObject({
      available: false,
      blockedReason: 'Registration window closed.',
    });
  });

  it('presents coach specialties, gates, and retired-legend loyalty', () => {
    const source = baseSource();
    const coachCandidates = generateCoachMarket({
      careerSeed: 8,
      season: 4,
      division: 2,
      fame: 800,
      retiredLegends: [{
        playerId: 'legend-1',
        name: 'Ari Flint',
        personality: 'LOYAL',
        fame: 750,
        seasonsAtClub: 8,
        specialties: ['ATTACK', 'MOTIVATOR'],
      }],
    });
    const viewModel = marketViewModel({
      ...source,
      division: 2,
      fame: 800,
      coachCandidates,
    });
    const legend = viewModel.coaches.find(coach => coach.retiredLegend);

    expect(viewModel.coaches.every(coach => coach.specialtyLabels.length === 2)).toBe(true);
    expect(legend).toMatchObject({
      name: 'Ari Flint',
      loyaltyLabel: '25% loyalty discount',
      available: true,
      headEffectLabels: [
        'SHO training +40%',
        'Morale loss −20% · Hero Gauge +20%',
      ],
      assistantEffectLabels: [
        'SHO training +20%',
        'Morale loss −10% · Hero Gauge +10%',
      ],
    });
  });

  it('never presents more than three coach choices', () => {
    const source = baseSource();
    const expanded = Array.from({ length: 5 }, (_, index) => ({
      ...source.coachCandidates[index % source.coachCandidates.length],
      id: `shortlist-${index}`,
      name: `Coach ${index}`,
    }));

    expect(marketViewModel({ ...source, coachCandidates: expanded }).coaches.map(coach => coach.id))
      .toEqual(['shortlist-0', 'shortlist-1', 'shortlist-2']);
  });

  it('locks every hire action while one head coach is employed', () => {
    const source = baseSource();
    const currentCoach = source.coachCandidates[0];
    const viewModel = marketViewModel({ ...source, headCoach: currentCoach });

    expect(viewModel.coaches.every(coach => !coach.available)).toBe(true);
    expect(viewModel.coaches.every(coach => (
      coach.blockedReason === `Dismiss ${currentCoach.name} first.`
    ))).toBe(true);
  });

  it('exposes a usable mood/card panel without leaking the hidden weekly ask', () => {
    const initial = startContractNegotiation({
      careerSeed: 55,
      negotiationId: 'talks-55',
      playerId: 'target-1',
      personality: 'PROFESSIONAL',
      weeklyAsk: 1000,
    });
    const countered = submitContractOffer(
      initial,
      { weeklyWage: 700, termSeasons: 1, perk: 'JERSEY_10' },
    );
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
});
