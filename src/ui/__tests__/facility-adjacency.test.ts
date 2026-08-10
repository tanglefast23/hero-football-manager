import {
  FACILITY_ADJACENCIES,
  type FacilityAdjacencyId,
} from '../../game/facilities';
import {
  facilityAdjacencyLabel,
  facilityAdjacencyPresentation,
} from '../facility-adjacency';
import { beatMoment } from '../bert-beat-moments';
import { copyFor } from '../../i18n';

describe('facility adjacency guidance', () => {
  it('gives every shipped pairing an exact effect and a real-world rationale', () => {
    for (const adjacency of FACILITY_ADJACENCIES) {
      const presentation = facilityAdjacencyPresentation(adjacency.id);
      expect(presentation).toMatchObject({ id: adjacency.id });
      expect(presentation?.pairLabel.length).toBeGreaterThan(0);
      expect(presentation?.effectLabel).toMatch(/10%|20%/);
      expect(presentation?.rationale.length).toBeGreaterThan(30);
      expect(presentation?.discoveryCopy.length).toBeLessThan(100);
      expect(presentation?.facilityTypes).toEqual([
        adjacency.first,
        adjacency.second,
      ]);
      expect(presentation?.milestone).toMatch(/^facility-combo-.+-seen$/);
      expect(facilityAdjacencyLabel(adjacency.id)).toContain(
        presentation!.pairLabel,
      );
      expect(facilityAdjacencyLabel(adjacency.id)).toContain(
        presentation!.effectLabel,
      );
    }
  });

  it('does not invent presentations or labels for unshipped pairings', () => {
    expect(facilityAdjacencyPresentation('future-combo')).toBeUndefined();
    expect(facilityAdjacencyPresentation('toString')).toBeUndefined();
    expect(facilityAdjacencyLabel('future-combo')).toBe('future-combo');
  });

  it('keeps the shipped adjacency IDs exhaustive', () => {
    const ids = FACILITY_ADJACENCIES.map((adjacency) => adjacency.id);
    expect(ids).toEqual<FacilityAdjacencyId[]>([
      'gym-dorm',
      'fan-shop-stadium',
      'medical-training-pitch',
    ]);
  });

  it('announces the unlocked combo and points at it', () => {
    const presentation = facilityAdjacencyPresentation('fan-shop-stadium')!;
    expect(
      copyFor('en')('clubFinances.secretCombo', {
        pair: presentation.pairLabel,
      }),
    ).toBe('Facility combo unlocked · Fan Shop + Stadium Stand');
    expect(presentation.discoveryCopy).toContain('this combo gives');
    expect(
      beatMoment(
        'facility-adjacency',
        [
          {
            text: presentation.discoveryCopy,
            focus: 'facility-adjacency',
            kind: 'body',
            pageIndex: 0,
          },
        ],
        0,
      ),
    ).toBe('pointing-out');
  });
});
