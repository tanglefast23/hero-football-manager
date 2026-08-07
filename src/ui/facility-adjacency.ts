import type { FacilityAdjacencyId } from '../game/facilities';
import { copyFor, type CopyFn } from '../i18n';
import type { FacilityTypeViewModel } from './models';

/**
 * English copy, for every caller that has not threaded a locale through yet.
 * The same lazy shape `application/view-models.ts` uses.
 */
let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

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

/**
 * The structural half of a pairing: which two buildings, which milestone, and
 * the catalog segment its four sentences live under.
 *
 * Split the way `render/power-effect-descriptors.ts` splits a power: the copy is
 * joined on in `facilityAdjacencyPresentation`, so the table below holds nothing
 * a translator would ever be shown.
 */
type FacilityAdjacencyStructure =
  Omit<FacilityAdjacencyPresentation, 'pairLabel' | 'effectLabel' | 'rationale' | 'discoveryCopy'>
  & { readonly copySlug: string };

const STRUCTURES: Readonly<Record<FacilityAdjacencyId, FacilityAdjacencyStructure>> = {
  'gym-dorm': {
    id: 'gym-dorm',
    facilityTypes: ['gym', 'dorm'],
    copySlug: 'gymDorm',
    milestone: 'facility-combo-gym-dorm-seen',
  },
  'fan-shop-stadium': {
    id: 'fan-shop-stadium',
    facilityTypes: ['fan-shop', 'stadium-stand'],
    copySlug: 'fanShopStadium',
    milestone: 'facility-combo-fan-shop-stadium-seen',
  },
  'medical-training-pitch': {
    id: 'medical-training-pitch',
    facilityTypes: ['medical-bay', 'training-pitch'],
    copySlug: 'medicalTrainingPitch',
    milestone: 'facility-combo-medical-training-pitch-seen',
  },
};

export function facilityAdjacencyPresentation(
  id: string,
  t: CopyFn = englishCopy(),
): FacilityAdjacencyPresentation | undefined {
  if (!Object.prototype.hasOwnProperty.call(STRUCTURES, id)) return undefined;
  const { copySlug, ...structure } = STRUCTURES[id as FacilityAdjacencyId];
  const segment = `clubFinances.facilityCombo.${copySlug}`;
  return {
    ...structure,
    pairLabel: t(`${segment}.pair`),
    effectLabel: t(`${segment}.effect`),
    rationale: t(`${segment}.rationale`),
    discoveryCopy: t(`${segment}.discovery`),
  };
}

export function facilityAdjacencyLabel(id: string, t: CopyFn = englishCopy()): string {
  const presentation = facilityAdjacencyPresentation(id, t);
  return presentation === undefined
    ? id
    : `${presentation.pairLabel} · ${presentation.effectLabel}`;
}
