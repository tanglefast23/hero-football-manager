import { createLaunchCareerSetup } from '../../application/launch';
import { buildCareerFacility, createCareer } from '..';
import {
  beginCareerTransferTalks,
  completeCareerTransfer,
  createCareerMarketState,
  hireCareerCoach,
  refreshCareerMarketForNewSeason,
  resolveCareerScoutClock,
  sellCareerPlayer,
  startCareerScoutMission,
  submitCareerTransferOffer,
} from '../market-career';

describe('career market integration', () => {
  test('charges for a mission and resolves deterministic reports on its due week', () => {
    const initial = createCareer(createLaunchCareerSetup(20260719, undefined, undefined, 'full'));
    const withOffice = buildCareerFacility(initial, 'scout-office', { x: 0, y: 0 }).state;
    const market = createCareerMarketState(withOffice);
    const started = startCareerScoutMission(
      withOffice,
      market,
      'EUROPE',
      { kind: 'POSITION', role: 'FWD' },
    );
    const waiting = resolveCareerScoutClock(started.state, started.market);
    const dueState = {
      ...started.state,
      week: started.market.activeScoutMission!.dueWeek,
    };
    const resolved = resolveCareerScoutClock(dueState, waiting);

    expect(started.state.clubs.find(club => club.id === initial.userClubId)?.cash)
      .toBe(withOffice.clubs.find(club => club.id === initial.userClubId)!.cash - 1800);
    expect(waiting).toBe(started.market);
    expect(resolved.activeScoutMission).toBeUndefined();
    expect(resolved.scoutReports.length).toBeGreaterThan(0);
    expect(JSON.stringify(resolved)).toBe(JSON.stringify(resolveCareerScoutClock(dueState, waiting)));
    expect(started.state.cashTransactions?.at(-1)).toMatchObject({
      kind: 'scouting',
      label: 'Scouting mission · Europe',
      amount: -1800,
      balanceAfter: started.state.clubs.find(club => club.id === initial.userClubId)?.cash,
    });
    expect(started.state.ledgers).toHaveLength(0);
  });

  test('turns an accepted pitch-card deal into a real transfer and repairs the seller lineup', () => {
    const initial = createCareer(createLaunchCareerSetup(4242, undefined, undefined, 'full'));
    const userLineup = new Set(initial.lineups.find(lineup => lineup.clubId === initial.userClubId)!.playerIds);
    const releasedReserve = initial.players.find(player => (
      player.clubId === initial.userClubId && !userLineup.has(player.id)
    ))!;
    const withRosterSpace = {
      ...initial,
      players: initial.players.filter(player => player.id !== releasedReserve.id),
      clubs: initial.clubs.map(club => club.id === initial.userClubId
        ? { ...club, weeklyWages: club.weeklyWages - releasedReserve.weeklyWage }
        : club),
    };
    const target = initial.players.find(player => (
      player.clubId !== initial.userClubId && player.role === 'FWD'
    ))!;
    const market = {
      ...createCareerMarketState(withRosterSpace),
      scoutReports: [{
        playerId: target.id,
        role: target.role,
        age: target.age ?? 24,
        statRanges: Object.fromEntries(Object.keys(target.attrs).map(key => [
          key,
          { minimum: target.attrs[key as keyof typeof target.attrs], maximum: target.attrs[key as keyof typeof target.attrs] },
        ])) as never,
        potentialRange: { minimum: 3, maximum: 3 },
      }],
    };
    let talks = beginCareerTransferTalks(withRosterSpace, market, target.id);
    const ask = talks.transferTalks!.negotiation.weeklyAsk;
    talks = submitCareerTransferOffer(talks, {
      weeklyWage: ask,
      termSeasons: 2,
      perk: 'GUARANTEED_STARTER',
    });
    expect(() => completeCareerTransfer(initial, talks)).toThrow('roster is full');
    const completed = completeCareerTransfer(withRosterSpace, talks);

    expect(completed.state.players.find(player => player.id === target.id)).toMatchObject({
      clubId: initial.userClubId,
      weeklyWage: ask,
      contractSeasonsRemaining: 2,
    });
    expect(completed.market.transferTalks).toBeUndefined();
    expect(completed.state.lineups.every(lineup => lineup.playerIds.length === 11)).toBe(true);
    expect(completed.state.cashTransactions?.at(-1)).toMatchObject({
      kind: 'transfer-buy',
      label: `Signed ${target.name}`,
      amount: -talks.transferTalks!.transferQuote.fee,
    });
    expect(completed.state.ledgers).toHaveLength(0);
  });

  test('itemizes a player sale without creating a weekly ledger', () => {
    const state = createCareer(createLaunchCareerSetup(4243, undefined, undefined, 'full'));
    const starters = new Set(state.lineups.find(lineup => lineup.clubId === state.userClubId)!.playerIds);
    const reserve = state.players.find(player => (
      player.clubId === state.userClubId && !starters.has(player.id)
    ))!;
    const buyer = state.clubs.find(club => club.id !== state.userClubId)!;
    const result = sellCareerPlayer(state, state.market!, reserve.id, buyer.id);

    expect(result.state.cashTransactions?.at(-1)).toMatchObject({
      kind: 'transfer-sell',
      label: `Sold ${reserve.name}`,
      amount: expect.any(Number),
    });
    expect(result.state.cashTransactions!.at(-1)!.amount).toBeGreaterThan(0);
    expect(result.state.ledgers).toHaveLength(0);
  });

  test('hires one deterministic preseason coach candidate', () => {
    const state = createCareer(createLaunchCareerSetup(81));
    const market = createCareerMarketState(state);
    const hired = hireCareerCoach(market, market.coachCandidates[0].id);

    expect(hired.headCoach).toEqual(market.coachCandidates[0]);
    expect(hired.headCoachSeasonsEmployed).toBe(0);
  });

  test('retains a head coach and adds one level after every two full seasons', () => {
    const state = createCareer(createLaunchCareerSetup(82));
    const hired = hireCareerCoach(
      createCareerMarketState(state),
      createCareerMarketState(state).coachCandidates[0].id,
    );
    const yearOne = refreshCareerMarketForNewSeason({ ...state, season: 2 }, hired);
    const yearTwo = refreshCareerMarketForNewSeason({ ...state, season: 3 }, yearOne);

    expect(yearOne.headCoach?.level).toBe(hired.headCoach?.level);
    expect(yearOne.headCoachSeasonsEmployed).toBe(1);
    expect(yearTwo.headCoach?.level).toBe(Math.min(5, (hired.headCoach?.level ?? 0) + 1));
    expect(yearTwo.headCoachSeasonsEmployed).toBe(2);
  });

  test('retains paid scouting work when the preseason coach market refreshes', () => {
    const state = createCareer(createLaunchCareerSetup(83, undefined, undefined, 'full'));
    const started = startCareerScoutMission(
      state,
      state.market!,
      'LOCAL',
      { kind: 'POSITION', role: 'MID' },
    );
    const previous = {
      ...started.market,
      scoutReports: [{
        playerId: state.players.find(player => player.clubId !== state.userClubId)!.id,
        role: 'MID' as const,
        age: 22,
        statRanges: {
          pac: { minimum: 40, maximum: 50 }, sho: { minimum: 40, maximum: 50 },
          pas: { minimum: 40, maximum: 50 }, def: { minimum: 40, maximum: 50 },
          tec: { minimum: 40, maximum: 50 }, sta: { minimum: 40, maximum: 50 },
          ref: { minimum: 40, maximum: 50 },
        },
        potentialRange: { minimum: 2, maximum: 4 },
      }],
    };
    const refreshed = refreshCareerMarketForNewSeason({ ...started.state, season: 2 }, previous);

    expect(refreshed.activeScoutMission).toEqual(started.market.activeScoutMission);
    expect(refreshed.scoutReports).toEqual(previous.scoutReports);
    expect(refreshed.nextMissionNumber).toBe(started.market.nextMissionNumber);
  });

  test('drops reports for opponents that leave the active division', () => {
    const state = createCareer(createLaunchCareerSetup(84, undefined, undefined, 'full'));
    const target = state.players.find(player => player.clubId !== state.userClubId)!;
    const report = {
      playerId: target.id,
      role: target.role,
      age: target.age ?? 22,
      statRanges: {
        pac: { minimum: 40, maximum: 50 }, sho: { minimum: 40, maximum: 50 },
        pas: { minimum: 40, maximum: 50 }, def: { minimum: 40, maximum: 50 },
        tec: { minimum: 40, maximum: 50 }, sta: { minimum: 40, maximum: 50 },
        ref: { minimum: 40, maximum: 50 },
      },
      potentialRange: { minimum: 2 as const, maximum: 4 as const },
    };
    const previous = { ...state.market!, scoutReports: [report] };
    const nextState = {
      ...state,
      season: 2,
      players: state.players.filter(player => player.id !== target.id),
    };

    expect(refreshCareerMarketForNewSeason(nextState, previous).scoutReports).toEqual([]);
  });
});
