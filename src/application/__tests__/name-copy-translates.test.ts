import { readFileSync } from 'fs';
import { join } from 'path';
import { loadLaunchContent } from '../../content';
import { createCareer, type CareerPlayer, type GameState } from '../../game';
import type {
  CoachSpecialty as MarketCoachSpecialty,
  PlayerPersonality as MarketPersonality,
  ScoutRegion,
} from '../../game/market';
import type { CoachSpecialty as LegacyCoachSpecialty } from '../../game/pyramid';
import type { PlayerArchetype, PlayerPersonality } from '../../game/types';
import { ENABLED_LOCALES, copyFor, loadCatalog, type Locale } from '../../i18n';
import { createLaunchCareerSetup } from '../launch';
import { careerMarketViewModelSource } from '../market-source-adapter';
import {
  marketViewModel,
  type MarketViewModelSource,
} from '../market-view-model';
import {
  archetypeName,
  coachSpecialtyName,
  personalityName,
  scoutRegionName,
} from '../name-copy';
import { clubLegacyViewModel, squadTrainingViewModel } from '../view-models';

/**
 * The names an enum turns into, in a language that is not English.
 *
 * Every one of these words used to come out of a prettifier — `readableId`, its
 * twin `readableLabel`, or the archetype table keyed by its own display text —
 * so a Vietnamese scout desk offered trips to "South America" and a German
 * player file called a Wall a "Wall".
 *
 * **Why each render site is asserted and not just the view model.** The
 * archetype reaches the screen through four different fields on three screens,
 * and each screen chooses for itself whether to draw the id or the label. A
 * test that checks one site passes while the other three still ship English,
 * which is exactly what had happened: the view model had been converted and
 * `ClubLegacyScreen` was still drawing `viewModel.archetype`. So the view-model
 * assertions below are paired with a scan of the components, and the scan
 * asserts the negative too — that no site draws the persisted id.
 */
const content = loadLaunchContent();
const de = copyFor('de');
const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

/**
 * The unions, spelled out as exhaustive records so that adding a member to any
 * of them fails the BUILD rather than quietly leaving one word untranslated.
 * `PLAYER_ARCHETYPES` in `archetype-caps.ts` cannot do that job — it is a list
 * that merely satisfies the union, so a ninth archetype could be added without
 * appearing in it.
 */
const ARCHETYPE_IDS = Object.keys({
  Speedster: 0,
  Sniper: 0,
  Playmaker: 0,
  Anchor: 0,
  Wall: 0,
  Engine: 0,
  'All-Rounder': 0,
  Prodigy: 0,
} satisfies Record<PlayerArchetype, 0>) as PlayerArchetype[];
const PERSONALITY_IDS = Object.keys({
  Fiery: 0,
  Loyal: 0,
  Greedy: 0,
  Joker: 0,
  Professional: 0,
  Timid: 0,
} satisfies Record<PlayerPersonality, 0>) as PlayerPersonality[];
const MARKET_PERSONALITY_IDS = Object.keys({
  FIERY: 0,
  LOYAL: 0,
  GREEDY: 0,
  JOKER: 0,
  PROFESSIONAL: 0,
  TIMID: 0,
} satisfies Record<MarketPersonality, 0>) as MarketPersonality[];
const SPECIALTY_IDS = Object.keys({
  ATTACK: 0,
  DEFENSE: 0,
  FITNESS: 0,
  TECHNIQUE: 0,
  GOALKEEPING: 0,
  MOTIVATOR: 0,
} satisfies Record<MarketCoachSpecialty, 0>) as MarketCoachSpecialty[];
const LEGACY_SPECIALTY_IDS = Object.keys({
  Attack: 0,
  Defense: 0,
  Fitness: 0,
  Technique: 0,
  Goalkeeping: 0,
  Motivator: 0,
} satisfies Record<LegacyCoachSpecialty, 0>) as LegacyCoachSpecialty[];
const REGION_IDS = Object.keys({
  LOCAL: 0,
  EUROPE: 0,
  SOUTH_AMERICA: 0,
  AFRICA: 0,
  ASIA: 0,
} satisfies Record<ScoutRegion, 0>) as ScoutRegion[];

