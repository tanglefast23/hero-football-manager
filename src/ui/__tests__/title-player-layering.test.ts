import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('title-screen player showcase layering', () => {
  const landingSource = readFileSync(
    join(process.cwd(), 'src/ui/screens/TitleLandingScreen.tsx'),
    'utf8',
  );
  const sceneSource = readFileSync(
    join(process.cwd(), 'src/ui/components/TitlePlayerPopScene.tsx'),
    'utf8',
  );

  it('keeps the animated players above the title copy and menu', () => {
    expect(landingSource).toContainSource('<View className="relative z-20">');
    expect(landingSource).toMatchSource(
      /pointerEvents="none" className="absolute [^"]*z-20[^"]*"/,
    );
    expect(landingSource).toMatchSource(
      /<View className="z-10 gap-2 border-\[3px\] border-ink bg-paper p-3">/,
    );
  });

  it('lets entering players remain visible while they cross the menu edge', () => {
    expect(sceneSource).toMatchSource(/scene: \{[\s\S]*?overflow: 'visible'/);
    expect(sceneSource).not.toContainSource(
      'Superpowered football players popping up from behind the menu while using their powers',
    );
  });
});
