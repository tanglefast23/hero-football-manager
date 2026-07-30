import type { FacilityAdjacencyId } from '../game/facilities';
import type { FacilityTypeViewModel } from './models';

export interface FacilityAdjacencyPresentation {
  readonly id: FacilityAdjacencyId;
  readonly pairLabel: string;
  readonly facilityTypes: readonly [FacilityTypeViewModel, FacilityTypeViewModel];
  readonly effectLabel: string;
  readonly rationale: string;
  readonly discoveryCopy: string;
  readonly milestone:
    | 'facility-combo-gym-dorm-seen'
    | 'facility-combo-fan-shop-stadium-seen'
    | 'facility-combo-medical-training-pitch-seen';
}

const PRESENTATIONS: Readonly<Record<FacilityAdjacencyId, FacilityAdjacencyPresentation>> = {
  'gym-dorm': {
    id: 'gym-dorm',
    pairLabel: 'Gym + Dorm',
    facilityTypes: ['gym', 'dorm'],
    effectLabel: '+10% stamina training gains',
    rationale: 'Players can move straight from conditioning into rest and recovery.',
    discoveryCopy: 'Players train, then recover next door. Bonus: +10% stamina training.',
    milestone: 'facility-combo-gym-dorm-seen',
  },
  'fan-shop-stadium': {
    id: 'fan-shop-stadium',
    pairLabel: 'Fan Shop + Stadium Stand',
    facilityTypes: ['fan-shop', 'stadium-stand'],
    effectLabel: '+10% merchandise income',
    rationale: 'Supporters pass the shop on matchday, creating more impulse purchases.',
    discoveryCopy: 'Fans pass the shop on matchday. Bonus: +10% merchandise income.',
    milestone: 'facility-combo-fan-shop-stadium-seen',
  },
  'medical-training-pitch': {
    id: 'medical-training-pitch',
    pairLabel: 'Medical Bay + Training Pitch',
    facilityTypes: ['medical-bay', 'training-pitch'],
    effectLabel: '20% less injury risk',
    rationale: 'Nearby physios can screen, treat, and rehabilitate players around every session.',
    discoveryCopy: 'Physios are beside every session. Bonus: 20% less injury risk.',
    milestone: 'facility-combo-medical-training-pitch-seen',
  },
};

export function facilityAdjacencyPresentation(
  id: string,
): FacilityAdjacencyPresentation | undefined {
  if (!Object.prototype.hasOwnProperty.call(PRESENTATIONS, id)) return undefined;
  return PRESENTATIONS[id as FacilityAdjacencyId];
}

export function facilityAdjacencyLabel(id: string): string {
  const presentation = facilityAdjacencyPresentation(id);
  return presentation === undefined
    ? id
    : `${presentation.pairLabel} · ${presentation.effectLabel}`;
}