const career = (seed: number) =>
  createCareer(createLaunchCareerSetup(seed, undefined, content));

function catalogWord(locale: Locale, key: string): string {
  const value = loadCatalog(locale).strings[key];
  expect({ locale, key, value }).toEqual({
    locale,
    key,
    value: expect.any(String),
  });
  return value!;
}

describe('every enum name has a word in every language', () => {
  /**
   * Asserting against the catalog entry rather than "not English" is the only
   * assertion that works for all six: German keeps "Loyal" and Spanish keeps
   * "Motor", so a difference test would have to carve out exceptions and would
   * stop proving anything. Reading the row back proves the key exists AND that
   * the lookup found it, because the fallback returns the prettified id.
   */
  test('archetypes, personalities, specialties and regions all resolve', () => {
    for (const locale of ENABLED_LOCALES) {
      const t = copyFor(locale);
      for (const [id, slug] of [
        ['Speedster', 'speedster'],
        ['Sniper', 'sniper'],
        ['Playmaker', 'playmaker'],
        ['Anchor', 'anchor'],
        ['Wall', 'wall'],
        ['Engine', 'engine'],
        ['All-Rounder', 'allRounder'],
        ['Prodigy', 'prodigy'],
      ] as const) {
        expect({ locale, id, word: archetypeName(t, id) }).toEqual({
          locale,
          id,
          word: catalogWord(locale, `archetype.${slug}.name`),
        });
      }
      expect(ARCHETYPE_IDS).toHaveLength(8);

      for (const id of PERSONALITY_IDS) {
        expect({ locale, id, word: personalityName(t, id) }).toEqual({
          locale,
          id,
          word: catalogWord(locale, `personality.${id.toLowerCase()}.name`),
        });
      }
      for (const id of SPECIALTY_IDS) {
        const slug = id === 'GOALKEEPING' ? 'goalkeeping' : id.toLowerCase();
        expect({ locale, id, word: coachSpecialtyName(t, id) }).toEqual({
          locale,
          id,
          word: catalogWord(locale, `coachSpecialty.${slug}.name`),
        });
      }
      for (const [id, slug] of [
        ['LOCAL', 'local'],
        ['EUROPE', 'europe'],
        ['SOUTH_AMERICA', 'southAmerica'],
        ['AFRICA', 'africa'],
        ['ASIA', 'asia'],
      ] as const) {
        expect({ locale, id, word: scoutRegionName(t, id) }).toEqual({
          locale,
          id,
          word: catalogWord(locale, `scoutRegion.${slug}.name`),
        });
      }
      expect(REGION_IDS).toHaveLength(5);
    }
  });

  /**
   * The non-vacuous half. If `archetype.wall.name` were ever deleted from the
   * German catalog, the test above would fail on the missing row — but if the
   * lookup silently stopped normalising and started returning the id, only a
   * hard-coded expectation catches it.
   */
  test('a German player reads German words, not the enum', () => {
    expect(ARCHETYPE_IDS.map((id) => archetypeName(de, id))).toEqual([
      'Sprinter',
      'Torjäger',
      'Spielmacher',
      'Abräumer',
      'Mauer',
      'Motor',
      'Allrounder',
      'Wunderkind',
    ]);
    expect(PERSONALITY_IDS.map((id) => personalityName(de, id))).toEqual([
      'Hitzkopf',
      'Loyal',
      'Gierig',
      'Spaßvogel',
      'Profi',
      'Schüchtern',
    ]);
    expect(REGION_IDS.map((id) => scoutRegionName(de, id))).toEqual([
      'Umgebung',
      'Europa',
      'Südamerika',
      'Afrika',
      'Asien',
    ]);
    expect(SPECIALTY_IDS.map((id) => coachSpecialtyName(de, id))).toEqual([
      'Angriff',
      'Abwehr',
      'Fitness',
      'Technik',
      'Torwart',
      'Motivator',
    ]);
  });

  /**
   * Personality and coach specialty each exist as TWO unions — title case on a
   * player (`src/game/types.ts`), upper case on a coach (`src/game/market.ts`)
   * — and one key family has to serve both. Two families would translate a
   * player's personality and leave the coach beside him in English.
   */
  test('both spellings of the same enum reach the same word', () => {
    expect(MARKET_PERSONALITY_IDS.map((id) => personalityName(de, id))).toEqual(
      PERSONALITY_IDS.map((id) => personalityName(de, id)),
    );
    expect(
      LEGACY_SPECIALTY_IDS.map((id) => coachSpecialtyName(de, id)),
    ).toEqual(SPECIALTY_IDS.map((id) => coachSpecialtyName(de, id)));
  });
});

