import { createLaunchCareerSetup } from '../launch';
import { marketViewModel } from '../market-view-model';
import {
  careerMarketScoutOptions,
  careerMarketViewModelSource,
} from '../market-source-adapter';
import { createCareer } from '../../game/career';
import { enableFullCareer } from '../../game/full-career';
import { buildCareerFacility } from '../../game/management';
import { advanceFacilityConstruction } from '../../game/facilities';
import {
  beginCareerTransferTalks,
  startCareerScoutMission,
  type CareerMarketState,
} from '../../game/market-career';
import type { CareerPlayer, GameState } from '../../game/types';

function fullCareer(seed = 20260719): GameState {
  return enableFullCareer(createCareer(createLaunchCareerSetup(seed)));
}

function exactReport(player: CareerPlayer): CareerMarketState['scoutReports'][number] {
  const range = (value: number) => ({ minimum: value, maximum: value });
  return {
    playerId: player.id,
    role: player.role,
    age: player.age ?? 24,
    statRanges: {
      pac: range(player.attrs.pac),
      sho: range(player.attrs.sho),
      pas: range(player.attrs.pas),
      def: range(player.attrs.def),
      tec: range(player.attrs.tec),
      sta: range(player.attrs.sta),
      ref: range(player.attrs.ref),
    },
    potentialRange: range(player.potential ?? 3),
    ...(player.power === undefined ? {} : { power: player.power }),
  };
}

describe('career market view-model source adapter', () => {
  it('derives deterministic scout briefs and live club context without mutating career state', () => {
    const initial = fullCareer(711);
    const officeProject = buildCareerFacility(initial, 'scout-office', { x: 0, y: 0 }).state;
    const withOffice = {
      ...officeProject,
      facilities: {
        ...officeProject.facilities,
        grid: advanceFacilityConstruction(officeProject.facilities.grid!).grid,
      },
    };
    const before = JSON.stringify(withOffice);
    const first = careerMarketViewModelSource(withOffice);
    const second = careerMarketViewModelSource(withOffice, withOffice.market);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(withOffice)).toBe(before);
    expect(first).toMatchObject({
      careerSeed: 711,
      season: 1,
      week: 1,
      currentCareerWeek: 1,
      division: 5,
      cash: withOffice.clubs.find(club => club.id === withOffice.userClubId)?.cash,
      scoutOfficeLevel: 1,
    });
    expect(first.scoutOptions).toHaveLength(4);
    expect(first.youthIntake).toMatchObject({
      status: 'OPEN',
      rosterCapacity: 16,
    });
    expect(first.youthIntake?.offers.length).toBeGreaterThanOrEqual(1);
    expect(new Set(first.scoutOptions.map(option => option.id)).size).toBe(4);
    expect(new Set(first.scoutOptions.map(option => option.focus.kind))).toEqual(
      new Set(['AGE', 'POSITION', 'RUMORED_HERO']),
    );
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(marketViewModel(first).youth).toMatchObject({
      status: 'OPEN',
      rosterLabel: '16/16 rostered',
      offers: [expect.objectContaining({ available: false, blockedReason: expect.stringContaining('Roster full') })],
    });
  });

  it('exposes an active mission, its charged cash, and the same deterministic option mapping', () => {
    const state = fullCareer(812);
    const options = careerMarketScoutOptions(state);
    const selected = options[0];
    const started = startCareerScoutMission(
      state,
      state.market!,
      selected.region,
      selected.focus,
      5,
    );
    const source = careerMarketViewModelSource(started.state, started.market);

    expect(source.activeScoutMission).toEqual(started.market.activeScoutMission);
    expect(source.cash).toBe(
      state.clubs.find(club => club.id === state.userClubId)!.cash
        - started.market.activeScoutMission!.cost,
    );
    expect(source.scoutOptions).toEqual(options);
  });

  it('maps current reports into buy listings and eligible user players into sell listings', () => {
    const state = fullCareer(913);
    const target = state.players.find(player => player.clubId !== state.userClubId)!;
    const market: CareerMarketState = {
      ...state.market!,
      nextMissionNumber: 2,
      scoutReports: [exactReport(target)],
    };
    const source = careerMarketViewModelSource(state, market);
    const buy = source.transferListings.find(listing => listing.direction === 'BUY');
    const sells = source.transferListings.filter(listing => listing.direction === 'SELL');

    expect(source.scoutResult).toMatchObject({
      missionId: 'scout-1',
      completedWeek: 1,
      reports: [{ playerId: target.id }],
    });
    expect(source.scoutedPlayerIdentities).toContainEqual(expect.objectContaining({
      id: target.id,
      name: target.name,
    }));
    expect(buy).toMatchObject({
      direction: 'BUY',
      sellingClubDivision: 5,
      player: { id: target.id, name: target.name },
    });
    expect(sells.length).toBeGreaterThan(0);
    expect(sells.every(listing => listing.player.id !== target.id)).toBe(true);

    const visible = marketViewModel(source);
    expect(visible.scouting.reports[0].playerName).toBe(target.name);
    expect(visible.transfers.some(listing => listing.direction === 'BUY')).toBe(true);
    expect(visible.transfers.some(listing => listing.direction === 'SELL')).toBe(true);
  });

  it('passes coach candidates and current contract talks through with the target wage context', () => {
    const state = fullCareer(1014);
    const target = state.players.find(player => player.clubId !== state.userClubId)!;
    const scouted: CareerMarketState = {
      ...state.market!,
      scoutReports: [exactReport(target)],
    };
    const market = beginCareerTransferTalks(state, scouted, target.id, 5);
    const source = careerMarketViewModelSource(state, market);

    expect(source.coachCandidates).toEqual(market.coachCandidates);
    expect(source.headCoach).toBeUndefined();
    expect(source.negotiation).toMatchObject({
      playerName: target.name,
      openingWeeklyWage: target.weeklyWage,
      state: { id: market.transferTalks?.negotiation.id, playerId: target.id },
    });
    expect(source.negotiation?.wageStep).toBeGreaterThan(0);
    expect(marketViewModel(source).negotiation).toMatchObject({
      playerName: target.name,
      status: 'OPEN',
      roundLabel: 'Round 1 of 3',
    });
  });

  it('passes the employed head coach through so the shortlist can lock replacement hires', () => {
    const state = fullCareer(1015);
    const headCoach = state.market!.coachCandidates[0];
    const withCoach = {
      ...state,
      market: {
        ...state.market!,
        headCoach,
        coachCandidates: state.market!.coachCandidates.slice(1),
      },
    };

    const source = careerMarketViewModelSource(withCoach);
    expect(source.headCoach).toEqual(headCoach);
    expect(marketViewModel(source).coaches.every(coach => !coach.available)).toBe(true);
  });

  it('requires an initialized market and rejects stale reports instead of inventing players', () => {
    const state = fullCareer(1115);
    expect(() => careerMarketViewModelSource({ ...state, market: undefined })).toThrow(
      'has not been initialized',
    );
    const stale: CareerMarketState = {
      ...state.market!,
      scoutReports: [{ ...exactReport(state.players[0]), playerId: 'missing-player' }],
    };
    expect(() => careerMarketViewModelSource(state, stale)).toThrow(
      'does not reference a transfer target',
    );
  });
});
