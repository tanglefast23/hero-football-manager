import { activeCareerMatchday } from './career';
import type { GameState } from './types';

/** Fixed career order for the five division-headline rivals, D5 through D1. */
export const RIVAL_HERO_INTRO_HERO_IDS = [
  'special-f171',
  'special-f178',
  'special-f174',
  'special-f176',
  'special-f168',
] as const;

export type RivalHeroIntroHeroId = (typeof RIVAL_HERO_INTRO_HERO_IDS)[number];

const RIVAL_HERO_INTRO_HERO_ID_SET = new Set<string>(RIVAL_HERO_INTRO_HERO_IDS);
const RIVAL_HERO_INTRO_FLAG_PREFIX = 'story:rival-hero-intro:';

export interface PendingRivalHeroIntro {
  readonly heroId: RivalHeroIntroHeroId;
  readonly opponentClubId: string;
  readonly fixtureId: string;
  readonly competition: 'league' | 'national-cup';
}

export function isRivalHeroIntroHeroId(
  heroId: string,
): heroId is RivalHeroIntroHeroId {
  return RIVAL_HERO_INTRO_HERO_ID_SET.has(heroId);
}

export function rivalHeroIntroFlag(heroId: RivalHeroIntroHeroId): string {
  return `${RIVAL_HERO_INTRO_FLAG_PREFIX}${heroId}`;
}

/** The unseen headline hero on the exact fixture Play or Quick Result would run. */
export function pendingRivalHeroIntro(
  state: GameState,
): PendingRivalHeroIntro | undefined {
  if (state.phase !== 'matchday') return undefined;
  const matchday = activeCareerMatchday(state);
  if (matchday === undefined) return undefined;
  const opponentClubId =
    matchday.fixture.homeClubId === state.userClubId
      ? matchday.fixture.awayClubId
      : matchday.fixture.homeClubId;

  for (const heroId of RIVAL_HERO_INTRO_HERO_IDS) {
    if (state.eventFlags.includes(rivalHeroIntroFlag(heroId))) continue;
    if (
      state.players.some(
        (player) => player.id === heroId && player.clubId === opponentClubId,
      )
    ) {
      return {
        heroId,
        opponentClubId,
        fixtureId: matchday.fixture.id,
        competition: matchday.kind,
      };
    }
  }
  return undefined;
}

/** Completes only the hero the current Match Day still expects. */
export function completeRivalHeroIntro(
  state: GameState,
  heroId: RivalHeroIntroHeroId,
): GameState {
  const flag = rivalHeroIntroFlag(heroId);
  if (state.eventFlags.includes(flag)) return state;
  if (pendingRivalHeroIntro(state)?.heroId !== heroId) return state;
  return { ...state, eventFlags: [...state.eventFlags, flag] };
}
