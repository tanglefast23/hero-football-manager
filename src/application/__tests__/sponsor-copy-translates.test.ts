import { loadLaunchContent } from '../../content';
import {
  acceptSponsorOffer,
  createCareer,
  createSeasonSponsorship,
  type GameState,
  type SponsorContractSnapshot,
  type SponsorshipState,
} from '../../game';
import { copyFor, loadCatalog } from '../../i18n';
import {
  parseStoredGameState,
  serializeGameState,
} from '../../persistence/game-state-codec';
import { createLaunchCareerSetup } from '../launch';
import { clubFinancesViewModel } from '../view-models';

/**
 * The sponsor desk, in a language that is not English.
 *
 * Three separate audits concluded this surface was blocked on a coordinated
 * save-format change. It was not: `sponsorObjectiveSnapshotSchema` has always
 * accepted `labelKey`/`labelParams`, and both the contract and offer snapshots
 * carry `sponsorContentId`, so the offer line is recoverable from content at
 * render time. What was missing was the producer writing the key and the view
 * models reading it.
 *
 * **Every assertion here uses a GERMAN translator.** With an English `t` a
 * successful lookup and a fallback to the persisted English are indistinguishable
 * — the test would pass whether or not any of this worked, which is the shape of
 * gate this whole workstream exists to stop shipping.
 */
const content = loadLaunchContent();
const de = copyFor('de');
const german = (key: string): string => {
  const value = loadCatalog('de').strings[key];
  expect({ key, value }).toEqual({ key, value: expect.any(String) });
  return value!;
};

/**
 * A D3 club in its offer window: two continuity slots, three candidates each.
 *
 * Season 1 deliberately, so the career's own fixtures cover the season a signed
 * objective reads its progress from.
 */
function sponsorDeskCareer(): GameState {
  const initial = createCareer(createLaunchCareerSetup(20260808));
  return {
    ...initial,
    week: 2,
    clubBusiness: {
      ...initial.clubBusiness,
      sponsorship: createSeasonSponsorship({
        rules: initial.sponsorRules!,
        careerSeed: initial.careerSeed,
        season: 1,
        division: 3,
        difficulty: 'COZY',
        highestDivisionReached: 3,
        nominalAnchor: 6_000,
      }),
    },
  };
}

function withSponsorship(
  state: GameState,
  sponsorship: SponsorshipState,
): GameState {
  return { ...state, clubBusiness: { ...state.clubBusiness, sponsorship } };
}

describe('the sponsor desk reads in the player s language', () => {
  test('offer lines, targets and profile chips all resolve', () => {
    const state = sponsorDeskCareer();
    const offers = state.clubBusiness.sponsorship.offers;
    expect(offers.length).toBeGreaterThan(0);

    const viewModel = clubFinancesViewModel(state, de).sponsorship!;
    const cards = viewModel.slots.flatMap((slot) => slot.offers);
    expect(cards).toHaveLength(offers.length);

    cards.forEach((card, index) => {
      const offer = offers[index]!;
      // The brand STAYS English — the owner's decision, and the same rule club
      // and player names already follow. Asserted rather than assumed, because
      // it is the one string on this card that must not move.
      expect({ id: offer.sponsorContentId, name: card.sponsorName }).toEqual({
        id: offer.sponsorContentId,
        name: offer.sponsorName,
      });
      expect(card.offerLine).toBe(
        german(`sponsor.brand.${offer.sponsorContentId}.offerLine`),
      );
      expect(card.offerLine).not.toBe(offer.offerLine);
      expect(card.objectiveLabel).toBe(
        german(
          `sponsor.objective.${objectiveIdOf(offer.objective.kind)}.label`,
        ).replace('{target}', String(offer.objective.target)),
      );
      expect(card.objectiveLabel).not.toBe(offer.objective.label);
      expect(card.objectiveLabel).toContain(String(offer.objective.target));
    });

    expect(cards.map((card) => card.profileLabel)).toEqual(
      offers.map((offer) =>
        german(
          `clubFinances.sponsorProfile${offer.profile[0]}${offer.profile.slice(1).toLowerCase()}`,
        ),
      ),
    );
    expect(new Set(cards.map((card) => card.profileLabel))).toEqual(
      new Set(['Solide', 'Ausgewogen', 'Mutig']),
    );
  });

  test('the continuity placeholder is chrome, not a brand', () => {
    const state = sponsorDeskCareer();
    const slots = clubFinancesViewModel(state, de).sponsorship!.slots;

    // D3 carries two managed slots, so the name is the numbered form.
    expect(slots.map((slot) => slot.sponsorName)).toEqual([
      'Aktueller Sponsor 1',
      'Aktueller Sponsor 2',
    ]);
    expect(slots.map((slot) => slot.offerLine)).toEqual([
      'Dein bestehender Sponsorvertrag läuft weiter.',
      'Dein bestehender Sponsorvertrag läuft weiter.',
    ]);
    // `'continuity'` matches no row in `sponsors.json`, so a lookup that assumed
    // a brand existed would leave both of these in English forever.
    expect(
      state.clubBusiness.sponsorship.activeContracts.map(
        (contract) => contract.sponsorName,
      ),
    ).toEqual(['Current Sponsor 1', 'Current Sponsor 2']);
  });

  test('a single-slot club drops the number', () => {
    const state = sponsorDeskCareer();
    const [first] = state.clubBusiness.sponsorship.activeContracts;
    const single = withSponsorship(state, {
      ...state.clubBusiness.sponsorship,
      activeContracts: [first!],
      offers: state.clubBusiness.sponsorship.offers.filter(
        (offer) => offer.slot === first!.slot,
      ),
    });

    expect(
      clubFinancesViewModel(single, de).sponsorship!.slots[0]!.sponsorName,
    ).toBe('Aktueller Sponsor');
  });

  test('a signed deal keeps its target translated all season', () => {
    const signed = signFirstOffer(sponsorDeskCareer());
    const contract = signed.clubBusiness.sponsorship.activeContracts.find(
      (candidate) => !candidate.provisional,
    )!;

    expect(contract.objective?.labelKey).toBe(
      'sponsor.objective.league-wins.label',
    );
    expect(contract.objective?.labelParams).toEqual({
      target: contract.objective!.target,
    });

    const slot = clubFinancesViewModel(signed, de).sponsorship!.slots.find(
      (candidate) => !candidate.provisional,
    )!;
    expect(slot.objectiveLabel).toBe(
      german('sponsor.objective.league-wins.label').replace(
        '{target}',
        String(contract.objective!.target),
      ),
    );
    expect(slot.sponsorName).toBe(contract.sponsorName);
  });
});

