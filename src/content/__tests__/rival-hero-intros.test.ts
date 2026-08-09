import { copyFor } from '../../i18n';
import { rivalHeroIntroViewModelForHeroId } from '../../application/rival-hero-intro';
import { RIVAL_HERO_INTRO_HERO_IDS } from '../../game/rival-hero-intro';
import { SPECIAL_HERO_ROSTER } from '../../game/special-heroes';
import { loadLaunchContent, parseLaunchContent } from '../load';

describe('rival hero intro content', () => {
  it('ships exactly one validated taunt for each order-one division special', () => {
    const content = loadLaunchContent();
    expect(content.rivalHeroIntros.intros.map((intro) => intro.heroId)).toEqual(
      RIVAL_HERO_INTRO_HERO_IDS,
    );

    expect(
      RIVAL_HERO_INTRO_HERO_IDS.map((heroId) => {
        const hero = SPECIAL_HERO_ROSTER.find(
          (candidate) => candidate.id === heroId,
        )!;
        return {
          heroId,
          name: hero.name,
          lookId: hero.lookId,
          power: hero.power,
          division: hero.placement,
          order: hero.order,
        };
      }),
    ).toEqual([
      {
        heroId: 'special-f171',
        name: 'Larry Alan',
        lookId: 'f171',
        power: 'SUPER_SPEED',
        division: 5,
        order: 1,
      },
      {
        heroId: 'special-f178',
        name: 'Scott Somers',
        lookId: 'f178',
        power: 'THUNDER_STRIKE',
        division: 4,
        order: 1,
      },
      {
        heroId: 'special-f174',
        name: 'Steve Rodgers',
        lookId: 'f174',
        power: 'RALLY_CRY',
        division: 3,
        order: 1,
      },
      {
        heroId: 'special-f176',
        name: 'Bruno Bannor',
        lookId: 'f176',
        power: 'SUPER_STRENGTH',
        division: 2,
        order: 1,
      },
      {
        heroId: 'special-f168',
        name: 'Bruce Wain',
        lookId: 'f168',
        power: 'SHADOW_MARK',
        division: 1,
        order: 1,
      },
    ]);

    for (const intro of content.rivalHeroIntros.intros) {
      const hero = SPECIAL_HERO_ROSTER.find(
        (candidate) => candidate.id === intro.heroId,
      );
      expect(hero).toMatchObject({ order: 1, placement: expect.any(Number) });
      expect(intro.taunt.length).toBeGreaterThan(0);
      expect(intro.taunt.length).toBeLessThanOrEqual(160);
    }
  });

  it('rejects duplicate, missing, and unknown hero records at launch parsing', () => {
    const content = loadLaunchContent();
    const duplicate = JSON.parse(JSON.stringify(content));
    duplicate.rivalHeroIntros.intros[4] = duplicate.rivalHeroIntros.intros[0];
    expect(() => parseLaunchContent(duplicate)).toThrow();

    const unknown = JSON.parse(JSON.stringify(content));
    unknown.rivalHeroIntros.intros[0].heroId = 'special-f999';
    expect(() => parseLaunchContent(unknown)).toThrow();
  });

  it('builds production identities and translated title/taunt from one join', () => {
    const content = loadLaunchContent();
    expect(
      rivalHeroIntroViewModelForHeroId('special-f168', content, copyFor('en')),
    ).toEqual({
      heroId: 'special-f168',
      name: 'Bruce Wain',
      lookId: 'f168',
      role: 'DEF',
      power: 'SHADOW_MARK',
      title: 'Division Rival',
      taunt:
        'My superpower is preparation. My backup superpower is an absurd transfer budget.',
    });
    expect(
      rivalHeroIntroViewModelForHeroId('special-f171', content, copyFor('es')),
    ).toMatchObject({
      title: 'Rival de división',
      taunt: 'Estaré en tu área antes de que desaparezca este bocadillo.',
    });
  });
});
