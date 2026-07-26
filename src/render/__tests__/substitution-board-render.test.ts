import { readFileSync } from 'fs';
import { join } from 'path';

const board = () => readFileSync(join(process.cwd(), 'src/render/SubstitutionBoard.tsx'), 'utf8');
const matchScreen = () => readFileSync(join(process.cwd(), 'src/render/MatchScreen.tsx'), 'utf8');
const styles = () => readFileSync(join(process.cwd(), 'src/render/match-screen-styles.ts'), 'utf8');

describe('substitution board layout', () => {
  it('is a centred modal with padding, never a full-width bar', () => {
    const source = board();

    expect(source).toContain("alignItems: 'center'");
    expect(source).toContain("justifyContent: 'center'");
    expect(source).toContain('padding: 24');
    expect(source).toContain('boardWide: { maxWidth: 920');
    expect(source).toContain('boardNarrow: { maxWidth: 520');
    // The old bar stretched edge to edge and its styles are gone with it.
    expect(styles()).not.toContain('swapSheet:');
    expect(styles()).not.toContain('swapOverlay:');
  });

  it('names the three zones the manager drags between', () => {
    const source = board();

    expect(source).toContain('>FIELD<');
    expect(source).toContain('>SUBSTITUTIONS<');
    expect(source).toContain('>BENCH<');
    expect(source).toContain('MOST TIRED FIRST');
    expect(source).toContain('fieldByTiredness');
    // The bench is a real drop target, drawn as pixel furniture.
    expect(source).toContain('function BenchArt');
    expect(source).toContain('benchShadow');
  });

  it('drags with PanResponder and keeps a tap as the equal path', () => {
    const source = board();

    expect(source).toContain('PanResponder.create');
    expect(source).toContain('onPanResponderRelease');
    expect(source).toContain('zoneAt(gesture.moveX, gesture.moveY)');
    // A short press is a tap: the board does the obvious move for that card.
    expect(source).toContain('const TAP_SLOP = 8');
    expect(source).toContain('onTap()');
    // Hit-testing uses page coordinates, so zones measure in window space.
    expect(source).toContain('measureInWindow');
  });

  it('lets Bert do the directing and the complaining', () => {
    const source = board();

    expect(source).toContain('BertFullBody');
    expect(source).toContain('Drag your tired players down to the bench');
    expect(source).toContain('BERT RUDGE');
    // Rejections and the outstanding problem share his speech bubble.
    expect(source).toContain('SUBSTITUTION_REJECTION_MESSAGES');
    expect(source).toContain('speechProblem');
  });

  it('opens a dotted shirt that names who left it, and marches only when it qualifies', () => {
    const source = board();

    // The border is Skia, because a View's dashed border has no animatable offset.
    expect(source).toContain('DashPathEffect');
    expect(source).toContain('phase={phase}');
    expect(source).toContain('BlurMask');
    expect(source).toContain('DASH_MARCH_PT_PER_SECOND');
    // Only a shirt this substitute could legally fill is armed: keepers with
    // keepers, outfielders with outfielders.
    expect(source).toContain("draggingRole === (player.role === 'GK' ? 'GK' : 'OUTFIELD')");
    expect(source).toContain('incoming === undefined');
    // The shirt states the position on both faces.
    expect(source).toContain('openShirtLabel');
    expect(source).toContain('filledShirtLabel');
    expect(source).toContain('SHIRT · EMPTY');
  });

  it('takes a substitute out of the column once they are in a shirt', () => {
    const source = board();

    expect(source).toContain('bench.filter(player => !isComingOn(plan, player.id))');
    expect(source).toContain('availableBench');
    // Dragging them out of the shirt puts them back and reopens it.
    expect(source).toContain('returnToBench');
    expect(source).toContain("onTap: () => onDrop(filled ? 'subs' : 'field')");
  });

  it('offers cancel, reset and save, and only reset can be a no-op', () => {
    const source = board();

    expect(source).toContain('>CANCEL<');
    expect(source).toContain('>RESET<');
    expect(source).toContain('setPlan(EMPTY_SUBSTITUTION_PLAN)');
    // Cancel closes the board; reset only clears it.
    expect(source).toContain('onPress={onCancel}');
    expect(source).toContain('onPress={reset}');
    expect(source).toContain('disabled={staged === 0}');
  });

  it('lists two names per row on a phone', () => {
    const source = board();

    expect(source).toContain('grid: { flexDirection: \'row\', flexWrap: \'wrap\'');
    expect(source).toContain("gridCell: { width: '48.5%'");
    expect(source).toContain('wide ? null : styles.grid');
    // Compact cells drop the sentence and the portrait to fit half a row.
    expect(source).toContain('compact ? surname(player.name) : player.name');
  });

  it('gates save on a legal plan and never on the button alone', () => {
    const source = board();

    expect(source).toContain('const saveable = canSave(plan, substitutionsRemaining)');
    // Pressing a blocked save explains itself rather than doing nothing.
    expect(source).toContain('if (!saveable) {');
    expect(source).toContain('setMessage(problem)');
    expect(source).toContain('onSave(planInputs(plan))');
  });
});

describe('match screen wiring', () => {
  it('commits one recorded SUBSTITUTE input per staged pair', () => {
    const source = matchScreen();

    expect(source).toContain('<SubstitutionBoard');
    expect(source).toContain('onSave={commitSubstitutions}');
    expect(source).toContain('for (const swap of swaps) {');
    expect(source).toContain("kind: 'SUBSTITUTE'");
    // Every pair lands on the same tick, and one rejection cannot kill the screen.
    expect(source).toContain('tick: match.tick + 1');
    expect(source).toContain('console.warn(\'MatchScreen: the engine rejected a staged substitution\'');
  });

  it('drops the old two-tap selection state entirely', () => {
    const source = matchScreen();

    expect(source).not.toContain('selectedOutgoing');
    expect(source).not.toContain('selectedIncoming');
    expect(source).not.toContain('TAP THE PLAYER COMING OFF');
    expect(source).not.toContain('MAKE SWAP');
  });

  it('keeps the match paused while the board is open', () => {
    const source = matchScreen();

    // The board reads and writes engine state, so nothing may move underneath it.
    expect(source).toContain("automaticPauseReasonsRef.current.add('swap')");
    expect(source).toContain("automaticPauseReasonsRef.current.delete('swap')");
  });
});
