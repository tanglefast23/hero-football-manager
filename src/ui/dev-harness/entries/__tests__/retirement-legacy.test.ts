import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { clubLegacyViewModel, homeViewModel } from '../../../../application/view-models';
import { resolveNextClubLegendLegacy } from '../../../../game/legacy-career';
import { CLUB_LEGEND_MIN_FAME, CLUB_LEGEND_MIN_SEASONS } from '../../../../game/pyramid';
import type { GameState } from '../../../../game/types';

/**
 * Jest runs with `testEnvironment: 'node'` and no react-native preset, so the
 * real `react-native` module throws on require. The entry's fabrication is
 * plain TypeScript sitting in the same file as its component — these stubs are
 * what let the state builders be run at all, and nothing here renders.
 */
jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../../screens/ClubHomeScreen', () => ({ ClubHomeScreen: () => null }));
jest.mock('../../../screens/ClubLegacyScreen', () => ({ ClubLegacyScreen: () => null }));
jest.mock('../../DevHarnessControls', () => ({
  DevHarnessButton: () => null,
  devHarnessControlStyles: { row: {}, rowLabel: {} },
}));

// The mocks above are hoisted over these imports by the ts-jest transformer.
import {
  emptyLegacyReason,
  isLegacyCase,
  retirementLegacyCareer,
  retirementLegacyEntry,
  retirementLegacyNote,
  type RetirementLegacyCaseId,
} from '../retirement-legacy';

const OPTIONS = { quietDesk: true } as const;

function career(caseId: RetirementLegacyCaseId): GameState {
  return retirementLegacyCareer(caseId, OPTIONS);
}

function retirementRows(state: GameState): string[] {
  return homeViewModel(state).alerts
    .filter(alert => alert.id.startsWith('retirement-announcement-'))
    .map(alert => alert.title);
}

