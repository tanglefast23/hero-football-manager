import { createLaunchCareerSetup } from '../../application/launch';
import {
  runHeadlessFullCareer,
  summarizeFullCareerBalance,
} from '../headless';
import { buildCareerTeamDef } from '../squad';

const SAMPLE_SEEDS = [0, 1, 77, 20_260_719, 4_294_967_295] as const;
const STRESS_SEASONS = 6;

describe('M2 deterministic management balance rails', () => {
  test.each(SAMPLE_SEEDS)('keeps seed %i finite, bounded, and playable for six seasons', seed => {
    const setup = createLaunchCareerSetup(seed, undefined, undefined, 'full');
    const first = runHeadlessFullCareer(setup, STRESS_SEASONS);
    const second = runHeadlessFullCareer(setup, STRESS_SEASONS);
    const summary = summarizeFullCareerBalance(first);
    const userTeam = buildCareerTeamDef(first, first.userClubId);

    // Byte equality is the strongest management determinism rail: cup draws,
    // weekly economy, player wellbeing, retirement, and the pyramid all agree.
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.phase).toBe('season-end');
    expect(summary.completedSeasons).toBe(STRESS_SEASONS);
    expect(first.ledgers).toHaveLength(STRESS_SEASONS * 30);

    // A deliberately passive manager can run into debt after the S1 subsidy,
    // but the six-season stress path must stay in a controlled integer corridor
    // rather than overflow or produce runaway income/debt.
    expect(summary.minimumBalance).toBeGreaterThanOrEqual(-325_000);
    expect(summary.maximumBalance).toBeLessThanOrEqual(75_000);
    expect(summary.minimumWeeklyNet).toBeGreaterThanOrEqual(-15_000);
    expect(summary.maximumWeeklyNet).toBeLessThanOrEqual(40_000);
    expect(Number.isSafeInteger(summary.endingCash)).toBe(true);
    expect(summary.trainingPoints).toBeGreaterThan(0);

    expect(summary.currentDivision).toBeGreaterThanOrEqual(1);
    expect(summary.currentDivision).toBeLessThanOrEqual(5);
    expect(summary.userRosterSize).toBeGreaterThanOrEqual(16);
    expect(summary.userStartingLineupSize).toBe(11);
    expect(userTeam.players).toHaveLength(11);
    expect(new Set(userTeam.players.map(player => player.id)).size).toBe(11);
    expect(userTeam.players.some(player => player.role === 'GK')).toBe(true);
  });

  test('continues past the old two-season boundary on a long deterministic sample', () => {
    const setup = createLaunchCareerSetup(91_827, undefined, undefined, 'full');
    const seasonSeven = runHeadlessFullCareer(setup, 7);

    expect(seasonSeven.season).toBe(7);
    expect(seasonSeven.phase).toBe('season-end');
    expect(seasonSeven.phase).not.toBe('complete');
    expect(seasonSeven.m2?.pyramid.divisions.map(division => division.clubs.length))
      .toEqual([10, 10, 10, 10, 10]);
    expect(seasonSeven.m2?.nationalCups).toHaveLength(7);
    expect(seasonSeven.m2?.nationalCups.every(cup => cup.championClubId !== undefined)).toBe(true);
  });

  test('samples passive four-season promotion and fail-soft outcomes across 40 seeds', () => {
    const summaries = Array.from({ length: 40 }, (_, seed) => {
      const state = runHeadlessFullCareer(
        createLaunchCareerSetup(seed, undefined, undefined, 'full'),
        4,
      );
      return { state, summary: summarizeFullCareerBalance(state) };
    });
    const divisionThreeOrHigher = summaries.filter(({ summary }) => summary.currentDivision <= 3);
    const loanCount = summaries.filter(({ state }) => state.financialSafety?.emergencyLoanUsed).length;

    // This runner is deliberately passive, so it is not the player-progression
    // median promised by the design doc. It still guards distribution drift:
    // some zero-hero clubs climb twice, every debt spiral receives the one loan,
    // and no sampled balance escapes the long-run corridor.
    expect(divisionThreeOrHigher.length / summaries.length).toBeGreaterThanOrEqual(0.1);
    expect(loanCount).toBe(summaries.length);
    expect(Math.min(...summaries.map(({ summary }) => summary.minimumBalance)))
      .toBeGreaterThanOrEqual(-200_000);
    expect(summaries.every(({ summary }) => Number.isSafeInteger(summary.endingCash))).toBe(true);
  });

  test('rejects non-M2 and unsafe economic state instead of reporting false confidence', () => {
    const setup = createLaunchCareerSetup(44);
    const full = runHeadlessFullCareer(setup, 1);

    expect(() => summarizeFullCareerBalance({ ...full, careerMode: 'm1-slice' }))
      .toThrow('full career balance requires an M2 career state');
    expect(() => summarizeFullCareerBalance({
      ...full,
      clubs: full.clubs.map(club => club.id === full.userClubId
        ? { ...club, cash: Number.POSITIVE_INFINITY }
        : club),
    })).toThrow('full career balance contains non-finite or unsafe money');
  });
});
