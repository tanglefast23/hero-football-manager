/**
 * App Store capture seed.
 *
 * Builds a legitimate career with the real engine and production content, then
 * emits the serialized save so it can be pushed into a simulator's SQLite.
 * The runbook (docs/plans/2026-08-05-feat-app-store-submission-runbook-plan.md
 * Phase 9) permits staging a game state for capture provided no harness
 * control or flag is visible in the captured experience — nothing here changes
 * the build, only the save it loads.
 *
 * Every assistant-guide milestone and sequence is marked complete so the
 * coach-mark overlay is absent: it dims the screen and swallows taps, which
 * would both spoil a capture and block navigation.
 */
import fs from 'node:fs';
import {
  M2_ASSISTANT_GUIDE_SEQUENCE_IDS,
  type AssistantGuideMilestone,
} from '../game/assistant-guide';
import { createLaunchCareerSetup } from '../application/launch';
import { advanceWeek, createCareer } from '../game/career';
import { serializeGameState } from '../persistence/game-state-codec';
import { GAME_SCHEMA_VERSION, type GameState } from '../game/types';
import type { PowerId } from '../sim/types';

// Chosen by store-seed-search.test.ts: in this career's first fixture the
// flame power fires at minute 69 with the score 1-2 — a real contest, unlike
// most openers, which the deliberately rigged first opponent runs away with.
const SEED = 20260893;
const OUT = '/tmp/hfm-store-save.json';

const MILESTONES: readonly AssistantGuideMilestone[] = [
  'intro-complete',
  'first-training-complete',
  'desk-intro-complete',
  'first-week-advanced',
  'condition-warning-seen',
  'match-condition-warning-seen',
  'quick-train-seen',
  'squad-sort-seen',
  'transfer-window-seen',
  'facility-combo-gym-dorm-seen',
  'facility-combo-fan-shop-stadium-seen',
  'facility-combo-medical-training-pitch-seen',
  'first-cup-exit-seen',
  'first-fans-seen',
  'first-fans-ledger-seen',
  'expired-contract-seen',
  'hero-license-shop-seen',
];

/** Silences every guide surface: milestones, sequences and the inbox queue. */
function guideSilencedFlags(): string[] {
  const flags = MILESTONES.map((m) => `guide:bert:${m}`);
  for (const id of [
    'management-intro',
    'desk-intro',
    'expired-contract',
    ...M2_ASSISTANT_GUIDE_SEQUENCE_IDS,
  ]) {
    flags.push(`guide:bert:sequence-complete:${id}`);
    flags.push(`guide:bert:inbox:delivered:${id}`);
  }
  return flags;
}

/** Grants a power to a user-club player by role, and licenses them. */
function grantPower(
  state: GameState,
  role: string,
  power: PowerId,
  skip = 0,
): GameState {
  let remaining = skip;
  let granted = false;
  const players = state.players.map((player) => {
    if (
      granted ||
      player.clubId !== state.userClubId ||
      player.role !== role ||
      player.power !== undefined
    ) {
      return player;
    }
    if (remaining > 0) {
      remaining -= 1;
      return player;
    }
    granted = true;
    return { ...player, power, licensed: true };
  });
  if (!granted) throw new Error(`no free ${role} to grant ${power}`);
  return { ...state, players };
}

test('emit App Store capture save', () => {
  let state = createCareer(createLaunchCareerSetup(SEED));

  // Arm in the SAME order as store-seed-search.test.ts, or a different player
  // gets the power and the searched firing tick no longer applies.
  state = grantPower(state, 'FWD', 'FIRE_TORCH');
  state = grantPower(state, 'GK', 'GIANT_GK');

  state = {
    ...state,
    eventFlags: [...state.eventFlags, ...guideSilencedFlags()],
    facilities: { ...state.facilities, trainingGroundBuilt: true },
  };

  // Walk the real clock to the first fixture rather than hand-setting phase,
  // so every derived structure (lineups, ledgers, market) stays consistent.
  let guard = 0;
  while (state.phase !== 'matchday') {
    if ((guard += 1) > 40) throw new Error('never reached a matchday');
    state = advanceWeek(state);
  }

  const json = serializeGameState(state); // validates against the zod schema
  fs.writeFileSync(OUT, json);

  const heroes = state.players.filter(
    (p) => p.clubId === state.userClubId && p.power !== undefined,
  );
  fs.writeFileSync(
    '/tmp/hfm-store-save-provenance.json',
    JSON.stringify(
      {
        seed: SEED,
        schemaVersion: GAME_SCHEMA_VERSION,
        season: state.season,
        week: state.week,
        phase: state.phase,
        userClubId: state.userClubId,
        heroes: heroes.map((h) => ({
          id: h.id,
          name: h.name,
          role: h.role,
          power: h.power,
        })),
        bytes: json.length,
      },
      null,
      2,
    ),
  );

  expect(state.phase).toBe('matchday');
  expect(heroes).toHaveLength(2);
});
