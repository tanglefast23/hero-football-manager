import { loadLaunchContent } from '../../content';
import {
  advanceFacilityConstruction,
  buildCareerFacility,
  createCareer,
  hasSeenDeskTip,
  offerCareerEvent,
  type GameState,
} from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { homeViewModel, settleWeeklyTip } from '../view-models';

describe("manager's tips", () => {
  const content = loadLaunchContent();
  const tipIds = content.tips.tips.map(tip => tip.id);

  /** A career whose guide queue is silent, so the desk is genuinely empty. */
  function deskClearCareer(seed: number): GameState {
    const started = buildCareerFacility(
      createCareer(createLaunchCareerSetup(seed, undefined, content)),
      'training-pitch',
      { x: 0, y: 0 },
    ).state;
    let grid = started.facilities.grid!;
    while (grid.construction !== undefined) {
      grid = advanceFacilityConstruction(grid).grid;
    }
    return {
      ...started,
      week: 9,
      facilities: { trainingGroundBuilt: true, grid },
      market: undefined,
      m2: undefined,
    };
  }

  /** Walks weeks until a tip lands, returning the settled state. */
  function settleUntilTip(start: GameState, maxWeeks = 30): GameState {
    let state = start;
    for (let week = start.week; week <= maxWeeks; week += 1) {
      state = settleWeeklyTip({ ...state, week, deskTip: undefined });
      if (state.deskTip?.tipId !== undefined) return state;
    }
    throw new Error('no tip landed within the season');
  }

  it('ships tips that are all distinct and readable', () => {
    expect(new Set(tipIds).size).toBe(tipIds.length);
    expect(tipIds.length).toBeGreaterThanOrEqual(10);
    for (const tip of content.tips.tips) {
      expect(tip.body.length).toBeGreaterThan(60);
    }
  });

  it('writes the whole tip onto the desk as its own card', () => {
    const settled = settleUntilTip(deskClearCareer(20261201));
    const tip = content.tips.tips.find(candidate => candidate.id === settled.deskTip!.tipId)!;

    const notes = homeViewModel(settled).notes;

    expect(notes).toContainEqual({
      id: `tip:${tip.id}`,
      kind: 'tip',
      title: tip.title,
      detail: tip.body,
    });
  });

  it('carries optional squad destinations from content onto actionable tips', () => {
    const drillTiers = content.tips.tips.find(candidate => candidate.id === 'drill-tiers-are-permanent');

    expect(drillTiers).toMatchObject({ destination: 'drill-shop' });

    const base = deskClearCareer(20261208);
    const home = homeViewModel({
      ...base,
      deskTip: { season: base.season, week: base.week, tipId: drillTiers!.id },
    });
    expect(home.notes).toContainEqual({
      id: `tip:${drillTiers!.id}`,
      kind: 'tip',
      title: drillTiers!.title,
      detail: drillTiers!.body,
      destination: 'drill-shop',
    });
  });

  it('settles a week once, so re-reconciling cannot reroll it', () => {
    const settled = settleUntilTip(deskClearCareer(20261202));

    expect(settleWeeklyTip(settled)).toBe(settled);
    expect(settleWeeklyTip(settleWeeklyTip(settled))).toBe(settled);
  });

  it('leaves some weeks without a tip', () => {
    const clear = deskClearCareer(20261203);
    const outcomes = Array.from({ length: 20 }, (_, index) => (
      settleWeeklyTip({ ...clear, week: index + 5 }).deskTip?.tipId
    ));

    expect(outcomes.some(tipId => tipId === undefined)).toBe(true);
    expect(outcomes.some(tipId => tipId !== undefined)).toBe(true);
  });

  it('never repeats a tip in one career', () => {
    let state = deskClearCareer(20261204);
    const shown: string[] = [];
    for (let season = 1; season <= 8; season += 1) {
      for (let week = 1; week <= 30; week += 1) {
        state = settleWeeklyTip({ ...state, season, week, deskTip: undefined });
        const tipId = state.deskTip?.tipId;
        if (tipId !== undefined) shown.push(tipId);
      }
    }

    expect(shown.length).toBeGreaterThan(5);
    expect(new Set(shown).size).toBe(shown.length);
    for (const tipId of shown) expect(hasSeenDeskTip(state, tipId)).toBe(true);
  });

  it('runs dry rather than recycling once every tip has been read', () => {
    const clear = deskClearCareer(20261205);
    const allSeen = { ...clear, eventFlags: [...clear.eventFlags, ...tipIds.map(id => `tip:seen:${id}`)] };

    const settled = settleWeeklyTip(allSeen);

    expect(settled.deskTip).toEqual({ season: settled.season, week: settled.week });
    expect(homeViewModel(settled).notes.some(note => note.kind === 'tip')).toBe(false);
  });

  it('stays off a week that already has something to read', () => {
    const clear = deskClearCareer(20261206);
    const injuredId = clear.players.find(player => player.clubId === clear.userClubId)!.id;
    const busy = {
      ...clear,
      players: clear.players.map(player => (
        player.id === injuredId ? { ...player, injuryWeeks: 3 } : player
      )),
    };

    expect(settleWeeklyTip(busy)).toBe(busy);
  });

  it('yields the quiet week to a story rather than stacking under it', () => {
    const withStory = offerCareerEvent(deskClearCareer(20261207), 'giant-spider-arrives');

    expect(settleWeeklyTip(withStory)).toBe(withStory);
  });

  it('waits until the opening tutorial is over', () => {
    const onboarding = { ...deskClearCareer(20261208), onboarding: { stage: 'first-match' as const } };

    expect(settleWeeklyTip(onboarding)).toBe(onboarding);
  });
});
