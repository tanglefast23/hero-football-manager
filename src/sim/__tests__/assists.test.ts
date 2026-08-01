import { createMatch, observePossession as observeForTest, runMatch, tick } from '../match';
import { ROVERS, UNITED } from '../teams';
import type { MatchState } from '../types';

const POLICIES = { homePolicy: 'FIRE_WHEN_READY' as const, awayPolicy: 'FIRE_WHEN_READY' as const };

function goalsWithAssists(seeds: number): { goals: number; assisted: number } {
  let goals = 0;
  let assisted = 0;
  for (let index = 0; index < seeds; index += 1) {
    const result = runMatch(900_000 + index * 7919, ROVERS, UNITED, [], POLICIES);
    for (const event of result.events) {
      if (event.kind !== 'GOAL') continue;
      goals += 1;
      if (event.assistedById !== undefined) assisted += 1;
    }
  }
  return { goals, assisted };
}

describe('assist tracking', () => {
  it('starts a match with no assist candidate', () => {
    const state: MatchState = createMatch(1, ROVERS, UNITED);
    expect(state.assistCandidateId).toBeNull();
  });

  it('credits a teammate who held the ball before the scorer', () => {
    const { goals, assisted } = goalsWithAssists(20);
    expect(goals).toBeGreaterThan(0);
    expect(assisted).toBeGreaterThan(0);
  });

  it('never credits the scorer with their own assist', () => {
    for (let index = 0; index < 20; index += 1) {
      const seed = 900_000 + index * 7919;
      const result = runMatch(seed, ROVERS, UNITED, [], POLICIES);
      const reference = createMatch(seed, ROVERS, UNITED, POLICIES);
      const slotIds = new Map<number, string>();
      reference.players.forEach((player, slot) => slotIds.set(slot, player.def.id));
      for (const event of result.events) {
        if (event.kind !== 'GOAL' || event.assistedById === undefined) continue;
        expect(event.assistedById).not.toBe(slotIds.get(event.by));
      }
    }
  });

  it('is deterministic — the same seed produces the same assists', () => {
    const first = runMatch(4242, ROVERS, UNITED, [], POLICIES);
    const second = runMatch(4242, ROVERS, UNITED, [], POLICIES);
    expect(first.events).toEqual(second.events);
  });

  it('clears the candidate when a kickoff restarts play', () => {
    const state = createMatch(7, ROVERS, UNITED, POLICIES);
    // Stop on the scoring tick itself. The restart runs inside it, and letting
    // play resume would build a fresh candidate that says nothing about it.
    const scored = (): boolean => state.events.some(event => event.kind === 'GOAL');
    while (state.phase !== 'fulltime' && !scored()) tick(state);
    expect(scored()).toBe(true);
    expect(state.assistCandidateId).toBeNull();
  });

  // --- Constructed cases. These are why the design stamps a stable id rather
  // than a slot; the smoke tests above cannot fail on any of them.

  it('credits the assister who was substituted off before the goal', () => {
    const state = createMatch(11, ROVERS, UNITED, POLICIES);
    const assisterId = state.players[7].def.id;
    const scorerId = state.players[9].def.id;

    state.ball = { kind: 'held', by: 7 };
    observeForTest(state);
    state.ball = { kind: 'held', by: 9 };
    observeForTest(state);
    expect(state.assistCandidateId).toBe(assisterId);

    // Slot 7 now belongs to someone else. The candidate is an identity, so it
    // must not follow the slot.
    state.players[7] = { ...state.players[7], def: { ...state.players[7].def, id: 'substitute-7' } };
    expect(state.assistCandidateId).toBe(assisterId);
    expect(state.assistCandidateId).not.toBe(scorerId);
  });

  it('clears the candidate when the other team takes the ball', () => {
    const state = createMatch(12, ROVERS, UNITED, POLICIES);
    state.ball = { kind: 'held', by: 7 };
    observeForTest(state);
    state.ball = { kind: 'held', by: 9 };
    observeForTest(state);
    expect(state.assistCandidateId).not.toBeNull();

    state.ball = { kind: 'held', by: 15 }; // team 1
    observeForTest(state);
    expect(state.assistCandidateId).toBeNull();
  });

  it('keeps the candidate across a pass in flight', () => {
    const state = createMatch(13, ROVERS, UNITED, POLICIES);
    state.ball = { kind: 'held', by: 7 };
    observeForTest(state);
    state.ball = {
      kind: 'pass', pos: { x: 0, y: 0 }, from: 7, to: 9,
      willSucceed: true, interceptor: -1, z: 0, vz: 0, speed: 1,
    };
    observeForTest(state);
    state.ball = { kind: 'held', by: 9 };
    observeForTest(state);
    expect(state.assistCandidateId).toBe(state.players[7].def.id);
  });

  it('survives a decoy clone being dismissed while it held the ball', () => {
    const state = createMatch(14, ROVERS, UNITED, POLICIES);
    state.decoyClones[0] = {
      ownerIdx: 9, sourceIdx: 9, sourcePlayerId: state.players[9].def.id,
      pos: { x: 10, y: 10 }, formationSlot: 9, untilTick: 999,
    } as NonNullable<MatchState['decoyClones'][0]>;
    state.ball = { kind: 'held', by: 22 };
    observeForTest(state);
    expect(state.ballHolderId).toBe(state.players[9].def.id);

    state.ball = { kind: 'loose', pos: { x: 10, y: 10 }, vel: { x: 0, y: 0 }, z: 0, vz: 0 };
    state.decoyClones[0] = null;
    observeForTest(state);

    state.ball = { kind: 'held', by: 7 };
    expect(() => observeForTest(state)).not.toThrow();
    expect(state.assistCandidateId).toBe(state.players[9].def.id);
  });
});
