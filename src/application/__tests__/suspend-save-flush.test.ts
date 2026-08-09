import { flushPendingCareerSave, useM1Store } from '../store';
import {
  MissingCareerBackupError,
  type CareerRepository,
} from '../../persistence';
import { DEFAULT_CREATION_RATINGS, type GameState } from '../../game';

/**
 * The save queue is serial, and iOS kills a hidden web app without warning. These
 * tests are about the one thing that matters there: a completed action's career
 * write must not still be waiting behind a long one when the app goes away.
 *
 * A save held open here stays in the store's module-level queue for the rest of
 * the file, so every test that opens one releases it in a `finally`.
 */
describe('career save flush on suspend', () => {
  beforeEach(() => {
    useM1Store.setState(useM1Store.getInitialState(), true);
  });

  it('does nothing when there is no queued career', async () => {
    let saves = 0;
    const repository = stubCareerRepository({
      async save() {
        saves += 1;
      },
    });
    await useM1Store.getState().initializePersistence(repository);
    await flushPendingCareerSave();

    expect(saves).toBe(0);
  });

  it('writes a pending career when the queue is otherwise idle', async () => {
    const saved: GameState[] = [];
    const repository = stubCareerRepository({
      async save(state) {
        saved.push(state);
      },
    });
    await useM1Store.getState().initializePersistence(repository);
    await startCreatedCareer(20260806);

    const before = saved.length;
    useM1Store.setState({ career: withWeek(useM1Store.getState().career!, 7) });
    useM1Store.getState().retrySave();
    await flushPendingCareerSave();

    expect(saved.length).toBe(before + 1);
    expect(saved.at(-1)!.week).toBe(7);
    expect(useM1Store.getState().saveWarning).toBeNull();
  });

  it('warns the player when the flush write fails', async () => {
    const saved: GameState[] = [];
    let failing = false;
    const repository = stubCareerRepository({
      async save(state) {
        if (failing) throw new Error('disk full');
        saved.push(state);
      },
    });
    await useM1Store.getState().initializePersistence(repository);
    await startCreatedCareer(20260806);

    useM1Store.setState({
      career: withWeek(useM1Store.getState().career!, 11),
    });
    failing = true;
    useM1Store.getState().retrySave();
    await flushPendingCareerSave();
    await settle();

    // A disk that cannot take the write is the player's problem to know about.
    expect(useM1Store.getState().saveWarning).not.toBeNull();
    expect(saved.some((state) => state.week === 11)).toBe(false);
  });

  it('lets a later action save after a failed flush', async () => {
    const saved: GameState[] = [];
    let failNext = false;
    const repository = stubCareerRepository({
      async save(state) {
        if (failNext) {
          failNext = false;
          throw new Error('disk full');
        }
        saved.push(state);
      },
    });
    await useM1Store.getState().initializePersistence(repository);
    await startCreatedCareer(20260806);

    useM1Store.setState({
      career: withWeek(useM1Store.getState().career!, 13),
    });
    failNext = true;
    useM1Store.getState().retrySave();
    await flushPendingCareerSave();
    await settle();

    // The in-app Retry the save warning offers has to work on its own, with no
    // second suspend to rescue it.
    const later = withWeek(useM1Store.getState().career!, 14);
    useM1Store.setState({ career: later });
    useM1Store.getState().retrySave();
    await settle();

    expect(saved.some((state) => state.week === 14)).toBe(true);
    expect(useM1Store.getState().lastPersistedCareer).toBe(later);
  });

  it('writes the queued career ahead of a long save already in flight', async () => {
    const saved: GameState[] = [];
    const held: { release: (() => void) | null } = { release: null };
    let hangNext = false;
    const repository = stubCareerRepository({
      async save(state) {
        if (hangNext) {
          hangNext = false;
          // Stands in for whatever long write the career is queued behind — a
          // replay save, or the four rival matches fulltime sims (571ms).
          await new Promise<void>((resolve) => {
            held.release = resolve;
          });
        }
        saved.push(state);
      },
    });
    await useM1Store.getState().initializePersistence(repository);
    await startCreatedCareer(20260806);

    try {
      hangNext = true;
      useM1Store.setState({
        career: withWeek(useM1Store.getState().career!, 3),
      });
      useM1Store.getState().retrySave();
      await waitUntil(() => held.release !== null);

      // A later action, whose write now has to queue behind that one.
      const latest = withWeek(useM1Store.getState().career!, 4);
      useM1Store.setState({ career: latest });
      useM1Store.getState().retrySave();

      // The app is hiding: this must not wait its turn.
      const flushed = flushPendingCareerSave();
      await waitUntil(() => saved.some((state) => state.week === 4));
      expect(saved.some((state) => state.week === 3)).toBe(false);
      expect(useM1Store.getState().lastPersistedCareer).toBe(latest);

      held.release!();
      await flushed;
      // The task queued for that state sees it was written and does nothing, so
      // cutting ahead costs one write, not two.
      expect(saved.filter((state) => state.week === 4)).toHaveLength(1);
    } finally {
      held.release?.();
      await flushPendingCareerSave();
    }
  });

  it('never cuts ahead of a career replacement', async () => {
    const saved: GameState[] = [];
    const held: { release: (() => void) | null } = { release: null };
    let hangNext = false;
    const repository = stubCareerRepository({
      async save(state) {
        if (hangNext) {
          hangNext = false;
          await new Promise<void>((resolve) => {
            held.release = resolve;
          });
        }
        saved.push(state);
      },
    });
    await useM1Store.getState().initializePersistence(repository);
    await startCreatedCareer(20260806);

    try {
      // Replacing a career writes a checkpoint, then the new career, then clears
      // the old replays. A save landing inside that sequence would be written
      // over by the replacement that follows it.
      hangNext = true;
      useM1Store.getState().startNewCareer(20260807);
      await waitUntil(() => held.release !== null);

      useM1Store.setState({
        career: withWeek(useM1Store.getState().career!, 21),
      });
      useM1Store.getState().retrySave();
      const flushed = flushPendingCareerSave();
      await settle();
      expect(saved.some((state) => state.week === 21)).toBe(false);

      held.release!();
      await flushed;
      // Once the sequence is done, the ordinary queued task writes it.
      expect(saved.some((state) => state.week === 21)).toBe(true);
    } finally {
      held.release?.();
      await flushPendingCareerSave();
    }
  });
});

function withWeek(career: GameState, week: number): GameState {
  return { ...career, week };
}

async function startCreatedCareer(seed: number): Promise<void> {
  useM1Store.getState().startNewCareer(seed);
  useM1Store.getState().completePlayerCreation({
    name: 'Jo Rook',
    ratings: DEFAULT_CREATION_RATINGS,
  });
  // Let the creation write finish, so the queue starts each test idle.
  await flushPendingCareerSave();
}

/** A few macrotasks, which is all any queued save needs when nothing is held. */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1)
    await new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitUntil(done: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !done(); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  if (!done()) throw new Error('condition never became true');
}

function stubCareerRepository(
  overrides: Partial<CareerRepository> = {},
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
