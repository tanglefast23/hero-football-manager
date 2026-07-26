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

  it('has two columns and nothing else — no bench furniture, no assistant', () => {
    const source = board();

    expect(source).toContain('>FIELD<');
    expect(source).toContain('>BENCH<');
    expect(source).toContain('MOST TIRED FIRST');
    // The pixel bench strip and Bert are both gone: every swap is a straight
    // trade, so there is no third zone and nothing to explain.
    expect(source).not.toContain('BenchArt');
    expect(source).not.toContain('benchShadow');
    expect(source).not.toContain('BertFullBody');
    expect(source).not.toContain('BERT RUDGE');
  });

  it('lights up exactly what a drop would accept', () => {
    const source = board();

    // One predicate for the glow and the drop, so they cannot disagree.
    expect(source).toContain('lit={drag !== null && drag.id !== id && isEligible(drag, id)}');
    expect(source).toContain('if (target === null || !isEligible(source, target)) return;');
    expect(source).toContain('canSwap(plan, starter, sub, substitutionsRemaining)');
    // Blue, never gold: docs/08 reserves the gold accent for hero and power.
    expect(source).toContain('cardLit');
    expect(source).toContain("borderColor: '#3f6fb5'");
    expect(source).toContain("boxShadow: '0 0 0 3px rgba(90, 143, 214, 0.45)'");
    expect(source).not.toContain('DashPathEffect');
    expect(source).not.toContain('#edb54a');
    expect(source).not.toContain('#c8862a');
  });

  it('scrolls the list unless a card is held, and never drags on contact', () => {
    const source = board();

    // A card that lifted on contact would swallow every swipe and leave a phone
    // list unscrollable, so lifting takes a hold and the list may take the
    // gesture back until then.
    expect(source).toContain('const LIFT_DELAY_MS = 180');
    expect(source).toContain('onPanResponderTerminationRequest: () => !liftedRef.current');
    expect(source).toContain('liftTimer.current = setTimeout(');
    expect(source).toContain('if (!liftedRef.current) {');
    // Only a lifted card drops; a tap is deliberately nothing.
    expect(source).toContain('if (dropping) drop(from, gesture.moveX, gesture.moveY);');
  });

  it('reads its handlers from a ref so a second swap cannot erase the first', () => {
    const source = board();

    // PanResponder.create runs once. Closing over props would capture the plan
    // from the first render, and applySwap against that stale plan would drop
    // every swap staged before it.
    expect(source).toContain('const latest = useRef({ source, onDragStart, onDragEnd, onDrop })');
    expect(source).toContain('latest.current = { source, onDragStart, onDragEnd, onDrop }');
    expect(source).toContain('latest.current.onDragStart(latest.current.source)');
    expect(source).toContain('const { source: from, onDrop: drop } = latest.current;');
  });

  it('measures drop targets when the drag starts, not when they lay out', () => {
    const source = board();

    // The board scrolls, so a rect captured at layout time would be stale.
    expect(source).toContain('const measureCards');
    expect(source).toContain('measureInWindow');
    expect(source).toContain('onDragStart: (source: DragSource) => {');
    expect(source).toContain('measureCards();');
    expect(source).toContain('cardAt(pageX, pageY)');
  });

  it('keeps a traded starter dimmed on the bench and only accepts their partner back', () => {
    const source = board();

    expect(source).toContain('cardDimmed');
    expect(source).toContain('COMING OFF');
    // A swapped shirt is the same box as any other card — no dotted border, no
    // tinted background. Only its contents differ.
    expect(source).not.toContain('cardSwapped');
    expect(source).not.toContain("borderStyle: 'dashed'");
    expect(source).toContain('benchEntries');
    // A leaver's card takes the drop that undoes its own swap and nothing else.
    expect(source).toContain('return target === `field:${source.slot}`;');
    expect(source).toContain('undoSwap');
  });

  it('explains what is unavailable instead of refusing in silence', () => {
    const source = board();

    // docs/08's interaction feedback contract: disabled things say why.
    expect(source).toContain('budgetNote');
    expect(source).toContain('ineligibleTag(');
    expect(source).toContain('atLimit ? styles.counterSpent : null');
    expect(source).toContain('atLimit ? styles.noteSpent : null');
    expect(source).toContain("accessibilityRole=\"alert\"");
  });

  it('dresses to the pixel bible: cream canvas, ink structure, Track A buttons', () => {
    const source = board();

    // 60% warm cream, 30% ink structure (docs/08 design language).
    expect(source).toContain("const PAPER = '#f4f1ea'");
    expect(source).toContain("const INK = '#241f2e'");
    // Track A lozenge: 2px outline, chunky corner, gloss band, darker lip.
    expect(source).toContain('function LozengeButton');
    expect(source).toContain('borderBottomWidth: 5');
    expect(source).toContain("gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: '40%' }");
    expect(source).toContain('pressed && !disabled ? null : <View style={[styles.gloss, gloss]} />');
    expect(source).toContain('translateY: pressed && !disabled ? 2 : 0');
    // Four type sizes, two weights (docs/08).
    expect(source).toContain('fontSize: 24');
    expect(source).toContain('fontSize: 18');
    expect(source).toContain('fontSize: 15');
    expect(source).toContain('fontSize: 13');
    expect(source).not.toContain('fontSize: 14');
    expect(source).not.toContain('fontSize: 11');
  });

  it('offers cancel, reset and save', () => {
    const source = board();

    expect(source).toContain('label="CANCEL"');
    expect(source).toContain('label="RESET"');
    // Just SAVE: the header counter says how many, the cards say which.
    expect(source).toContain('label="SAVE"');
    expect(source).not.toContain('SAVE{staged');
    // Blue for confirm, grey for secondary and disabled (docs/08 colour meaning).
    expect(source).toContain('tone="blue"');
    expect(source).toContain('tone="grey"');
    expect(source).toContain('setPlan(EMPTY_SUBSTITUTION_PLAN)');
    expect(source).toContain('onPress={onCancel}');
    expect(source).toContain('onPress={reset}');
    expect(source).toContain('disabled={staged === 0}');
    expect(source).toContain('onSave(planInputs(plan))');
  });

  it('lists two names per row on a phone', () => {
    const source = board();

    expect(source).toContain("grid: { flexDirection: 'row', flexWrap: 'wrap'");
    expect(source).toContain("gridCell: { width: '48.5%'");
    expect(source).toContain('wide ? undefined : styles.grid');
    expect(source).toContain('compactName(');
  });
});

describe('match screen wiring', () => {
  it('commits one recorded SUBSTITUTE input per staged pair', () => {
    const source = matchScreen();

    expect(source).toContain('<SubstitutionBoard');
    expect(source).toContain('onSave={commitSubstitutions}');
    expect(source).toContain('for (const swap of swaps) {');
    expect(source).toContain("kind: 'SUBSTITUTE'");
    expect(source).toContain('tick: match.tick + 1');
    expect(source).toContain("console.warn('MatchScreen: the engine rejected a staged substitution'");
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

    expect(source).toContain("automaticPauseReasonsRef.current.add('swap')");
    expect(source).toContain("automaticPauseReasonsRef.current.delete('swap')");
  });
});
