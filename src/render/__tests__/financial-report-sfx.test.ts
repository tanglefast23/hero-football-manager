interface MockPlayer {
  volume: number;
  muted: boolean;
  loop: boolean;
  play: jest.Mock;
  pause: jest.Mock;
  seekTo: jest.Mock;
  remove: jest.Mock;
  release: jest.Mock;
  resolveSeek: () => void;
  rejectSeek: () => void;
  pendingSeeks: () => number;
}

const mockPlayers: MockPlayer[] = [];

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => {
    const resolvers: Array<{
      resolve: () => void;
      reject: (error: Error) => void;
    }> = [];
    const player: MockPlayer = {
      volume: -1,
      muted: false,
      loop: false,
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(
        () =>
          new Promise<void>((resolve, reject) => {
            resolvers.push({ resolve: () => resolve(), reject });
          }),
      ),
      remove: jest.fn(),
      release: jest.fn(),
      resolveSeek: () => resolvers.shift()?.resolve(),
      rejectSeek: () => resolvers.shift()?.reject(new Error('seek failed')),
      pendingSeeks: () => resolvers.length,
    };
    mockPlayers.push(player);
    return player;
  }),
}));

import { createAudioPlayer } from 'expo-audio';
import {
  playLedgerSpin,
  playLedgerThunk,
  playSurgeIgnition,
  resumeFinancialReportSfx,
  setFinancialReportSfxMasterVolume,
  stopAllFinancialReportSfx,
  stopLedgerSpin,
  stopSurgeBed,
  suspendFinancialReportSfx,
  teardownFinancialReportSfx,
} from '../financial-report-sfx';

