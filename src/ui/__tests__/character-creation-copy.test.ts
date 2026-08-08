import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCatalog } from '../../i18n';

const DIFFICULTY_KEY = {
  CHAIRMAN: 'characterCreation.expertMode',
  COZY: 'characterCreation.casualMode',
} as const;

describe('first-hire screen copy', () => {
  const source = readFileSync(join(process.cwd(), 'src/ui/screens/CharacterCreationScreen.tsx'), 'utf8');

  it('keeps difficulty labels simple', () => {
    const strings = loadCatalog('en').strings;
    expect(strings[DIFFICULTY_KEY.COZY]).toBe('Casual mode');
    expect(strings[DIFFICULTY_KEY.CHAIRMAN]).toBe('Expert mode');
    expect(source).not.toContain('First-season wage subsidy');
    expect(source).not.toContain('No wage subsidy');
  });

  it('leads with Chairman and offers Cozy as the alternative below it', () => {
    // Chairman is the default career, so it is the option the list opens on;
    // Cozy is the one you step down to. Order carries that, not just the label.
    expect(source.indexOf("'CHAIRMAN'")).toBeLessThan(source.indexOf("'COZY'"));
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
    expect(source).toContain("t('creation.rookieTerms')");
    expect(loadCatalog('en').strings['creation.rookieTerms']).toBe('$180 / week · 1 season');
  });

  it('labels the registration panel simply', () => {
    expect(source).toContain("title={t('characterCreation.name')}");
    expect(loadCatalog('en').strings['characterCreation.name']).toBe('Name');
    expect(source).not.toContain('Name on the shirt');
  });

  it('announces the current value on every stepper button', () => {
    const strings = loadCatalog('en').strings;
    for (const key of [
      'characterCreation.a11y.decreaseStat',
      'characterCreation.a11y.increaseStat',
      'characterCreation.a11y.previousChoice',
      'characterCreation.a11y.nextChoice',
    ]) {
      expect(source).toContain(`t('${key}'`);
      expect(strings[key]).toContain('currently {value}');
    }
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
    const pressInBody = /onPressIn=\{event => \{([\s\S]*?)onPressIn\?\.\(event\);/.exec(pressable)?.[1];
    const pressBody = /onPress=\{onPress == null \? undefined : event => \{([\s\S]*?)onPress\(event\);/.exec(pressable)?.[1];
    // The stepper is heard as the finger goes down, and the completed press
    // keeps an owner of its own because a keyboard activation has no press-in
    // phase to cue from. Both routes go through the one helper below, so an
    // activation cannot make the sound twice however it arrived.
    expect(pressInBody).toContain('cueGate.pressIn(() => playPressCue(pressSfx));');
    expect(pressBody).toContain('cueGate.press(() => playPressCue(pressSfx));');
    expect(pressable).toContain("if (pressSfx === 'stat-step') playStatStepSfx();");
    expect(pressable.match(/playStatStepSfx\(\)/g)).toHaveLength(1);
  });

  it('enters creation with one short navigation click and no trailing celebration', () => {
    const welcome = readFileSync(
      join(process.cwd(), 'src/ui/screens/NewGameWelcomeScreen.tsx'),
      'utf8',
    );
    expect(welcome).toContain("pressSfx={hasSavedCareer ? 'danger' : 'click'}");
  });

  it('cycles appearance through one shared helper', () => {
    expect(source).toContain('function cycleAppearance');
    expect(source.match(/cycleAppearance\('/g)?.length).toBe(6);
    // the duplicated inline spread closures are gone
    expect(source).not.toContain('setAppearance(current => ({ ...current, skinTone:');
  });

  it('requires every creation point to be spent before signing', () => {
    expect(source).toContain('const canSubmit = hasValidName && pointsRemaining === 0;');
    expect(source).toContain("t('characterCreation.spendBeforeSigning'");
    expect(loadCatalog('en').strings['characterCreation.spendBeforeSigning.other'])
      .toBe('Spend {count} more points before signing.');
    expect(source).toContain('const [submitAttempted, setSubmitAttempted] = useState(false);');
    expect(source).toContain('!canSubmit && submitAttempted');
    expect(source).toContain('setSubmitAttempted(true);');
    expect(source).not.toContain('disabled={!canSubmit}');
    expect(source).not.toContain('Points can stay unspent.');
  });

  it('offers the club its own name, pre-filled and optional', () => {
    const strings = loadCatalog('en').strings;
    expect(strings['characterCreation.teamName']).toBe('Team name (optional)');
    // Pre-filled with the club's own name, so a manager who likes it walks past
    // the field; the placeholder repeats it for anyone who clears it.
    expect(source).toContain('useState(defaultClubName)');
    expect(source).toContain('placeholder={defaultClubName}');
    // Blank means "leave it alone" — the engine drops an undefined name rather
    // than writing the default over itself.
    expect(source).toContain("clubName: clubName.trim() === '' ? undefined : clubName,");
  });

  it('opens the rename sheet from the registration card and carries its result', () => {
    const strings = loadCatalog('en').strings;
    expect(strings['characterCreation.teammateNames']).toBe("Teammate's Names (Optional):");
    expect(strings['characterCreation.renameRoster']).toBe('Rename roster');
    expect(source).toContain('<View className="mt-3 border-t-2 border-ink/15 pt-3">');
    expect(source).toMatch(
      /<View className="flex-row items-center gap-2">[\s\S]*?characterCreation\.teammateNames[\s\S]*?<ActionButton/,
    );
    expect(source).toContain("t('characterCreation.renameRoster')");
    expect(source).toContain('<RosterRenameModal');
    // Saved renames survive a reopen, so a second visit edits rather than
    // starting the whole squad again.
    expect(source).toContain('renames={rosterNames}');
    expect(source).toContain('rosterNames,');
  });

  it('parks the caret in the name field on desktop only', () => {
    // A hovering pointer AND the wide layout. `Platform.OS === 'web'` plus
    // `wide` was not enough: a landscape iPad is both, and it opened this
    // screen with the on-screen keyboard already over the form and the name
    // field already selected.
    expect(source).toContain(
      "if (!hasHoverPointer() || !wide || typeof document === 'undefined') return;",
    );
    expect(source).not.toContain("Platform.OS !== 'web' || !wide");
    // Focused by id, not by ref: NativeWind's wrapper never hands a ref down to
    // the input, so ref.current stays null and the caret never lands.
    // `id`, not the legacy `nativeID` — react-native-web drops the latter and
    // the input rendered with no id at all, so getElementById found nothing.
    expect(source).toContain('id={NAME_FIELD_ID}');
    expect(source).not.toContain('nativeID={NAME_FIELD_ID}');
    expect(source).toContain('document.getElementById(NAME_FIELD_ID)?.focus({ preventScroll: true })');
  });
});

describe('roster rename sheet', () => {
  const source = readFileSync(join(process.cwd(), 'src/ui/RosterRenameModal.tsx'), 'utf8');

  it('empties a field on its first tap and never again', () => {
    // The whole point of the sheet is that renaming costs one tap and a word.
    // Clearing on EVERY focus would wipe a finished name the moment a finger
    // landed back on it, so the clear is one-shot per field.
    expect(source).toContain('if (cleared[player.id] === true) return;');
    expect(source).toContain("setDrafts(current => ({ ...current, [player.id]: '' }));");
    // The name it dropped stays visible, so nothing is lost by tapping in.
    expect(source).toContain('placeholder={player.name}');
  });

  it('keeps a blank field s original name and reports only real changes', () => {
    expect(source).toContain('if (typed.length > 0 && typed !== player.name) saved[player.id] = typed;');
  });

  it('blocks the save on a name too short to print, and says so', () => {
    expect(loadCatalog('en').strings['rosterRename.tooShort'])
      .toBe('Every name needs at least {min} characters.');
    expect(source).toContain('typed.length > 0 && typed.length < TYPED_NAME_MIN_LENGTH');
    expect(source).toContain('setSaveAttempted(true);');
  });

  it('offers both a save and a way out', () => {
    const strings = loadCatalog('en').strings;
    expect(strings['rosterRename.save']).toBe('Save');
    expect(strings['rosterRename.cancel']).toBe('Cancel');
    expect(source).toContain("t('rosterRename.save')");
    expect(source).toContain("t('rosterRename.cancel')");
  });
});