describe('the retirement and legacy reel', () => {
  it('registers three squads and three queues', () => {
    expect(retirementLegacyEntry.cases.map(entry => entry.id)).toEqual([
      'announcement',
      'hero-farewell',
      'generation',
      'legacy-one',
      'legacy-queue',
      'legacy-empty',
    ]);
    expect(retirementLegacyEntry.cases.every(entry => (entry.note ?? '').length > 0)).toBe(true);
  });

  it('builds every case, deterministically', () => {
    for (const entry of retirementLegacyEntry.cases) {
      const caseId = entry.id as RetirementLegacyCaseId;
      expect(career(caseId)).toEqual(career(caseId));
    }
  });

  /**
   * One means one. The engine announces anyone who has reached his own
   * retirement age, so without pushing the rest of the squad back to an
   * unremarkable age the "single farewell" case quietly ships two.
   */
  it('announces exactly one final season for the single case', () => {
    const state = career('announcement');

    expect(state.retirementAnnouncements?.length).toBe(1);
    expect(retirementRows(state)).toHaveLength(1);
    expect(retirementRows(state)[0]).toContain('announces final season');
  });

  it('stamps the notice in the season the desk reads', () => {
    const state = career('announcement');
    const announcement = state.retirementAnnouncements?.[0];

    // `homeProductAlerts` only shows announcements made in `season - 1`.
    expect(announcement?.announcedInSeason).toBe(state.season - 1);
    expect(announcement?.retirementAge).toBeGreaterThanOrEqual(33);
    expect(announcement?.retirementAge).toBeLessThanOrEqual(38);
  });

  /** The emotionally loaded one: a player with a power is the one leaving. */
  it('gives the hero farewell an actual hero', () => {
    const state = career('hero-farewell');
    const announcement = state.retirementAnnouncements?.[0];
    const leaving = state.players.find(player => player.id === announcement?.playerId);

    expect(leaving?.power).toBeDefined();
    expect(retirementRows(state)).toHaveLength(1);
  });

  /**
   * The measurement the case exists to take: the desk carries three items a
   * week, so a generation ageing out arrives larger than the inbox it lands in
   * and the remainder is dropped with nothing to say it existed.
   */
  it('ages a whole generation out at once and shows the desk overflowing', () => {
    const state = career('generation');
    const announced = state.retirementAnnouncements?.length ?? 0;
    const shown = retirementRows(state);

    expect(announced).toBeGreaterThan(3);
    expect(shown.length).toBeLessThanOrEqual(3);
    expect(shown.length).toBeLessThan(announced);
    expect(retirementLegacyNote('generation', state)).toContain(`Announced ${announced}`);
    expect(retirementLegacyNote('generation', state)).toContain(`${shown.length} on the desk`);
  });

  it('queues legends the shipped thresholds accept', () => {
    const state = career('legacy-queue');

    expect(state.pendingLegacyPlayerIds).toHaveLength(3);
    for (const retired of state.retiredPlayers ?? []) {
      expect(retired.seasonsAtClub ?? 0).toBeGreaterThanOrEqual(CLUB_LEGEND_MIN_SEASONS);
      expect(retired.fame ?? 0).toBeGreaterThanOrEqual(CLUB_LEGEND_MIN_FAME);
    }
    expect((state.retiredPlayers ?? []).some(retired => retired.power !== undefined)).toBe(true);
  });

  it('labels the last decision differently from a queue of them', () => {
    expect(clubLegacyViewModel(career('legacy-one')).queueLabel).toBe('Final legacy decision');
    expect(clubLegacyViewModel(career('legacy-queue')).queueLabel).toBe('3 legacy decisions remain');
  });

  /** The reel's two buttons are the shipped transaction, so the queue advances. */
  it('advances the queue through the real legacy transaction', () => {
    const state = career('legacy-queue');
    const first = state.pendingLegacyPlayerIds?.[0];

    const transaction = resolveNextClubLegendLegacy(state, 'coach-candidate');

    expect(transaction.resolvedPlayerId).toBe(first);
    expect(transaction.state.pendingLegacyPlayerIds).toHaveLength(2);
    expect(transaction.coachCandidate?.retiredLegendPlayerId).toBe(first);
  });

  /**
   * "Mentor a prospect" adds a seventeenth player to a squad the season
   * transition has already refilled to its role targets. Whether it can be
   * taken at all is therefore a roster-space question, and the reel reports
   * the count rather than assuming an answer.
   */
  it('reports the roster space the mentor choice needs', () => {
    const state = career('legacy-queue');

    expect(retirementLegacyNote('legacy-queue', state)).toMatch(/roster \d+\/\d+/);
    expect(retirementLegacyNote('legacy-queue', state)).toContain('Queue 3');
  });

  it('has no legacy screen for an empty queue, and says so', () => {
    const state = career('legacy-empty');

    expect(state.pendingLegacyPlayerIds ?? []).toHaveLength(0);
    expect(() => clubLegacyViewModel(state)).toThrow();
    expect(emptyLegacyReason(state)).toBe('there is no pending club-legend decision');
  });

  it('sends each case to the surface that owns it', () => {
    expect(isLegacyCase('announcement')).toBe(false);
    expect(isLegacyCase('hero-farewell')).toBe(false);
    expect(isLegacyCase('generation')).toBe(false);
    expect(isLegacyCase('legacy-one')).toBe(true);
    expect(isLegacyCase('legacy-empty')).toBe(true);
  });

  /**
   * A function-form `style` on a Pressable drops layout properties on iOS and
   * collapses the control to nothing. The entry draws every control with
   * `DevHarnessButton`, which is where the 44pt minimum lives.
   */
  it('keeps its controls on the harness button', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/dev-harness/entries/retirement-legacy.tsx'),
      'utf8',
    );

    expect(source).not.toContain('<Pressable');
    expect(source).not.toContain('style={({');
    expect(source).toContain('DevHarnessButton');
    // No audio cue: the management SFX table is index-addressed by eight tests.
    expect(source).not.toContain('Sfx');
  });
});
