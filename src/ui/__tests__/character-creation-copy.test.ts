import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('first-hire screen copy', () => {
  const source = readFileSync(join(process.cwd(), 'src/ui/screens/CharacterCreationScreen.tsx'), 'utf8');

  it('keeps difficulty labels simple and removes the redundant Bert note', () => {
    expect(source).toContain("['COZY', 'Casual mode']");
    expect(source).toContain("['CHAIRMAN', 'Expert mode']");
    expect(source).not.toContain('Bert Rudge');
    expect(source).not.toContain('First-season wage subsidy');
    expect(source).not.toContain('No wage subsidy');
  });

  it('offers both directions on every paper-doll choice', () => {
    expect(source).toContain('onPrevious');
    expect(source).toContain('Previous');
    // every cycler must pass both handlers, so neither direction is forgotten
    expect(source.match(/onPrevious=/g)?.length).toBe(3);
    expect(source.match(/onNext=/g)?.length).toBe(3);
  });
});
