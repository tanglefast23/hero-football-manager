import type { MatchEvent } from '../sim/types';

export type MatchHapticCue =
  'zone' | 'power' | 'rival-power' | 'goal' | 'conceded';

export function hapticCueForEvent(
  event: MatchEvent,
  controlledTeam: 0 | 1,
): MatchHapticCue | null {
  if (event.kind === 'POWER_READY') {
    return teamForPlayer(event.player) === controlledTeam ? 'zone' : null;
  }
  if (event.kind === 'POWER_FIRED') {
    return teamForPlayer(event.player) === controlledTeam
      ? 'power'
      : 'rival-power';
  }
  if (event.kind === 'GUST_REDIRECT' || event.kind === 'GUST_PUNT') {
    return teamForPlayer(event.player) === controlledTeam
      ? 'power'
      : 'rival-power';
  }
  if (event.kind === 'GOAL')
    return event.team === controlledTeam ? 'goal' : 'conceded';
  return null;
}

function teamForPlayer(player: number): 0 | 1 {
  return player < 11 ? 0 : 1;
}
