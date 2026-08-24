import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), 'utf8');

describe('saved club kit render wiring', () => {
  it('passes the saved kit to watched match presentations', () => {
    const app = source('App.tsx');

    expect(app.match(/clubKit=\{store\.career\.clubKit\}/g)).toHaveLength(2);
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
});
