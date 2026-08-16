import { loadLaunchContent } from '../../content';
import {
  careerContractPromiseHeroLimit,
  careerHeroLimit,
  createCareer,
  heroLicensePurchaseCost,
  nextHeroLicenseOffer,
  promotionRewardsForDivision,
  purchaseCareerHeroLicense,
} from '../../game';
import type { GameState } from '../../game';
import {
  parseStoredGameState,
  serializeGameState,
} from '../../persistence/game-state-codec';
import { createLaunchCareerSetup } from '../launch';

describe('Hero License purchases', () => {
  const content = loadLaunchContent();

  const careerWith = (
    cash: number,
    highestDivisionReached: 5 | 3 | 1 = 5,
  ): GameState => {
    const state = createCareer(
      createLaunchCareerSetup(414, undefined, content),
    );
    return {
      ...state,
      m2: { ...state.m2!, highestDivisionReached },
      clubs: state.clubs.map((club) =>
        club.id === state.userClubId ? { ...club, cash } : club,
      ),
    };
  };

  const cashOf = (state: GameState) =>
    state.clubs.find((club) => club.id === state.userClubId)!.cash;

  it('prices a permit by its number, never by how many were bought', () => {
    expect(heroLicensePurchaseCost(3)).toBe(100_000);
    expect(heroLicensePurchaseCost(4)).toBe(200_000);
    expect(heroLicensePurchaseCost(5)).toBe(300_000);
    expect(heroLicensePurchaseCost(6)).toBe(350_000);
    expect(heroLicensePurchaseCost(7)).toBe(400_000);
    expect(() => heroLicensePurchaseCost(2)).toThrow('never sold');

    // A Global League club that bought nothing still pays the fifth permit's
    // price, because the ladder it climbed already handed it four.
    expect(nextHeroLicenseOffer(careerWith(500_000, 1))).toMatchObject({
      licenseNumber: 5,
      cost: 300_000,
    });
  });

  it('charges the club, raises the cap, and writes one ledger line', () => {
    const bought = purchaseCareerHeroLicense(careerWith(150_000)).state;

    expect(bought.purchasedHeroLicenseCap).toBe(3);
    expect(careerHeroLimit(bought)).toBe(3);
    expect(cashOf(bought)).toBe(50_000);
    expect(bought.cashTransactions?.at(-1)).toMatchObject({
      kind: 'hero-license',
      label: 'Hero License 3 bought',
      labelKey: 'cashTransaction.heroLicenseBought',
      labelParams: { license: 3 },
      amount: -100_000,
    });

    // The next permit up is the fourth, and this purse cannot reach it.
    expect(nextHeroLicenseOffer(bought)).toMatchObject({
      licenseNumber: 4,
      cost: 200_000,
      blockedReason: { text: 'Not enough money.' },
    });
    expect(() => purchaseCareerHeroLicense(bought)).toThrow(
      'Not enough money.',
    );
  });

  it('treats a bought permit as a floor, so promotion never stacks on it', () => {
    const bought = purchaseCareerHeroLicense(careerWith(150_000)).state;
    const promoted: GameState = {
      ...bought,
      m2: { ...bought.m2!, highestDivisionReached: 3 },
    };

    // Regional League gives three for free. The paid third does not make four.
    expect(careerHeroLimit(promoted)).toBe(3);
    expect(nextHeroLicenseOffer(promoted).licenseNumber).toBe(4);
  });

  it('gives the transfer desk the same cap match day fields', () => {
    const before = careerWith(150_000);
    expect(careerContractPromiseHeroLimit(before)).toBe(2);

    const bought = purchaseCareerHeroLicense(before).state;
    // The bug this guards: match day licensed three heroes while the desk
    // still refused a starting promise for the third.
    expect(careerContractPromiseHeroLimit(bought)).toBe(
      careerHeroLimit(bought),
    );
    expect(careerContractPromiseHeroLimit(bought)).toBe(3);
  });

  it('sells a fifth permit only to a Global League club', () => {
    const richButLow = careerWith(2_000_000, 5);
    const toFour: GameState = {
      ...richButLow,
      purchasedHeroLicenseCap: 4,
    };
    expect(nextHeroLicenseOffer(toFour)).toMatchObject({
      licenseNumber: 5,
      blockedReason: {
        text: 'Only a Global League club may hold more than four.',
        textKey: 'fixtureMatchDay.heroLicenseGlobalOnly',
      },
    });
    expect(() => purchaseCareerHeroLicense(toFour)).toThrow('Global League');

    const global: GameState = {
      ...toFour,
      m2: { ...toFour.m2!, highestDivisionReached: 1 },
    };
    expect(nextHeroLicenseOffer(global).blockedReason).toBeUndefined();
    expect(
      purchaseCareerHeroLicense(global).state.purchasedHeroLicenseCap,
    ).toBe(5);
  });

  it('stops congratulating the club on a permit it already paid for', () => {
    const titles = (held: number) =>
      promotionRewardsForDivision(3, held).map((reward) => reward.title);

    expect(titles(0)).toContain('Third Hero License');
    expect(titles(3)).not.toContain('Third Hero License');
    // A third bought does not silence the fourth the Global League still owes.
    expect(
      promotionRewardsForDivision(1, 3).map((reward) => reward.title),
    ).toContain('Fourth Hero License');
  });

  it('survives a save round trip, and old saves stay at the earned cap', () => {
    const bought = purchaseCareerHeroLicense(careerWith(150_000)).state;
    const reloaded = parseStoredGameState(serializeGameState(bought));
    expect(reloaded.purchasedHeroLicenseCap).toBe(3);
    expect(careerHeroLimit(reloaded)).toBe(3);

    const { purchasedHeroLicenseCap: _dropped, ...beforePermitsWereSold } =
      bought;
    const old = parseStoredGameState(
      serializeGameState(beforePermitsWereSold as GameState),
    );
    expect(old.purchasedHeroLicenseCap).toBeUndefined();
    expect(careerHeroLimit(old)).toBe(2);
  });
});
