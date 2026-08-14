import { readFileSync } from 'fs';
import { join } from 'path';
import { playerRequestViewModel } from '../../../../application/player-request-view-model';
import { loadLaunchContent } from '../../../../content/load';
import {
  advancePlayerRequests,
  resolvePlayerRequest,
  starQualifiers,
  weightForPlayer,
} from '../../../../game/player-requests';
import { SEASON_WEEKS, type GameState } from '../../../../game/types';
import { devHarnessCareerAtWeek } from '../../career';

const entry = readFileSync(
  join(process.cwd(), 'src/ui/dev-harness/entries/player-requests.tsx'),
  'utf8',
);

/**
 * `player-requests.tsx` imports react-native, which throws under Jest's node
 * environment. Its five cases are not fabricated states though — each one is a
 * seeded career stepped forward through the real weekly draw until the wanted
 * state exists — and a case whose stop condition is never met would open on
 * whatever the budget ran out on, silently. That is what is checked here, with
 * the same stepping the entry does.
 */
const SEED = 23;
const SEASON = 6;
const WEEK = 2;
const STEP_BUDGET = 80;

function withCatalog(state: GameState): GameState {
  return { ...state, playerRequestRules: loadLaunchContent().playerRequests };
}

function steppedCareer(
  stop: (state: GameState) => boolean,
): GameState | undefined {
  let state = withCatalog(devHarnessCareerAtWeek(SEASON, WEEK, SEED));
  for (let step = 0; step < STEP_BUDGET; step += 1) {
    state = advancePlayerRequests(state, true);
    if (stop(state)) return state;
    state =
      state.week >= SEASON_WEEKS
        ? { ...state, season: state.season + 1, week: 1 }
        : { ...state, week: state.week + 1 };
  }
  return undefined;
}

function askerWeight(state: GameState): number {
  const pending = state.playerRequests?.pending;
  const asker = state.players.find((player) => player.id === pending?.playerId);
  if (asker === undefined) return 0;
  const tuning = state.playerRequestRules!.tuning;
  return weightForPlayer(
    asker,
    starQualifiers(
      state.seasonStatLines ?? [],
      state.season,
      tuning.starGoalRank,
    ),
    tuning.starFameThreshold,
  );
}

describe('the player requests reel', () => {
  /**
   * The reason the entry attaches the catalog itself. `createLaunchCareerSetup`
   * never puts one on a career — only the store does — so every career built
   * the way this harness builds one has requests switched off at the first line
   * of `advancePlayerRequests`.
   */
  it('starts from a career with no request catalog at all', () => {
    expect(
      devHarnessCareerAtWeek(SEASON, WEEK, SEED).playerRequestRules,
    ).toBeUndefined();
  });

  it('finds a star asker', () => {
    const state = steppedCareer((item) => askerWeight(item) === 2);

    expect(state).toBeDefined();
    expect(playerRequestViewModel(state!).pending).toBeDefined();
  });

  it('finds a squad asker', () => {
    const state = steppedCareer((item) => askerWeight(item) === 1);

    expect(state).toBeDefined();
    expect(playerRequestViewModel(state!).pending).toBeDefined();
  });

  it('finds a request already down to its last week', () => {
    const state = steppedCareer(
      (item) => item.playerRequests?.pending?.warned === true,
    );

    expect(state).toBeDefined();
    expect(playerRequestViewModel(state!).pending?.weeksToAnswer).toBe(1);
  });

  it('finds a non-money tradeoff after the first request', () => {
    const state = steppedCareer(
      (item) =>
        item.playerRequests?.pending !== undefined &&
        (item.playerRequests?.history.length ?? 0) >= 1,
    );

    expect(state).toBeDefined();
    expect(playerRequestViewModel(state!).pending?.canAfford).toBe(true);
    expect(state!.playerRequests!.pending!.costAmount).toBeUndefined();
  });

  it('finds a quiet week with a ledger behind it', () => {
    const state = steppedCareer(
      (item) =>
        item.playerRequests?.pending === undefined &&
        (item.playerRequests?.history.length ?? 0) >= 3,
    );

    expect(state).toBeDefined();
    const viewModel = playerRequestViewModel(state!);
    expect(viewModel.pending).toBeUndefined();
    expect(viewModel.history.length).toBeGreaterThanOrEqual(3);
    // Nobody answered any of them, which is the state the ledger exists to make
    // visible: silence settles a request at a refusal's price.
    expect(
      viewModel.history.every((item) => item.resolution === 'LAPSED'),
    ).toBe(true);
  });

  /** Granting and refusing are the entry's controls, and both really settle. */
  it('settles an answer through the shipped resolver', () => {
    const state = steppedCareer(
      (item) => item.playerRequests?.pending !== undefined,
    )!;
    const askerId = state.playerRequests!.pending!.playerId;
    const before = state.players.find((player) => player.id === askerId)!;
    const granted = resolvePlayerRequest(
      state,
      state.playerRequestRules!,
      'GRANTED',
    );
    const refused = resolvePlayerRequest(
      state,
      state.playerRequestRules!,
      'REFUSED',
    );

    expect(
      granted.players.find((player) => player.id === askerId)!.morale,
    ).toBeGreaterThan(before.morale);
    expect(
      refused.players.find((player) => player.id === askerId)!.morale,
    ).toBeLessThan(before.morale);
    expect(granted.playerRequests?.history[0].resolution).toBe('GRANTED');
    expect(refused.playerRequests?.history[0].resolution).toBe('REFUSED');
  });

  /**
   * `cases` is read while the module is still evaluating, so anything it reads
   * has to be initialised before it. A `const` below the entry is still in its
   * temporal dead zone there, and the only symptom is a blank bundle.
   */
  it('declares its cases above the entry that reads them', () => {
    expect(entry.indexOf('const REQUEST_CASES')).toBeLessThan(
      entry.indexOf('export const playerRequestsEntry'),
    );
  });

  /** The harness adds no audio: the management SFX table is index-addressed. */
  it('plays no sound of its own', () => {
    expect(entry).not.toContain('SfxPressable');
    expect(entry).not.toContain('playManagement');
  });
});
