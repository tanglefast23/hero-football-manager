import {
  FACILITY_ADJACENCIES,
  FACILITY_CATALOG,
  type FacilityAdjacencyId,
} from '../../game/facilities';
import {
  facilityAdjacencyClue,
  facilityAdjacencyLabel,
  facilityAdjacencyPresentation,
} from '../facility-adjacency';

describe('facility adjacency guidance', () => {
  it('gives every shipped pairing an exact effect and a real-world rationale', () => {
    for (const adjacency of FACILITY_ADJACENCIES) {
      const presentation = facilityAdjacencyPresentation(adjacency.id);
      expect(presentation).toMatchObject({ id: adjacency.id });
      expect(presentation?.pairLabel.length).toBeGreaterThan(0);
      expect(presentation?.effectLabel).toMatch(/10%|20%/);
      expect(presentation?.rationale.length).toBeGreaterThan(30);
      expect(facilityAdjacencyLabel(adjacency.id)).toContain(presentation!.pairLabel);
      expect(facilityAdjacencyLabel(adjacency.id)).toContain(presentation!.effectLabel);
    }
  });

  it('gives both buildings in every pairing a pre-discovery clue', () => {
    for (const adjacency of FACILITY_ADJACENCIES) {
      const firstClue = facilityAdjacencyClue(adjacency.first);
      const secondClue = facilityAdjacencyClue(adjacency.second);
      expect(firstClue).toMatchObject({
        adjacencyId: adjacency.id,
      });
      expect(secondClue).toMatchObject({
        adjacencyId: adjacency.id,
      });
      expect(firstClue?.text.toLowerCase()).not.toContain(
        FACILITY_CATALOG[adjacency.second].name.toLowerCase(),
      );
      expect(secondClue?.text.toLowerCase()).not.toContain(
        FACILITY_CATALOG[adjacency.first].name.toLowerCase(),
      );
    }
  });

  it('does not invent clues or labels for facilities without a shipped pairing', () => {
    expect(facilityAdjacencyClue('hero-lab')).toBeUndefined();
    expect(facilityAdjacencyPresentation('future-combo')).toBeUndefined();
    expect(facilityAdjacencyPresentation('toString')).toBeUndefined();
    expect(facilityAdjacencyLabel('future-combo')).toBe('future-combo');
  });

  it('keeps the shipped adjacency IDs exhaustive', () => {
    const ids = FACILITY_ADJACENCIES.map(adjacency => adjacency.id);
    expect(ids).toEqual<FacilityAdjacencyId[]>([
      'gym-dorm',
      'fan-shop-stadium',
      'medical-training-pitch',
    ]);
  });
});