describe('every archetype render site draws the translated word', () => {
  test('the player file — both the identity line and the archetype row', () => {
    const state = career(20260808);
    const player = state.players.find(
      (candidate) => candidate.clubId === state.userClubId,
    )!;
    const german = squadTrainingViewModel(
      state,
      content,
      player.id,
      de,
    ).players.find((row) => row.id === player.id)!;

    expect(german.archetype).toBe(player.archetype);
    expect(german.archetypeLabel).toBe(archetypeName(de, player.archetype!));
    expect(german.archetypeLabel).not.toBe(german.archetype);
    expect(german.personalityLabel).toBe(
      personalityName(de, player.personality!),
    );

    // Both lines draw the label. The id stays on the model because
    // `archetypeDevelopmentSummary` and `personalityExplainer` key off it.
    const screen = read('src/ui/screens/SquadTrainingScreen.tsx');
    expect(screen).toContainSource(
      '{selectedPlayer.role} · {selectedPlayer.archetypeLabel}',
    );
    expect(screen).toContainSource('{selectedPlayer.archetypeLabel}</Text>');
    expect(screen).toContainSource('{selectedPlayer.personalityLabel}</Text>');
  });

  test('the youth card on the market screen', () => {
    const state = career(20260808);
    const source: MarketViewModelSource = {
      ...careerMarketViewModelSource(state, undefined, de),
      unlockedSections: ['YOUTH', 'SCOUT', 'TRANSFERS', 'COACHES'],
      youthIntake: {
        status: 'OPEN',
        declined: false,
        rosterCount: 16,
        rosterCapacity: 20,
        exclusiveChoice: false,
        offers: [
          {
            player: {
              id: 'youth-1',
              name: 'Tam Reyes',
              role: 'FWD',
              age: 17,
              potential: 4,
              archetype: 'Sniper',
              weeklyWage: 40,
              attrs: {
                pac: 40,
                sho: 44,
                pas: 30,
                def: 12,
                tec: 35,
                sta: 38,
                ref: 6,
              },
            },
            signingBonus: 500,
          },
        ],
      },
    };

    expect(marketViewModel(source, de).youth?.offers[0]?.archetypeLabel).toBe(
      'Torjäger',
    );
    expect(read('src/ui/screens/MarketScreen.tsx')).toContainSource(
      '{offer.role} · {offer.ageLabel} · {offer.archetypeLabel}',
    );
  });

  test('the club-legend chip', () => {
    const state = career(20260808);
    const roster = state.players.filter(
      (candidate) => candidate.clubId === state.userClubId,
    );
    const legend: CareerPlayer = {
      ...roster[0]!,
      id: 'retired-legend',
      name: 'Ari Flint',
      archetype: 'Playmaker',
      personality: 'Loyal',
      // `isClubLegend` gates the queue on both numbers, so a legend with a
      // default fame never reaches the screen this test is about.
      seasonsAtClub: 7,
      fame: 288,
    };
    const withLegend: GameState = {
      ...state,
      retiredPlayers: [legend],
      pendingLegacyPlayerIds: [legend.id],
    };

    const german = clubLegacyViewModel(withLegend, de);
    expect(german.archetype).toBe('Playmaker');
    expect(german.archetypeLabel).toBe('Spielmacher');
    expect(german.personalityLabel).toBe(personalityName(de, 'Loyal'));

    expect(read('src/ui/screens/ClubLegacyScreen.tsx')).toContainSource(
      '<StatusChip label={viewModel.archetypeLabel} tone="hero" />',
    );
  });

  /**
   * The negative control the other three cannot give. Drawing the id renders a
   * perfectly readable English word, so nothing looks broken and no view-model
   * assertion can see it — the only way to catch a site sliding back is to say
   * the id is never drawn.
   */
  test('no site draws the persisted id', () => {
    const drawnIds = [
      ['src/ui/screens/SquadTrainingScreen.tsx', '{selectedPlayer.archetype}'],
      [
        'src/ui/screens/SquadTrainingScreen.tsx',
        '{selectedPlayer.personality}<',
      ],
      ['src/ui/screens/MarketScreen.tsx', '{offer.archetype}'],
      ['src/ui/screens/ClubLegacyScreen.tsx', 'label={viewModel.archetype}'],
      ['src/ui/screens/ClubLegacyScreen.tsx', 'label={viewModel.personality}'],
    ] as const;
    for (const [file, expression] of drawnIds) {
      expect({
        file,
        expression,
        drawn: read(file).includes(expression),
      }).toEqual({ file, expression, drawn: false });
    }
  });
});

