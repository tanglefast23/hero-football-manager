import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const mockPlayers: Array<{
  play: jest.Mock;
  pause: jest.Mock;
  seekTo: jest.Mock;
  setPlaybackRate: jest.Mock;
  shouldCorrectPitch: boolean;
}> = [];
jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  createAudioPlayer: jest.fn(() => {
    const player = {
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(() => Promise.resolve()),
      setPlaybackRate: jest.fn(),
      shouldCorrectPitch: true,
      remove: jest.fn(),
      release: jest.fn(),
    };
    mockPlayers.push(player);
    return player;
  }),
}));
import {
  audioKeysForProfile,
  initAudio,
  teardownAudio,
  setMasterVolume,
  updateSubstitutionFootsteps,
  pauseSubstitutionFootsteps,
} from '../audio';
import {
  sampleWalk,
  packWalks,
  walkIsActive,
  type SubstitutionWalk,
} from '../substitution-walk';

afterEach(() => {
  teardownAudio();
  jest.restoreAllMocks();
});

it('follows the outgoing walk, varies steps, and silences playback exactly two seconds after exit', async () => {
  teardownAudio();
  mockPlayers.length = 0;
  setMasterVolume(1);
  initAudio();
  const keys = audioKeysForProfile('full');
  const steps = keys.flatMap((key, i) =>
    key.startsWith('footstep-') ? [mockPlayers[i]] : [],
  );
  expect(steps).toHaveLength(3);
  let random = 0;
  jest
    .spyOn(Math, 'random')
    .mockImplementation(() => ((random++ * 7) % 11) / 11);
  const walk: SubstitutionWalk = {
    id: 'sub:100:3:off',
    slot: 3,
    direction: 'off',
    visualId: 'field-1',
    name: 'Rossi',
    from: { x: 1000, y: 5000 },
    to: { x: -510, y: 5000 },
    startTick: 100,
    durationTicks: 10,
  };
  updateSubstitutionFootsteps(false, 100);
  expect(steps.every((p) => p.seekTo.mock.calls.length === 0)).toBe(true);
  for (let frame = 0; frame <= 29; frame++) {
    const tick = 100 + frame;
    const walking = walkIsActive(walk, tick);
    expect(sampleWalk(packWalks([walk]), 0, tick, 0, 0).active).toBe(walking);
    updateSubstitutionFootsteps(walking, 100);
    await Promise.resolve();
  }
  expect(steps.every((p) => p.play.mock.calls.length > 0)).toBe(true);
  const rates = steps.flatMap((p) =>
    p.setPlaybackRate.mock.calls.map((c) => c[0]),
  );
  expect(new Set(rates).size).toBeGreaterThan(1);
  expect(rates.every((rate) => rate >= 0.94 && rate <= 1.06)).toBe(true);
  expect(steps.every((p) => !p.shouldCorrectPitch)).toBe(true);
  expect(steps.every((p) => p.pause.mock.calls.length === 0)).toBe(true);
  const count = steps.reduce((n, p) => n + p.play.mock.calls.length, 0);
  updateSubstitutionFootsteps(false, 100); // Exactly 2,000ms after exit.
  await Promise.resolve();
  expect(steps.every((p) => p.pause.mock.calls.length === 1)).toBe(true);
  updateSubstitutionFootsteps(false, 5000);
  expect(steps.reduce((n, p) => n + p.play.mock.calls.length, 0)).toBe(count);

  // A pending native seek cannot resurrect a paused or unmounted walk.
  updateSubstitutionFootsteps(true, 0);
  pauseSubstitutionFootsteps();
  await Promise.resolve();
  expect(steps.reduce((n, p) => n + p.play.mock.calls.length, 0)).toBe(count);
  updateSubstitutionFootsteps(true, 0);
  teardownAudio();
  await Promise.resolve();
  expect(steps.reduce((n, p) => n + p.play.mock.calls.length, 0)).toBe(count);

  const screen = readFileSync(
    join(process.cwd(), 'src/render/MatchScreen.tsx'),
    'utf8',
  );
  expect(screen).toContain(
    "substitutionWalksRef.current.some((walk) => walk.direction === 'off')",
  );
  expect(screen).toMatch(/updateSubstitutionFootsteps\([\s\S]*?wallGap,/);
});
