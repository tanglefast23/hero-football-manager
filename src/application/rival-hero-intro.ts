import type { LaunchContent } from '../content';
import type { CopyFn } from '../i18n';
import {
  pendingRivalHeroIntro,
  type RivalHeroIntroHeroId,
} from '../game/rival-hero-intro';
import { SPECIAL_HERO_ROSTER } from '../game/special-heroes';
import type { GameState } from '../game/types';
import type { PowerId, Role } from '../sim/types';
import { copyOrEnglish } from './copy-fallback';

export interface RivalHeroIntroViewModel {
  readonly heroId: RivalHeroIntroHeroId;
  readonly name: string;
  readonly lookId: string;
  readonly role: Exclude<Role, 'GK'>;
  readonly power: PowerId;
  readonly title: string;
  readonly taunt: string;
}

export function rivalHeroIntroViewModel(
  state: GameState,
  content: LaunchContent,
  t: CopyFn,
): RivalHeroIntroViewModel | undefined {
  const pending = pendingRivalHeroIntro(state);
  return pending === undefined
    ? undefined
    : rivalHeroIntroViewModelForHeroId(pending.heroId, content, t);
}

/** The same production join used by the career screen, exposed for the harness. */
export function rivalHeroIntroViewModelForHeroId(
  heroId: RivalHeroIntroHeroId,
  content: LaunchContent,
  t: CopyFn,
): RivalHeroIntroViewModel {
  const hero = SPECIAL_HERO_ROSTER.find((candidate) => candidate.id === heroId);
  if (hero === undefined || hero.placement === 'scout' || hero.order !== 1) {
    throw new Error(`unknown division-headline rival ${heroId}`);
  }
  const intro = content.rivalHeroIntros.intros.find(
    (candidate) => candidate.heroId === heroId,
  );
  if (intro === undefined)
    throw new Error(`missing rival hero intro copy ${heroId}`);
  return {
    heroId,
    name: hero.name,
    lookId: hero.lookId,
    role: hero.role,
    power: hero.power,
    title: t('rivalHeroIntro.divisionRival'),
    taunt: copyOrEnglish(t, `rivalHeroIntro.${heroId}.taunt`, intro.taunt),
  };
}