// Creation order at init: spin, four thunk voices, flame-up, crackle.
const spin = () => mockPlayers[0];
const thunkVoice = (index: number) => mockPlayers[1 + index];
const flameUp = () => mockPlayers[5];
const crackle = () => mockPlayers[6];

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('financial report audio controller', () => {
  beforeEach(() => {
    teardownFinancialReportSfx();
    mockPlayers.length = 0;
    (createAudioPlayer as jest.Mock).mockClear();
    setFinancialReportSfxMasterVolume(1);
    resumeFinancialReportSfx();
  });

  afterEach(() => {
    teardownFinancialReportSfx();
  });

  it('never plays a spin whose stop arrived before the seek resolved', async () => {
    playLedgerSpin();
    stopLedgerSpin();
    spin().resolveSeek();
    await flush();
    expect(spin().play).not.toHaveBeenCalled();
  });

  it('restarts a double-started spin cleanly, playing only the second', async () => {
    playLedgerSpin();
    playLedgerSpin();
    spin().resolveSeek();
    await flush();
    expect(spin().play).not.toHaveBeenCalled();
    spin().resolveSeek();
    await flush();
    expect(spin().play).toHaveBeenCalledTimes(1);
  });

  it('rotates four thunk voices and invalidates a stale seek on wraparound', async () => {
    playLedgerThunk();
    playLedgerThunk();
    playLedgerThunk();
    playLedgerThunk();
    expect(thunkVoice(0).seekTo).toHaveBeenCalledTimes(1);
    expect(thunkVoice(3).seekTo).toHaveBeenCalledTimes(1);
    // Voice 0's first seek is still pending when the fifth call reuses it.
    playLedgerThunk();
    expect(thunkVoice(0).seekTo).toHaveBeenCalledTimes(2);
    thunkVoice(0).resolveSeek(); // the STALE seek
    await flush();
    expect(thunkVoice(0).play).not.toHaveBeenCalled();
    thunkVoice(0).resolveSeek(); // the fresh one
    await flush();
    expect(thunkVoice(0).play).toHaveBeenCalledTimes(1);
  });

  it('never plays a thunk whose stop-all arrived before the seek resolved', async () => {
    playLedgerThunk();
    stopAllFinancialReportSfx();
    thunkVoice(0).resolveSeek();
    await flush();
    expect(thunkVoice(0).play).not.toHaveBeenCalled();
  });

  it('starts flame-up and the crackle loop on ignition and stops both together', async () => {
    playSurgeIgnition();
    expect(crackle().loop).toBe(true);
    flameUp().resolveSeek();
    crackle().resolveSeek();
    await flush();
    expect(flameUp().play).toHaveBeenCalledTimes(1);
    expect(crackle().play).toHaveBeenCalledTimes(1);
    stopSurgeBed();
    expect(flameUp().pause).toHaveBeenCalled();
    expect(crackle().pause).toHaveBeenCalled();
    stopSurgeBed(); // double-stop is safe
  });

  it('never plays a flame-up whose surge stopped before the seek resolved', async () => {
    playSurgeIgnition();
    stopSurgeBed();
    flameUp().resolveSeek();
    crackle().resolveSeek();
    await flush();
    expect(flameUp().play).not.toHaveBeenCalled();
    expect(crackle().play).not.toHaveBeenCalled();
  });

  it('suspend invalidates in-flight seeks even after resume', async () => {
    playLedgerSpin();
    suspendFinancialReportSfx();
    resumeFinancialReportSfx();
    spin().resolveSeek();
    await flush();
    expect(spin().play).not.toHaveBeenCalled();
  });

  it('resumes the crackle only into a still-active surge, with a fresh seek', async () => {
    playSurgeIgnition();
    crackle().resolveSeek();
    flameUp().resolveSeek();
    await flush();
    expect(crackle().play).toHaveBeenCalledTimes(1);
    suspendFinancialReportSfx();
    expect(crackle().pause).toHaveBeenCalled();
    resumeFinancialReportSfx();
    expect(crackle().seekTo).toHaveBeenCalledTimes(2); // the fresh resume seek
    crackle().resolveSeek();
    await flush();
    expect(crackle().play).toHaveBeenCalledTimes(2);
  });

  it('stays silent on resume when the surge stopped during suspension', async () => {
    playSurgeIgnition();
    crackle().resolveSeek();
    await flush();
    suspendFinancialReportSfx();
    stopSurgeBed();
    resumeFinancialReportSfx();
    expect(crackle().seekTo).toHaveBeenCalledTimes(1); // no resume seek issued
  });

  it('starts nothing while suspended', () => {
    playLedgerSpin(); // init happens on first call, so players exist
    suspendFinancialReportSfx();
    const seeksBefore = spin().seekTo.mock.calls.length;
    playLedgerSpin();
    expect(spin().seekTo).toHaveBeenCalledTimes(seeksBefore);
  });

  it('sets volume zero as muted on every player and unmutes on restore', () => {
    playLedgerSpin();
    setFinancialReportSfxMasterVolume(0);
    for (const player of mockPlayers) {
      expect(player.volume).toBe(0);
      expect(player.muted).toBe(true);
    }
    setFinancialReportSfxMasterVolume(0.8);
    for (const player of mockPlayers) {
      expect(player.muted).toBe(false);
    }
    expect(spin().volume).toBeCloseTo(0.6 * 0.8);
  });

  it('recovers a dead player with one bounded recreate-and-retry', async () => {
    playLedgerSpin();
    const originalSpin = spin();
    originalSpin.rejectSeek();
    await flush();
    // A replacement player was created and its retry seek issued.
    const replacement = mockPlayers[mockPlayers.length - 1];
    expect(replacement).not.toBe(originalSpin);
    replacement.resolveSeek();
    await flush();
    expect(replacement.play).toHaveBeenCalledTimes(1);
  });

  it('stays silent without wedging when recovery itself fails permanently', async () => {
    playLedgerSpin();
    (createAudioPlayer as jest.Mock).mockImplementationOnce(() => {
      throw new Error('dead device');
    });
    spin().rejectSeek();
    await flush();
    // No replacement retry loop; the next play call still works normally.
    expect(() => playLedgerSpin()).not.toThrow();
  });

  it('tears down every player and re-initializes cleanly afterwards', () => {
    playLedgerSpin();
    const created = mockPlayers.length;
    expect(created).toBe(7);
    teardownFinancialReportSfx();
    for (const player of mockPlayers) {
      expect(player.remove).toHaveBeenCalled();
      expect(player.release).toHaveBeenCalled();
    }
    expect(() => playLedgerThunk()).not.toThrow();
    expect(mockPlayers.length).toBe(14); // a fresh set
  });
});
