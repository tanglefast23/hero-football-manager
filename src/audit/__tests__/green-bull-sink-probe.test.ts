/**
 * Opt-in purchasing-power check on a copy of the completed browser career.
 * No fixtures or weekly settlements run, and the checkpoint is never written.
 *
 * npm run test:probe -- src/audit/__tests__/green-bull-sink-probe.test.ts
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import {
  acceptGreenBullTraining,
  greenBullTrainingOffer,
} from '../../game/midseason-training';
import { weeklyAmbientTrainingPoints } from '../../game/career';
import type { GameState } from '../../game/types';
import { parseStoredGameState } from '../../persistence/game-state-codec';

const checkpoint = join(
  process.cwd(),
  'artifacts/playtest-2026-10-19-run2/checkpoints/season-6-end.json.gz',
);
const sha256 = (bytes: Buffer) =>
  createHash('sha256').update(bytes).digest('hex');
const cash = (state: GameState) =>
  state.clubs.find((club) => club.id === state.userClubId)!.cash;

test('measures the unchanged Green Bull cash sink without career progress', () => {
  const input = readFileSync(checkpoint);
  const wrapper = JSON.parse(gunzipSync(input).toString('utf8')) as {
    snapshot: { career: unknown };
  };
  const source = parseStoredGameState(JSON.stringify(wrapper.snapshot.career));
  const weekly = weeklyAmbientTrainingPoints(source);
  // A controlled future training opportunity avoids old individual-drill flags.
  // This does not advance the career or pay income, wages, upkeep or prizes.
  const baseline: GameState = {
    ...source,
    phase: 'manage',
    season: source.season + 1,
    week: 1,
    trainingPoints: Math.max(source.trainingPoints, weekly * 2),
  };
  const offer = greenBullTrainingOffer(baseline)!;
  expect(offer.blockedReason).toBeUndefined();
  expect(offer.cost).toBe(50_000);
  const purchased = acceptGreenBullTraining(baseline);
  expect(cash(baseline) - cash(purchased)).toBe(offer.cost);
  expect(purchased.trainingPoints).toBe(0);
  const squad = source.players.filter(
    (player) => player.clubId === source.userClubId,
  );
  const stats = ['pac', 'sho', 'pas', 'def', 'tec', 'sta', 'ref'] as const;
  const storedStatGain = squad.reduce((sum, player) => {
    const after = purchased.players.find(
      (candidate) => candidate.id === player.id,
    )!;
    return (
      sum +
      stats.reduce(
        (gain, stat) => gain + after.attrs[stat] - player.attrs[stat],
        0,
      )
    );
  }, 0);

  let state = baseline;
  const purchases: {
    week: number;
    cost: number;
    cashAfter: number;
    tpDrained: number;
  }[] = [];
  for (let week = 1; week <= 30; week += 1) {
    // Give exactly one production week's TP for each controlled opportunity.
    // No additional cash is granted. This is capacity, not a season forecast.
    const ready: GameState = { ...state, week, trainingPoints: weekly };
    const nextOffer = greenBullTrainingOffer(ready)!;
    if (nextOffer.blockedReason !== undefined) break;
    const next = acceptGreenBullTraining(ready);
    expect(cash(ready) - cash(next)).toBe(nextOffer.cost);
    expect(next.trainingPoints).toBe(0);
    purchases.push({
      week,
      cost: nextOffer.cost,
      cashAfter: cash(next),
      tpDrained: weekly,
    });
    state = next;
  }
  const totalCashSpent = purchases.reduce((sum, row) => sum + row.cost, 0);
  expect(purchases.length).toBeGreaterThan(0);
  expect(cash(state)).toBe(cash(baseline) - totalCashSpent);
  expect(sha256(readFileSync(checkpoint))).toBe(sha256(input));
  const directory =
    process.env.HFM_BALANCE_ARTIFACT_DIR ??
    join(process.cwd(), 'artifacts/balance-design-2026-10-19');
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, 'green-bull-sink.json'),
    JSON.stringify(
      {
        kind: 'controlled-late-checkpoint-purchasing-capacity',
        status: 'MEASUREMENT_ONLY',
        input: {
          path: checkpoint,
          sha256: sha256(input),
          season: source.season,
          week: source.week,
          cash: cash(source),
          tp: source.trainingPoints,
        },
        controls: {
          phase: 'manage',
          season: baseline.season,
          singlePurchaseTpBudget: baseline.trainingPoints,
          capacityTpPerOpportunity: weekly,
          noIncomeOrExpensesExceptGreenBull: true,
          fixturesPlayed: 0,
          weeklySettlements: 0,
          sourceUnchanged: true,
          meaning:
            'Synthetic future opportunities on a copy. This is not a resumed career, a win estimate, or evidence that Green Bull is an optimal purchase.',
        },
        firstPurchase: {
          cost: offer.cost,
          cashBefore: cash(baseline),
          cashAfter: cash(purchased),
          tpBefore: baseline.trainingPoints,
          tpAfter: purchased.trainingPoints,
          squad: squad.length,
          storedStatGain,
        },
        capacity: { purchases, totalCashSpent, remainingCash: cash(state) },
      },
      null,
      2,
    ) + '\n',
  );
});
