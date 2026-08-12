import { attemptShot, shotFlightTick } from '../engine';
import { GOAL_CENTER_X } from '../geometry';
import { createMatch, runMatch } from '../match';
import { performSubstitution } from '../substitutions';
import { ROVERS, UNITED } from '../teams';
import type { PlayerDef } from '../types';

const LATE_SUB: PlayerDef = {
  id: 'late-sub',
  name: 'Late Sub',
  role: 'FWD',
  attrs: { pac: 60, sho: 60, pas: 60, def: 60, tec: 60, sta: 60, ref: 60 },
};

describe('shooting and goals', () => {
  // A shot spends ~9 ticks in the air. The GOAL event names a lineup slot, so
  // any swap committed inside that window used to hand the goal to the man who
  // came on. scoredById is stamped when the ball leaves the shooter's foot.
  it('credits a goal to the shooter, not the substitute who came on mid-flight', () => {
    const m = createMatch(23, { ...ROVERS, bench: [LATE_SUB] }, UNITED, {
      controlledTeam: 0,
    });
    const slot = 10;
    const shooterId = m.players[slot].def.id;
    attemptShot(m, slot, 2000);
    if (m.ball.kind !== 'shot') throw new Error('attemptShot produced no shot');
    // Force a deterministic on-target finish: keeperChecked skips the save
    // roll, so no RNG decides whether this test sees a GOAL at all.
    m.ball.targetX = GOAL_CENTER_X;
    m.ball.pos = { x: GOAL_CENTER_X, y: 300 };
    m.ball.vel = { x: 0, y: -300 };
    m.ball.z = 0;
    m.ball.vz = 0;
    m.ball.keeperChecked = true;

    expect(performSubstitution(m, 0, slot, LATE_SUB.id)).toBe(true);
    expect(m.players[slot].def.id).toBe(LATE_SUB.id); // the slot really did change hands
    shotFlightTick(m);

    const goal = m.events.find((e) => e.kind === 'GOAL');
    expect(goal).toBeDefined();
    expect(goal).toMatchObject({ by: slot, scoredById: shooterId });
  });

  it('across 30 seeds, goals happen and scores are sane', () => {
    let totalGoals = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const r = runMatch(seed, ROVERS, UNITED);
      const goals = r.events.filter((e) => e.kind === 'GOAL').length;
      expect(goals).toBe(r.score[0] + r.score[1]);
      expect(goals).toBeLessThanOrEqual(15);
      totalGoals += goals;
    }
    expect(totalGoals).toBeGreaterThan(15);
    expect(totalGoals).toBeLessThan(240);
  });

  it('saves deplete GK Resolve', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const save = runMatch(seed, ROVERS, UNITED).events.find(
        (e) => e.kind === 'SAVE',
      ) as { resolveLeft: number } | undefined;
      if (save) {
        expect(save.resolveLeft).toBeLessThan(100);
        return;
      }
    }
    throw new Error('no SAVE event in 30 matches — shooting is broken');
  });

  it('a much weaker GK concedes more (500-match aggregate)', () => {
    const weakGk = structuredClone(UNITED);
    weakGk.players[0].attrs.ref = 20;
    let vsNormal = 0,
      vsWeak = 0;
    for (let seed = 1; seed <= 500; seed++) {
      vsNormal += runMatch(seed, ROVERS, UNITED).score[0];
      vsWeak += runMatch(seed, ROVERS, weakGk).score[0];
    }
    expect(vsWeak).toBeGreaterThan(vsNormal);
  });
});
