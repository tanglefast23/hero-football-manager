import type { LaunchContent } from '../content';
import {
  pendingTrainingInterrupts,
  resolveTrainingDrillForPath,
  type CareerPlayer,
  type CareerTrainingSlot,
  type GameState,
} from '../game';

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
  const slots = state.trainingPlan?.slots ?? [];
  const planIsActive = slots.length > 0
    && pendingTrainingInterrupts(state, state.trainingPoints).tpShortfall === 0;

  if (!planIsActive) return genericScene(roster);

  const playersById = new Map(roster.map(player => [player.id, player]));
  const drillsById = new Map(content.training.focusDrills.map(drill => [drill.id, drill]));
  const assigned = slots
    .map(slot => ({ slot, player: playersById.get(slot.playerId) }))
    .filter((entry): entry is { slot: CareerTrainingSlot; player: CareerPlayer } =>
      entry.player !== undefined,
    );

  if (assigned.length === 0) return genericScene(roster);

  const participants = assigned.map(({ slot, player }) => {
    const drill = resolveTrainingDrillForPath(state, slot.pathId);
    return {
      playerId: player.id,
      playerName: player.name,
      role: player.role,
      lookId: player.lookId,
      activityId: activityIdFor(slot.pathId),
      activityLabel: drillsById.get(drill.id)?.name ?? drill.id,
    };
  });

  return {
    mode: 'plan',
    drillLabels: participants.map(participant => participant.activityLabel),
    participants,
  };
}

function genericScene(roster: readonly CareerPlayer[]): TrainingTransitionScene {
  const index = Math.max(0, roster.findIndex(player => player.role !== 'GK'));
  const player = roster[index];
  return {
    mode: 'generic',
    drillLabels: ['Open Training'],
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

function activityIdFor(pathId: string): TrainingActivityId {
  if (pathId === 'first-touch') return 'rondo';
  return ACTIVITY_IDS.has(pathId as TrainingActivityId)
    ? pathId as TrainingActivityId
    : 'generic';
}
