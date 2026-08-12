import { createMatch, queueInput, tick } from '../../sim/match';
import type {
  Attrs,
  MatchState,
  PlayerDef,
  Role,
  TeamDef,
} from '../../sim/types';
import { contributionsFrom } from '../match-contributions';
import { controlledMatchOptions } from '../match-policy';
import { goalsFrom } from '../matchday';

function runToFullTime(state: MatchState): void {
  while (state.phase !== 'fulltime') tick(state);
}

function team(id: string): TeamDef {
  const roles: Role[] = [
    'GK',
    'DEF',
    'DEF',
    'DEF',
    'DEF',
    'MID',
    'MID',
    'MID',
    'MID',
    'FWD',
    'FWD',
  ];
  const attrs = (): Attrs => ({
    pac: 60,
    sho: 55,
    pas: 55,
    def: 55,
    tec: 55,
    sta: 60,
    ref: 55,
  });
  const players: PlayerDef[] = roles.map((role, index) => ({
    id: `${id}${index}`,
    name: `P${id}${index}`,
    role,
    attrs: attrs(),
  }));
  const bench: PlayerDef[] = [
    { id: `${id}bf`, name: 'BF', role: 'FWD', attrs: attrs() },
    { id: `${id}bm`, name: 'BM', role: 'MID', attrs: attrs() },
  ];
  return { id, name: `Club ${id}`, players, bench };
}

// A shot flies for many ticks, and the emergency auto-sub path can swap the
// shooter out before the ball crosses the line. The goal must stay with the
// player who actually shot, not with whoever inherited his lineup slot.
test('goal stays with the shooter who was substituted while his shot flew', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const state = createMatch(seed, team('h'), team('a'), {
      ...controlledMatchOptions(0),
    });
    const benchIds = ['hbf', 'hbm'];
    let used = 0;
    let armed: {
      slot: number;
      shooterId: string;
      launchTick: number;
      benchId: string;
    } | null = null;
    while (state.phase !== 'fulltime') {
      const ball = state.ball;
      if (
        armed === null &&
        ball.kind === 'shot' &&
        ball.by > 0 &&
        ball.by < 11 &&
        used < benchIds.length
      ) {
        try {
          queueInput(state, {
            tick: state.tick + 1,
            kind: 'SUBSTITUTE',
            player: ball.by,
            replacementId: benchIds[used],
          });
          armed = {
            slot: ball.by,
            shooterId: state.players[ball.by].def.id,
            launchTick: state.tick,
            benchId: benchIds[used],
          };
          used += 1;
        } catch {
          // Sub rejected (limit reached, wrong phase): keep playing.
        }
      }
      const scoreBefore = state.score[0];
      tick(state);
      if (armed === null) continue;
      const scenario = armed;
      if (state.score[0] > scoreBefore) {
        const goalEvent = [...state.events]
          .reverse()
          .find((event) => event.kind === 'GOAL');
        const subEvent = [...state.events]
          .reverse()
          .find(
            (event) =>
              event.kind === 'SUBSTITUTION' && event.player === scenario.slot,
          );
        if (
          goalEvent !== undefined &&
          goalEvent.kind === 'GOAL' &&
          goalEvent.by === scenario.slot &&
          subEvent !== undefined &&
          subEvent.kind === 'SUBSTITUTION' &&
          subEvent.t >= scenario.launchTick &&
          subEvent.t <= goalEvent.t
        ) {
          // The sub landed while the shot was in flight: the exact scenario.
          runToFullTime(state);
          const credited = goalsFrom(state).find(
            (goal) => goal.tick === goalEvent.t,
          );
          const contributions = contributionsFrom(state);
          const shooterGoals =
            contributions.find((row) => row.playerId === scenario.shooterId)
              ?.goals ?? 0;
          // The substitute may legitimately score later in the run-out, so
          // only this goal's attribution is asserted, not his whole tally.
          expect(credited?.playerId).toBe(scenario.shooterId);
          expect(shooterGoals).toBeGreaterThanOrEqual(1);
          return;
        }
        armed = null;
      } else if (state.ball.kind !== 'shot') {
        armed = null;
      }
    }
  }
  throw new Error('in-flight substitution scenario never materialized');
});
