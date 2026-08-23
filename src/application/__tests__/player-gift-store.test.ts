import { createCareer } from '../../game/career';
import {
  lowMoraleGiftTutorialPlayerId,
  reconcileLowMoraleGiftTutorialTarget,
} from '../../game/player-gifts';
import type { GameState } from '../../game/types';
import {
  MissingCareerBackupError,
  type CareerRepository,
} from '../../persistence';
import { createLaunchCareerSetup } from '../launch';
import { useM1Store } from '../store';

beforeEach(() => {
  useM1Store.setState(useM1Store.getInitialState(), true);
});

test('shows the gift celebration only after the gifted career is saved', async () => {
  const base = createCareer(createLaunchCareerSetup(20260823));
  const player = base.players.find(
    (candidate) => candidate.clubId === base.userClubId,
  )!;
  const career: GameState = reconcileLowMoraleGiftTutorialTarget({
    ...base,
    players: base.players.map((candidate) =>
      candidate.id === player.id ? { ...candidate, morale: 5 } : candidate,
    ),
    clubs: base.clubs.map((club) =>
      club.id === base.userClubId ? { ...club, cash: 1_000_000 } : club,
    ),
  });
  const saved: GameState[] = [];
  let releaseSave: (() => void) | undefined;
  const repository = stubCareerRepository({
    async load() {
      return career;
    },
    async save(state) {
      await new Promise<void>((resolve) => {
        releaseSave = resolve;
      });
      saved.push(state);
    },
  });
  useM1Store.setState({
    career,
    repository,
    activeTab: 'squad',
    persistenceReady: true,
    lastPersistedCareer: career,
  });
  const gifting = useM1Store.getState().giftPlayer(player.id, true);
  await waitUntil(() => releaseSave !== undefined);

  expect(useM1Store.getState().lastPlayerGiftResult).toBeNull();
  releaseSave!();
  await gifting;

  expect(saved.at(-1)?.cashTransactions?.at(-1)).toMatchObject({
    kind: 'player-gift',
    referenceId: player.id,
  });
  expect(lowMoraleGiftTutorialPlayerId(saved.at(-1)!)).toBeUndefined();
  expect(reconcileLowMoraleGiftTutorialTarget(saved.at(-1)!)).toBe(
    saved.at(-1),
  );
  expect(useM1Store.getState().lastPlayerGiftResult).toMatchObject({
    playerId: player.id,
    moraleGain: 20,
  });
});

test('saves tutorial completion when the guided gift is unaffordable', async () => {
  const base = createCareer(createLaunchCareerSetup(20260825));
  const player = base.players.find(
    (candidate) => candidate.clubId === base.userClubId,
  )!;
  const career = reconcileLowMoraleGiftTutorialTarget({
    ...base,
    players: base.players.map((candidate) =>
      candidate.id === player.id ? { ...candidate, morale: 5 } : candidate,
    ),
    clubs: base.clubs.map((club) =>
      club.id === base.userClubId ? { ...club, cash: 0 } : club,
    ),
  });
  const saved: GameState[] = [];
  useM1Store.setState({
    career,
    repository: stubCareerRepository({
      async save(state) {
        saved.push(state);
      },
    }),
    activeTab: 'squad',
    persistenceReady: true,
    lastPersistedCareer: career,
  });

  await useM1Store.getState().giftPlayer(player.id, true);

  expect(saved.at(-1)?.cashTransactions).toEqual(career.cashTransactions);
  expect(lowMoraleGiftTutorialPlayerId(saved.at(-1)!)).toBeUndefined();
  expect(reconcileLowMoraleGiftTutorialTarget(saved.at(-1)!)).toBe(
    saved.at(-1),
  );
  expect(useM1Store.getState().error).toBe('The club cannot afford this gift.');
  expect(useM1Store.getState().lastPlayerGiftResult).toBeNull();
});

test('does not replay a saved gift celebration after leaving the Squad tab', async () => {
  const career = createCareer(createLaunchCareerSetup(20260824));
  let releaseSave: (() => void) | undefined;
  const repository = stubCareerRepository({
    async save() {
      await new Promise<void>((resolve) => {
        releaseSave = resolve;
      });
    },
  });
  useM1Store.setState({
    career,
    repository,
    activeTab: 'squad',
    persistenceReady: true,
    lastPersistedCareer: career,
  });
  const player = career.players.find(
    (candidate) => candidate.clubId === career.userClubId,
  )!;

  const gifting = useM1Store.getState().giftPlayer(player.id);
  await waitUntil(() => releaseSave !== undefined);
  useM1Store.getState().setActiveTab('home');
  releaseSave!();
  await gifting;

  expect(useM1Store.getState().lastPlayerGiftResult).toBeNull();
});

async function waitUntil(done: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 50 && !done(); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  if (!done()) throw new Error('condition never became true');
}

function stubCareerRepository(
  overrides: Partial<CareerRepository>,
): CareerRepository {
  return {
    async load() {
      return null;
    },
    async loadRaw() {
      return null;
    },
    async save() {},
    async delete() {},
    async backupSummary() {
      return null;
    },
    async restoreBackup() {
      throw new MissingCareerBackupError();
    },
    async checkIntegrity() {
      return true;
    },
    ...overrides,
  };
}
