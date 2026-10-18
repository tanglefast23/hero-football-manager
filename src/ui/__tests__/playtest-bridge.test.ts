import { createCareer } from '../../game/career';
import { createLaunchCareerSetup } from '../../application/launch';
import { installPlaytestBridge } from '../playtest-bridge';

function source() {
  const career = createCareer(createLaunchCareerSetup(20261019));
  return {
    career,
    screen: 'management',
    activeTab: 'home',
    error: null,
    persistenceReady: true,
    persistenceLoadError: null,
    saving: false,
    lastPersistedCareer: career,
  };
}

it.each([
  ['web', 'https:', 'public.example', '?qa=playtest'],
  ['web', 'hfm:', 'localhost', '?qa=playtest'],
  ['web', 'http:', 'localhost', ''],
  ['ios', 'http:', 'localhost', '?qa=playtest'],
])(
  'keeps the bridge closed on %s %s %s %s',
  (platform, protocol, hostname, search) => {
    const target = { location: { protocol, hostname, search } };
    const read = jest.fn(source);
    installPlaytestBridge(target, read, platform);
    expect(target).not.toHaveProperty('__HFM_QA__');
    expect(read).not.toHaveBeenCalled();
  },
);

it('reads current snapshots without exposing or mutating the store', () => {
  const target: {
    location: { protocol: string; hostname: string; search: string };
    __HFM_QA__?: { read: () => any };
  } = {
    location: {
      protocol: 'http:',
      hostname: 'localhost',
      search: '?qa=playtest',
    },
  };
  const state = source();
  const original = JSON.stringify(state);
  const cleanup = installPlaytestBridge(target, () => state, 'web');
  const bridge = target.__HFM_QA__!;
  expect(Object.keys(bridge)).toEqual(['read']);
  const first = bridge.read();
  expect(first.careerIsPersisted).toBe(true);
  first.career.players[0].attrs.pac = 999;
  expect(JSON.stringify(state)).toBe(original);
  state.screen = 'matchday';
  expect(bridge.read().screen).toBe('matchday');
  expect(bridge.read().career.players[0].attrs.pac).not.toBe(999);
  cleanup();
  expect(target.__HFM_QA__).toBeUndefined();
});

it('reports serialization failure without crashing the snapshot reader', () => {
  const target: {
    location: { hostname: string; search: string };
    __HFM_QA__?: { read: () => any };
  } = {
    location: { hostname: 'localhost', search: '?qa=playtest' },
  };
  const state = source();
  state.career.players[0].attrs.pac = -100;
  installPlaytestBridge(target, () => state, 'web');
  const snapshot = target.__HFM_QA__!.read();
  expect(snapshot.screen).toBe('management');
  expect(snapshot.career).toBeNull();
  expect(snapshot.careerSerializationError).toContain('players.0.attrs.pac');
});
