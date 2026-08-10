import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const root = process.cwd();

function source(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

function typescriptReactFiles(directory: string): string[] {
  return readdirSync(join(root, directory)).flatMap((name) => {
    const path = join(directory, name);
    return statSync(join(root, path)).isDirectory()
      ? typescriptReactFiles(path)
      : path.endsWith('.tsx')
        ? [path]
        : [];
  });
}

describe('cross-platform modal coverage', () => {
  it('keeps every shipped modal off the react-native-web portal', () => {
    const nativeWrapper = 'src/ui/components/CrossPlatformModal.tsx';
    const webWrapper = 'src/ui/components/CrossPlatformModal.web.tsx';
    const offenders = ['App.tsx', ...typescriptReactFiles('src')]
      .filter((path) => path !== nativeWrapper && path !== webWrapper)
      .filter((path) =>
        (
          source(path).match(/import\s*{[\s\S]*?}\s*from 'react-native';/g) ??
          []
        ).some((statement) => /\bModal\b/.test(statement)),
      )
      .map((path) => relative(root, join(root, path)));

    expect(offenders).toEqual([]);
    expect(source(nativeWrapper)).toContain(
      "import { Modal, type ModalProps } from 'react-native';",
    );
    expect(source(webWrapper)).toContain("position: 'fixed'");
    expect(source(webWrapper)).toContain('createPortal(');
    expect(source(webWrapper)).toContain("event.key === 'Escape'");
    expect(source(webWrapper)).toContain("setAttribute('inert', '')");
    expect(source(webWrapper)).toContain("setAttribute('aria-hidden', 'true')");
    expect(source(webWrapper)).toContain('visibleWebModalCount += 1');
    expect(source(webWrapper)).toContain('visibleWebModalCount - 1');
  });
});
