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

    // One predicate for the glow and the drop, so they cannot disagree — and
    // one `active` card, carried or picked, so a tap lights the same partners a
    // drag does.
    expect(source).toContain('const active = drag ?? picked;');
    expect(source).toContain('lit={active !== null && active.id !== id && isEligible(active, id)}');
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

  it('keeps mobile tap-only so dragging the list always scrolls', () => {
    const source = board();

    // The narrow board never attaches pan handlers, so a swipe belongs wholly
    // to the ScrollView. Its cards use Pressable's normal tap cancellation.
    expect(source).toContain('dragEnabled={wide}');
    expect(source).toContain('{...(dragEnabled ? responder.panHandlers : {})}');
    expect(source).toContain('onPress={dragEnabled ? undefined : tap}');
    expect(source).not.toContain('holdToLift');
    expect(source).not.toContain('LIFT_DELAY_MS');
    expect(source).not.toContain('liftTimer');
    // Wide pointer dragging still distinguishes a click from a travelled drop.
    expect(source).toContain(
      'const still = Math.abs(gesture.dx) <= TAP_SLOP && Math.abs(gesture.dy) <= TAP_SLOP;',
    );
    expect(source).toMatch(/if \(still\) \{\s*pick\(from\);/);
    expect(source).toContain('if (dropping) drop(from, gesture.moveX, gesture.moveY);');
  });

  it('reads its handlers from a ref so a second swap cannot erase the first', () => {
    const source = board();

    // PanResponder.create runs once. Closing over props would capture the plan
    // from the first render, and applySwap against that stale plan would drop
    // every swap staged before it.
    expect(source).toContain('const latest = useRef({ source, onDragStart, onDragMove, onDragEnd, onDrop, onTap, dragEnabled })');
    expect(source).toContain('latest.current = { source, onDragStart, onDragMove, onDragEnd, onDrop, onTap, dragEnabled }');
    expect(source).toContain('latest.current.onDragStart(latest.current.source)');
    expect(source).toContain('const { source: from, onDrop: drop, onTap: pick } = latest.current;');
    // The tap path goes through the same ref, so an activation cannot stage a
    // swap against a plan from an earlier render either.
    expect(source).toContain('const tap = useCallback(() => latest.current.onTap(latest.current.source), []);');
    // Every handler the responder calls has to come back through the ref.
    expect(source).not.toMatch(/onPanResponder\w+: \([^)]*\) => \{[^}]*\bonDrag(Start|Move|End)\(/);
  });

  it('can be worked without a pointer at all', () => {
    const source = board();

    // The cards have always announced themselves as buttons. Dragging is a
    // pointer skill, so activation has to reach the same trade from a click, a
    // keyboard, or a screen reader.
    expect(source).toContain('onAccessibilityTap={dragEnabled ? tap : undefined}');
    expect(source).toContain('{...keyboardActivation(tap)}');
    expect(source).toContain("if (event.key !== 'Enter' && event.key !== ' ') return;");
    expect(source).toContain('focusable');
    expect(source).toContain('accessibilityState={{ selected: picked }}');
    // aria-selected is invalid on role="button", so the web silently drops that
    // state — the label is the only place the pick is announced everywhere.
    expect(source).toContain('accessibilityLabel={picked ? `${accessibilityLabel}, picked` : accessibilityLabel}');
    // Every card carries the action in a hint rather than burying "hold and
    // drag" in the name a screen reader reads out first.
    expect(source).toContain('accessibilityHint={picked?.id === id');
    expect(source).not.toContain('Hold and drag onto');

    // Two taps make a trade, a repeat tap takes it back, and any other card
    // becomes the new pick — no dead ends.
    expect(source).toContain('if (isEligible(current, source.id)) {');
    expect(source).toContain('resolveDrop(current, source.id);');
    expect(source).toContain('if (current.id === source.id) {');
    expect(source).toContain("'TAP A PLAYER, THEN TAP THEIR REPLACEMENT'");
  });

  it('keeps dragging as a wide pointer affordance only', () => {
    const source = board();

    // A mouse/pointer lifts on movement. Mobile never receives the responder.
    expect(source).toContain('onStartShouldSetPanResponder: () => latest.current.dragEnabled');
    expect(source).toContain('lift();');
    expect(source).toContain('dragEnabled: boolean;');
  });

  it('guides the exact tired starter without changing either input model', () => {
    const source = board();

    expect(source).toContain('guideFieldPlayer?: number;');
    expect(source).toContain('const guideCardId: CardId | null = guideFieldPlayer === undefined');
    expect(source).toContain('const guided = id === guideCardId;');
    expect(source).toContain("guideLabel={guided ? (wide ? 'Click and drag' : 'Tap') : undefined}");
    expect(source).toContain('onPress={dragEnabled ? undefined : tap}');
    expect(source).toContain('onStartShouldSetPanResponder: () => latest.current.dragEnabled');
    expect(source).toContain('if (source.id === guideCardId || target === guideCardId)');
  });

  it('keeps the title and substitution count on one row on a phone', () => {
    const source = board();

    expect(source).toContain('style={styles.titleRow}');
    expect(source).toContain('numberOfLines={1}');
    expect(source).toContain('adjustsFontSizeToFit');
    expect(source).toContain('style={[styles.title, wide ? null : styles.titleNarrow]}');
    expect(source).toContain('titleNarrow: { fontSize: 18 }');
  });

  it('promises the trade on the card actually under the carried one', () => {
    const source = board();

    // The badge and the drop must agree, so both go through cardAt.
    expect(source).toContain('onDragMove: (source: DragSource, pageX: number, pageY: number) => {');
    expect(source).toContain('const over = cardAt(pageX, pageY);');
    expect(source).toContain('isEligible(source, over) ? over : null');
    expect(source).toContain("hint={dropTarget === id ? 'SWAP' : null}");
    // Putting a leaver back is not a swap, so it says what it really does.
    expect(source).toContain("hint={dropTarget === id ? 'KEEP ON' : null}");
    expect(source).toContain('dropHint:');
    // Text alone is not enough: the target itself has to read as chosen, and
    // has to out-shout the softer ring every eligible card already wears.
    expect(source).toContain('hint === null ? null : styles.cardTargeted');
    expect(source).toContain('cardTargeted:');
  });

  it('raises the column a card is carried out of, and lights cards under the pointer', () => {
    const source = board();

    // zIndex only orders siblings: without raising the column, a starter dragged
    // toward the bench slid under the bench column, which paints after it.
    expect(source).toContain('columnCarrying');
    expect(source).toContain("drag?.kind === 'field' ? styles.columnCarrying : null");
    expect(source).toContain('onPointerEnter={() => setHovered(true)}');
    expect(source).toContain('onPointerLeave={() => setHovered(false)}');
    expect(source).toContain('cardHovered');
    // Rest, hover, carried — one value, so two animations cannot fight.
    expect(source).toContain('outputRange: [1, 1.02, 1.06]');
  });

  it('shows the bench on the same energy scale as the field', () => {
    const source = board();

    // A bare "100%" beside a row of bars asks the eye to compare a number with
    // a bar; the bench draws its own full green track instead.
    expect(source).toContain('backgroundColor: ENERGY_FILL_COLORS.green');
    expect(source.match(/styles\.energyTrack/g)?.length).toBe(2);
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
    // The player coming on keeps the old swapped-shirt cue: a dashed blue
    // frame and light tint, while ordinary field cards retain the solid frame.
    expect(source).toContain(': [styles.card, styles.cardSwapped]');
    expect(source).toContain('cardSwapped:');
    expect(source).toContain("borderStyle: 'dashed'");
    expect(source).toContain("backgroundColor: 'rgba(90,143,214,0.12)'");
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
    expect(source).toContain('disabled={!saveable}');
    expect(source).toContain('onSave(planInputs(plan), draftAutoSubs)');
    // AUTO is part of the board's draft: toggling it lights SAVE, Cancel
    // discards it, and Reset restores the value the board opened with.
    expect(source).toContain('const [draftAutoSubs, setDraftAutoSubs] = useState(autoSubs)');
    expect(source).toContain('const saveable = canSave(plan) || autoChanged;');
    expect(source).toContain('setDraftAutoSubs(autoSubs);');
  });

  it('keeps all three footer labels on one line at phone text sizes', () => {
    const source = board();
    const lozenge = source.match(/function LozengeButton\(([\s\S]*?)\n}\n\n\/\*\*/)?.[1] ?? '';

    expect(lozenge).toContain('adjustsFontSizeToFit');
    expect(lozenge).toContain('numberOfLines={1}');
    expect(lozenge).toContain('style={styles.buttonLabel}');
    expect(source).toMatch(
      /buttonLabel: \{[\s\S]{0,180}?fontSize: 13,/,
    );
  });

  it('color-codes player names by position while leaving the role label readable', () => {
    const source = board();

    expect(source).toContain("FWD: { color: '#a83440' }");
    expect(source).toContain("DEF: { color: '#3f6fb5' }");
    expect(source).toContain("GK: { color: '#3f8a4a' }");
    expect(source).toContain("MID: { color: '#5b3a91' }");
    expect(source).toContain('POSITION_NAME_STYLE[incoming?.role ?? player.role]');
    expect(source).toContain('POSITION_NAME_STYLE[entry.sub.role]');
    expect(source).toContain('POSITION_NAME_STYLE[entry.starter.role]');
    expect(source).toContain('<Text style={styles.role}> {incoming?.role ?? player.role}</Text>');
    expect(source).toContain('<Text style={styles.role}> {entry.sub.role}</Text>');
  });

  it('makes a greyed-out lozenge inert, not just labelled as one', () => {
    const source = board();

    // accessibilityState alone announces "disabled" while the press still lands:
    // a greyed RESET clicked and a greyed SAVE warned. The Pressable needs the
    // prop itself, the way ActionButton pairs them.
    expect(source).toMatch(/accessibilityState=\{\{ disabled \}\}[\s\S]{0,240}?\n {6}disabled=\{disabled\}/);
    // One owner for the press cue: SfxPressable clicks, so reset must not too.
    // Asserted against the body rather than the first statement, because reset
    // also drops any half-finished tap pick — that is state, not a cue.
    const resetBody = source.match(
      /const reset = useCallback\(\(\) => \{([\s\S]*?)\}, \[autoSubs\]\);/,
    )?.[1] ?? '';
    expect(resetBody).toContain('setPlan(EMPTY_SUBSTITUTION_PLAN)');
    expect(resetBody).toContain('setPicked(null)');
    expect(resetBody).not.toContain('playUiClickSfx');
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
