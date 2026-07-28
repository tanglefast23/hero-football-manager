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

  it('starts directly with player creation instead of a Bert note', () => {
    expect(source).not.toContain('Bert Rudge');
    expect(source).not.toContain('title="Registration note"');
    expect(source).not.toContain('Eighteen, plays up front');
    expect(source).not.toContain('A solid D5');
  });

  it('offers both directions on every paper-doll choice', () => {
    expect(source).toContain('onPrevious');
    expect(source).toContain('Previous');
    // every cycler must pass both handlers, so neither direction is forgotten
    expect(source.match(/onPrevious=/g)?.length).toBe(3);
    expect(source.match(/onNext=/g)?.length).toBe(3);
  });

  it('shows each paper-doll value in full inside its fixed cell', () => {
    // "3 / 10" overran the w-16 column and rendered as "3 / …", so the value is
    // unspaced and both cells cap how far system text can scale them.
    expect(source).toContain('formatChoiceValue(appearance.hairstyle, APPEARANCE_OPTIONS.hairstyle)');
    expect(source).not.toMatch(/\$\{appearance\.\w+ \+ 1\} \//);
    expect(source.match(/maxFontSizeMultiplier=\{STEPPER_MAX_FONT_SIZE_MULTIPLIER\}/g)?.length).toBe(2);
  });

  it('cycles every paper-doll control through the shipped option counts', () => {
    // Hair is ten looks, not seven: the counts come from the look atlas so a
    // stepper can never disagree with the art.
    expect(source).toContain("cycleAppearance('hairstyle', 1, APPEARANCE_OPTIONS.hairstyle)");
    expect(source).not.toMatch(/cycleAppearance\('\w+', -?1, \d+\)/);
  });

  it('keeps the registration terms inside the card', () => {
    expect(source).toContain('flex-row flex-wrap items-center justify-between gap-2');
    expect(source).toContain('$180 / week · 1 season');
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

  it('uses the supplied tap sound for appearance and stat adjustment buttons', () => {
    // Two appearance-arrow definitions render 6 buttons; two stat-stepper
    // definitions render 12 more buttons.
    expect(source.match(/pressSfx="stat-step"/g)?.length).toBe(4);
    const pressable = readFileSync(
      join(process.cwd(), 'src/ui/components/SfxPressable.tsx'),
      'utf8',
    );
    expect(pressable).toMatch(/onPressIn=\{event => \{[\s\S]*?pressSfx === 'stat-step'[\s\S]*?playStatStepSfx\(\)/);
    expect(pressable).toContain('Already played on press-in so a release never doubles the cue.');
  });

  it('cycles appearance through one shared helper', () => {
    expect(source).toContain('function cycleAppearance');
    expect(source.match(/cycleAppearance\('/g)?.length).toBe(6);
    // the duplicated inline spread closures are gone
    expect(source).not.toContain('setAppearance(current => ({ ...current, skinTone:');
  });

  it('requires every creation point to be spent before signing', () => {
    expect(source).toContain('const canSubmit = hasValidName && pointsRemaining === 0;');
    expect(source).toContain('Spend ${pointsRemaining} more ${pointLabel} before signing.');
    expect(source).toContain('const [submitAttempted, setSubmitAttempted] = useState(false);');
    expect(source).toContain('!canSubmit && submitAttempted');
    expect(source).toContain('setSubmitAttempted(true);');
    expect(source).not.toContain('disabled={!canSubmit}');
    expect(source).not.toContain('Points can stay unspent.');
  });
});
