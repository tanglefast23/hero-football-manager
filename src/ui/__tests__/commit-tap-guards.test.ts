import { readFileSync } from 'fs';
import { join } from 'path';

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

/**
 * These cover taps that spend the manager's money, training points or an
 * irreversible choice. There is no component renderer in this project, so they
 * assert the wiring at source level the way the rest of the UI suite does.
 */
describe('committing taps are guarded', () => {
  it('spends a Quick Train request once instead of leaving it standing', () => {
    const modal = read('src/ui/TrainingDrillModal.tsx');
    const screen = read('src/ui/screens/SquadTrainingScreen.tsx');

    // The effect re-runs on every new `options` identity, and a resolved drill
    // produces one. Without the consume the confirmation reopened itself after
    // each drill, proposing a spend nobody asked for.
    expect(modal).toContainSource('onQuickTrainConsumed?.();');
    expect(modal).toContainSource(
      '}, [onQuickTrainConsumed, options, quickTrainPathId]);',
    );
    expect(screen).toContainSource(
      'onQuickTrainConsumed={forgetQuickTrainRequest}',
    );
    expect(screen).toContainSource('setQuickTrainPathId(undefined);');
  });

  it('guards the three commits whose button re-renders holding the next decision', () => {
    expect(read('src/ui/screens/MarketScreen.tsx')).toContainSource(
      'onPress={() => guardTap(() => onSubmitContractOffer(',
    );
    expect(read('src/ui/screens/SeasonEndScreen.tsx')).toContainSource(
      'onPress={() => guardTap(() => onRenewContract(',
    );
    expect(read('src/ui/screens/ClubLegacyScreen.tsx')).toContainSource(
      'onPress={() => guardTap(() => onChoose(choice.id))}',
    );
  });

  it('re-arms the match-day hand-off when the store refuses it', () => {
    const source = read('src/ui/screens/FixtureMatchDayScreen.tsx');

    // A blocked save leaves the screen mounted; without the re-arm both Watch
    // and Quick Result stayed dead for that fixture with only Back as a way out.
    expect(source).toContainSource('reArmRef.current = setTimeout(');
    expect(source).toContainSource('handedOffRef.current = false;');
    expect(source).toContainSource(
      'if (reArmRef.current !== null) clearTimeout(reArmRef.current);',
    );
  });

  it('starts the week on the first tap instead of spending it on an animation skip', () => {
    const source = read('src/ui/screens/WeeklyReviewScreen.tsx');

    // The press used to be swallowed for 2.8s after the screen mounted — about
    // twice the longest count-up — so a manager who tapped once the numbers had
    // settled heard the button's chime and stayed on the review.
    expect(source).toContainSource('onPress={onContinue}');
    expect(source).not.toContainSource(
      'setBalanceAnimationsComplete(true);\n  };',
    );
  });

  it('answers a refused management action instead of failing silently', () => {
    const source = read('App.tsx');
    expect(source).toContainSource("playManagementActionSfx('warning');");
    // The confirmation sheet no longer adds a second cue on top of the button's.
    expect(source).not.toContainSource(
      "playManagementActionSfx('select');\n    setPendingConfirmation",
    );
  });

  it('keeps the last-resort database reset from failing in silence', () => {
    expect(read('App.tsx')).toContainSource('The save could not be deleted.');
  });
});