describe('the rest of the raw name tokens', () => {
  test('the scout desk names its region in the player s language', () => {
    const state = career(20260808);
    const base = careerMarketViewModelSource(state, undefined, de);
    const source: MarketViewModelSource = {
      ...base,
      unlockedSections: ['YOUTH', 'SCOUT', 'TRANSFERS', 'COACHES'],
      scoutOptions: [
        {
          id: 'brief-sa',
          region: 'SOUTH_AMERICA',
          focus: { kind: 'POSITION', role: 'DEF' },
        },
        { id: 'brief-asia', region: 'ASIA', focus: { kind: 'ELITE_PROSPECT' } },
      ],
      activeScoutMission: {
        id: 'mission-1',
        missionSeed: 7,
        startWeek: base.currentCareerWeek,
        dueWeek: base.currentCareerWeek + 3,
        cost: 4_000,
        region: 'AFRICA',
        focus: { kind: 'AGE', minimumAge: 16, maximumAge: 21 },
        scoutOfficeLevel: 1,
      },
    };

    const german = marketViewModel(source, de).scouting;
    expect(german.choices.map((choice) => choice.regionLabel)).toEqual([
      'Südamerika',
      'Asien',
    ]);
    // The headline interpolates the region, so an untranslated token would leak
    // "Africa" into an otherwise German sentence.
    expect(german.status.headline).toBe('Reise läuft: Afrika');
  });

  test('the coach market names specialty and personality in the player s language', () => {
    const state = career(20260808);
    const candidate = marketViewModel(
      careerMarketViewModelSource(state, undefined, de),
      de,
    ).coaches[0]!;

    expect(candidate.specialtyLabels).toEqual([
      coachSpecialtyName(de, 'ATTACK'),
      coachSpecialtyName(de, 'FITNESS'),
    ]);
    expect(candidate.personalityLabel).toBe('Hitzkopf');
  });

  /**
   * The drill confirmation card. `src/game/training.ts` may not reach the
   * catalog, so it emits a kind plus the token the kind needs and the view
   * model chooses the words — which is why the archetype bonus can read
   * "Mauer" here without the pure ring knowing what a Wall is called.
   *
   * The role code is deliberately absent from this expectation: GK/DEF/MID/FWD
   * are drawn untranslated everywhere else in the game.
   */
  test('the drill card names its bonuses in the player s language', () => {
    const state = career(20260808);
    const player = state.players.find(
      (candidate) =>
        candidate.clubId === state.userClubId && candidate.archetype === 'Wall',
    )!;
    const options =
      squadTrainingViewModel(state, content, player.id, de)
        .selectedPlayerStatOptions ?? [];
    const labels = new Set(
      options.flatMap((option) =>
        option.trainingModifiers.map((modifier) => modifier.label),
      ),
    );

    expect(labels).toContainSource('Jung');
    expect(labels).toContainSource('Mauer');
    expect(labels).not.toContainSource('Youth');
    expect(labels).not.toContainSource('Wall');
  });
});
