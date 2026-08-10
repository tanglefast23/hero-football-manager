import { readFileSync } from 'fs';
import { join } from 'path';

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), 'utf8');

describe('the post-match Financial Report layer', () => {
  it('uses the platform-safe full-screen modal wrapper', () => {
    const summary = source('src/ui/PostMatchSummaryModal.tsx');

    expect(summary).toContain(
      "import { CrossPlatformModal as Modal } from './components/CrossPlatformModal';",
    );
    expect(summary).toContain('style={styles.safeArea}');
  });

  it('puts the report outside the disabled management-screen subtree', () => {
    const app = source('App.tsx');

    expect(app).toMatch(
      /const backgroundInteractionBlocked =\s*pendingConfirmation !== null \|\|\s*blockingSaveWarningVisible \|\|\s*postMatchSummaryVisible;/,
    );
    expect(app).toMatch(
      /<View\s+className="flex-1"\s+pointerEvents=\{backgroundInteractionBlocked[\s\S]*?<\/View>\s*\{postMatchSummaryVisible && store\.postMatch !== null \? \(\s*<PostMatchSummaryModal/,
    );
  });
});
