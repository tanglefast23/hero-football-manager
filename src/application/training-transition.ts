import type { LaunchContent } from '../content';
import { chargeableCareerTrainingPlan, type CareerPlayer, type GameState } from '../game';

export type TrainingActivityId =
  | 'sprints'
  | 'finishing'
  | 'rondo'
  | 'duels'
  | 'circuit'
  | 'keeper-drills'
  | 'generic';

export interface TrainingTransitionParticipant {
  playerId: string;
  playerName: string;
  role: CareerPlayer['role'];
  lookId?: string;
  activityId: TrainingActivityId;
  activityLabel: string;
}

export interface TrainingTransitionScene {
  mode: 'plan' | 'generic';
  drillLabels: readonly string[];
  participants: readonly TrainingTransitionParticipant[];
}

const ACTIVITY_IDS = new Set<TrainingActivityId>([
  'sprints',
  'finishing',
  'rondo',
  'duels',
  'circuit',
  'keeper-drills',
]);

/**
 * Captures the focus plan before weekly settlement mutates the career. This is
 * presentation-only: it never writes to the deterministic game state.
 */
export function trainingTransitionScene(
  state: GameState,
  content: LaunchContent,
): TrainingTransitionScene {
  const roster = state.players.filter(player => player.clubId === state.userClubId);
  const plan = state.trainingPlan;
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  const chargeable = plan === undefined
    ? undefined
    : chargeableCareerTrainingPlan(state, plan.assignedPlayerIds, plan.drills);
  const activeDrills = chargeable?.drills ?? [];
  const moneyCost = chargeable?.moneyCost ?? 0;
  const trainingPointCost = chargeable?.trainingPointCost ?? 0;
  const planIsActive = plan !== undefined
    && plan.assignedPlayerIds.length > 0
    && plan.drills.length > 0
    && activeDrills.length > 0
    && club !== undefined
    && moneyCost <= Math.max(0, club.cash)
    && trainingPointCost <= state.trainingPoints;

  if (!planIsActive || plan === undefined) return genericScene(roster);

  const playersById = new Map(roster.map(player => [player.id, player]));
  const drillsById = new Map(content.training.focusDrills.map(drill => [drill.id, drill]));
  const assigned = plan.assignedPlayerIds
    .map(playerId => playersById.get(playerId))
    .filter((player): player is CareerPlayer => player !== undefined)
    .slice(0, 3);

  if (assigned.length === 0) return genericScene(roster);

  const drillLabels = activeDrills.map(drill => drillsById.get(drill.id)?.name ?? drill.id);
  return {
    mode: 'plan',
    drillLabels,
    participants: assigned.map((player, participantIndex) => {
      const drill = activeDrills[participantIndex % activeDrills.length];
      return {
        playerId: player.id,
        playerName: player.name,
        role: player.role,
        lookId: player.lookId,
        activityId: activityIdFor(drill.id),
        activityLabel: drillsById.get(drill.id)?.name ?? drill.id,
      };
    }),
  };
}

function genericScene(roster: readonly CareerPlayer[]): TrainingTransitionScene {
  const index = Math.max(0, roster.findIndex(player => player.role !== 'GK'));
  const player = roster[index];
  return {
    mode: 'generic',
    drillLabels: ['Basic Conditioning'],
    participants: [{
      playerId: player?.id ?? 'generic-player',
      playerName: player?.name ?? 'Rovers Player',
      role: player?.role ?? 'FWD',
      lookId: player?.lookId,
      activityId: 'generic',
      activityLabel: 'Ball Work',
    }],
  };
}

function activityIdFor(drillId: string): TrainingActivityId {
  const pathId = drillId.replace(/-(?:ii|iii)$/, '');
  if (pathId === 'first-touch') return 'rondo';
  return ACTIVITY_IDS.has(pathId as TrainingActivityId)
    ? pathId as TrainingActivityId
    : 'generic';
}
