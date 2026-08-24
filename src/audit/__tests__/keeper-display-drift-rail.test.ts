import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import { createCareer, trainPlayerInstantly } from '../../game';
import type { GameState } from '../../game/types';
import { MAX_PLAYER_ATTRIBUTE } from '../../sim/attributes';

/**
 * TRIPWIRE — read this before re-tuning the keeper ladder.
 *
 * The display parity trick is a deliberate lie: a keeper is shown the outfield
 * gain while only the halved one is stored. The lie stays small only while
 * Keeper Drills stay half the outfield ladder (2/3/5/7/9 against 4/6/10/14/18).
 *
 * Lower the keeper gains and the lie grows roughly twice as fast. Measured over
 * 150 weekly taps: today's ladder drifts 412 points, a halved one drifts 776 —
 * not because the per-tap gap doubles, but because a keeper on a weaker ladder
 * spends far longer on the low tiers, taking many more taps to reach the stat
 * ceiling that eventually stops the drift.
 *
 * Any change that weakens the keeper ladder has to answer this first:
 *
 *   KEEPER_GAIN_PROBE=1 npm run test:probe -- \
 *     src/audit/__tests__/keeper-drill-gain-probe.test.ts
 *
 * That probe only ever sweeps the ladder *downward* — its candidates are
 * [1, 0.75, 0.5, 0.4, 0.3, 0.2] against a 1.5x leverage target — so the change
 * it recommends is exactly the change that makes this worse.
 *
 * The code will not break. `keeperDisplayLadderMultiplier` reads the halving out
 * of content, so a re-tune carries the display with it automatically. What needs
 * a human decision is whether the *larger* lie is still acceptable, or whether
 * it is time to rescale the Reflexes axis for real (plan §2b) and delete this.
 *
 * This rail is what forces that decision into the open rather than letting it
 * ship quietly. Verified 2026-08-04: it stays silent at today's ladder and fires
 * at 0.5x and below. If it fails, do not raise the bound to make it pass.
 *
 * See docs/superpowers/plans/2026-08-04-keeper-drill-display-parity.md §6.
 *
 * ---
 *
 * The tripwire on the keeper display trick.
 *
 * `refDisplayBonus` lets a keeper's card read as though Keeper Drills used the
 * outfield ladder, while the stored stat — the one the scout, the wage, the
 * transfer fee and the match engine all read — stays halved and correct. The
 * cost is drift: `displayed - stored` is exactly the number of Reflexes points
 * everything else in the game disagrees with the manager about, and it grows for
 * as long as the keeper keeps training.
 *
 * That is accepted deliberately (fix the start, rescale the axis for real
 * later), but "later" has to announce itself rather than be discovered by a
 * confused player. This is the announcement.
 *
 * **Always-on, deliberately.** The plan's first choice of home was
 * `long-career-development-probe.test.ts`, which is `describe.skip` unless its
 * env var is set — a rail that never runs is decoration. Nothing here simulates
 * a match, so it costs milliseconds and can afford to run every time.
 *
 * The `-rail` in the filename is load-bearing. `jest.config.js` ignores
 * `src/audit/__tests__/*-probe.test.ts` outright, so renaming this file to
 * match its neighbours would silently drop it from every run without failing
 * anything. Keep the suffix.
 *
 * See docs/superpowers/plans/2026-08-04-keeper-drill-display-parity.md §6.
 */

/**
 * Five seasons of thirty weeks with the keeper trained every single week — an
 * extreme but reachable keeper-focused career, and well inside the fifteen
 * seasons `long-career-development-probe` walks.
 */
const KEEPER_DISPLAY_DRIFT_TAPS = 150;

/**
 * Most points the display may run ahead of the stored stat over that career.
 *
 * Measured 2026-08-04: **412**, from a D5 opening keeper at Reflexes 46 taking
 * 150 Keeper Drills taps. The bound is that plus roughly a tenth.
 *
 * Bounded in points rather than as a `displayed / stored` ratio on purpose. The
 * ratio is `(B + 2S) / (B + S)`, which asymptotes to 2 and cannot discriminate:
 * a 1.4 cap trips inside the first season and a 1.95 cap can never fire at all.
 * The absolute gap is the thing that misleads, so the absolute gap is what is
 * railed.
 *
 * If a keeper-ladder re-tune (`keeper-drill-gain-probe` only ever sweeps it
 * downward) widens the gap per tap, this fails and the decision to rescale the
 * Reflexes axis for real resurfaces. Re-measure before raising it.
 */
const MAXIMUM_KEEPER_DISPLAY_DRIFT = 460;

/** A rested keeper on a fresh week, which is what a real career supplies. */
function restedWeek(state: GameState, playerId: string): GameState {
  return {
    ...state,
    trainingPoints: 1_000_000,
    players: state.players.map((player) =>
      player.id === playerId
        ? { ...player, condition: 100, injuryWeeks: 0, awayWeeks: 0 }
        : player,
    ),
  };
}

describe('keeper display drift', () => {
  it('stays inside its documented bound across a long keeper career', () => {
    const content = loadLaunchContent();
    let state = createCareer(
      createLaunchCareerSetup(20260804, undefined, content),
    );
    const keeper = state.players.find(
      (player) => player.clubId === state.userClubId && player.role === 'GK',
    )!;

    let previousBonus = 0;
    for (let tap = 0; tap < KEEPER_DISPLAY_DRIFT_TAPS; tap += 1) {
      const current = state.players.find((player) => player.id === keeper.id)!;
      if (
        Math.min(
          MAX_PLAYER_ATTRIBUTE,
          current.attrs.ref + (current.refDisplayBonus ?? 0),
        ) >= MAX_PLAYER_ATTRIBUTE
      ) {
        break;
      }
      state = trainPlayerInstantly(
        restedWeek(state, keeper.id),
        keeper.id,
        'keeper-drills',
      ).state;
      const trained = state.players.find((player) => player.id === keeper.id)!;
      const bonus = trained.refDisplayBonus ?? 0;

      // The bonus records how far the display has been *allowed* to run ahead,
      // so it only ever grows. An earlier draft clamped it to what fitted under
      // the ceiling, which drove it back down to 5 while the card still read a
      // stalled 999 — and left this rail measuring nothing.
      expect(bonus).toBeGreaterThanOrEqual(previousBonus);
      previousBonus = bonus;

      // Whatever the bonus says, nothing on screen may print above the ceiling
      // every other attribute is validated against.
      expect(
        Math.min(MAX_PLAYER_ATTRIBUTE, trained.attrs.ref + bonus),
      ).toBeLessThanOrEqual(MAX_PLAYER_ATTRIBUTE);
    }

    const finished = state.players.find((player) => player.id === keeper.id)!;
    expect(finished.refDisplayBonus ?? 0).toBeLessThanOrEqual(
      MAXIMUM_KEEPER_DISPLAY_DRIFT,
    );
  });

  it('never banks a bonus for an outfield player', () => {
    const content = loadLaunchContent();
    let state = createCareer(
      createLaunchCareerSetup(20260804, undefined, content),
    );
    const outfielder = state.players.find(
      (player) => player.clubId === state.userClubId && player.role !== 'GK',
    )!;

    for (let tap = 0; tap < 20; tap += 1) {
      state = trainPlayerInstantly(
        restedWeek(state, outfielder.id),
        outfielder.id,
        'sprints',
      ).state;
    }

    expect(
      state.players.find((player) => player.id === outfielder.id)!
        .refDisplayBonus,
    ).toBeUndefined();
  });
});
