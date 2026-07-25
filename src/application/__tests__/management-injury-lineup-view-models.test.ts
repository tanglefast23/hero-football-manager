import { loadLaunchContent } from '../../content';
import {
  acceptCareerTransferBid,
  advanceFacilityConstruction,
  applyBoardForcedSaleConsequences,
  boardForcedSaleAtDeadline,
  buildCareerFacility,
  completeAssistantGuideSequence,
  createBoardUltimatum,
  createCareer,
  M2_ASSISTANT_GUIDE_SEQUENCE_IDS,
  listCareerPlayer,
  protectBoardUltimatumPlayer,
  releaseCareerPlayer,
  startNextSeason,
  type GameState,
} from '../../game';
import { DEFAULT_CREATION_RATINGS } from '../../game/onboarding/player-creation';
import { addCreatedPlayer, beginStoryOnboarding } from '../../game/onboarding/story-onboarding';
import { reconcileStoryYouthIntake } from '../../game/youth-intake';
import { createLaunchCareerSetup } from '../launch';
import {
  homeViewModel,
  matchDayViewModel,
  postMatchViewModel,
  reconcileHomeAssistantInbox,
  squadTrainingViewModel,
} from '../view-models';

describe('management injury and lineup presentation', () => {
  const content = loadLaunchContent();

  it('shows active injuries on Home, in Squad, and on the match-day bench', () => {
    const initial = createCareer(createLaunchCareerSetup(20260720, undefined, content));
    const lineup = initial.lineups.find(candidate => candidate.clubId === initial.userClubId)!;
    const benchPlayer = initial.players.find(player => (
      player.clubId === initial.userClubId && !lineup.playerIds.includes(player.id)
    ))!;
    const injured: GameState = {
      ...initial,
      players: initial.players.map(player => player.id === benchPlayer.id
        ? { ...player, injuryWeeks: 2 }
        : player),
    };

    expect(homeViewModel(injured).alerts).toContainEqual(expect.objectContaining({
      id: `injury-${benchPlayer.id}`,
      title: `${benchPlayer.name} · OUT`,
      detail: 'OUT · 2 WEEKS — unavailable for selection.',
      tone: 'urgent',
      guideSequenceId: 'first-injury',
      destination: 'squad',
    }));

    const squadPlayer = squadTrainingViewModel(injured, content, benchPlayer.id)
      .players.find(player => player.id === benchPlayer.id);
    expect(squadPlayer).toMatchObject({ injuryWeeks: 2, isStarter: false });

    const fixture = injured.fixtures.find(candidate => (
      candidate.homeClubId === injured.userClubId || candidate.awayClubId === injured.userClubId
    ))!;
    const matchday = matchDayViewModel({ ...injured, week: fixture.week, phase: 'matchday' }, content);
    expect(matchday.bench.find(player => player.id === benchPlayer.id)).toMatchObject({
      injuryWeeks: 2,
      canStart: false,
      unavailableLabel: 'OUT · 2 WEEKS',
    });
  });

  it('carries a new-injury notice into the post-match office summary', () => {
    const initial = createCareer(createLaunchCareerSetup(20260721, undefined, content));
    const fixture = initial.fixtures.find(candidate => (
      candidate.homeClubId === initial.userClubId || candidate.awayClubId === initial.userClubId
    ))!;
    const before: GameState = { ...initial, week: fixture.week, phase: 'matchday' };
    const lineup = before.lineups.find(candidate => candidate.clubId === before.userClubId)!;
    const injuredId = lineup.playerIds[1];
    const injuredPlayer = before.players.find(player => player.id === injuredId)!;
    const replacement = before.players.find(player => (
      player.clubId === before.userClubId
      && player.role === injuredPlayer.role
      && !lineup.playerIds.includes(player.id)
      && player.power === undefined
    ))!;
    const after: GameState = {
      ...before,
      phase: 'manage',
      players: before.players.map(player => player.id === injuredId
        ? { ...player, injuryWeeks: 3 }
        : player),
      lineups: before.lineups.map(candidate => candidate.clubId === before.userClubId
        ? {
            ...candidate,
            playerIds: candidate.playerIds.map(playerId => playerId === injuredId ? replacement.id : playerId),
          }
        : candidate),
    };

    const score = fixture.homeClubId === before.userClubId
      ? { homeGoals: 1, awayGoals: 0 }
      : { homeGoals: 0, awayGoals: 1 };
    const summary = postMatchViewModel(before, after, fixture.id, score);

    expect(summary.updates).toContainEqual(expect.objectContaining({
      id: `injury-${injuredId}`,
      detail: `OUT · 3 WEEKS. ${replacement.name} has moved into the Starting XI.`,
      tone: 'warning',
    }));
  });

  it('guides the first emergency loan and transfer request to the correct desk', () => {
    const initial = {
      ...createCareer(createLaunchCareerSetup(20260726, undefined, content)),
      season: 2,
    };
    const requester = initial.players.find(player => player.clubId === initial.userClubId)!;
    let guided = M2_ASSISTANT_GUIDE_SEQUENCE_IDS
      .filter(sequenceId => (
        sequenceId !== 'first-emergency-loan' && sequenceId !== 'first-transfer-request'
      ))
      .reduce((state, sequenceId) => completeAssistantGuideSequence(state, sequenceId), initial);
    guided = {
      ...guided,
      players: guided.players.map(player => player.id === requester.id
        ? { ...player, transferRequested: true }
        : player),
      financialSafety: {
        consecutiveNegativeWeeks: 0,
        emergencyLoanUsed: true,
        loan: {
          originalAmount: 20_000,
          remainingBalance: 22_000,
          repaymentStartsSeason: 2,
          remainingWeeks: 30,
        },
      },
    };

    expect(homeViewModel(guided).alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: `transfer-request-${requester.id}`,
        guideSequenceId: 'first-transfer-request',
        destination: 'squad',
      }),
      expect.objectContaining({
        id: 'emergency-loan',
        guideSequenceId: 'first-emergency-loan',
        destination: 'club-finances',
      }),
    ]));
  });

  it('keeps a retirement announcement visible during the player final season', () => {
    const initial = createCareer(createLaunchCareerSetup(20260722, undefined, content));
    const player = initial.players.find(candidate => candidate.clubId === initial.userClubId)!;
    const finalSeason: GameState = {
      ...initial,
      season: 2,
      retirementAnnouncements: [{
        playerId: player.id,
        playerName: player.name,
        announcedInSeason: 1,
        retirementAge: 36,
      }],
    };

    expect(homeViewModel(finalSeason).alerts).toContainEqual(expect.objectContaining({
      id: `retirement-announcement-1-${player.id}`,
      title: `${player.name} announces final season`,
      detail: 'Age 36 · retires after Season 2.',
      tone: 'info',
      guideSequenceId: 'retirement',
      destination: 'club-legacy',
    }));
  });

  it('shows the exact board candidates and retained protected-player choice', () => {
    const initial = createCareer(createLaunchCareerSetup(20260723, undefined, content));
    const ultimatum = createBoardUltimatum(initial)!;
    const active = protectBoardUltimatumPlayer({
      ...initial,
      financialSafety: {
        consecutiveNegativeWeeks: 4,
        emergencyLoanUsed: true,
        boardUltimatum: ultimatum,
      },
    }, ultimatum.candidates[0].playerId);

    const viewModel = homeViewModel(active);
    expect(viewModel.boardUltimatum).toMatchObject({
      id: ultimatum.id,
      weeksRemaining: 4,
      protectedPlayerId: ultimatum.candidates[0].playerId,
      candidates: expect.arrayContaining([
        expect.objectContaining({ playerId: ultimatum.candidates[0].playerId }),
      ]),
    });
    expect(viewModel.alerts).toContainEqual(expect.objectContaining({ id: 'board-ultimatum' }));
  });

  it('reconciles a below-target manual sale before Home renders the remaining board choices', () => {
    const initial = createCareer(createLaunchCareerSetup(20260726, undefined, content));
    const ultimatum = { ...createBoardUltimatum(initial)!, targetCash: 1_000_000 };
    const active: GameState = {
      ...initial,
      financialSafety: {
        consecutiveNegativeWeeks: 4,
        emergencyLoanUsed: true,
        boardUltimatum: ultimatum,
      },
    };
    const soldId = ultimatum.candidates[0].playerId;
    const listed = listCareerPlayer(active, active.market!, soldId);
    const bid = listed.transferListings![0].bids[0];
    const sold = acceptCareerTransferBid(active, listed, bid.id).state;

    expect(sold.clubs.find(club => club.id === sold.userClubId)!.cash)
      .toBeLessThan(ultimatum.targetCash);
    expect(sold.financialSafety?.boardUltimatum?.candidates)
      .not.toContainEqual(expect.objectContaining({ playerId: soldId }));
    expect(() => homeViewModel(sold)).not.toThrow();
  });

  it('reconciles a released candidate before the season-end Home renders', () => {
    const initial = createCareer(createLaunchCareerSetup(20260727, undefined, content));
    const ultimatum = createBoardUltimatum(initial)!;
    const releasedId = ultimatum.candidates[0].playerId;
    const seasonEnd: GameState = {
      ...initial,
      phase: 'season-end',
      players: initial.players.map(player => player.id === releasedId
        ? { ...player, contractSeasonsRemaining: 0 }
        : player),
      financialSafety: {
        consecutiveNegativeWeeks: 4,
        emergencyLoanUsed: true,
        boardUltimatum: { ...ultimatum, targetCash: 1_000_000 },
      },
    };
    const released = releaseCareerPlayer(seasonEnd, releasedId);

    expect(released.financialSafety?.boardUltimatum?.candidates)
      .not.toContainEqual(expect.objectContaining({ playerId: releasedId }));
    expect(() => homeViewModel(released)).not.toThrow();
  });

  it('reconciles a retiring candidate during the full-career season transition', () => {
    const initial = createCareer(createLaunchCareerSetup(20260728, undefined, content));
    const ultimatum = createBoardUltimatum(initial)!;
    const retiringId = ultimatum.candidates[0].playerId;
    const seasonEnd: GameState = {
      ...initial,
      season: 2,
      phase: 'season-end',
      players: initial.players.map(player => player.id === retiringId
        ? {
            ...player,
            age: 45,
            retirementAnnounced: true,
            retirementAnnouncementSeason: 1,
          }
        : player),
      financialSafety: {
        consecutiveNegativeWeeks: 4,
        emergencyLoanUsed: true,
        boardUltimatum: { ...ultimatum, targetCash: 1_000_000 },
      },
    };
    const nextSeason = startNextSeason(seasonEnd);

    expect(nextSeason.players.some(player => player.id === retiringId)).toBe(false);
    expect(nextSeason.financialSafety?.boardUltimatum?.candidates)
      .not.toContainEqual(expect.objectContaining({ playerId: retiringId }));
    expect(() => homeViewModel(nextSeason)).not.toThrow();
  });

  it('renders an older save defensively when its protected board candidate is already stale', () => {
    const initial = createCareer(createLaunchCareerSetup(20260729, undefined, content));
    const ultimatum = createBoardUltimatum(initial)!;
    const staleId = ultimatum.candidates[0].playerId;
    const stale: GameState = {
      ...initial,
      players: initial.players.filter(player => player.id !== staleId),
      financialSafety: {
        consecutiveNegativeWeeks: 4,
        emergencyLoanUsed: true,
        boardUltimatum: { ...ultimatum, protectedPlayerId: staleId },
      },
    };

    const viewModel = homeViewModel(stale);
    expect(viewModel.boardUltimatum?.protectedPlayerId).toBeUndefined();
    expect(viewModel.boardUltimatum?.candidates)
      .not.toContainEqual(expect.objectContaining({ playerId: staleId }));
  });

  it('presents the forced sale and its replacement youth as one truthful aftermath', () => {
    const initial = createCareer(createLaunchCareerSetup(20260724, undefined, content));
    const ultimatum = createBoardUltimatum(initial)!;
    const resolution = boardForcedSaleAtDeadline(initial, ultimatum)!;
    const afterSale = applyBoardForcedSaleConsequences(initial, resolution);
    const visible: GameState = {
      ...afterSale,
      ledgers: [{
        season: resolution.resolvedSeason,
        week: resolution.resolvedWeek,
        lines: [{ kind: 'board-sale', label: 'Board sale', amount: resolution.fee }],
        balanceAfter: resolution.fee,
      }],
      financialSafety: {
        consecutiveNegativeWeeks: 0,
        emergencyLoanUsed: true,
        latestBoardResolution: resolution,
      },
    };

    expect(homeViewModel(visible).boardResolution).toMatchObject({
      kind: 'FORCED_SALE',
      soldPlayer: { id: resolution.playerId, fee: resolution.fee },
      replacementPlayer: { id: resolution.replacementPlayerId, age: 17 },
      fansLost: resolution.fansLost,
      moraleDelta: -8,
    });
  });

  it('never shows more than three inbox cards and defers the remaining firsts', () => {
    const initial = {
      ...createCareer(createLaunchCareerSetup(20260725, undefined, content)),
      week: 15,
    };
    const inbox = homeViewModel(initial).alerts;

    expect(inbox).toHaveLength(3);
    // This deliberately stale Week-15 fixture never completed the required
    // first pitch, so its urgent Training Pitch card still carries the
    // facility-placement guide and pushes scout-mission out of the three slots.
    expect(inbox.map(alert => alert.guideSequenceId)).toEqual([
      'head-coach-market',
      'youth-intake',
      'facility-placement',
    ]);
  });

  it('keeps the once-per-career youth intake in the capped inbox at Week 2 and Week 3', () => {
    const begun = beginStoryOnboarding(createCareer(createLaunchCareerSetup(20260718, undefined, content)));
    let story = addCreatedPlayer(begun, { name: 'Jo Rook', ratings: DEFAULT_CREATION_RATINGS });
    const pitchProject = buildCareerFacility(story, 'training-pitch', { x: 0, y: 0 }).state;
    const completedGrid = advanceFacilityConstruction(pitchProject.facilities.grid!).grid;
    story = completeAssistantGuideSequence({
      ...pitchProject,
      facilities: {
        ...pitchProject.facilities,
        trainingGroundBuilt: true,
        grid: completedGrid,
      },
    }, 'facility-placement');
    const injuredId = story.players.find(player => player.clubId === story.userClubId)!.id;
    story = {
      ...story,
      players: story.players.map(player => player.id === injuredId
        ? { ...player, injuryWeeks: 2 }
        : player),
    };

    const weekTwo = reconcileStoryYouthIntake({ ...story, week: 2 });
    expect(weekTwo.youthIntake).toMatchObject({ status: 'OPEN' });
    const weekTwoAlerts = homeViewModel(weekTwo).alerts;
    expect(weekTwoAlerts).toHaveLength(3);
    expect(weekTwoAlerts.map(alert => alert.guideSequenceId)).toContain('youth-intake');

    const weekThree = reconcileStoryYouthIntake({ ...weekTwo, week: 3 });
    expect(weekThree.youthIntake).toMatchObject({ status: 'OPEN' });
    const weekThreeAlerts = homeViewModel(weekThree).alerts;
    expect(weekThreeAlerts).toHaveLength(3);
    expect(weekThreeAlerts.map(alert => alert.guideSequenceId)).toContain('youth-intake');
  });

  it('delivers a crowded one-shot board resolution in the following week', () => {
    const initial = createCareer(createLaunchCareerSetup(20260727, undefined, content));
    const injuredIds = initial.players
      .filter(player => player.clubId === initial.userClubId)
      .slice(0, 3)
      .map(player => player.id);
    const resolutionId = 'board-ultimatum-s1-w1';
    const crowded: GameState = {
      ...initial,
      players: initial.players.map(player => injuredIds.includes(player.id)
        ? { ...player, injuryWeeks: 3 }
        : player),
      financialSafety: {
        consecutiveNegativeWeeks: 0,
        emergencyLoanUsed: true,
        latestBoardResolution: {
          id: resolutionId,
          kind: 'TARGET_MET',
          resolvedSeason: 1,
          resolvedWeek: 1,
          targetCash: 0,
        },
      },
    };

    expect(homeViewModel(crowded).alerts.map(alert => alert.id)).not.toContain(`board-resolution:${resolutionId}`);
    const persisted = reconcileHomeAssistantInbox(crowded);
    const nextWeek = { ...persisted, week: 2 };
    expect(homeViewModel(nextWeek).alerts.map(alert => alert.id)).toContain(`board-resolution:${resolutionId}`);
    const scheduled = reconcileHomeAssistantInbox(nextWeek);
    expect(homeViewModel(scheduled).alerts.map(alert => alert.id)).toContain(`board-resolution:${resolutionId}`);
    expect(reconcileHomeAssistantInbox(scheduled)).toBe(scheduled);
  });
});
