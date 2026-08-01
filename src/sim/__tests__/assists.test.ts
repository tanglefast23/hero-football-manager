import { createMatch, observePossession, runMatch, tick } from '../match';
import { restartKickoff, shotFlightTick } from '../engine';
import { GOAL_CENTER_X } from '../geometry';
import { ROVERS, UNITED } from '../teams';
import type { MatchState, TeamDef } from '../types';

const POLICIES = { homePolicy: 'FIRE_WHEN_READY' as const, awayPolicy: 'FIRE_WHEN_READY' as const };

function rosterIds(team: TeamDef): Set<string> {
  return new Set([...team.players, ...(team.bench ?? [])].map(player => player.id));
}

/**
 * Puts a live shot over team 0's target line so the engine stamps a real GOAL.
 * `keeperChecked` is pre-set: the keeper roll is the only rng in this path, and
 * skipping it keeps the helper from perturbing the match stream.
 */
function stampGoal(state: MatchState, shooter: number): void {
  state.ball = {
    kind: 'shot',
    pos: { x: GOAL_CENTER_X, y: 1 },
    vel: { x: 0, y: -100 },
    by: shooter,
    shotStrengthD64: 0,
    power: 50,
    targetX: GOAL_CENTER_X,
    z: 0,
    vz: 0,
    trajectory: 'driven',
    keeperChecked: true,
  };
  shotFlightTick(state);
}

describe('assist tracking', () => {
  it('starts a match with no assist candidate', () => {
    const state: MatchState = createMatch(1, ROVERS, UNITED);
    expect(state.assistCandidateId).toBeNull();
  });

  it('credits a real teammate of the scorer', () => {
    const rosters = [rosterIds(ROVERS), rosterIds(UNITED)];
    let goals = 0;
    let assisted = 0;
    for (let index = 0; index < 20; index += 1) {
      const result = runMatch(900_000 + index * 7919, ROVERS, UNITED, [], POLICIES);
      for (const event of result.events) {
        if (event.kind !== 'GOAL') continue;
        goals += 1;
        if (event.assistedById === undefined) continue;
        assisted += 1;
        // Without this the field could be stamped with any string at all.
        expect(rosters[event.team].has(event.assistedById)).toBe(true);
      }
    }
    expect(goals).toBeGreaterThan(0);
    expect(assisted).toBeGreaterThan(0);
  });

  it('never credits the scorer with their own assist', () => {
    let checked = 0;
    for (let index = 0; index < 20; index += 1) {
      const state = createMatch(900_000 + index * 7919, ROVERS, UNITED, POLICIES);
      let read = 0;
      while (state.phase !== 'fulltime') {
        tick(state);
        for (; read < state.events.length; read += 1) {
          const event = state.events[read];
          if (event.kind !== 'GOAL' || event.assistedById === undefined) continue;
          // Resolved from live state on the tick the goal landed. A slot map
          // taken at kickoff goes stale the moment anyone is substituted.
          expect(event.assistedById).not.toBe(state.players[event.by].def.id);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('is deterministic — the same seed produces the same assists', () => {
    const first = runMatch(4242, ROVERS, UNITED, [], POLICIES);
    const second = runMatch(4242, ROVERS, UNITED, [], POLICIES);
    expect(first.events).toEqual(second.events);
  });

  it('clears the candidate when a restart puts the ball back in play', () => {
    const state = createMatch(7, ROVERS, UNITED, POLICIES);
    // Both touches belong to the team that will restart — the halftime shape.
    // After a goal the ball goes to the conceding team and the same-team check
    // would drop the candidate on its own, so only this setup can prove the
    // explicit clear in restartKickoff does anything.
    state.ball = { kind: 'held', by: 14 };
    observePossession(state);
    state.ball = { kind: 'held', by: 16 };
    observePossession(state);
    expect(state.assistCandidateId).toBe(state.players[14].def.id);

    restartKickoff(state, 1);
    expect(state.assistCandidateId).toBeNull();
    expect(state.ballHolderId).toBeNull();
    expect(state.ballHolderTeam).toBeNull();
  });

  // --- Constructed cases. These are why the design stamps a stable id rather
  // than a slot; the smoke tests above cannot fail on any of them.

  it('credits the assister who was substituted off before the goal', () => {
    const state = createMatch(11, ROVERS, UNITED, POLICIES);
    const assisterId = state.players[7].def.id;

    state.ball = { kind: 'held', by: 7 };
    observePossession(state);
    state.ball = { kind: 'held', by: 9 };
    observePossession(state);
    expect(state.assistCandidateId).toBe(assisterId);

    // The assister leaves the pitch and a substitute inherits slot 7. A
    // slot-based candidate would now resolve to the substitute instead.
    state.players[7] = { ...state.players[7], def: { ...state.players[7].def, id: 'substitute-7' } };
    stampGoal(state, 9);

    const goals = state.events.filter(event => event.kind === 'GOAL');
    expect(goals).toHaveLength(1);
    expect(goals[0]).toMatchObject({ by: 9, team: 0, assistedById: assisterId });
  });

  it('clears the candidate when the other team takes the ball', () => {
    const state = createMatch(12, ROVERS, UNITED, POLICIES);
    state.ball = { kind: 'held', by: 7 };
    observePossession(state);
    state.ball = { kind: 'held', by: 9 };
    observePossession(state);
    expect(state.assistCandidateId).not.toBeNull();

    state.ball = { kind: 'held', by: 15 }; // team 1
    observePossession(state);
    expect(state.assistCandidateId).toBeNull();
  });

  it('keeps the candidate across a pass in flight', () => {
    const state = createMatch(13, ROVERS, UNITED, POLICIES);
    state.ball = { kind: 'held', by: 7 };
    observePossession(state);
    state.ball = {
      kind: 'pass', pos: { x: 0, y: 0 }, from: 7, to: 9,
      willSucceed: true, interceptor: -1, z: 0, vz: 0, speed: 1,
    };
    observePossession(state);
    state.ball = { kind: 'held', by: 9 };
    observePossession(state);
    expect(state.assistCandidateId).toBe(state.players[7].def.id);
  });

  it('survives an entity index whose decoy clone is gone', () => {
    const state = createMatch(14, ROVERS, UNITED, POLICIES);
    state.decoyClones[0] = {
      ...state.players[9],
      ownerIdx: 9,
      ownerPlayerId: state.players[9].def.id,
      sourceIdx: 9,
      sourcePlayerId: state.players[9].def.id,
      formationSlot: 9,
      untilTick: 999,
    };
    state.ball = { kind: 'held', by: 22 };
    observePossession(state);
    expect(state.ballHolderId).toBe(state.players[9].def.id);

    // Constructed, not engine-produced: dismissDecoyClone drops the ball loose
    // before it clears the slot. Entity 22 with nothing behind it must still
    // degrade to a no-op rather than reading `.def` off undefined.
    state.decoyClones[0] = null;
    expect(() => observePossession(state)).not.toThrow();
    expect(state.ballHolderId).toBe(state.players[9].def.id);

    // The dismissal cost nothing: the clone's source is still the assister.
    state.ball = { kind: 'held', by: 7 };
    observePossession(state);
    expect(state.assistCandidateId).toBe(state.players[9].def.id);
  });
});
