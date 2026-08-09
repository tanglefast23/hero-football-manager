/**
 * What a policy may ask the game to do.
 *
 * Policies return intents; they never touch `GameState`. The runner is the only
 * thing that turns an intent into a production call, which keeps the "no direct
 * stat/TP/cash writes" rule enforceable in one place.
 */
import type { FacilityPosition, FacilityType } from '../../game';

export type OpeningIntent =
  | { readonly kind: 'hire-head-coach'; readonly coachId: string }
  | {
      readonly kind: 'build-facility';
      readonly facilityType: FacilityType;
      readonly position: FacilityPosition;
    }
  | {
      readonly kind: 'train';
      readonly playerId: string;
      readonly pathId: string;
    };

export function describeIntent(intent: OpeningIntent): string {
  switch (intent.kind) {
    case 'hire-head-coach':
      return `hire-head-coach ${intent.coachId}`;
    case 'build-facility':
      return `build-facility ${intent.facilityType}@${intent.position.x},${intent.position.y}`;
    case 'train':
      return `train ${intent.playerId} ${intent.pathId}`;
    default: {
      const exhaustive: never = intent;
      throw new Error(`unknown intent ${JSON.stringify(exhaustive)}`);
    }
  }
}
