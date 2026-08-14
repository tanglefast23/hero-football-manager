import { loadLaunchContent, parseLaunchContent } from '../load';
import { PlayerRequestCatalogSchema } from '../schemas';
import type { LaunchContent } from '../schemas';
import type { PlayerRequestCatalog, PlayerRequestCost } from '../../game/types';

function cloneContent(content: LaunchContent): LaunchContent {
  return JSON.parse(JSON.stringify(content)) as LaunchContent;
}

describe('validated player request catalog', () => {
  test('ships thirty requests with unique ids', () => {
    const catalog = loadLaunchContent().playerRequests;

    expect(catalog.requests).toHaveLength(30);
    expect(new Set(catalog.requests.map((request) => request.id)).size).toBe(
      30,
    );
  });

  test('uses only costs that disrupt the usual team plan', () => {
    const kinds = new Set(
      loadLaunchContent().playerRequests.requests.map((r) => r.cost.kind),
    );

    expect(kinds).toEqual(
      new Set(['ABSENCE', 'CONDITION_SQUAD', 'DRILL_PLAYER', 'DRILL_SQUAD']),
    );
  });

  test('keeps drill costs alive through at least the next training week', () => {
    const drillCosts = loadLaunchContent()
      .playerRequests.requests.map((request) => request.cost)
      .filter(
        (cost) => cost.kind === 'DRILL_PLAYER' || cost.kind === 'DRILL_SQUAD',
      );

    for (const cost of drillCosts) expect(cost.weeks).toBeGreaterThanOrEqual(2);
  });

  test('carries no status perk, which would collide with contractPromise', () => {
    const kinds = loadLaunchContent().playerRequests.requests.map(
      (r) => r.cost.kind as string,
    );

    // A request must never write contractPromise: it holds one object per
    // player, so granting a perk would destroy whatever was agreed in talks.
    for (const banned of [
      'ARMBAND',
      'SHIRT_TEN',
      'GUARANTEED_START',
      'TRAINING_PRIORITY',
    ]) {
      expect(kinds).not.toContain(banned);
    }
  });

  test('gives a themed bonus only to requests with a squad-wide cost', () => {
    const withBonus = loadLaunchContent().playerRequests.requests.filter(
      (request) => request.grantBonus !== undefined,
    );

    expect(withBonus.length).toBeGreaterThan(0);
    for (const request of withBonus) {
      expect(['CONDITION_SQUAD', 'DRILL_SQUAD']).toContain(request.cost.kind);
    }
  });

  test('rejects a duplicate request id', () => {
    const catalog = loadLaunchContent().playerRequests;
    const duplicated = {
      ...catalog,
      requests: [
        catalog.requests[0],
        { ...catalog.requests[1], id: catalog.requests[0].id },
      ],
    };

    expect(() => PlayerRequestCatalogSchema.parse(duplicated)).toThrow(
      'request ID',
    );
  });

  test('rejects artwork that names a sprite the game does not have', () => {
    const catalog = loadLaunchContent().playerRequests;
    const broken = {
      ...catalog,
      requests: [{ ...catalog.requests[0], art: ['money-bag', 'unicorn'] }],
    };

    expect(() => PlayerRequestCatalogSchema.parse(broken)).toThrow(
      'unknown request art sprite',
    );
  });

  test('rejects a cadence whose guarantee is not after its floor', () => {
    const catalog = loadLaunchContent().playerRequests;
    const broken = {
      ...catalog,
      tuning: {
        ...catalog.tuning,
        cadence: {
          ...catalog.tuning.cadence,
          COZY: {
            ...catalog.tuning.cadence.COZY,
            minWeeks: 12,
            guaranteeWeeks: 12,
          },
        },
      },
    };

    expect(() => PlayerRequestCatalogSchema.parse(broken)).toThrow(
      'minWeeks must be below guaranteeWeeks',
    );
  });

  test('rejects a star window that is slower than the ordinary one', () => {
    const catalog = loadLaunchContent().playerRequests;
    const broken = {
      ...catalog,
      tuning: {
        ...catalog.tuning,
        cadence: {
          ...catalog.tuning.cadence,
          CHAIRMAN: {
            ...catalog.tuning.cadence.CHAIRMAN,
            starMinWeeks: 9,
            starGuaranteeWeeks: 12,
          },
        },
      },
    };

    // Owning stars is what makes the dressing room noisy; a slower star window
    // would invert the whole point of the fame weighting.
    expect(() => PlayerRequestCatalogSchema.parse(broken)).toThrow(
      'must not wait longer',
    );
  });

  test('is rejected by the launch content schema when a request is malformed', () => {
    const content = cloneContent(loadLaunchContent());
    (
      content.playerRequests.requests[0].cost as {
        multiplierPercent: number;
      }
    ).multiplierPercent = 0;

    expect(() => parseLaunchContent(content)).toThrow();
  });
});

describe('catalog conforms to the engine contract', () => {
  test('the validated catalog is assignable to the shape src/game requires', () => {
    // `src/game/` may depend only on itself and inward on `src/sim/`, so it
    // cannot import these types from here — it declares its own contract and
    // content has to satisfy it. This assignment is the check: if either side
    // drifts, this file stops compiling. The runtime expect is incidental.
    const catalog: PlayerRequestCatalog = loadLaunchContent().playerRequests;

    expect(catalog.requests.length).toBeGreaterThan(0);
  });

  test('every authored cost kind is one the engine knows how to resolve', () => {
    const engineKinds: ReadonlyArray<PlayerRequestCost['kind']> = [
      'MONEY_PLAYER',
      'MONEY_SQUAD',
      'ABSENCE',
      'CONDITION_SQUAD',
      'DRILL_PLAYER',
      'DRILL_SQUAD',
    ];

    for (const request of loadLaunchContent().playerRequests.requests) {
      expect(engineKinds).toContain(request.cost.kind);
    }
  });
});
