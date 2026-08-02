import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { clubLegacyViewModel, homeViewModel } from '../../../../application/view-models';
import { resolveNextClubLegendLegacy } from '../../../../game/legacy-career';
import { CLUB_LEGEND_MIN_FAME, CLUB_LEGEND_MIN_SEASONS } from '../../../../game/pyramid';
import { careerRosterCapacity, userCareerRosterCount } from '../../../../game/youth-intake';
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

function retirementAlerts(state: GameState) {
  return homeViewModel(state).alerts.filter(alert => alert.id.startsWith('retirement-'));
}

function retirementRows(state: GameState): string[] {
  return retirementAlerts(state).map(alert => alert.title);
}

describe('the retirement and legacy reel', () => {
  it('registers five squads and three queues', () => {
    expect(retirementLegacyEntry.cases.map(entry => entry.id)).toEqual([
      'announcement',
      'hero-farewell',
      'generation',
      'last-matches',
      'farewell',
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

  /**
   * The emotionally loaded one, and the one that used to read like any other
   * row: the desk never said the player leaving had a power.
   */
  it('marks the hero farewell as a hero', () => {
    const state = career('hero-farewell');
    const announcement = state.retirementAnnouncements?.[0];
    const leaving = state.players.find(player => player.id === announcement?.playerId);
    const row = retirementAlerts(state)[0];

    expect(leaving?.power).toBeDefined();
    expect(retirementRows(state)).toHaveLength(1);
    expect(row?.isHero).toBe(true);
    // The ordinary farewell carries no chip, so the chip means something.
    expect(retirementAlerts(career('announcement'))[0]?.isHero).toBeUndefined();
  });

  /**
   * The measurement the case exists to take. Seven farewells arrive in a desk
   * that shows three rows, and `retirementAnnouncements` is overwritten at the
   * next transition — so one row per player lost four of them for good. One
   * grouped row names three and counts the rest.
   */
  it('ages a whole generation out at once without losing anybody', () => {
    const state = career('generation');
    const announced = state.retirementAnnouncements?.length ?? 0;
    const rows = retirementAlerts(state);

    expect(announced).toBeGreaterThan(3);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe(`${announced} players announce final seasons`);
    expect(rows[0].detail).toContain(`and ${announced - 3} more`);
    expect(retirementLegacyNote('generation', state)).toContain(`Announced ${announced}`);
    expect(retirementLegacyNote('generation', state)).toContain('1 on the desk');
  });

  /**
   * The advance warning. An announcement is a season old by the time the last
   * match is played, so without this the send-off is something a manager reads
   * about afterwards. It schedules urgent because its window is three weeks
   * wide — a busy desk must not swallow it.
   */
  it('warns that the last matches are being played, even on a busy desk', () => {
    const state = career('last-matches');
    const busy = retirementLegacyCareer('last-matches', { quietDesk: false });
    const warning = retirementAlerts(state)
      .find(alert => alert.id.startsWith('retirement-final-weeks-'));

    expect(warning).toBeDefined();
    expect(warning?.detail).toContain('when the season ends');
    expect(warning?.detail).toContain('weeks left');
    expect(warning?.isHero).toBe(true);
    expect(retirementAlerts(busy).map(alert => alert.id))
      .toContain(`retirement-final-weeks-${busy.season}`);
  });

  /**
   * The moment that did not exist at all. `retiredPlayers` grew for the whole
   * career and was rendered nowhere, so a player below the legend thresholds
   * got one announcement and then vanished.
   */
  it('says goodbye the season after a player has actually gone', () => {
    const state = career('farewell');
    const gone = state.retiredPlayers ?? [];
    const row = retirementAlerts(state)
      .find(alert => alert.id === `retirement-farewell:s${state.season}`);

    expect(gone.length).toBe(3);
    expect(gone.every(player => player.retirementAnnouncementSeason === state.season - 2)).toBe(true);
    expect(state.players.some(player => gone.some(left => left.id === player.id))).toBe(false);
    expect(row?.title).toBe('3 players have retired');
    expect(row?.detail).toContain(`Season ${state.season - 1}`);
    expect(row?.isHero).toBe(true);
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

  /** The reel's buttons are the shipped transaction, so the queue advances. */
  it('advances the queue through the real legacy transaction', () => {
    const state = career('legacy-queue');
    const first = state.pendingLegacyPlayerIds?.[0];

    const transaction = resolveNextClubLegendLegacy(state, 'coach-candidate');

    expect(transaction.resolvedPlayerId).toBe(first);
    expect(transaction.state.pendingLegacyPlayerIds).toHaveLength(2);
    expect(transaction.coachCandidate?.retiredLegendPlayerId).toBe(first);
  });

  /**
   * Two choices, and both of them work over a full roster. "Mentor a prospect"
   * did not: it added a seventeenth player to a squad the season transition has
   * already refilled to the sixteen-player cap, so every offer of it threw and
   * the store turned the throw into an error banner under a button that still
   * looked available.
   */
  it('offers the coach and the farewell, over a full roster', () => {
    const state = career('legacy-queue');
    const legacy = clubLegacyViewModel(state);

    expect(legacy.choices.map(choice => choice.id)).toEqual(['coach-candidate', 'farewell']);
    // Both read as decisions: a label, why it happens, and what it does.
    expect(legacy.choices.every(choice => (
      choice.label.length > 0 && choice.detail.length > 0 && choice.outcome.length > 0
    ))).toBe(true);
    expect(retirementLegacyNote('legacy-queue', state)).toMatch(/roster \d+\/\d+/);
    expect(retirementLegacyNote('legacy-queue', state)).toContain('Queue 3');
    // The roster is full, and both legacies resolve anyway.
    expect(userCareerRosterCount(state)).toBe(careerRosterCapacity(state));
    expect(() => resolveNextClubLegendLegacy(state, 'coach-candidate')).not.toThrow();
    expect(() => resolveNextClubLegendLegacy(state, 'farewell')).not.toThrow();
  });

  /**
   * The measurement the second button exists to survive: the queue advances the
   * same way, and the coach market is the number that separates the two.
   */
  it('advances the queue on a farewell without touching the coach market', () => {
    const state = career('legacy-queue');
    const first = state.pendingLegacyPlayerIds?.[0];
    const coachesBefore = state.market?.coachCandidates.length ?? 0;

    const declined = resolveNextClubLegendLegacy(state, 'farewell');
    const hired = resolveNextClubLegendLegacy(state, 'coach-candidate');

    expect(declined.resolvedPlayerId).toBe(first);
    expect(declined.state.pendingLegacyPlayerIds).toHaveLength(2);
    expect(declined.coachCandidate).toBeUndefined();
    expect(declined.state.market?.coachCandidates).toHaveLength(coachesBefore);
    expect(hired.state.market?.coachCandidates).toHaveLength(coachesBefore + 1);
    expect(retirementLegacyNote('legacy-queue', declined.state))
      .toContain(`coach market ${coachesBefore}`);
    expect(retirementLegacyNote('legacy-queue', hired.state))
      .toContain(`coach market ${coachesBefore + 1}`);
  });

  /**
   * The club's own record of everyone who has left it. `retiredPlayers` grows
   * for the life of a career and used to be rendered on no screen at all.
   */
  it('shows the roll of former players beside the decision', () => {
    const legacy = clubLegacyViewModel(career('legacy-queue'));

    expect(legacy.isHero).toBe(true);
    // Three retired, one of them the legend this screen is deciding about.
    expect(legacy.formerPlayerTotal).toBe(2);
    expect(legacy.formerPlayers.map(former => former.playerId)).not.toContain(legacy.playerId);
    expect(legacy.formerPlayers.every(former => /\d+ seasons? · \d+ fame/.test(former.detail)))
      .toBe(true);
    expect(retirementLegacyNote('legacy-queue', career('legacy-queue'))).toContain('roll shows 2/2');
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
    expect(isLegacyCase('last-matches')).toBe(false);
    expect(isLegacyCase('farewell')).toBe(false);
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
