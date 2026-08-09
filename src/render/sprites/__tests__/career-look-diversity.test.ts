import { createCareer } from '../../../game/career';
import { createLaunchCareerSetup } from '../../../application/launch';
import { runHeadlessFullCareer } from '../../../game/headless';
import type { CareerPlayer } from '../../../game/types';
import {
  parseStoredGameState,
  serializeGameState,
} from '../../../persistence/game-state-codec';
import { playerLookId } from '../player-look';

function assignedLook(player: CareerPlayer): string {
  expect(player.lookId).toBeDefined();
  return playerLookId(player.id, player.role, player.lookId);
}

describe('career roster visual diversity', () => {
  it('gives all 161 launch players a distinct look', () => {
    const career = createCareer(createLaunchCareerSetup(20260720));
    const coverage = career.clubs.map((club) => {
      const roster = career.players.filter(
        (player) => player.clubId === club.id,
      );
      const looks = roster.map(assignedLook);
      return {
        clubId: club.id,
        players: roster.length,
        uniqueLooks: new Set(looks).size,
      };
    });
    const userCoverage = coverage.find(
      (club) => club.clubId === career.userClubId,
    )!;
    expect(userCoverage.uniqueLooks).toBe(userCoverage.players);
    expect(Math.min(...coverage.map((club) => club.uniqueLooks))).toBe(16);
    // 161 with the named D5 hero, who carries a reserved face of his own.
    expect(new Set(career.players.map(assignedLook)).size).toBe(161);
  });

  it('keeps every club distinct and avoids obvious opponent repeats deep into an endless career', () => {
    const career = runHeadlessFullCareer(createLaunchCareerSetup(20260720), 7);
    const userRoster = career.players.filter(
      (player) => player.clubId === career.userClubId,
    );
    const userLooks = userRoster.map(assignedLook);
    expect(new Set(userLooks).size).toBe(userRoster.length);

    for (const club of career.clubs.filter(
      (club) => club.id !== career.userClubId,
    )) {
      const opponent = career.players.filter(
        (player) => player.clubId === club.id,
      );
      const opponentLooks = opponent.map(assignedLook);
      expect(new Set(opponentLooks).size).toBe(opponent.length);
      expect(
        new Set([...userLooks, ...opponentLooks]).size,
      ).toBeGreaterThanOrEqual(30);
    }
  });

  it('persists every assigned face through a deep-career save and reload', () => {
    const career = runHeadlessFullCareer(createLaunchCareerSetup(20260720), 7);
    const reloaded = parseStoredGameState(serializeGameState(career));
    expect(
      reloaded.players.map((player) => [player.id, assignedLook(player)]),
    ).toEqual(
      career.players.map((player) => [player.id, assignedLook(player)]),
    );
  });

  it('avoids active-career collisions across varied seeds', () => {
    for (let offset = 0; offset < 20; offset += 1) {
      const career = runHeadlessFullCareer(
        createLaunchCareerSetup(20260720 + offset),
        7,
      );
      const userLooks = career.players
        .filter((player) => player.clubId === career.userClubId)
        .map(assignedLook);
      expect(new Set(userLooks).size).toBe(userLooks.length);
      for (const club of career.clubs.filter(
        (club) => club.id !== career.userClubId,
      )) {
        const opponentLooks = career.players
          .filter((player) => player.clubId === club.id)
          .map(assignedLook);
        expect(new Set(opponentLooks).size).toBe(opponentLooks.length);
        expect(
          new Set([...userLooks, ...opponentLooks]).size,
        ).toBeGreaterThanOrEqual(30);
      }
    }
  });

  it('does not let newly promoted opponents displace surviving user faces', () => {
    for (const seed of [20260721, 20260722]) {
      const seasonSix = runHeadlessFullCareer(createLaunchCareerSetup(seed), 6);
      const seasonSeven = runHeadlessFullCareer(
        createLaunchCareerSetup(seed),
        7,
      );
      const seasonSevenLooks = new Map(
        seasonSeven.players
          .filter((player) => player.clubId === seasonSeven.userClubId)
          .map((player) => [player.id, assignedLook(player)]),
      );
      for (const player of seasonSix.players.filter(
        (player) =>
          player.clubId === seasonSix.userClubId &&
          seasonSevenLooks.has(player.id),
      )) {
        expect(seasonSevenLooks.get(player.id)).toBe(assignedLook(player));
      }
    }
  });
});