describe('what a save written before any of this still shows', () => {
  /**
   * The old-save case, and the reason it is worth a test of its own: the
   * persisted English is a finished, readable sentence, so a save that never
   * translates looks exactly like one that does. Only a non-English translator
   * can tell the two apart.
   */
  test('an objective with no labelKey falls back to the English in the save', () => {
    const signed = signFirstOffer(sponsorDeskCareer());
    const stored = JSON.parse(serializeGameState(signed)) as {
      clubBusiness: {
        sponsorship: {
          activeContracts: { objective?: Record<string, unknown> }[];
          offers: { objective: Record<string, unknown> }[];
        };
      };
    };
    for (const contract of stored.clubBusiness.sponsorship.activeContracts) {
      delete contract.objective?.labelKey;
      delete contract.objective?.labelParams;
    }
    for (const offer of stored.clubBusiness.sponsorship.offers) {
      delete offer.objective.labelKey;
      delete offer.objective.labelParams;
    }

    const restored = parseStoredGameState(JSON.stringify(stored));
    const old = clubFinancesViewModel(restored, de).sponsorship!.slots.find(
      (candidate) => !candidate.provisional,
    )!;
    const current = clubFinancesViewModel(signed, de).sponsorship!.slots.find(
      (candidate) => !candidate.provisional,
    )!;

    const englishInTheSave =
      restored.clubBusiness.sponsorship.activeContracts.find(
        (candidate) => !candidate.provisional,
      )!.objective!.label;
    expect(old.objectiveLabel).toBe(englishInTheSave);
    expect(old.objectiveLabel).toMatch(/^Win \d+ league match/);
    // The pairing that makes the assertion above mean something: the same save
    // WITH the key reads German, so the fallback is a fallback and not the only
    // thing this view model has ever done.
    expect(current.objectiveLabel).not.toBe(old.objectiveLabel);

    // The offer line is recovered from `sponsorContentId`, which every save has
    // always carried, so it translates even on the save that predates the key.
    expect(old.offerLine).toBe(current.offerLine);
    expect(old.offerLine).not.toBe(
      restored.clubBusiness.sponsorship.activeContracts.find(
        (candidate) => !candidate.provisional,
      )!.offerLine,
    );
  });

  test('a brand the shipped content no longer has renders its persisted line', () => {
    const state = sponsorDeskCareer();
    const retired: SponsorContractSnapshot = {
      ...state.clubBusiness.sponsorship.activeContracts[0]!,
      sponsorContentId: 'harborline-tractors',
      sponsorName: 'Harborline Tractors',
      offerLine: 'Ploughing on since 1974.',
      provisional: false,
    };
    const withRetiredBrand = withSponsorship(state, {
      ...state.clubBusiness.sponsorship,
      activeContracts: [retired],
      offers: [],
    });

    const slot = clubFinancesViewModel(withRetiredBrand, de).sponsorship!
      .slots[0]!;
    expect(slot.sponsorName).toBe('Harborline Tractors');
    expect(slot.offerLine).toBe('Ploughing on since 1974.');
  });
});

/** The objective family ids in `content/sponsors.json`, by the kind they carry. */
function objectiveIdOf(
  kind: 'LEAGUE_WINS' | 'LEAGUE_GOALS' | 'LEAGUE_FINISH',
): string {
  const definition = content.sponsors.objectives.find(
    (candidate) => candidate.kind === kind,
  );
  expect({ kind, found: definition !== undefined }).toEqual({
    kind,
    found: true,
  });
  return definition!.id;
}

function signFirstOffer(state: GameState): GameState {
  const offer = state.clubBusiness.sponsorship.offers.find(
    (candidate) => candidate.objective.kind === 'LEAGUE_WINS',
  )!;
  return withSponsorship(
    state,
    acceptSponsorOffer(state.clubBusiness.sponsorship, {
      offerId: offer.offerId,
      season: 1,
      week: 2,
    }),
  );
}
