import { readFileSync } from 'fs';
import { join } from 'path';

describe('procedural match VFX Dev Harness entry', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/ui/dev-harness/entries/match-vfx.tsx'),
    'utf8',
  );

  it('registers one bookmarkable production-context case per effect', () => {
    const ids = [
      "id: 'slide-tackle'",
      "id: 'standing-tackle'",
      "id: 'hard-shot'",
      "id: 'save-impact'",
      "id: 'power-interruption'",
    ];
    for (const id of ids) expect(source).toContain(id);
    const registry = readFileSync(
      join(process.cwd(), 'src/ui/dev-harness/registry.ts'),
      'utf8',
    );
    expect(registry).toContain(
      "import { matchVfxEntry } from './entries/match-vfx';",
    );
    expect(registry).toContain('liveMatchControlsEntry,\n  matchVfxEntry,');
  });

  it('uses production MatchScreen and remounts on effect, motion, or Replay', () => {
    expect(source).toContain('<MatchScreen');
    expect(source).toContain('matchVfxQa={qa}');
    expect(source).toContain(
      'key={`${selected.kind}:${reduceMotion}:${runKey}`}',
    );
    expect(source).toContain('setRunKey((current) => current + 1)');
    expect(source).toContain(
      'setReduceMotion(false);\n                replay();',
    );
    expect(source).toContain(
      'setReduceMotion(true);\n                replay();',
    );
  });
});
