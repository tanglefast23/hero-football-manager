import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('first-hire screen copy', () => {
  const source = readFileSync(join(process.cwd(), 'src/ui/screens/CharacterCreationScreen.tsx'), 'utf8');

  it('keeps difficulty labels simple', () => {
    expect(source).toContain("['COZY', 'Casual mode']");
    expect(source).toContain("['CHAIRMAN', 'Expert mode']");
    expect(source).not.toContain('First-season wage subsidy');
    expect(source).not.toContain('No wage subsidy');
  });

  it('introduces the recruit through Bert instead of the header blurb', () => {
    expect(source).toContain('Bert Rudge');
    // Title stays two words so it fits one line beside the panel header.
    expect(source).toContain('title="Registration note"');
    expect(source).toContain('Eighteen, plays up front');
    expect(source).not.toContain('A solid D5');
  });

  it('offers both directions on every paper-doll choice', () => {
    expect(source).toContain('onPrevious');
    expect(source).toContain('Previous');
    // every cycler must pass both handlers, so neither direction is forgotten
    expect(source.match(/onPrevious=/g)?.length).toBe(3);
    expect(source.match(/onNext=/g)?.length).toBe(3);
  });

  it('labels the registration panel simply', () => {
    expect(source).toContain('title="Name"');
    expect(source).not.toContain('Name on the shirt');
  });

  it('announces the current value on every stepper button', () => {
    expect(source).toContain('currently ${value}');
    // no stepper may announce itself without its value
    expect(source).not.toMatch(/accessibilityLabel=\{`(Previous|Next) \$\{label\}`\}/);
    expect(source).not.toMatch(/accessibilityLabel=\{`(Decrease|Increase) \$\{copy\.label\}`\}/);
  });

  it('cycles appearance through one shared helper', () => {
    expect(source).toContain('function cycleAppearance');
    expect(source.match(/cycleAppearance\('/g)?.length).toBe(6);
    // the duplicated inline spread closures are gone
    expect(source).not.toContain('setAppearance(current => ({ ...current, skinTone:');
  });
});
