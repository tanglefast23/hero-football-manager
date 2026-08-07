import { loadLaunchContent } from '../../content';
import {
  buildCareerFacility,
  createCareer,
  facilityUpgradeBlockedReason,
} from '../../game';
import { ENABLED_LOCALES, copyFor } from '../../i18n';
import { createLaunchCareerSetup } from '../launch';
import { clubFinancesViewModel, squadTrainingViewModel } from '../view-models';

/**
 * The squad room and the finance screen in a language that is not English.
 *
 * These strings were produced by `src/game`, which may not import `src/i18n`,
 * and for that reason shipped as English only: the drill shop's path chips, the
 * three "why you cannot do this" sentences and the ledger's path name all drew
 * English words inside otherwise translated screens, in all six languages.
 *
 * Asserting the German rather than only asserting a key means the catalog has to
 * actually hold the entry — a dual write pointing at a key nothing can resolve
 * looks identical to no dual write at all, because the English fallback renders
 * either way.
 */
const content = loadLaunchContent();
const de = copyFor('de');

function career(seed: number) {
  const state = createCareer(createLaunchCareerSetup(seed, undefined, content));
  return {
    ...state,
    clubs: state.clubs.map(club => club.id === state.userClubId
      ? { ...club, cash: 100_000 }
      : club),
  };
}

describe('training copy reaches a non-English player', () => {
  test('drill shop rows name the path in the player s language', () => {
    const state = career(20260807);
    const english = squadTrainingViewModel(state, content, undefined).drillUpgrades;
    const german = squadTrainingViewModel(state, content, undefined, de).drillUpgrades;

    expect(english.map(row => row.label)).toEqual([
      'Pace', 'Shooting', 'Passing', 'Defense', 'Technique', 'Stamina', 'Reflexes',
    ]);
    expect(german.map(row => row.label)).toEqual([
      'Tempo', 'Schuss', 'Pass', 'Abwehr', 'Technik', 'Ausdauer', 'Reflexe',
    ]);
  });

  test('the stat picker names the path in the player s language too', () => {
    const state = career(20260808);
    const player = state.players.find(candidate => candidate.clubId === state.userClubId)!;
    const german = squadTrainingViewModel(state, content, player.id, de)
      .selectedPlayerStatOptions;

    expect(german?.map(option => option.label)).toContain('Ausdauer');
    expect(german?.map(option => option.label)).not.toContain('Stamina');
  });

  test('a locked drill tier explains itself in German, division name included', () => {
    const german = squadTrainingViewModel(career(20260809), content, undefined, de)
      .drillUpgrades[0];

    // The whole sentence, not just its frame: an untranslated `DIVISION_NAMES`
    // leaking back in would leave "County League" on the end of this.
    expect(german.blockedReason).toBe('Übungen Stufe 2 gibt es ab D4 · Kreisliga.');
  });

  test('an unaffordable upgrade says so in German', () => {
    const promoted = career(20260810);
    const broke = {
      ...promoted,
      m2: { ...promoted.m2!, highestDivisionReached: 4 as const },
      clubs: promoted.clubs.map(club => club.id === promoted.userClubId
        ? { ...club, cash: 2_999 }
        : club),
    };

    expect(squadTrainingViewModel(broke, content, undefined, de).drillUpgrades[0].blockedReason)
      .toBe('Nicht genug Geld.');
  });

  test('a facility level held back by the division explains itself in German', () => {
    // Level 3 is the only facility level a D5 club cannot reach.
    const state = career(20260811);
    const gym = buildCareerFacility(state, 'gym', { x: 2, y: 0 }).state;
    const atLevelTwo = {
      ...gym,
      facilities: {
        ...gym.facilities,
        grid: {
          ...gym.facilities.grid!,
          construction: undefined,
          buildings: gym.facilities.grid!.buildings.map(building => ({ ...building, level: 2 as const })),
        },
      },
    };

    expect(facilityUpgradeBlockedReason(atLevelTwo, 3)).toMatchObject({
      textKey: 'clubFinances.facilityLevelUnlocksIn',
      textParams: { level: 3, divisionLevel: 2, divisionNameKey: 'division.national' },
    });
    const building = clubFinancesViewModel(atLevelTwo, de).facilities.buildings[0];
    expect(building.upgradeBlockedReason).toBe('Anlagen Stufe 3 gibt es ab D2 · Nationalliga.');

    // The disabled button's label comes from `upgradeBlockedDivision`, carried
    // as a number, not from regexing the rung back out of the sentence. That is
    // what this pins: the data half exists in every locale, so the button can
    // never depend on a translation keeping an English-authored token.
    for (const locale of ENABLED_LOCALES) {
      const drawn = clubFinancesViewModel(atLevelTwo, copyFor(locale))
        .facilities.buildings[0];
      expect({ locale, division: drawn.upgradeBlockedDivision })
        .toEqual({ locale, division: 2 });
      // The sentence should still name the rung — it is how the player reads
      // which division unlocks it — but nothing but the copy depends on it now.
      expect({ locale, rung: drawn.upgradeBlockedReason?.match(/D[1-5]/)?.[0] })
        .toEqual({ locale, rung: 'D2' });
    }
  });
});
