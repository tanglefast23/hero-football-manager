import type { FacilityAdjacencyId } from '../game/facilities';
import type { FacilityTypeViewModel } from './models';

export interface FacilityAdjacencyPresentation {
  readonly id: FacilityAdjacencyId;
  readonly pairLabel: string;
  readonly effectLabel: string;
  readonly rationale: string;
}

export interface FacilityAdjacencyClue {
  readonly adjacencyId: FacilityAdjacencyId;
  readonly text: string;
}

const PRESENTATIONS: Readonly<Record<FacilityAdjacencyId, FacilityAdjacencyPresentation>> = {
  'gym-dorm': {
    id: 'gym-dorm',
    pairLabel: 'Gym + Dorm',
    effectLabel: '+10% stamina training gains',
    rationale: 'Players can move straight from conditioning into rest and recovery.',
  },
  'fan-shop-stadium': {
    id: 'fan-shop-stadium',
    pairLabel: 'Fan Shop + Stadium Stand',
    effectLabel: '+10% merchandise income',
    rationale: 'Supporters pass the shop on matchday, creating more impulse purchases.',
  },
  'medical-training-pitch': {
    id: 'medical-training-pitch',
    pairLabel: 'Medical Bay + Training Pitch',
    effectLabel: '20% less injury risk',
    rationale: 'Nearby physios can screen, treat, and rehabilitate players around every session.',
  },
};

const CLUES: Readonly<Partial<Record<FacilityTypeViewModel, FacilityAdjacencyClue>>> = {
  gym: {
    adjacencyId: 'gym-dorm',
    text: 'Hard sessions pay off when players can recover immediately afterwards.',
  },
  dorm: {
    adjacencyId: 'gym-dorm',
    text: 'Better rest turns conditioning work into lasting stamina.',
  },
  'fan-shop': {
    adjacencyId: 'fan-shop-stadium',
    text: 'Matchday foot traffic can turn supporters into customers.',
  },
  'stadium-stand': {
    adjacencyId: 'fan-shop-stadium',
    text: 'Crowds spend more when club merchandise sits on their matchday route.',
  },
  'medical-bay': {
    adjacencyId: 'medical-training-pitch',
    text: 'Fast treatment works best when physios are close to daily sessions.',
  },
  'training-pitch': {
    adjacencyId: 'medical-training-pitch',
    text: 'Training is safer when treatment is only a few steps away.',
  },
};

export function facilityAdjacencyPresentation(
  id: string,
): FacilityAdjacencyPresentation | undefined {
  if (!Object.prototype.hasOwnProperty.call(PRESENTATIONS, id)) return undefined;
  return PRESENTATIONS[id as FacilityAdjacencyId];
}

export function facilityAdjacencyClue(
  type: FacilityTypeViewModel,
): FacilityAdjacencyClue | undefined {
  return CLUES[type];
}

export function facilityAdjacencyLabel(id: string): string {
  const presentation = facilityAdjacencyPresentation(id);
  return presentation === undefined
    ? id
    : `${presentation.pairLabel} · ${presentation.effectLabel}`;
}
