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
  dismissAssistantInboxProductForCurrentWeek,
  M2_ASSISTANT_GUIDE_SEQUENCE_IDS,
  listCareerPlayer,
  protectBoardUltimatumPlayer,
  releaseCareerPlayer,
  startNextSeason,
  type GameState,
} from '../../game';
import { DEFAULT_CREATION_RATINGS } from '../../game/onboarding/player-creation';
import {
  addCreatedPlayer,
  beginStoryOnboarding,
} from '../../game/onboarding/story-onboarding';
import { reconcileStoryYouthIntake } from '../../game/youth-intake';
import { createLaunchCareerSetup } from '../launch';
import {
  homeViewModel,
  homeProductAlerts,
  matchDayViewModel,
  postMatchViewModel,
  reconcileHomeAssistantInbox,
  squadTrainingViewModel,
} from '../view-models';

describe('management injury and lineup presentation', () => {
  const content = loadLaunchContent();

  it('keeps an out-of-position replacement in the formation slot they took', () => {
    const initial = createCareer(
      createLaunchCareerSetup(20260805, undefined, content),
    );
    const fixture = initial.fixtures.find(
      (candidate) =>
        candidate.homeClubId === initial.userClubId ||
        candidate.awayClubId === initial.userClubId,
    )!;
    const lineup = initial.lineups.find(
      (candidate) => candidate.clubId === initial.userClubId,
    )!;
    const playerById = new Map(
      initial.players.map((player) => [player.id, player]),
    );
    const midfieldSlot = lineup.playerIds.findIndex(
      (id) => playerById.get(id)?.role === 'MID',
    );
    const mae = initial.players.find(
      (player) => player.id === 'bramble-rovers-p14',
    )!;
    const swapped: GameState = {
      ...initial,
      week: fixture.week,
      phase: 'matchday',
      lineups: initial.lineups.map((candidate) =>
        candidate.clubId === initial.userClubId
          ? {
              ...candidate,
              playerIds: candidate.playerIds.map((id, index) =>
                index === midfieldSlot ? mae.id : id,
              ),
            }
          : candidate,
      ),
    };

    const matchday = matchDayViewModel(swapped, content, '4-4-2');
    expect(
      matchday.lineup.find((player) => player.id === mae.id),
    ).toMatchObject({
      role: 'DEF',
      formationRole: 'MID',
    });
    expect(
      matchday.lineup.filter((player) => player.formationRole === 'DEF'),
    ).toHaveLength(4);
    expect(
      matchday.lineup.filter((player) => player.formationRole === 'MID'),
    ).toHaveLength(4);
    expect(
      matchday.lineup.filter((player) => player.formationRole === 'FWD'),
    ).toHaveLength(2);
  });

  it('uses ID suffixes instead of invented shirt numbers for duplicate labels', () => {
    const initial = createCareer(
      createLaunchCareerSetup(20260824, undefined, content),
    );
    const fixture = initial.fixtures.find(
      (candidate) =>
        candidate.homeClubId === initial.userClubId ||
        candidate.awayClubId === initial.userClubId,
    )!;
    const duplicates = initial.players
      .filter(
        (player) =>
          player.clubId === initial.userClubId && player.role === 'DEF',
      )
      .slice(0, 2);
    const matchday = matchDayViewModel(
      {
        ...initial,
        week: fixture.week,
        phase: 'matchday',
        players: initial.players.map((player) => {
          if (!duplicates.some((duplicate) => duplicate.id === player.id))
            return player;
          const { shirtNumber: _shirtNumber, ...withoutShirt } = player;
          return { ...withoutShirt, name: 'Cal Moss' };
        }),
      },
      content,
    );
    const labels = [...matchday.lineup, ...matchday.bench]
      .filter((player) =>
        duplicates.some((duplicate) => duplicate.id === player.id),
      )
      .map((player) => player.name);

    expect(new Set(labels).size).toBe(2);
    expect(labels).toEqual([
      expect.stringMatching(/^Cal Moss \(DEF\) · /),
      expect.stringMatching(/^Cal Moss \(DEF\) · /),
    ]);
    expect(labels.join(' ')).not.toContain('#');
  });

  it('derives one stable unique shirt number per active player', () => {
    const story = addCreatedPlayer(
      beginStoryOnboarding(
        createCareer(createLaunchCareerSetup(20260824, undefined, content)),
      ),
      { name: 'Jo Rook', ratings: DEFAULT_CREATION_RATINGS },
    );
    const fixture = story.fixtures.find(
      (candidate) =>
        candidate.homeClubId === story.userClubId ||
        candidate.awayClubId === story.userClubId,
    )!;
    const lineup = story.lineups.find(
      (candidate) => candidate.clubId === story.userClubId,
    )!;
    const roster = story.players.filter(
      (player) => player.clubId === story.userClubId,
    );
    const numberTenHolder = roster.find(
      (player) => !lineup.playerIds.includes(player.id),
    )!;
    const derivedCollision = lineup.playerIds[9];
    const prepared: GameState = {
      ...story,
      week: fixture.week,
      phase: 'matchday',
      players: story.players.map((player) => {
        if (player.clubId !== story.userClubId) return player;
        const { shirtNumber: _shirtNumber, ...withoutShirt } = player;
        if (player.id === numberTenHolder.id) {
          return {
            ...withoutShirt,
            name: 'Léo Costa',
            shirtNumber: 10,
            contractPromise: {
              perk: 'JERSEY_10' as const,
              agreedSeason: story.season,
            },
          };
        }
        return player.id === derivedCollision
          ? { ...withoutShirt, name: 'Léo Costa' }
          : withoutShirt;
      }),
    };
    const snapshot = JSON.stringify(prepared);

    const matchday = matchDayViewModel(prepared, content);
    const squad = squadTrainingViewModel(
      prepared,
      content,
      story.onboarding!.createdPlayerId,
    );
    const matchdayPlayers = [...matchday.lineup, ...matchday.bench];
    const matchdayNumbers = matchdayPlayers.map((player) => player.shirtNumber);

    expect(matchdayNumbers).toHaveLength(roster.length);
    expect(new Set(matchdayNumbers).size).toBe(roster.length);
    expect(
      matchdayPlayers.find((player) => player.id === numberTenHolder.id)
        ?.shirtNumber,
    ).toBe(10);
    expect(
      matchdayPlayers.find((player) => player.id === derivedCollision)
        ?.shirtNumber,
    ).not.toBe(10);
    for (const player of matchdayPlayers) {
      expect(
        squad.players.find((candidate) => candidate.id === player.id)
          ?.shirtNumber,
      ).toBe(player.shirtNumber);
    }
    expect(
      squad.players.find(
        (player) => player.id === story.onboarding!.createdPlayerId,
      )?.shirtNumber,
    ).toBeDefined();
    expect(JSON.stringify(prepared)).toBe(snapshot);

    const swapped: GameState = {
      ...prepared,
      lineups: prepared.lineups.map((candidate) =>
        candidate.clubId !== prepared.userClubId
          ? candidate
          : {
              ...candidate,
              playerIds: candidate.playerIds.map((playerId, index) =>
                index === 0
                  ? candidate.playerIds[1]
                  : index === 1
                    ? candidate.playerIds[0]
                    : playerId,
              ),
            },
      ),
    };
    const swappedMatchday = matchDayViewModel(swapped, content);
    expect(swappedMatchday.lineup[0].shirtNumber).toBe(1);
    expect(swappedMatchday.lineup[1].shirtNumber).toBe(2);
    expect(swappedMatchday.lineup[0].id).toBe(lineup.playerIds[1]);
    expect(swappedMatchday.lineup[1].id).toBe(lineup.playerIds[0]);
  });

  it('shows the active sponsor challenge only on its match day', () => {
    const initial = createCareer(
      createLaunchCareerSetup(20260820, undefined, content),
    );
    const fixture = initial.fixtures.find(
      (candidate) =>
        candidate.homeClubId === initial.userClubId ||
        candidate.awayClubId === initial.userClubId,
    )!;
    const active: GameState = {
      ...initial,
      week: fixture.week,
      phase: 'matchday',
      clubBusiness: {
        ...initial.clubBusiness,
        sponsorship: {
          ...initial.clubBusiness.sponsorship,
          weeklyChallenge: {
            id: 'sponsor-sprint-s1',
            kind: 'SCORE_THREE',
            sponsorName: 'Sponsor Desk',
            season: initial.season,
            chosenWeek: fixture.week,
            fixtureId: fixture.id,
            fixtureWeek: fixture.week,
            nominalBonus: 9_600,
          },
        },
      },
    };

    expect(matchDayViewModel(active, content).sponsorChallenge).toEqual({
      targetLabel: 'Score 3+ goals',
      actualBonus: 9_600,
    });
    expect(
      matchDayViewModel(
        {
          ...active,
          clubBusiness: {
            ...active.clubBusiness,
            sponsorship: {
              ...active.clubBusiness.sponsorship,
              weeklyChallenge: {
                ...active.clubBusiness.sponsorship.weeklyChallenge!,
                outcome: { met: false, actualBonus: 0 },
              },
            },
          },
        },
        content,
      ).sponsorChallenge,
    ).toBeUndefined();
  });

  it('shows active injuries on Home, in Squad, and on the match-day bench', () => {
    const initial = createCareer(
      createLaunchCareerSetup(20260720, undefined, content),
    );
    const lineup = initial.lineups.find(
      (candidate) => candidate.clubId === initial.userClubId,
    )!;
    const benchPlayer = initial.players.find(
      (player) =>
        player.clubId === initial.userClubId &&
        !lineup.playerIds.includes(player.id),
    )!;
    const injured: GameState = {
      ...initial,
      players: initial.players.map((player) =>
        player.id === benchPlayer.id ? { ...player, injuryWeeks: 2 } : player,
      ),
    };

    expect(homeViewModel(injured).alerts).toContainEqual(
      expect.objectContaining({
        id: `injury-${benchPlayer.id}`,
        title: `${benchPlayer.name} · OUT`,
        detail: 'OUT · 2 WEEKS, unavailable for selection.',
        tone: 'urgent',
        guideSequenceId: 'first-injury',
        destination: 'squad',
      }),
    );

    const squadPlayer = squadTrainingViewModel(
      injured,
      content,
      benchPlayer.id,
    ).players.find((player) => player.id === benchPlayer.id);
    expect(squadPlayer).toMatchObject({ injuryWeeks: 2, isStarter: false });

    const fixture = injured.fixtures.find(
      (candidate) =>
        candidate.homeClubId === injured.userClubId ||
        candidate.awayClubId === injured.userClubId,
    )!;
    const matchday = matchDayViewModel(
      { ...injured, week: fixture.week, phase: 'matchday' },
      content,
    );
    expect(
      matchday.bench.find((player) => player.id === benchPlayer.id),
    ).toMatchObject({
      injuryWeeks: 2,
      canStart: false,
      unavailableLabel: 'OUT · 2 WEEKS',
    });
  });

  it('carries a new-injury notice into the post-match office summary', () => {
    const initial = createCareer(
      createLaunchCareerSetup(20260721, undefined, content),
    );
    const fixture = initial.fixtures.find(
      (candidate) =>
        candidate.homeClubId === initial.userClubId ||
        candidate.awayClubId === initial.userClubId,
    )!;
    const before: GameState = {
      ...initial,
      week: fixture.week,
      phase: 'matchday',
    };
    const lineup = before.lineups.find(
      (candidate) => candidate.clubId === before.userClubId,
    )!;
    const injuredId = lineup.playerIds[1];
    const injuredPlayer = before.players.find(
      (player) => player.id === injuredId,
    )!;
    const replacement = before.players.find(
      (player) =>
        player.clubId === before.userClubId &&
        player.role === injuredPlayer.role &&
        !lineup.playerIds.includes(player.id) &&
        player.power === undefined,
    )!;
    const after: GameState = {
      ...before,
      phase: 'manage',
      players: before.players.map((player) =>
        player.id === injuredId ? { ...player, injuryWeeks: 3 } : player,
      ),
      lineups: before.lineups.map((candidate) =>
        candidate.clubId === before.userClubId
          ? {
              ...candidate,
              playerIds: candidate.playerIds.map((playerId) =>
                playerId === injuredId ? replacement.id : playerId,
              ),
            }
          : candidate,
      ),
    };

    const score =
      fixture.homeClubId === before.userClubId
        ? { homeGoals: 1, awayGoals: 0 }
        : { homeGoals: 0, awayGoals: 1 };
    const summary = postMatchViewModel(before, after, fixture.id, score);

    expect(summary.updates).toContainEqual(
      expect.objectContaining({
        id: `injury-${injuredId}`,
        detail: `OUT · 3 WEEKS. ${replacement.name} has moved into the Starting XI.`,
        tone: 'warning',
      }),
    );
  });

  it('guides the first emergency loan and transfer request to the correct desk', () => {
    const initial = {
      ...createCareer(createLaunchCareerSetup(20260726, undefined, content)),
      season: 2,
    };
    const requester = initial.players.find(
      (player) => player.clubId === initial.userClubId,
    )!;
    let guided = M2_ASSISTANT_GUIDE_SEQUENCE_IDS.filter(
      (sequenceId) =>
        sequenceId !== 'first-emergency-loan' &&
        sequenceId !== 'first-transfer-request',
    ).reduce(
      (state, sequenceId) => completeAssistantGuideSequence(state, sequenceId),
      initial,
    );
    guided = {
      ...guided,
      players: guided.players.map((player) =>
        player.id === requester.id
          ? { ...player, transferRequested: true }
          : player,
      ),
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

    expect(homeViewModel(guided).alerts).toEqual(
      expect.arrayContaining([
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
      ]),
    );
  });

  it('removes the transfer-request message as soon as the request ends', () => {
    const initial = completeAssistantGuideSequence(
      createCareer(createLaunchCareerSetup(20260823, undefined, content)),
      'first-transfer-request',
    );
    const requester = initial.players.find(
      (player) => player.clubId === initial.userClubId,
    )!;
    const requested: GameState = {
      ...initial,
      players: initial.players.map((player) =>
        player.id === requester.id
          ? { ...player, transferRequested: true }
          : player,
      ),
    };
    expect(homeViewModel(requested).alerts).toContainEqual(
      expect.objectContaining({ id: `transfer-request-${requester.id}` }),
    );

    const withdrawn: GameState = {
      ...requested,
      players: requested.players.map((player) =>
        player.id === requester.id
          ? { ...player, transferRequested: false }
          : player,
      ),
    };
    expect(homeViewModel(withdrawn).alerts).not.toContainEqual(
      expect.objectContaining({ id: `transfer-request-${requester.id}` }),
    );

    const departed: GameState = {
      ...requested,
      players: requested.players.filter((player) => player.id !== requester.id),
    };
    expect(homeViewModel(departed).alerts).not.toContainEqual(
      expect.objectContaining({ id: `transfer-request-${requester.id}` }),
    );

    const delivered = reconcileHomeAssistantInbox(requested);
    const resolvedAfterDelivery: GameState = {
      ...delivered,
      players: delivered.players.map((player) =>
        player.id === requester.id
          ? { ...player, transferRequested: false }
          : player,
      ),
    };
    expect(homeViewModel(resolvedAfterDelivery).alerts).not.toContainEqual(
      expect.objectContaining({ id: `transfer-request-${requester.id}` }),
    );

    const dismissed = dismissAssistantInboxProductForCurrentWeek(
      requested,
      `transfer-request-${requester.id}`,
    );
    expect(homeViewModel(dismissed).alerts).not.toContainEqual(
      expect.objectContaining({ id: `transfer-request-${requester.id}` }),
    );
    expect(
      homeViewModel({ ...dismissed, week: dismissed.week + 1 }).alerts,
    ).toContainEqual(
      expect.objectContaining({ id: `transfer-request-${requester.id}` }),
    );
  });

  it('keeps same-name transfer requests distinct by player ID', () => {
    const initial = createCareer(
      createLaunchCareerSetup(20260824, undefined, content),
    );
    const [first, second] = initial.players.filter(
      (player) => player.clubId === initial.userClubId,
    );
    const requested: GameState = {
      ...initial,
      players: initial.players.map((player) =>
        player.id === first.id || player.id === second.id
          ? { ...player, name: 'Ty Brooks', transferRequested: true }
          : player,
      ),
    };
    const alerts = homeProductAlerts(requested).filter((alert) =>
      alert.id.startsWith('transfer-request-'),
    );

    expect(alerts.map((alert) => alert.id)).toEqual(
      expect.arrayContaining([
        `transfer-request-${first.id}`,
        `transfer-request-${second.id}`,
      ]),
    );
    expect(new Set(alerts.map((alert) => alert.title)).size).toBe(2);
  });

  it('keeps a retirement announcement visible during the player final season', () => {
    const initial = createCareer(
      createLaunchCareerSetup(20260722, undefined, content),
    );
    const player = initial.players.find(
      (candidate) => candidate.clubId === initial.userClubId,
    )!;
    const finalSeason: GameState = {
      ...initial,
      season: 2,
      retirementAnnouncements: [
        {
          playerId: player.id,
          playerName: player.name,
          announcedInSeason: 1,
          retirementAge: 36,
        },
      ],
    };

    // One row per season, not per player: seven can announce in the same week
    // and the desk shows three, so a row each dropped the rest for good.
    expect(homeViewModel(finalSeason).alerts).toContainEqual(
      expect.objectContaining({
        id: 'retirement-announcement-1',
        title: `${player.name} announces final season`,
        detail: 'Age 36 · retires after Season 2.',
        tone: 'info',
        guideSequenceId: 'retirement',
        destination: 'club-legacy',
      }),
    );
  });

  it('removes a retirement announcement after the player leaves the club', () => {
    const initial = createCareer(
      createLaunchCareerSetup(20260722, undefined, content),
    );
    const player = initial.players.find(
      (candidate) => candidate.clubId === initial.userClubId,
    )!;
    const sold: GameState = {
      ...initial,
      season: 2,
      players: initial.players.map((candidate) =>
        candidate.id === player.id
          ? { ...candidate, clubId: 'sold-to-club' }
          : candidate,
      ),
      retirementAnnouncements: [
        {
          playerId: player.id,
          playerName: player.name,
          announcedInSeason: 1,
          retirementAge: 36,
        },
      ],
    };

    expect(
      homeViewModel(sold).alerts.some((alert) =>
        alert.id.startsWith('retirement-announcement-'),
      ),
    ).toBe(false);
  });

  it('shows the exact board candidates and retained protected-player choice', () => {
    const initial = createCareer(
      createLaunchCareerSetup(20260723, undefined, content),
    );
    const ultimatum = createBoardUltimatum(initial)!;
    const active = protectBoardUltimatumPlayer(
      {
        ...initial,
        financialSafety: {
          consecutiveNegativeWeeks: 4,
          emergencyLoanUsed: true,
          boardUltimatum: ultimatum,
        },
      },
      ultimatum.candidates[0].playerId,
    );

    const viewModel = homeViewModel(active);
    expect(viewModel.boardUltimatum).toMatchObject({
      id: ultimatum.id,
      weeksRemaining: 4,
      protectedPlayerId: ultimatum.candidates[0].playerId,
      candidates: expect.arrayContaining([
        expect.objectContaining({ playerId: ultimatum.candidates[0].playerId }),
      ]),
    });
    expect(viewModel.alerts).toContainEqual(
      expect.objectContaining({ id: 'board-ultimatum' }),
    );
  });

  it('reconciles a below-target manual sale before Home renders the remaining board choices', () => {
    const initial = createCareer(
      createLaunchCareerSetup(20260726, undefined, content),
    );
    const ultimatum = {
      ...createBoardUltimatum(initial)!,
      targetCash: 1_000_000,
    };
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

    expect(
      sold.clubs.find((club) => club.id === sold.userClubId)!.cash,
    ).toBeLessThan(ultimatum.targetCash);
    expect(sold.financialSafety?.boardUltimatum?.candidates).not.toContainEqual(
      expect.objectContaining({ playerId: soldId }),
    );
    expect(() => homeViewModel(sold)).not.toThrow();
  });

  it('reconciles a released candidate before the season-end Home renders', () => {
    const initial = createCareer(
      createLaunchCareerSetup(20260727, undefined, content),
    );
    const ultimatum = createBoardUltimatum(initial)!;
    const releasedId = ultimatum.candidates[0].playerId;
    const seasonEnd: GameState = {
      ...initial,
      phase: 'season-end',
      players: initial.players.map((player) =>
        player.id === releasedId
          ? { ...player, contractSeasonsRemaining: 0 }
          : player,
      ),
      financialSafety: {
        consecutiveNegativeWeeks: 4,
        emergencyLoanUsed: true,
        boardUltimatum: { ...ultimatum, targetCash: 1_000_000 },
      },
    };
    const released = releaseCareerPlayer(seasonEnd, releasedId);

    expect(
      released.financialSafety?.boardUltimatum?.candidates,
    ).not.toContainEqual(expect.objectContaining({ playerId: releasedId }));
    expect(() => homeViewModel(released)).not.toThrow();
  });

  it('reconciles a retiring candidate during the full-career season transition', () => {
    const initial = createCareer(
      createLaunchCareerSetup(20260728, undefined, content),
    );
    const ultimatum = createBoardUltimatum(initial)!;
    const retiringId = ultimatum.candidates[0].playerId;
    const seasonEnd: GameState = {
      ...initial,
      season: 2,
      phase: 'season-end',
      players: initial.players.map((player) =>
        player.id === retiringId
          ? {
              ...player,
              age: 45,
              retirementAnnounced: true,
              retirementAnnouncementSeason: 1,
            }
          : player,
      ),
      financialSafety: {
        consecutiveNegativeWeeks: 4,
        emergencyLoanUsed: true,
        boardUltimatum: { ...ultimatum, targetCash: 1_000_000 },
      },
    };
    const nextSeason = startNextSeason(seasonEnd);

    expect(nextSeason.players.some((player) => player.id === retiringId)).toBe(
      false,
    );
    expect(
      nextSeason.financialSafety?.boardUltimatum?.candidates,
    ).not.toContainEqual(expect.objectContaining({ playerId: retiringId }));
    expect(() => homeViewModel(nextSeason)).not.toThrow();
    expect(
      nextSeason.players.some((player) =>
        player.id.includes(`-academy-s${nextSeason.season}-`),
      ),
    ).toBe(true);
    const withInbox = reconcileHomeAssistantInbox(nextSeason);
    expect(
      withInbox.eventFlags.some((flag) =>
        flag.includes(
          encodeURIComponent(`academy-promotion:s${nextSeason.season}`),
        ),
      ),
    ).toBe(true);
  });

  it('renders an older save defensively when its protected board candidate is already stale', () => {
    const initial = createCareer(
      createLaunchCareerSetup(20260729, undefined, content),
    );
    const ultimatum = createBoardUltimatum(initial)!;
    const staleId = ultimatum.candidates[0].playerId;
    const stale: GameState = {
      ...initial,
      players: initial.players.filter((player) => player.id !== staleId),
      financialSafety: {
        consecutiveNegativeWeeks: 4,
        emergencyLoanUsed: true,
        boardUltimatum: { ...ultimatum, protectedPlayerId: staleId },
      },
    };

    const viewModel = homeViewModel(stale);
    expect(viewModel.boardUltimatum?.protectedPlayerId).toBeUndefined();
    expect(viewModel.boardUltimatum?.candidates).not.toContainEqual(
      expect.objectContaining({ playerId: staleId }),
    );
  });

  it('presents the forced sale and its replacement youth as one truthful aftermath', () => {
    const initial = createCareer(
      createLaunchCareerSetup(20260724, undefined, content),
    );
    const ultimatum = createBoardUltimatum(initial)!;
    const resolution = boardForcedSaleAtDeadline(initial, ultimatum)!;
    const afterSale = applyBoardForcedSaleConsequences(initial, resolution);
    const visible: GameState = {
      ...afterSale,
      ledgers: [
        {
          season: resolution.resolvedSeason,
          week: resolution.resolvedWeek,
          lines: [
            { kind: 'board-sale', label: 'Board sale', amount: resolution.fee },
          ],
          balanceAfter: resolution.fee,
        },
      ],
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

  it('keeps a forced-sale aftermath readable after the next-season opponent rebuild', () => {
    const initial = createCareer(
      createLaunchCareerSetup(20260730, undefined, content),
    );
    const ultimatum = createBoardUltimatum(initial)!;
    const resolution = boardForcedSaleAtDeadline(initial, ultimatum)!;
    const afterSale = applyBoardForcedSaleConsequences(initial, resolution);
    const seasonEnd: GameState = {
      ...afterSale,
      phase: 'season-end',
      financialSafety: {
        consecutiveNegativeWeeks: 0,
        emergencyLoanUsed: true,
        latestBoardResolution: resolution,
      },
    };

    const nextSeason = startNextSeason(seasonEnd);
    expect(
      nextSeason.players.some((player) => player.id === resolution.playerId),
    ).toBe(false);
    expect(
      nextSeason.players.some(
        (player) => player.id === resolution.replacementPlayerId,
      ),
    ).toBe(true);

    const visible = reconcileHomeAssistantInbox(nextSeason);
    expect(() => homeViewModel(visible)).not.toThrow();
    const panel = homeViewModel(visible).boardResolution;
    const buyerName = afterSale.clubs.find(
      (club) => club.id === resolution.buyerClubId,
    )!.name;
    const replacementName = nextSeason.players.find(
      (player) => player.id === resolution.replacementPlayerId,
    )!.name;
    expect(panel).toMatchObject({
      kind: 'FORCED_SALE',
      replacementPlayer: { id: resolution.replacementPlayerId },
    });
    expect(panel?.soldPlayer).toBeUndefined();
    expect(panel?.detail).toContain(
      `forced sale to ${buyerName} for $${resolution.fee.toLocaleString('en-US')}`,
    );
    expect(panel?.detail).toContain(`The academy promoted ${replacementName}`);
  });

  it('never shows more than three inbox cards and defers the remaining firsts', () => {
    const initial = {
      ...createCareer(createLaunchCareerSetup(20260725, undefined, content)),
      week: 15,
    };
    const inbox = homeViewModel(initial).alerts;

    expect(inbox).toHaveLength(3);
    // The Hero Cup leads because from Week 5 it is a blue job, and a blue job
    // holds Advance Week shut until its own card is opened. Deferring it — as
    // this desk used to, behind three ordinary firsts — left a career that
    // could not move and no card anywhere to move it.
    //
    // Behind it, this deliberately stale Week-15 fixture never completed the
    // first pitch, so its urgent Training Pitch card still carries the
    // facility-placement guide; the youth intake and scout-mission queue on.
    expect(inbox.map((alert) => alert.guideSequenceId)).toEqual([
      'national-cup',
      'facility-placement',
      'head-coach-market',
    ]);
  });

  it('keeps the once-per-career youth intake in the capped inbox at Week 2 and Week 3', () => {
    const begun = beginStoryOnboarding(
      createCareer(createLaunchCareerSetup(20260718, undefined, content)),
    );
    let story = addCreatedPlayer(begun, {
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    const pitchProject = buildCareerFacility(story, 'training-pitch', {
      x: 0,
      y: 0,
    }).state;
    const completedGrid = advanceFacilityConstruction(
      pitchProject.facilities.grid!,
    ).grid;
    story = completeAssistantGuideSequence(
      {
        ...pitchProject,
        facilities: {
          ...pitchProject.facilities,
          trainingGroundBuilt: true,
          grid: completedGrid,
        },
      },
      'facility-placement',
    );
    const injuredId = story.players.find(
      (player) => player.clubId === story.userClubId,
    )!.id;
    story = {
      ...story,
      players: story.players.map((player) =>
        player.id === injuredId ? { ...player, injuryWeeks: 2 } : player,
      ),
    };

    const weekTwo = reconcileStoryYouthIntake({ ...story, week: 2 });
    expect(weekTwo.youthIntake).toMatchObject({ status: 'OPEN' });
    const weekTwoAlerts = homeViewModel(weekTwo).alerts;
    expect(weekTwoAlerts).toHaveLength(3);
    expect(weekTwoAlerts.map((alert) => alert.guideSequenceId)).toContain(
      'youth-intake',
    );

    const weekThree = reconcileStoryYouthIntake({ ...weekTwo, week: 3 });
    expect(weekThree.youthIntake).toMatchObject({ status: 'OPEN' });
    const weekThreeAlerts = homeViewModel(weekThree).alerts;
    expect(weekThreeAlerts).toHaveLength(3);
    expect(weekThreeAlerts.map((alert) => alert.guideSequenceId)).toContain(
      'youth-intake',
    );
  });

  /**
   * Retargeted. This used to pin the board being crowded out — three injuries
   * filled the week and the verdict was deferred — and on a real career that
   * deferral never ended, because the next week had injuries too. The board's
   * rows are built first and scheduled urgent now, so its verdict lands the
   * week it happens. The one-shot lifecycle underneath is still the thing worth
   * pinning: shown once, and then never again.
   */
  it('delivers a one-shot board resolution on a crowded desk, exactly once', () => {
    const initial = createCareer(
      createLaunchCareerSetup(20260727, undefined, content),
    );
    const injuredIds = initial.players
      .filter((player) => player.clubId === initial.userClubId)
      .slice(0, 3)
      .map((player) => player.id);
    const resolutionId = 'board-ultimatum-s1-w1';
    const crowded: GameState = {
      ...initial,
      players: initial.players.map((player) =>
        injuredIds.includes(player.id) ? { ...player, injuryWeeks: 3 } : player,
      ),
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

    const thisWeek = homeViewModel(crowded).alerts.map((alert) => alert.id);
    expect(thisWeek).toContain(`board-resolution:${resolutionId}`);
    // Three injuries and the training-pitch nudge could not push it off.
    expect(thisWeek).toHaveLength(3);

    const persisted = reconcileHomeAssistantInbox(crowded);
    expect(homeViewModel(persisted).alerts.map((alert) => alert.id)).toContain(
      `board-resolution:${resolutionId}`,
    );
    expect(reconcileHomeAssistantInbox(persisted)).toBe(persisted);

    const nextWeek = { ...persisted, week: 2 };
    expect(
      homeViewModel(nextWeek).alerts.map((alert) => alert.id),
    ).not.toContain(`board-resolution:${resolutionId}`);
  });
});
