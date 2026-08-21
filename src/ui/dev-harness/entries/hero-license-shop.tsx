import { useEffect, useMemo, useState } from 'react';
import { loadLaunchContent } from '../../../content/load';
import { matchDayViewModel } from '../../../application/view-models';
import { activeCareerMatchday } from '../../../game/career';
import { selectCareerLicensedHeroes } from '../../../game/squad';
import type { GameState } from '../../../game/types';
import { FixtureMatchDayScreen } from '../../screens/FixtureMatchDayScreen';
import { COACHING_FORMATION_IDS } from '../../../sim/tactics';
import { devHarnessCareer } from '../career';
import type { DevHarnessEntry } from '../registry';

interface ShopCase {
  readonly id: string;
  readonly label: string;
  readonly note: string;
  readonly cash: number;
  readonly sponsorChallenge?: boolean;
  readonly permitFive?: boolean;
}

/**
 * The counter opens once the club owns as many heroes as it can field, so both
 * cases carry two heroes against the District League's cap of two. The only
 * axis that varies is whether the club can pay.
 */
const SHOP_CASES: readonly ShopCase[] = Object.freeze([
  {
    id: 'affordable',
    label: 'Can pay',
    note: 'Third permit at $100,000, with the money in the bank',
    cash: 180_000,
  },
  {
    id: 'too-poor',
    label: 'Cannot pay',
    note: 'Same price, refused — the club is short',
    cash: 12_000,
  },
  {
    id: 'sponsor-challenge',
    label: 'Challenge',
    note: 'Active Score 3+ goals challenge and $9,600 prize',
    cash: 180_000,
    sponsorChallenge: true,
  },
  {
    id: 'permit-five',
    label: 'Permit five',
    note: 'D1 · four active permits · fifth hero starts on the bench',
    cash: 1_000_000,
    permitFive: true,
  },
]);

const CASE_BY_ID = new Map(SHOP_CASES.map((entry) => [entry.id, entry]));

/** A real career stopped at its first player-controlled formation screen. */
function matchdayCareer(): GameState {
  return devHarnessCareer({
    id: 'hero-license-shop:first-matchday:20260805',
    seed: 20260805,
    seasonBudget: 2,
    stopAt: (state) =>
      state.phase === 'matchday' && activeCareerMatchday(state) !== undefined,
  });
}

/**
 * Two heroes and a bank balance, authored.
 *
 * Awakening is capped at two per season and is driven by match events, so a
 * headless run reaches the second hero seasons after the screen under review
 * stops changing. The powers and the cash are therefore set here; the offer,
 * its price, its refusal and the panel itself are all production paths.
 */
function shopCareer(shopCase: ShopCase): GameState {
  const base = matchdayCareer();
  const fixture = activeCareerMatchday(base)!.fixture;
  const squad = base.players.filter(
    (player) => player.clubId === base.userClubId,
  );
  const starterIds = new Set(
    base.lineups.find((lineup) => lineup.clubId === base.userClubId)!.playerIds,
  );
  const permitFiveHeroes = [
    ...squad
      .filter((player) => starterIds.has(player.id) && player.role !== 'GK')
      .slice(0, 4),
    squad.find(
      (player) => !starterIds.has(player.id) && player.role !== 'GK',
    )!,
  ];
  const heroes = shopCase.permitFive ? permitFiveHeroes : squad.slice(0, 2);
  const heroIds = new Set(heroes.map((player) => player.id));
  const licensedIds = new Set(
    heroes
      .slice(0, shopCase.permitFive ? 4 : 2)
      .map((player) => player.id),
  );
  return {
    ...base,
    ...(shopCase.permitFive ? { purchasedHeroLicenseCap: 5 } : {}),
    clubs: base.clubs.map((club) =>
      club.id === base.userClubId ? { ...club, cash: shopCase.cash } : club,
    ),
    players: base.players.map((player) =>
      heroIds.has(player.id)
        ? {
            ...player,
            power: player.id === squad[0].id ? 'SUPER_SPEED' : 'THUNDER_STRIKE',
            licensed: licensedIds.has(player.id),
          }
        : player,
    ),
    ...(shopCase.sponsorChallenge
      ? {
          clubBusiness: {
            ...base.clubBusiness,
            sponsorship: {
              ...base.clubBusiness.sponsorship,
              weeklyChallenge: {
                id: `sponsor-sprint-s${base.season}`,
                kind: 'SCORE_THREE' as const,
                sponsorName: 'Sponsor Desk',
                season: base.season,
                chosenWeek: fixture.week,
                fixtureId: fixture.id,
                fixtureWeek: fixture.week,
                nominalBonus: 9_600,
              },
            },
          },
        }
      : {}),
  };
}

export function HeroLicenseShopReel({ caseId }: { readonly caseId: string }) {
  const shopCase = CASE_BY_ID.get(caseId) ?? SHOP_CASES[0];
  const content = useMemo(() => loadLaunchContent(), []);
  const [state, setState] = useState(() => shopCareer(shopCase));
  useEffect(() => setState(shopCareer(shopCase)), [shopCase]);
  const viewModel = useMemo(
    () => matchDayViewModel(state, content),
    [content, state],
  );

  return (
    <FixtureMatchDayScreen
      viewModel={viewModel}
      onBack={() => {}}
      onToggleHeroLicense={(playerId) =>
        setState((current) => {
          const selected = current.players
            .filter(
              (player) =>
                player.clubId === current.userClubId && player.licensed,
            )
            .map((player) => player.id);
          return selectCareerLicensedHeroes(
            current,
            selected.includes(playerId)
              ? selected.filter((id) => id !== playerId)
              : [...selected, playerId],
          );
        })
      }
      onBuyHeroLicense={() => {}}
      onSwapStartingPlayer={() => {}}
      onWatchMatch={() => {}}
      onQuickResult={() => {}}
      formationOptions={COACHING_FORMATION_IDS}
      onSelectFormation={() => {}}
      onOpenSettings={() => {}}
      autoPowers={false}
      onAutoPowersChange={() => {}}
      autoSubs={false}
      onAutoSubsChange={() => {}}
    />
  );
}

export const heroLicenseShopEntry: DevHarnessEntry = Object.freeze({
  id: 'hero-license-shop',
  group: 'Match day',
  title: 'Hero License permit office',
  summary:
    'The counter that sells the next Hero License before promotion does.',
  cases: Object.freeze(
    SHOP_CASES.map((entry) =>
      Object.freeze({
        id: entry.id,
        label: entry.label,
        note: entry.note,
      }),
    ),
  ),
  render: (caseId: string) => <HeroLicenseShopReel caseId={caseId} />,
});
