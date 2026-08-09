import type { RivalHeroIntroHeroId } from '../game/rival-hero-intro';
import { isRivalHeroIntroHeroId } from '../game/rival-hero-intro';
import type { Role, TeamDef } from '../sim/types';

export interface WinningHeadlineHero {
  readonly heroId: RivalHeroIntroHeroId;
  readonly name: string;
  readonly role: Role;
  readonly lookId?: string;
  readonly team: 0 | 1;
}

/**
 * The order-one division rival on the winning side, if this result has one.
 *
 * Cup ties can finish level on the simulation score and name their penalty
 * winner separately. Ordinary league draws pass no tied winner and celebrate
 * nobody. The original team definition is used so a late substitution cannot
 * make the headline character disappear from their club's victory.
 */
export function winningHeadlineHero(
  home: TeamDef,
  away: TeamDef,
  score: readonly [number, number],
  tiedWinnerTeam?: 0 | 1,
): WinningHeadlineHero | undefined {
  const winnerTeam =
    score[0] > score[1] ? 0 : score[0] < score[1] ? 1 : tiedWinnerTeam;
  if (winnerTeam === undefined) return undefined;
  const team = winnerTeam === 0 ? home : away;
  const hero = [...team.players, ...(team.bench ?? [])].find((player) =>
    isRivalHeroIntroHeroId(player.id),
  );
  if (hero === undefined || !isRivalHeroIntroHeroId(hero.id)) return undefined;
  return {
    heroId: hero.id,
    name: hero.name,
    role: hero.role,
    ...(hero.lookId === undefined ? {} : { lookId: hero.lookId }),
    team: winnerTeam,
  };
}
