import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), 'utf8');

describe('saved club kit render wiring', () => {
  it('passes the saved kit to watched match presentations', () => {
    const app = source('App.tsx');
    const matchday = app.match(/<FixtureMatchDayScreen[\s\S]*?\/>/)?.[0] ?? '';

    expect(app.match(/clubKit=\{store\.career\.clubKit\}/g)).toHaveLength(3);
    expect(matchday).toContainSource('clubKit={store.career.clubKit}');
    expect(app.match(/clubKitChoice=\{store\.career\.clubKit\}/g)).toHaveLength(
      1,
    );
  });

  it('uses the saved kit in the awakening cutscene atlas', () => {
    const awakening = source('src/ui/screens/AwakeningCutsceneScreen.tsx');

    expect(awakening).toContainSource(
      "const plan = useClubKit().planFor('r');",
    );
    expect(awakening).toContainSource(
      'buildSpriteAtlas(Skia, cutsceneVisualIds, plan)',
    );
  });

  it('pins the saved kit to match-day portraits', () => {
    const matchday = source('src/ui/screens/FixtureMatchDayScreen.tsx');
    const fixtureCard =
      matchday.match(
        /const fixtureCard = \(([\s\S]*?)\n  const teamSheet =/,
      )?.[1] ?? '';
    const teamSheet =
      matchday.match(
        /const teamSheet = \(([\s\S]*?)\n  const matchOrderRow =/,
      )?.[1] ?? '';

    expect(matchday).toContainSource('clubKit: ClubKitChoice | undefined;');
    expect(matchday).toContainSource('<ClubKitProvider kit={clubKit}>');
    expect(teamSheet).not.toContainSource('stockKit');
    expect(fixtureCard).toContainSource('stockKit');
  });
});
