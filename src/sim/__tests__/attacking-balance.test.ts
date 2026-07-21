import { createMatch, runMatch, tick } from '../match';
import { dist2, PITCH_H } from '../geometry';
import { ROVERS, UNITED } from '../teams';

describe('attacking decision balance', () => {
  it('keeps the normal-match attacking mix inside the fast arcade target', () => {
    const matches = 200;
    let goals = 0;
    let shots = 0;
    let passes = 0;
    let completedPasses = 0;
    let zoneEntries = 0;
    const zoneEntriesByPlayer = new Array<number>(22).fill(0);
    const powerFiresByPlayer = new Array<number>(22).fill(0);
    let matchesWithRivalCard = 0;

    for (let seed = 1; seed <= matches; seed++) {
      const result = runMatch(seed, ROVERS, UNITED);
      let rivalCardInMatch = false;
      goals += result.score[0] + result.score[1];
      for (const event of result.events) {
        if (event.kind === 'SHOT') shots++;
        else if (event.kind === 'PASS') {
          passes++;
          if (event.ok) completedPasses++;
        } else if (event.kind === 'POWER_READY') {
          zoneEntries++;
          zoneEntriesByPlayer[event.player]++;
        } else if (event.kind === 'POWER_FIRED') {
          powerFiresByPlayer[event.player]++;
        } else if (event.kind === 'CARD' && event.player === 14) {
          rivalCardInMatch = true;
        }
      }
      if (rivalCardInMatch) matchesWithRivalCard++;
    }

    const goalsPerMatch = goals / matches;
    const shotsPerMatch = shots / matches;
    const passesPerMatch = passes / matches;
    const completionRate = completedPasses / passes;
    const zoneEntriesPerMatch = zoneEntries / matches;
    console.log(
      `ATTACKING MIX goals=${goalsPerMatch.toFixed(3)} shots=${shotsPerMatch.toFixed(3)} ` +
      `passes=${passesPerMatch.toFixed(3)} completion=${completionRate.toFixed(3)} ` +
      `zoneEntries=${zoneEntriesPerMatch.toFixed(3)} ` +
      `heroEntries=[${zoneEntriesByPlayer[9]},${zoneEntriesByPlayer[10]},${zoneEntriesByPlayer[14]}] ` +
      `rivalFires=${powerFiresByPlayer[14]} rivalCardMatches=${matchesWithRivalCard} over ${matches} seeds`,
    );

    expect(goalsPerMatch).toBeGreaterThanOrEqual(1.5);
    expect(goalsPerMatch).toBeLessThanOrEqual(5);
    expect(shotsPerMatch).toBeGreaterThanOrEqual(8);
    expect(shotsPerMatch).toBeLessThanOrEqual(15);
    expect(passesPerMatch).toBeGreaterThanOrEqual(10);
    expect(completionRate).toBeGreaterThanOrEqual(0.65);
    expect(completionRate).toBeLessThanOrEqual(0.88);
    // Three launch heroes should still enter the Zone often enough that the
    // tap loop remains central, without every possession becoming a power.
    expect(zoneEntriesPerMatch).toBeGreaterThanOrEqual(3);
    expect(zoneEntriesPerMatch).toBeLessThanOrEqual(14);
    // Natural-match reachability matters as much as the rigged power contracts:
    // the launch rival must regularly threaten Super Strength without a
    // test-only activation.
    expect(zoneEntriesByPlayer[14] / matches).toBeGreaterThanOrEqual(1.5);
    expect(zoneEntriesByPlayer[14] / matches).toBeLessThanOrEqual(3.5);
    expect(powerFiresByPlayer[14] / matches).toBeGreaterThanOrEqual(0.5);
    expect(powerFiresByPlayer[14] / matches).toBeLessThanOrEqual(1.5);
    // Hero License canon (docs/04, m1.12): the exemption is symmetric, so a
    // rival firing Super Strength all match is never booked for it either.
    expect(matchesWithRivalCard).toBe(0);
  }, 60000);

  it('keeps unpressured attacking-third backpasses exceptional across seeds', () => {
    const matches = 40;
    let attackingThirdPasses = 0;
    let backwardPasses = 0;
    let unpressuredBackpasses = 0;

    for (let seed = 1; seed <= matches; seed++) {
      const m = createMatch(seed, ROVERS, UNITED);
      while (m.phase !== 'fulltime') {
        const eventStart = m.events.length;
        tick(m);
        for (const event of m.events.slice(eventStart)) {
          if (event.kind !== 'PASS') continue;
          const passer = m.players[event.from];
          const receiver = m.players[event.to];
          const passerProgress = passer.team === 0 ? PITCH_H - passer.pos.y : passer.pos.y;
          if (passerProgress < PITCH_H * 2 / 3) continue;

          const receiverProgress = receiver.team === 0 ? PITCH_H - receiver.pos.y : receiver.pos.y;
          const backward = receiverProgress < passerProgress - 200;
          let pressured = false;
          for (const opponent of m.players) {
            if (opponent.team !== passer.team && opponent.outUntilTick <= m.tick
              && dist2(opponent.pos, passer.pos) < 400 * 400) {
              pressured = true;
              break;
            }
          }

          attackingThirdPasses++;
          if (backward) backwardPasses++;
          if (!pressured) {
            if (backward) unpressuredBackpasses++;
          }
        }
      }
    }

    expect(attackingThirdPasses).toBeGreaterThan(100);
    expect(backwardPasses / attackingThirdPasses).toBeLessThanOrEqual(0.2);
    // The leased presser means almost every natural attacking-third pass is
    // launched under pressure. If an unpressured pass does occur, it must not
    // be the old arbitrary backpass behavior.
    expect(unpressuredBackpasses / attackingThirdPasses).toBeLessThanOrEqual(0.01);
  }, 30000);
});
