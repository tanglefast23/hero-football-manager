import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A Week 16 career could not be opened again. Two effects each forced a
 * different management tab, and each listed `store.activeTab` in its deps: the
 * first-Cup round-of-32 briefing pulled the manager to League, and an
 * undiscovered facility-combo reveal pulled them back to Club. The tab flipped
 * on every render until React threw "Maximum update depth exceeded" (#185).
 * The error surfaced inside `BertBriefingWalkOn`, because the briefing mounts
 * on one flip and unmounts on the other, and its unmount clears the guide
 * focus — a state write per cycle.
 *
 * Both conditions live in the save, so the crash repeated on every load.
 *
 * The rule this test holds: an effect that forces the tab must stand down while
 * another guide is already claiming it. Only one claim may be live at a time.
 */
const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

/** The effect body, from its `useEffect(` to the end of its dependency list. */
function effectContaining(marker: string): string {
  const at = app.indexOf(marker);
  expect(at).toBeGreaterThan(-1);
  const start = app.lastIndexOf('useEffect(', at);
  expect(start).toBeGreaterThan(-1);
  const end = app.indexOf(']);', at);
  expect(end).toBeGreaterThan(start);
  return app.slice(start, end);
}

describe('only one guide claims the management tab', () => {
  test('the facility-combo reveal stands down while the Cup briefing is owed', () => {
    const effect = effectContaining("store.setActiveTab('club')");
    expect(effect).toContain('firstCupRoundOf32GuideOwed');
  });

  test('its guard is a dependency, so the stand-down is re-evaluated', () => {
    const effect = effectContaining("store.setActiveTab('club')");
    const deps = effect.slice(effect.lastIndexOf('}, ['));
    expect(deps).toContain('firstCupRoundOf32GuideOwed');
  });

  test('the reveal is also hidden while the Cup briefing is owed', () => {
    const visible = app.slice(
      app.indexOf('const facilityComboRevealVisible ='),
      app.indexOf('const facilityComboRevealVisible =') + 240,
    );
    expect(visible).toContain('!firstCupRoundOf32GuideOwed');
  });

  test('the guard is declared before the effect that reads it', () => {
    expect(app.indexOf('const firstCupRoundOf32GuideOwed =')).toBeLessThan(
      app.indexOf('const facilityComboReveal ='),
    );
  });
});
