import { loadLaunchContent, type GameEvent } from '../../content';
import {
  createCareer,
  careerEventPlayerSaleBlocker,
  offerCareerEvent,
  selectCareerEventPlayer,
  type GameState,
} from '../../game';
import { serializeGameState } from '../../persistence/game-state-codec';
import { createLaunchCareerSetup } from '../launch';
import { storyEventViewModel } from '../view-models';
import {
  continueResolvedCareerEvent,
  InvalidCareerEventTargetError,
  resolveCareerEventChoice,
} from '../career-event-flow';
import { careerEventTargetCandidates } from '../career-event-targets';

const catalog = loadLaunchContent().events;

function event(id: string): GameEvent {
  const found = catalog.events.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`missing test event ${id}`);
  return found;
}

function career(): GameState {
  const created = createCareer(createLaunchCareerSetup(20260808));
  return {
    ...created,
    phase: 'manage',
    week: 12,
  };
}

function playerEvent(eventId: string): GameState {
  const offered = offerCareerEvent(career(), eventId);
  const playerId = careerEventTargetCandidates(offered, event(eventId))
    .playerIds[0];
  if (playerId === undefined) throw new Error(`${eventId} has no test player`);
  return selectCareerEventPlayer(offered, playerId);
}

describe('shared career event flow', () => {
  test('is byte-identical for identical inputs and a safe call consumes no risky history', () => {
    const offered = playerEvent('rival-bid-arrives');
    const before = serializeGameState(offered);

    const first = resolveCareerEventChoice(
      offered,
      catalog,
      'listen-to-the-rival-bid',
    );
    const second = resolveCareerEventChoice(
      offered,
      catalog,
      'listen-to-the-rival-bid',
    );

    expect(serializeGameState(first)).toBe(serializeGameState(second));
    expect(first.eventClock.riskyChoices).toBe(offered.eventClock.riskyChoices);
    expect(serializeGameState(offered)).toBe(before);
  });

  test('rejects a directly supplied illegal target before applying any effect', () => {
    const offered = offerCareerEvent(career(), 'the-penalty-gauntlet');
    const nonKeeper = offered.players.find(
      (player) => player.clubId === offered.userClubId && player.role !== 'GK',
    );
    if (nonKeeper === undefined)
      throw new Error('test career has no outfield player');
    const invalid = selectCareerEventPlayer(offered, nonKeeper.id);
    const before = serializeGameState(invalid);

    expect(() =>
      resolveCareerEventChoice(invalid, catalog, 'all-forty'),
    ).toThrow(InvalidCareerEventTargetError);
    expect(serializeGameState(invalid)).toBe(before);
  });

  test('carries and locks the exact legal player into part two', () => {
    const offered = playerEvent('rival-bid-arrives');
    const resolved = resolveCareerEventChoice(
      offered,
      catalog,
      'listen-to-the-rival-bid',
    );

    const continuation = continueResolvedCareerEvent(resolved, catalog);

    expect(continuation.followed).toBe(true);
    expect(continuation.state.pendingEvent).toMatchObject({
      eventId: 'rival-bid-deadline-day',
      selectedPlayerId: offered.pendingEvent?.selectedPlayerId,
      playerLocked: true,
    });
  });

  test('the deadline fee previews and completes a real sale of the carried player', () => {
    const opening = offerCareerEvent(career(), 'rival-bid-arrives');
    const sellablePlayerId = careerEventTargetCandidates(
      opening,
      event('rival-bid-arrives'),
    ).playerIds.find(playerId => (
      careerEventPlayerSaleBlocker(opening, playerId, 2600) === undefined
    ));
    if (sellablePlayerId === undefined) throw new Error('test event has no sellable player');
    const offered = selectCareerEventPlayer(opening, sellablePlayerId);
    const selectedPlayerId = offered.pendingEvent?.selectedPlayerId;
    if (selectedPlayerId === undefined) throw new Error('test event has no player');
    const playerName = offered.players.find(player => player.id === selectedPlayerId)!.name;
    const opened = continueResolvedCareerEvent(
      resolveCareerEventChoice(offered, catalog, 'listen-to-the-rival-bid'),
      catalog,
    ).state;
    const clubBefore = opened.clubs.find(club => club.id === opened.userClubId)!;
    const preview = storyEventViewModel(opened, loadLaunchContent())
      .choices.find(choice => choice.id === 'take-the-deadline-fee');

    expect(preview).toMatchObject({ disabled: false });
    expect(preview?.consequenceHint).toContain('+$2,600');
    expect(preview?.consequenceHint).toContain(`Lose ${playerName}`);

    const sold = resolveCareerEventChoice(
      opened,
      catalog,
      'take-the-deadline-fee',
    );
    const clubAfter = sold.clubs.find(club => club.id === sold.userClubId)!;
    const result = storyEventViewModel(sold, loadLaunchContent());

    expect(sold.players.find(player => player.id === selectedPlayerId)?.clubId)
      .not.toBe(sold.userClubId);
    expect(
      sold.lineups.find(lineup => lineup.clubId === sold.userClubId)?.playerIds,
    ).not.toContain(selectedPlayerId);
    expect(clubAfter.cash).toBe(clubBefore.cash + 2600);
    expect(sold.cashTransactions?.filter(transaction => (
      transaction.kind === 'transfer-sell'
      && transaction.referenceId === selectedPlayerId
    ))).toHaveLength(1);
    expect(result.outcomeRewards?.map(reward => reward.label))
      .toEqual(['+$2,600', `Lose ${playerName}`]);
  });

  test('only the sale choice is disabled when the chosen player must stay for squad cover', () => {
    const initial = career();
    const starters = new Set(
      initial.lineups.find(lineup => lineup.clubId === initial.userClubId)!.playerIds,
    );
    const backupKeeper = initial.players.find(player => (
      player.clubId === initial.userClubId
      && !starters.has(player.id)
      && player.role === 'GK'
    ));
    if (backupKeeper === undefined) throw new Error('test career has no backup keeper');
    const state = selectCareerEventPlayer(
      offerCareerEvent(initial, 'rival-bid-deadline-day'),
      backupKeeper.id,
    );
    const choices = storyEventViewModel(state, loadLaunchContent()).choices;

    expect(choices.find(choice => choice.id === 'hold-past-the-deadline'))
      .toMatchObject({ disabled: false });
    expect(choices.find(choice => choice.id === 'take-the-deadline-fee'))
      .toMatchObject({
        disabled: true,
        disabledReason: expect.stringContaining('spare goalkeeper'),
      });
  });

  test('skips a targeted sequel when its original player is now illegal, even with alternatives', () => {
    const offered = playerEvent('rival-bid-arrives');
    const resolved = resolveCareerEventChoice(
      offered,
      catalog,
      'listen-to-the-rival-bid',
    );
    const selectedPlayerId = offered.pendingEvent?.selectedPlayerId;
    const anotherClubId = resolved.clubs.find(
      (club) => club.id !== resolved.userClubId,
    )?.id;
    if (selectedPlayerId === undefined || anotherClubId === undefined) {
      throw new Error('test career cannot make the carried player illegal');
    }
    const invalidated: GameState = {
      ...resolved,
      players: resolved.players.map((player) =>
        player.id === selectedPlayerId
          ? { ...player, clubId: anotherClubId }
          : player,
      ),
    };
    expect(
      careerEventTargetCandidates(invalidated, event('rival-bid-deadline-day'))
        .playerIds.length,
    ).toBeGreaterThan(0);

    const continuation = continueResolvedCareerEvent(invalidated, catalog);

    expect(continuation.followed).toBe(false);
    expect(continuation.state.pendingEvent).toBeUndefined();
  });

  test('keeps an untargeted authored chain unchanged', () => {
    const offered = offerCareerEvent(career(), 'leaking-stand-roof');
    const resolved = resolveCareerEventChoice(
      offered,
      catalog,
      'pay-for-the-roof',
    );

    const continuation = continueResolvedCareerEvent(resolved, catalog);

    expect(continuation.followed).toBe(true);
    expect(continuation.state.pendingEvent).toEqual({
      eventId: 'west-stand-reopening',
    });
  });
});
