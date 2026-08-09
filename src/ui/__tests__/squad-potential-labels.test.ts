import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('squad potential labels', () => {
  it('uses compact phone headers and explains potential as the SUPER session chance', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/screens/SquadTrainingScreen.tsx'),
      'utf8',
    );

    expect(source).toContainSource('useWindowDimensions');
    // The wide/phone split is still the point of this assertion; the labels
    // themselves moved into the catalog as `col.squad.*`, so the check is that
    // the screen still picks a different KEY per layout rather than that it
    // types a different English word. squad-register-columns.test.ts owns the
    // "no literal label survives" half, and i18n gate 8b measures the
    // translations against the columns they have to fit.
    expect(source).toContainSource(
      "t(wideColumns ? 'col.squad.score' : 'col.squad.overall')",
    );
    expect(source).toContainSource(
      "t(wideColumns ? 'col.squad.potentialLong' : 'col.squad.potential')",
    );
    expect(source).toContainSource(
      "t(wideColumns ? 'col.squad.conditionLong' : 'col.squad.condition')",
    );
    // The + button speaks for itself; the clipped "Train" header is gone.
    expect(source).not.toContainSource('>Train</PixelText>');
    expect(source).toContainSource('player.potentialGrade');
    expect(source).toContainSource("t('squadTraining.potentialAndSuper', {");
    expect(source).toContainSource(
      'percent: selectedPlayer.superChancePercent,',
    );
    expect(source).toContainSource('selectedPlayer.positionTrainingLabel');
    expect(source).not.toContainSource(
      'Projected max ${selectedPlayer.projectedOverall}',
    );
    expect(source).not.toContainSource('player.remainingPotential');
  });

  /**
   * The player file prints four numbers a manager is expected to act on and
   * nothing on the card says what any of them do. Potential is the sharpest
   * case: its value is wider than its box, so "C+ · 5% SU…" is all the card can
   * ever show — the tip is the only place the full line exists.
   */
  it('explains condition, potential, fame and morale on the player file', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/screens/SquadTrainingScreen.tsx'),
      'utf8',
    );
    const copy = JSON.parse(
      readFileSync(join(process.cwd(), 'content/i18n/en.json'), 'utf8'),
    ).strings as Record<string, string>;

    for (const key of [
      'squadTraining.column.condition',
      'squadTraining.potentialTip',
      'squadTraining.fameTip',
      'squadTraining.moraleTip',
    ]) {
      expect(source).toContainSource(`text={t('${key}'`);
      expect(copy[key]).toBeDefined();
    }
    // Hover is the desktop half; every tip also has a spoken label, because a
    // phone and a screen reader never see a hover.
    for (const key of [
      'squadTraining.a11y.condition',
      'squadTraining.a11y.potential',
      'squadTraining.a11y.fame',
      'squadTraining.a11y.morale',
    ]) {
      expect(source).toContainSource(`accessibilityLabel={t('${key}'`);
      expect(copy[key]).toBeDefined();
    }
    // The clipped value is spelled out in full inside the bubble.
    expect(copy['squadTraining.potentialTip']).toContainSource(
      '{grade} · {percent}% SUPER',
    );
  });

  it('always reserves enough fixed space to show the full player position', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/screens/SquadTrainingScreen.tsx'),
      'utf8',
    );

    // The role column is one measured width shared by the header and the cells
    // under it. It used to be two — `w-12` above `width: 48` — which put the
    // POS heading 6pt left of the positions it labelled, because a rem is
    // React Native's 14pt on native and `w-12` is therefore 42pt, not 48.
    expect(source).toContainSource(
      'role: { width: REGISTER_COLUMN_WIDTH.phone.role, flexShrink: 0 }',
    );
    expect(source).toContainSource(
      'role: { width: REGISTER_COLUMN_WIDTH.wide.role, flexShrink: 0 }',
    );
    expect(source).toMatchSource(
      /<Text[\s\S]*?style=\{columns\.role\}[\s\S]*?adjustsFontSizeToFit[\s\S]*?>\{player\.role\}<\/Text>/,
    );
    expect(source).not.toContainSource("'w-10 font-pixel text-sm text-ink'");
    expect(source).not.toContainSource(
      "'w-10 font-pixel text-sm text-blue-dark'",
    );
    // Widths are derived, not chosen: see squad-register-columns.ts and the
    // test beside it, which re-runs the arithmetic for every column.
    expect(source).toContainSource(
      "const headerLabelSize = wideColumns ? 'text-xs' : 'text-[10px]';",
    );
    expect(source).toContainSource("const ROSTER_TRAIN_COLUMN_CLASS = 'w-11';");
    expect(source).toContainSource(
      '<View className={ROSTER_TRAIN_COLUMN_CLASS} />',
    );
    expect(source).toContainSource(
      "'relative ml-1 h-10 w-10 items-center justify-center rounded-full",
    );
    // 35pt of circle plus hitSlop, summed and checked in squad-register-columns.
    expect(source).toContainSource('hitSlop={TRAIN_BUTTON_HIT_SLOP}');
  });
});
