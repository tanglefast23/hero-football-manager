import { createLaunchCareerSetup } from '../../application/launch';
import { parseStoredGameState, serializeGameState } from '../../persistence/game-state-codec';
import { advanceFacilityConstruction, buildCareerFacility, createCareer } from '..';
import { clubSquadStrength } from '../m2-career';
import {
  applyCareerNegotiationConsequence,
  acceptCareerTransferBid,
  beginCareerTransferTalks,
  closeCareerTransferTalks,
  careerCoachUnlockedFormationIds,
  completeCareerTransfer,
  createCareerMarketState,
  dismissCareerCoach,
  expireCareerTransferListings,
  growthSinceSigningPercent,
  hireCareerCoach,
  listCareerPlayer,
  refreshCareerMarketForNewSeason,
  resolveCareerScoutClock,
  scoutOfficeLevel,
  scoutShortlistSize,
  sellCareerPlayer,
  startCareerScoutMission,
  submitCareerTransferOffer,
} from '../market-career';
import type { GameState } from '../types';

describe('career market integration', () => {
  test('charges for a mission and resolves deterministic reports on its due week', () => {
    const initial = {
      ...createCareer(createLaunchCareerSetup(20260719)),
      week: 15,
    };
    const officeProject = buildCareerFacility(initial, 'scout-office', { x: 2, y: 0 }).state;
    const withOffice = {
      ...officeProject,
      facilities: {
        ...officeProject.facilities,
        grid: advanceFacilityConstruction(officeProject.facilities.grid!).grid,
      },
    };
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

  test('international scouting draws reports from clubs outside the active division', () => {
    const initial = {
      ...createCareer(createLaunchCareerSetup(20260719)),
      week: 15,
    };
    const activePlayerIds = new Set(initial.players.map(player => player.id));
    const started = startCareerScoutMission(
      initial,
      initial.market!,
      'EUROPE',
      { kind: 'POSITION', role: 'FWD' },
    );
    const dueState = {
      ...started.state,
      week: started.market.activeScoutMission!.dueWeek,
    };
    const resolved = resolveCareerScoutClock(dueState, started.market);

    // Two names, because this club owns no Scout Office. A level-1 office buys
    // the third — see 'the Scout Office shortlist grows with its best level'.
    expect(resolved.scoutReports).toHaveLength(2);
    expect(resolved.scoutReports.some(report => !activePlayerIds.has(report.playerId))).toBe(true);
  });

  test('the Scout Office shortlist grows with its best level', () => {
    expect(scoutShortlistSize(0)).toBe(2);
    expect(scoutShortlistSize(1)).toBe(3);
    expect(scoutShortlistSize(2)).toBe(4);
    expect(scoutShortlistSize(3)).toBe(5);
    expect(() => scoutShortlistSize(4)).toThrow('Scout Office level');

    const initial = { ...createCareer(createLaunchCareerSetup(20260719)), week: 15 };
    const withOffices = (...levels: readonly (1 | 2 | 3)[]): GameState => ({
      ...initial,
      facilities: {
        ...initial.facilities,
        grid: {
          ...initial.facilities.grid!,
          nextBuildingId: levels.length + 1,
          buildings: levels.map((level, index) => ({
            id: `facility-${index + 1}`,
            type: 'scout-office' as const,
            level,
            x: index,
            y: 0,
          })),
        },
      },
    });
    const namesReturned = (state: GameState): number => {
      const started = startCareerScoutMission(
        state,
        createCareerMarketState(state),
        'EUROPE',
        { kind: 'POSITION', role: 'FWD' },
      );
      const due = { ...started.state, week: started.market.activeScoutMission!.dueWeek };
      return resolveCareerScoutClock(due, started.market).scoutReports.length;
    };

    // Owning nothing is now strictly worse than a level-1 office. It used to be
    // identical, because the level lookup defaulted to 1.
    expect(scoutOfficeLevel(initial)).toBe(0);
    expect(namesReturned(initial)).toBe(2);
    expect(namesReturned(withOffices(1))).toBe(3);
    expect(namesReturned(withOffices(3))).toBe(5);
    // The best office wins, so a second one upgraded later is not wasted money.
    expect(scoutOfficeLevel(withOffices(1, 3))).toBe(3);
    expect(namesReturned(withOffices(1, 3))).toBe(5);
  });

  test('prices and completes a scouted transfer from the seller real pyramid division', () => {
    const initial = createCareer(createLaunchCareerSetup(20260720));
    const sourceDivision = initial.m2!.pyramid.divisions.find(division => division.level === 4)!;
    const sourceClub = sourceDivision.clubs[0];
    const target = sourceClub.squad.find(player => player.role === 'DEF')!;
    expect(initial.players.some(player => player.id === target.id)).toBe(false);

    const userLineup = new Set(initial.lineups
      .find(lineup => lineup.clubId === initial.userClubId)!.playerIds);
    const releasedReserve = initial.players.find(player => (
      player.clubId === initial.userClubId && !userLineup.has(player.id)
    ))!;
    const withRosterSpace = {
      ...initial,
      clubs: initial.clubs.map(club => club.id === initial.userClubId
        ? { ...club, cash: 1_000_000, weeklyWages: club.weeklyWages - releasedReserve.weeklyWage }
        : club),
      players: initial.players.filter(player => player.id !== releasedReserve.id),
    };
    const report = {
      playerId: target.id,
      role: target.role,
      age: target.age,
      statRanges: Object.fromEntries(Object.entries(target.attrs).map(([key, value]) => [
        key,
        { minimum: value, maximum: value },
      ])) as never,
      potentialRange: { minimum: 3 as const, maximum: 3 as const },
    };
    const market = { ...withRosterSpace.market!, scoutReports: [report] };
    const talksWithWrongFallback = beginCareerTransferTalks(
      withRosterSpace,
      market,
      target.id,
      5,
    );
    const talksWithActualDivision = beginCareerTransferTalks(
      withRosterSpace,
      market,
      target.id,
      sourceDivision.level,
    );

    expect(talksWithWrongFallback.transferTalks!.transferQuote)
      .toEqual(talksWithActualDivision.transferTalks!.transferQuote);
    const savedTalks = parseStoredGameState(serializeGameState({
      ...withRosterSpace,
      market: talksWithWrongFallback,
    }));
    expect(savedTalks.market?.transferTalks?.playerId).toBe(target.id);

    const ask = talksWithWrongFallback.transferTalks!.negotiation.weeklyAsk;
    const accepted = submitCareerTransferOffer(talksWithWrongFallback, {
      weeklyWage: ask,
      termSeasons: 2,
      perk: 'GUARANTEED_STARTER',
    });
    const completed = completeCareerTransfer(withRosterSpace, accepted);
    const completedSource = completed.state.m2!.pyramid.divisions
      .find(division => division.level === sourceDivision.level)!.clubs
      .find(club => club.id === sourceClub.id)!;
    const completedUser = completed.state.m2!.pyramid.divisions
      .flatMap(division => division.clubs)
      .find(club => club.id === initial.userClubId)!;

    expect(completed.state.players.find(player => player.id === target.id)).toMatchObject({
      clubId: initial.userClubId,
      weeklyWage: ask,
    });
    expect(completedSource.squad.some(player => player.id === target.id)).toBe(false);
    expect(completedSource.squadStrength).toBe(clubSquadStrength(completedSource.squad));
    expect(completedUser.squad.find(player => player.id === target.id)?.clubId)
      .toBe(initial.userClubId);
    const reloaded = parseStoredGameState(serializeGameState({
      ...completed.state,
      market: completed.market,
    }));
    expect(reloaded.players.find(player => player.id === target.id)?.clubId)
      .toBe(initial.userClubId);
    expect(reloaded.m2!.pyramid.divisions.flatMap(division => division.clubs)
      .find(club => club.id === sourceClub.id)!.squad.some(player => player.id === target.id))
      .toBe(false);
  });

  test('refuses to buy a pyramid club below its lineup template (career-brick guard)', () => {
    const initial = createCareer(createLaunchCareerSetup(20260726));
    const sourceDivision = initial.m2!.pyramid.divisions.find(division => division.level === 4)!;
    const sourceClub = sourceDivision.clubs[0];
    const goalkeepers = sourceClub.squad.filter(player => player.role === 'GK');
    expect(goalkeepers.length).toBeGreaterThanOrEqual(2);

    // The club has already lost its spare keeper. Nothing refills pyramid
    // squads, and startingEleven needs 1 GK / 4 DEF / 4 MID / 2 FWD when this
    // division goes active after promotion — selling the last keeper bricked
    // the career at the next season transition.
    const hollowed = {
      ...initial,
      m2: {
        ...initial.m2!,
        pyramid: {
          ...initial.m2!.pyramid,
          divisions: initial.m2!.pyramid.divisions.map(division => ({
            ...division,
            clubs: division.clubs.map(club => club.id === sourceClub.id
              ? { ...club, squad: club.squad.filter(player => player.id !== goalkeepers[0].id) }
              : club),
          })),
        },
      },
    };
    const lastKeeper = goalkeepers[1];
    const report = {
      playerId: lastKeeper.id,
      role: lastKeeper.role,
      age: lastKeeper.age,
      statRanges: Object.fromEntries(Object.entries(lastKeeper.attrs).map(([key, value]) => [
        key,
        { minimum: value, maximum: value },
      ])) as never,
      potentialRange: { minimum: 3 as const, maximum: 3 as const },
    };
    const market = { ...hollowed.market!, scoutReports: [report] };

    expect(() => beginCareerTransferTalks(hollowed, market, lastKeeper.id))
      .toThrow('will not sell');
  });

  test('closing talks locks that player\'s deterministic deck for the rest of the week', () => {
    const initial = createCareer(createLaunchCareerSetup(20260727));
    const sourceDivision = initial.m2!.pyramid.divisions.find(division => division.level === 4)!;
    const target = sourceDivision.clubs[0].squad.find(player => player.role === 'DEF')!;
    const report = {
      playerId: target.id,
      role: target.role,
      age: target.age,
      statRanges: Object.fromEntries(Object.entries(target.attrs).map(([key, value]) => [
        key,
        { minimum: value, maximum: value },
      ])) as never,
      potentialRange: { minimum: 3 as const, maximum: 3 as const },
    };
    const market = { ...initial.market!, scoutReports: [report] };

    // The negotiation id is week-stable, so close-and-reopen used to re-deal
    // the identical pitch-card deck at round 0 — retrying away the three-round
    // cap and the walk-away penalty.
    const opened = beginCareerTransferTalks(initial, market, target.id);
    const closed = closeCareerTransferTalks(initial, opened);
    expect(closed.transferTalks).toBeUndefined();
    expect(() => beginCareerTransferTalks(initial, closed, target.id))
      .toThrow('ended talks for this week');
  });

  test('turns an accepted pitch-card deal into a real transfer and repairs the seller lineup', () => {
    const initial = createCareer(createLaunchCareerSetup(4242));
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
      contractPromise: { perk: 'GUARANTEED_STARTER', agreedSeason: initial.season },
    });
    expect(completed.state.lineups.find(lineup => lineup.clubId === initial.userClubId)?.playerIds)
      .toContain(target.id);
    expect(completed.state.players.find(player => player.id === target.id)?.lookId).toBe(target.lookId);
    expect(completed.market.transferTalks).toBeUndefined();
    expect(completed.state.lineups.every(lineup => lineup.playerIds.length === 11)).toBe(true);
    expect(completed.state.cashTransactions?.at(-1)).toMatchObject({
      kind: 'transfer-buy',
      label: `Signed ${target.name}`,
      amount: -talks.transferTalks!.transferQuote.fee,
    });
    expect(completed.state.ledgers).toHaveLength(0);

    expect(() => completeCareerTransfer({ ...withRosterSpace, week: 19 }, talks))
      .toThrow('window is closed');
  });

  test('itemizes a player sale without creating a weekly ledger', () => {
    const state = createCareer(createLaunchCareerSetup(4243));
    const starters = new Set(state.lineups.find(lineup => lineup.clubId === state.userClubId)!.playerIds);
    const reserve = state.players.find(player => (
      player.clubId === state.userClubId && !starters.has(player.id)
    ))!;
    const buyer = state.clubs.find(club => club.id !== state.userClubId)!;
    const result = sellCareerPlayer(state, state.market!, reserve.id, buyer.id);
    const fee = result.state.cashTransactions!.at(-1)!.amount;

    expect(result.state.cashTransactions?.at(-1)).toMatchObject({
      kind: 'transfer-sell',
      label: `Sold ${reserve.name}`,
      amount: expect.any(Number),
    });
    expect(fee).toBeGreaterThan(0);
    expect(result.state.clubs.find(club => club.id === buyer.id)?.cash).toBe(buyer.cash - fee);
    expect(result.state.players.find(player => player.id === reserve.id)?.lookId).toBe(reserve.lookId);
    expect(result.state.ledgers).toHaveLength(0);

    const brokeBuyerState = {
      ...state,
      clubs: state.clubs.map(club => club.id === buyer.id ? { ...club, cash: 0 } : club),
    };
    expect(() => sellCareerPlayer(brokeBuyerState, state.market!, reserve.id, buyer.id))
      .toThrow('cannot afford');
  });

  test('hires one deterministic preseason coach candidate', () => {
    const state = createCareer(createLaunchCareerSetup(81));
    const market = createCareerMarketState(state);
    const hired = hireCareerCoach(state, market, market.coachCandidates[0].id);

    expect(hired.headCoach).toEqual(market.coachCandidates[0]);
    expect(hired.headCoachSeasonsEmployed).toBe(0);
    expect(hired.coachCandidates).not.toContainEqual(market.coachCandidates[0]);
    expect(careerCoachUnlockedFormationIds(hired))
      .toContain(market.coachCandidates[0].unlockId?.replace('formation:', ''));
    expect(() => hireCareerCoach(state, hired, hired.coachCandidates[0].id))
      .toThrow('dismiss the current head coach');
  });

  test('dismisses a coach for exactly one weekly wage before another can be hired', () => {
    const state = createCareer(createLaunchCareerSetup(810));
    const hired = hireCareerCoach(state, state.market!, state.market!.coachCandidates[0].id);
    const coach = hired.headCoach!;
    const cashBefore = state.clubs.find(club => club.id === state.userClubId)!.cash;

    const dismissed = dismissCareerCoach(state, hired);

    expect(dismissed.market.headCoach).toBeUndefined();
    expect(dismissed.market.headCoachSeasonsEmployed).toBeUndefined();
    expect(dismissed.state.clubs.find(club => club.id === state.userClubId)?.cash)
      .toBe(cashBefore - coach.weeklyWage);
    expect(dismissed.state.cashTransactions?.at(-1)).toMatchObject({
      kind: 'coach-dismissal',
      label: `Severance · ${coach.name}`,
      amount: -coach.weeklyWage,
      referenceId: coach.id,
    });
    expect(hireCareerCoach(
      dismissed.state,
      dismissed.market,
      dismissed.market.coachCandidates[0].id,
    ).headCoach)
      .toBeDefined();
  });

  test('retains a head coach and adds one level after every two full seasons', () => {
    const state = createCareer(createLaunchCareerSetup(82));
    const hired = hireCareerCoach(
      state,
      createCareerMarketState(state),
      createCareerMarketState(state).coachCandidates[0].id,
    );
    const yearOne = refreshCareerMarketForNewSeason({ ...state, season: 2 }, hired);
    const yearTwo = refreshCareerMarketForNewSeason({ ...state, season: 3 }, yearOne);

    expect(yearOne.headCoach?.level).toBe(hired.headCoach?.level);
    expect(yearOne.headCoachSeasonsEmployed).toBe(1);
    expect(yearTwo.headCoach?.level).toBe(Math.min(5, (hired.headCoach?.level ?? 0) + 1));
    expect(yearTwo.headCoach?.weeklyWage).toBe(
      Math.round(500 * yearTwo.headCoach!.level
        * (100 - yearTwo.headCoach!.loyaltyDiscountPercent) / 100),
    );
    expect(yearTwo.headCoachSeasonsEmployed).toBe(2);
  });

  test('does not re-offer coach content that the club already learned', () => {
    const state = createCareer(createLaunchCareerSetup(821));
    const market = createCareerMarketState(state);
    const hired = hireCareerCoach(state, market, market.coachCandidates[0].id);
    const refreshed = refreshCareerMarketForNewSeason({ ...state, season: 2 }, hired);

    expect(hired.unlockedCoachContentIds).toContain('formation:4-3-3');
    expect(refreshed.coachCandidates.every(candidate => candidate.unlockId === undefined)).toBe(true);
  });

  test('lists a player, creates repeatable AI bids, and accepts only a saved bid', () => {
    const state = createCareer(createLaunchCareerSetup(824));
    const starters = new Set(state.lineups.find(lineup => lineup.clubId === state.userClubId)!.playerIds);
    const reserve = state.players.find(player => (
      player.clubId === state.userClubId && !starters.has(player.id)
    ))!;
    const first = listCareerPlayer(state, state.market!, reserve.id);
    const second = listCareerPlayer(state, state.market!, reserve.id);

    expect(first.transferListings).toEqual(second.transferListings);
    expect(first.transferListings?.[0].bids.length).toBeGreaterThan(0);
    expect(new Set(first.transferListings?.[0].bids.map(bid => bid.buyerClubId)).size)
      .toBe(first.transferListings?.[0].bids.length);
    expect(() => acceptCareerTransferBid(state, first, 'invented-bid')).toThrow('unknown transfer bid');

    const bid = first.transferListings![0].bids[0];
    const accepted = acceptCareerTransferBid(state, first, bid.id);
    expect(accepted.state.players.find(player => player.id === reserve.id)?.clubId)
      .toBe(bid.buyerClubId);
    expect(accepted.state.players.find(player => player.id === reserve.id)?.lookId)
      .toBe(reserve.lookId);
    expect(accepted.state.cashTransactions?.at(-1)).toMatchObject({
      kind: 'transfer-sell',
      amount: bid.quote.fee,
    });
    expect(accepted.market.transferListings).toEqual([]);
  });

  test('expires listings at the end of their registration window and rejects a saved bid later', () => {
    const initial = createCareer(createLaunchCareerSetup(826));
    const weekFour = { ...initial, week: 4 };
    const starters = new Set(weekFour.lineups
      .find(lineup => lineup.clubId === weekFour.userClubId)!.playerIds);
    const reserve = weekFour.players.find(player => (
      player.clubId === weekFour.userClubId && !starters.has(player.id)
    ))!;
    const listed = listCareerPlayer(weekFour, weekFour.market!, reserve.id);
    const bidId = listed.transferListings![0].bids[0].id;

    expect(expireCareerTransferListings({ ...weekFour, week: 5 }, listed).transferListings)
      .toEqual([]);
    expect(() => acceptCareerTransferBid({ ...weekFour, week: 17 }, listed, bidId))
      .toThrow('transfer bid has expired');
    expect(() => acceptCareerTransferBid({ ...weekFour, season: 2, week: 1 }, listed, bidId))
      .toThrow('transfer bid has expired');
  });

  test('enforces coach eligibility and gates an assistant behind the Coaching Office', () => {
    const initial = createCareer(createLaunchCareerSetup(825));
    const market = createCareerMarketState(initial);
    const candidate = market.coachCandidates.find(coach => coach.requiredDivision === 5)!;
    const hired = hireCareerCoach(initial, market, candidate.id);

    expect(hired.headCoach?.id).toBe(candidate.id);
    expect(hired.unlockedCoachContentIds).toContain(candidate.unlockId);
    expect(() => hireCareerCoach(initial, market, candidate.id, 'ASSISTANT'))
      .toThrow('Coaching Office');

    const officeProject = buildCareerFacility(initial, 'coaching-office', { x: 2, y: 0 }).state;
    const withOffice = {
      ...officeProject,
      facilities: {
        ...officeProject.facilities,
        grid: advanceFacilityConstruction(officeProject.facilities.grid!).grid,
      },
    };
    const other = market.coachCandidates.find(coach => coach.id !== candidate.id)!;
    const withAssistant = hireCareerCoach(withOffice, hired, other.id, 'ASSISTANT');
    expect(withAssistant.assistantCoach?.id).toBe(other.id);

    const dismissed = dismissCareerCoach(withOffice, withAssistant, 'ASSISTANT');
    expect(dismissed.market.headCoach?.id).toBe(candidate.id);
    expect(dismissed.market.assistantCoach).toBeUndefined();
    expect(dismissed.state.cashTransactions?.at(-1)).toMatchObject({
      kind: 'coach-dismissal',
      amount: -other.weeklyWage,
      referenceId: other.id,
    });
  });

  test('measures contract growth from the stored signing attributes', () => {
    const state = createCareer(createLaunchCareerSetup(821));
    const player = state.players.find(candidate => candidate.clubId === state.userClubId)!;
    const baseline = Object.values(player.attrs).reduce((sum, value) => sum + value, 0);

    expect(growthSinceSigningPercent({
      ...player,
      signingStatTotal: baseline,
      attrs: Object.fromEntries(Object.entries(player.attrs).map(([key, value]) => [key, value + 10])) as typeof player.attrs,
    })).toBe(Math.floor((70 * 100) / baseline));
    expect(growthSinceSigningPercent({ ...player, signingStatTotal: undefined })).toBe(0);
  });

  test('applies an insulting offer consequence exactly once in live career state', () => {
    const state = createCareer(createLaunchCareerSetup(822));
    const target = state.players.find(player => player.clubId !== state.userClubId)!;
    const market = {
      ...state.market!,
      scoutReports: [{
        playerId: target.id,
        role: target.role,
        age: target.age ?? 24,
        statRanges: Object.fromEntries(Object.keys(target.attrs).map(key => [
          key,
          { minimum: 1, maximum: 99 },
        ])) as never,
        potentialRange: { minimum: 1, maximum: 5 },
      }],
    };
    const talks = beginCareerTransferTalks(state, market, target.id);
    const insulted = submitCareerTransferOffer(talks, {
      weeklyWage: 1,
      termSeasons: 1,
      perk: 'JERSEY_10',
    });
    const applied = applyCareerNegotiationConsequence(state, insulted, 'transfer');
    const repeated = applyCareerNegotiationConsequence(applied.state, applied.market, 'transfer');

    expect(applied.state.players.find(player => player.id === target.id)?.morale)
      .toBe(Math.max(0, target.morale - 10));
    expect(applied.market.clubFameAdjustment).toBe(-2);
    expect(applied.market.transferTalks?.consequenceApplied).toBe(true);
    expect(repeated).toEqual(applied);
  });

  test('retains paid scouting work when the preseason coach market refreshes', () => {
    const state = {
      ...createCareer(createLaunchCareerSetup(83)),
      week: 15,
    };
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

  test('retains reports for opponents that leave the active division but remain in the pyramid', () => {
    const state = createCareer(createLaunchCareerSetup(84));
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

    expect(refreshCareerMarketForNewSeason(nextState, previous).scoutReports).toEqual([report]);
  });
});
