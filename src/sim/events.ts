import type { MatchEvent, MatchState } from './types';

export function emit(state: MatchState, e: MatchEvent): void {
  state.events.push(e);
}
