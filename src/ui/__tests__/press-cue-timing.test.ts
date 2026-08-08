const mockPlayers: Array<{
  play: jest.Mock;
  pause: jest.Mock;
  seekTo: jest.Mock;
  remove: jest.Mock;
  release: jest.Mock;
  volume: number;
}> = [];
const mockImpactAsync = jest.fn(() => Promise.resolve());

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: mockImpactAsync,
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => {
    const player = {
      volume: -1,
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(() => Promise.resolve()),
      remove: jest.fn(),
      release: jest.fn(),
    };
    mockPlayers.push(player);
    return player;
  }),
}));

// The component pulls react-native in for Pressable/Text/View. Nothing here
// renders it — the gate is the part that decides when a press makes a sound,
// and it is deliberately free of React so it can be driven directly.
jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
  Platform: { OS: 'ios' },
}));

import { createPressCueGate } from '../press-cue-gate';
import {
  playManagementActionSfx,
  playMatchControlSfx,
  playStatStepSfx,
  playUiClickSfx,
  setManagementSfxMasterVolume,
  teardownManagementSfx,
} from '../../render/management-sfx';

/** The routing SfxPressable hands the gate for its default cue. */
const playClick = () => playUiClickSfx();

// Catalog order, which the sound module builds its players in. The two rapid
// cues own three further voices each at the end of the list, so a second press
// of the same cue lands on a different player — count every player's plays
// rather than one player's.
const UI_CLICK = 2;
const WARNING = 15;
const STAT_STEP = 17;
const MATCH_CONTROL = 26;

const totalPlays = () =>
  mockPlayers.reduce((count, player) => count + player.play.mock.calls.length, 0);

let clock = 0;

/** Sound is asynchronous — every cue rewinds before it plays. */
const settle = () => Promise.resolve();

describe('press cue timing', () => {
  beforeEach(() => {
    teardownManagementSfx();
    mockPlayers.length = 0;
    jest.clearAllMocks();
    clock = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => clock);
    setManagementSfxMasterVolume(1);
  });

  afterEach(() => {
    teardownManagementSfx();
    jest.restoreAllMocks();
  });

  it('sounds with the finger going down, and stays quiet when it lifts', async () => {
    const gate = createPressCueGate();

    gate.pressIn(playClick);
    await settle();
    // The point of the whole exercise: the press is already audible while the
    // finger is still on the button.
    expect(totalPlays()).toBe(1);
    expect(mockPlayers[UI_CLICK].play).toHaveBeenCalledTimes(1);

    clock += 120;
    gate.pressOut();
    gate.press(playClick);
    await settle();

    expect(totalPlays()).toBe(1);
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);
    expect(mockImpactAsync).toHaveBeenCalledWith('light');
  });

  it('answers an activation that never had a press-in', async () => {
    const gate = createPressCueGate();

    // A keyboard or synthetic activation: React Native Web hands it straight to
    // the press handler, which is why that handler has to be an owner too.
    gate.press(playClick);
    await settle();

    expect(totalPlays()).toBe(1);
    expect(mockPlayers[UI_CLICK].play).toHaveBeenCalledTimes(1);
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);
  });

  it('keeps a button held down to a single cue', async () => {
    const gate = createPressCueGate();

    gate.pressIn(playClick);
    // Long past any window measured from the press-in. What the guard actually
    // measures is release-to-activation, so the hold's length cannot reach it.
    clock += 8_000;
    gate.pressOut();
    gate.press(playClick);
    await settle();

    expect(totalPlays()).toBe(1);
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);
  });

  it('plays one live-match whistle across press-in, release, and activation', async () => {
    const gate = createPressCueGate();

    gate.pressIn(playMatchControlSfx);
    clock += 120;
    gate.pressOut();
    gate.press(playMatchControlSfx);
    await settle();

    expect(totalPlays()).toBe(1);
    expect(mockPlayers[MATCH_CONTROL].seekTo).toHaveBeenCalledTimes(1);
    expect(mockPlayers[MATCH_CONTROL].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[UI_CLICK].play).not.toHaveBeenCalled();
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);
  });

  it('gives every activation its own cue', async () => {
    const gate = createPressCueGate();

    for (let press = 0; press < 3; press += 1) {
      gate.pressIn(playClick);
      clock += 90;
      gate.pressOut();
      gate.press(playClick);
      clock += 400;
    }
    await settle();

    expect(totalPlays()).toBe(3);
    expect(mockImpactAsync).toHaveBeenCalledTimes(3);
  });

  it('recovers from an abandoned press, so a later keyboard activation is heard', async () => {
    const gate = createPressCueGate();

    // Finger dragged off the button: press-in and press-out arrive, the press
    // never does, and nothing consumes the record of it.
    gate.pressIn(playClick);
    clock += 200;
    gate.pressOut();
    await settle();
    expect(totalPlays()).toBe(1);

    clock += 2_000;
    gate.press(playClick);
    await settle();

    expect(totalPlays()).toBe(2);
  });

  it('routes each cue to its own sound', async () => {
    createPressCueGate().pressIn(playStatStepSfx);
    createPressCueGate().pressIn(() => playManagementActionSfx('warning'));
    await settle();

    expect(mockPlayers[STAT_STEP].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[WARNING].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[UI_CLICK].play).not.toHaveBeenCalled();
    // A refusal is felt as sound only; the tap haptic belongs to cues that mean
    // the press was taken.
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);
  });
});
