import { readFileSync } from 'fs';
import { join } from 'path';

const board = () =>
  readFileSync(join(process.cwd(), 'src/render/SubstitutionBoard.tsx'), 'utf8');

/** The desktop cue names both inputs; the labels themselves live in the catalog. */
const GUIDE_LABEL_BOTH_WAYS =
  /guideLabel=\{\s*guided\s*\?\s*wide\s*\?\s*t\('substitutionBoard\.guideClickOrDrag'\)\s*:\s*t\('substitutionBoard\.guideTap'\)\s*:\s*undefined\s*\}/;
const matchScreen = () =>
  readFileSync(join(process.cwd(), 'src/render/MatchScreen.tsx'), 'utf8');
const styles = () =>
  readFileSync(
    join(process.cwd(), 'src/render/match-screen-styles.ts'),
    'utf8',
  );

describe('substitution board layout', () => {
  it('is a centred modal with padding, never a full-width bar', () => {
    const source = board();

    expect(source).toContainSource("alignItems: 'center'");
    expect(source).toContainSource("justifyContent: 'center'");
    expect(source).toContainSource('padding: 24');
    expect(source).toContainSource('boardWide: { maxWidth: 920');
    expect(source).toContainSource('boardNarrow: { maxWidth: 520');
    // The old bar stretched edge to edge and its styles are gone with it.
    expect(styles()).not.toContainSource('swapSheet:');
    expect(styles()).not.toContainSource('swapOverlay:');
  });

  it('has two columns and nothing else — no bench furniture, no assistant', () => {
    const source = board();

    expect(source).toContainSource("{t('substitutionBoard.fieldColumn')}");
    expect(source).toContainSource("{t('substitutionBoard.benchColumn')}");
    expect(source).toContainSource("t('substitutionBoard.mostTiredFirst')");
    // The pixel bench strip and Bert are both gone: every swap is a straight
    // trade, so there is no third zone and nothing to explain.
    expect(source).not.toContainSource('BenchArt');
    expect(source).not.toContainSource('benchShadow');
    expect(source).not.toContainSource('BertFullBody');
    expect(source).not.toContainSource('BERT RUDGE');
  });

  it('lights up exactly what a drop would accept', () => {
    const source = board();

    // One predicate for the glow and the drop, so they cannot disagree — and
    // one `active` card, carried or picked, so a tap lights the same partners a
    // drag does.
    expect(source).toContainSource('const active = drag ?? picked;');
    expect(source).toContainSource(
      'lit={active !== null && active.id !== id && isEligible(active, id)}',
    );
    expect(source).toContainSource(
      'if (target === null || !isEligible(source, target)) return;',
    );
    expect(source).toContainSource(
      'canSwap(plan, starter, sub, substitutionsRemaining)',
    );
    // Blue, never gold: docs/08 reserves the gold accent for hero and power.
    expect(source).toContainSource('cardLit');
    expect(source).toContainSource("borderColor: '#3f6fb5'");
    expect(source).toContainSource(
      "boxShadow: '0 0 0 3px rgba(90, 143, 214, 0.45)'",
    );
    expect(source).not.toContainSource('DashPathEffect');
    expect(source).not.toContainSource('#edb54a');
    expect(source).not.toContainSource('#c8862a');
  });

  it('keeps mobile tap-only so dragging the list always scrolls', () => {
    const source = board();

    // The narrow board never attaches pan handlers, so a swipe belongs wholly
    // to the ScrollView. Its cards use Pressable's normal tap cancellation.
    expect(source).toContainSource('dragEnabled={wide}');
    expect(source).toContainSource(
      '{...(dragEnabled ? responder.panHandlers : { onPress: tap })}',
    );
    expect(source).not.toContainSource('holdToLift');
    expect(source).not.toContainSource('LIFT_DELAY_MS');
    expect(source).not.toContainSource('liftTimer');
    // Wide pointer dragging still distinguishes a click from a travelled drop.
    expect(source).toContainSource(
      'const still = Math.abs(gesture.dx) <= TAP_SLOP && Math.abs(gesture.dy) <= TAP_SLOP;',
    );
    expect(source).toMatchSource(/if \(still\) \{\s*pick\(from\);/);
    expect(source).toContainSource(
      'if (dropping) drop(from, gesture.moveX, gesture.moveY);',
    );
  });

  it('jumps a stacked phone board to the bench after a field player is picked', () => {
    const source = board();

    expect(source).toContainSource(
      'const boardScrollRef = useRef<ScrollView | null>(null);',
    );
    expect(source).toContainSource('ref={boardScrollRef}');
    expect(source).toContainSource(
      'benchTopRef.current = event.nativeEvent.layout.y;',
    );
    expect(source).toContainSource("if (!wide && source.kind === 'field') {");
    expect(source).toContainSource('boardScrollRef.current?.scrollTo({');
    expect(source).toContainSource('y: benchTopRef.current,');
    expect(source).toContainSource('animated: true,');
  });

  it('reads its handlers from a ref so a second swap cannot erase the first', () => {
    const source = board();

    // PanResponder.create runs once. Closing over props would capture the plan
    // from the first render, and applySwap against that stale plan would drop
    // every swap staged before it.
    expect(source).toContainSource(
      'const latest = useRef({ source, onDragStart, onDragMove, onDragEnd, onDrop, onTap, dragEnabled })',
    );
    expect(source).toContainSource(
      'latest.current = { source, onDragStart, onDragMove, onDragEnd, onDrop, onTap, dragEnabled }',
    );
    expect(source).toContainSource(
      'latest.current.onDragStart(latest.current.source)',
    );
    expect(source).toContainSource(
      'const { source: from, onDrop: drop, onTap: pick } = latest.current;',
    );
    // The tap path goes through the same ref, so an activation cannot stage a
    // swap against a plan from an earlier render either.
    expect(source).toContainSource(
      'const tap = useCallback(() => latest.current.onTap(latest.current.source), []);',
    );
    // Every handler the responder calls has to come back through the ref.
    expect(source).not.toMatchSource(
      /onPanResponder\w+: \([^)]*\) => \{[^}]*\bonDrag(Start|Move|End)\(/,
    );
  });

  it('can be worked without a pointer at all', () => {
    const source = board();

    // The cards have always announced themselves as buttons. Dragging is a
    // pointer skill, so activation has to reach the same trade from a click, a
    // keyboard, or a screen reader.
    expect(source).toContainSource(
      'onAccessibilityTap={dragEnabled ? tap : undefined}',
    );
    expect(source).toContainSource('{...keyboardActivation(tap)}');
    expect(source).toContainSource(
      "if (event.key !== 'Enter' && event.key !== ' ') return;",
    );
    expect(source).toContainSource('focusable');
    expect(source).toContainSource('accessibilityState={{ selected: picked }}');
    // aria-selected is invalid on role="button", so the web silently drops that
    // state — the label is the only place the pick is announced everywhere.
    expect(source).toContainSource(
      "t('substitutionBoard.a11y.picked', { label: accessibilityLabel })",
    );
    // Every card carries the action in a hint rather than burying "hold and
    // drag" in the name a screen reader reads out first.
    expect(source).toContainSource('accessibilityHint={picked?.id === id');
    expect(source).not.toContainSource('Hold and drag onto');

    // Two taps make a trade, a repeat tap takes it back, and any other card
    // becomes the new pick — no dead ends.
    expect(source).toContainSource('if (isEligible(current, source.id)) {');
    expect(source).toContainSource('resolveDrop(current, source.id);');
    expect(source).toContainSource('if (current.id === source.id) {');
    expect(source).toContainSource("t('substitutionBoard.hintPickAPlayer')");
  });

  it('keeps dragging as a wide pointer affordance only', () => {
    const source = board();

    // A mouse/pointer lifts on movement. Mobile never receives the responder.
    expect(source).toContainSource(
      'onStartShouldSetPanResponder: () => latest.current.dragEnabled',
    );
    expect(source).toContainSource('lift();');
    expect(source).toContainSource('dragEnabled: boolean;');
  });

  it('never hands the pan responder to a Pressable, which swallows it whole', () => {
    // Not folklore, and not a guess: derive the collision from the library that
    // actually runs the board on a desktop. Pressable spreads its own press
    // handlers AFTER the caller's props, and they cover every responder prop a
    // PanResponder needs — so a Pressable around a drag overwrites the lot and
    // the card answers neither the drag nor the click that ends one.
    const panResponder = require('react-native-web/dist/cjs/exports/PanResponder');
    const pressModule = require('react-native-web/dist/cjs/modules/usePressEvents/PressResponder');
    const PressResponder = pressModule.default ?? pressModule;
    const panKeys: string[] = Object.keys(
      panResponder.create({ onStartShouldSetPanResponder: () => true })
        .panHandlers,
    );
    const pressKeys: string[] = Object.keys(
      new PressResponder({}).getEventHandlers(),
    );

    expect(panKeys.filter((key) => pressKeys.includes(key))).toEqual(
      expect.arrayContaining([
        'onStartShouldSetResponder',
        'onResponderGrant',
        'onResponderMove',
        'onResponderRelease',
      ]),
    );

    // So the card that carries the gesture is a plain Animated.View, and the
    // Pressable stays on mobile, where there is no drag for it to swallow.
    const source = board();
    expect(source).toContainSource(
      'const Shell = dragEnabled ? Animated.View : AnimatedPressable;',
    );
    expect(source).toContainSource(
      '{...(dragEnabled ? responder.panHandlers : { onPress: tap })}',
    );
    // The old wiring: panHandlers spread onto a Pressable, which ate them.
    expect(source).not.toContainSource(
      'onPress={dragEnabled ? undefined : tap}',
    );
    expect(source).not.toContainSource('<AnimatedPressable');
  });

  it('leaves the desktop both ways of making a swap', () => {
    const source = board();

    // Drag a card onto its partner, or click one and click the other: the wide
    // board answers both, and the click arrives as a still release from the
    // very same responder that carries the drag.
    expect(source).toContainSource('if (still) {');
    expect(source).toMatchSource(/if \(still\) \{\s*pick\(from\);/);
    expect(source).toMatchSource(GUIDE_LABEL_BOTH_WAYS);
    // Pressable supplied the pointer cursor on web; a dragged View has to ask.
    expect(source).toContainSource("cardPointer: { cursor: 'pointer' }");
    expect(source).toContainSource('dragEnabled ? styles.cardPointer : null');
  });

  it('guides the exact tired starter without changing either input model', () => {
    const source = board();

    expect(source).toContainSource('guideFieldPlayer?: number;');
    expect(source).toContainSource(
      'const guideCardId: CardId | null = guideFieldPlayer === undefined',
    );
    expect(source).toContainSource('const guided = id === guideCardId;');
    expect(source).toMatchSource(GUIDE_LABEL_BOTH_WAYS);
    expect(source).toContainSource(
      '{...(dragEnabled ? responder.panHandlers : { onPress: tap })}',
    );
    expect(source).toContainSource(
      'onStartShouldSetPanResponder: () => latest.current.dragEnabled',
    );
    expect(source).toContainSource(
      'if (source.id === guideCardId || target === guideCardId)',
    );
  });

  it('keeps the title and substitution count on one row on a phone', () => {
    const source = board();

    expect(source).toContainSource('style={styles.titleRow}');
    expect(source).toContainSource('numberOfLines={1}');
    expect(source).toContainSource('adjustsFontSizeToFit');
    expect(source).toContainSource(
      'style={[styles.title, wide ? null : styles.titleNarrow]}',
    );
    expect(source).toContainSource('titleNarrow: { fontSize: 18 }');
  });

  it('promises the trade on the card actually under the carried one', () => {
    const source = board();

    // The badge and the drop must agree, so both go through cardAt.
    expect(source).toContainSource(
      'onDragMove: (source: DragSource, pageX: number, pageY: number) => {',
    );
    expect(source).toContainSource('const over = cardAt(pageX, pageY);');
    expect(source).toContainSource('isEligible(source, over) ? over : null');
    expect(source).toContainSource(
      "hint={dropTarget === id ? t('substitutionBoard.dropHintSwap') : null}",
    );
    // Putting a leaver back is not a swap, so it says what it really does.
    expect(source).toContainSource(
      "hint={dropTarget === id ? t('substitutionBoard.dropHintKeepOn') : null}",
    );
    expect(source).toContainSource('dropHint:');
    // Text alone is not enough: the target itself has to read as chosen, and
    // has to out-shout the softer ring every eligible card already wears.
    expect(source).toContainSource(
      'hint === null ? null : styles.cardTargeted',
    );
    expect(source).toContainSource('cardTargeted:');
  });

  it('raises the column a card is carried out of, and lights cards under the pointer', () => {
    const source = board();

    // zIndex only orders siblings: without raising the column, a starter dragged
    // toward the bench slid under the bench column, which paints after it.
    expect(source).toContainSource('columnCarrying');
    expect(source).toContainSource(
      "drag?.kind === 'field' ? styles.columnCarrying : null",
    );
    // Asked for only where a pointer can hover: a tablet's tap-time synthetic
    // hover has no leave, and left a tapped card lifted for the rest of the match.
    expect(source).toContainSource('const pointerHover = hasHoverPointer();');
    expect(source).toContainSource(
      'onPointerEnter={pointerHover ? () => setHovered(true) : undefined}',
    );
    expect(source).toContainSource(
      'onPointerLeave={pointerHover ? () => setHovered(false) : undefined}',
    );
    expect(source).toContainSource('cardHovered');
    // Rest, hover, carried — one value, so two animations cannot fight.
    expect(source).toContainSource('outputRange: [1, 1.02, 1.06]');
  });

  it('shows the bench on the same energy scale as the field', () => {
    const source = board();

    // The engine puts a substitute on at their real startingCondition
    // (src/sim/substitutions.ts), so the bench card must draw that condition,
    // never an assumed full bar.
    expect(source).toContainSource('energyBand(entry.sub.condition)');
    expect(source).not.toContainSource("reason ?? '100%'");
    expect(source).not.toContainSource('ENERGY_FILL_COLORS.green');
    expect(source.match(/styles\.energyTrack/g)?.length).toBe(2);
  });

  it('measures drop targets when the drag starts, not when they lay out', () => {
    const source = board();

    // The board scrolls, so a rect captured at layout time would be stale.
    expect(source).toContainSource('const measureCards');
    expect(source).toContainSource('measureInWindow');
    expect(source).toContainSource('onDragStart: (source: DragSource) => {');
    expect(source).toContainSource('measureCards();');
    expect(source).toContainSource('cardAt(pageX, pageY)');
  });

  it('keeps a traded starter dimmed on the bench and only accepts their partner back', () => {
    const source = board();

    expect(source).toContainSource('cardDimmed');
    expect(source).toContainSource("t('substitutionBoard.comingOff')");
    // The player coming on keeps the old swapped-shirt cue: a dashed blue
    // frame and light tint, while ordinary field cards retain the solid frame.
    expect(source).toContainSource(': [styles.card, styles.cardSwapped]');
    expect(source).toContainSource('cardSwapped:');
    expect(source).toContainSource("borderStyle: 'dashed'");
    expect(source).toContainSource("backgroundColor: 'rgba(90,143,214,0.12)'");
    expect(source).toContainSource('benchEntries');
    // A leaver's card takes the drop that undoes its own swap and nothing else.
    expect(source).toContainSource('return target === `field:${source.slot}`;');
    expect(source).toContainSource('undoSwap');
  });

  it('explains what is unavailable instead of refusing in silence', () => {
    const source = board();

    // docs/08's interaction feedback contract: disabled things say why.
    expect(source).toContainSource('budgetNote');
    expect(source).toContainSource('ineligibleTag(');
    expect(source).toContainSource('atLimit ? styles.counterSpent : null');
    expect(source).toContainSource('atLimit ? styles.noteSpent : null');
    expect(source).toContainSource('accessibilityRole="alert"');
  });

  it('dresses to the pixel bible: cream canvas, ink structure, Track A buttons', () => {
    const source = board();

    // 60% warm cream, 30% ink structure (docs/08 design language).
    expect(source).toContainSource("const PAPER = '#f4f1ea'");
    expect(source).toContainSource("const INK = '#241f2e'");
    // Track A lozenge: 2px outline, chunky corner, gloss band, darker lip.
    expect(source).toContainSource('function LozengeButton');
    expect(source).toContainSource('borderBottomWidth: 5');
    expect(source).toContainSource(
      "gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: '40%' }",
    );
    expect(source).toContainSource(
      'pressed && !disabled ? null : <View style={[styles.gloss, gloss]} />',
    );
    expect(source).toContainSource('translateY: pressed && !disabled ? 2 : 0');
    // Four type sizes, two weights (docs/08).
    expect(source).toContainSource('fontSize: 24');
    expect(source).toContainSource('fontSize: 18');
    expect(source).toContainSource('fontSize: 15');
    expect(source).toContainSource('fontSize: 13');
    expect(source).not.toContainSource('fontSize: 14');
    expect(source).not.toContainSource('fontSize: 11');
  });

  it('offers cancel, reset and save', () => {
    const source = board();

    expect(source).toContainSource("label={t('substitutionBoard.cancel')}");
    expect(source).toMatchSource(
      /label=\{t\('substitutionBoard\.cancel'\)\}[\s\S]*?onPressIn=\{\(\) => \{[\s\S]*?onCancel\(\);[\s\S]*?onPress=\{onCancel\}/,
    );
    expect(source).toContainSource("label={t('substitutionBoard.reset')}");
    // Just SAVE: the header counter says how many, the cards say which.
    expect(source).toContainSource("label={t('substitutionBoard.save')}");
    expect(source).not.toContainSource('SAVE{staged');
    // Blue for confirm, grey for secondary and disabled (docs/08 colour meaning).
    expect(source).toContainSource('tone="blue"');
    expect(source).toContainSource('tone="grey"');
    expect(source).toContainSource('setPlan(EMPTY_SUBSTITUTION_PLAN)');
    expect(source).toContainSource('onPress={onCancel}');
    expect(source).toContainSource('onPress={reset}');
    expect(source).toContainSource('disabled={!saveable}');
    expect(source).toContainSource('onSave(planInputs(plan), draftAutoSubs)');
    // AUTO is part of the board's draft: toggling it lights SAVE, Cancel
    // discards it, and Reset restores the value the board opened with.
    expect(source).toContainSource(
      'const [draftAutoSubs, setDraftAutoSubs] = useState(autoSubs)',
    );
    expect(source).toContainSource(
      'const saveable = canSave(plan) || autoChanged;',
    );
    expect(source).toContainSource('setDraftAutoSubs(autoSubs);');
  });

  it('keeps all three footer labels on one line at phone text sizes', () => {
    const source = board();
    const lozenge =
      source.match(/function LozengeButton\(([\s\S]*?)\n}\n\n\/\*\*/)?.[1] ??
      '';

    expect(lozenge).toContainSource('adjustsFontSizeToFit');
    expect(lozenge).toContainSource('numberOfLines={1}');
    expect(lozenge).toContainSource('style={styles.buttonLabel}');
    expect(source).toMatchSource(/buttonLabel: \{[\s\S]{0,180}?fontSize: 13,/);
  });

  it('color-codes player names by position while leaving the role label readable', () => {
    const source = board();

    expect(source).toContainSource("FWD: { color: '#a83440' }");
    expect(source).toContainSource("DEF: { color: '#3f6fb5' }");
    expect(source).toContainSource("GK: { color: '#3f8a4a' }");
    expect(source).toContainSource("MID: { color: '#5b3a91' }");
    expect(source).toContainSource(
      'POSITION_NAME_STYLE[incoming?.role ?? player.role]',
    );
    expect(source).toContainSource('POSITION_NAME_STYLE[entry.sub.role]');
    expect(source).toContainSource('POSITION_NAME_STYLE[entry.starter.role]');
    expect(source).toContainSource('<Text style={styles.role}>');
    expect(source).toContainSource('{incoming?.role ?? player.role}');
    expect(source).toContainSource(
      '<Text style={styles.role}> {entry.sub.role}</Text>',
    );
  });

  it('makes a greyed-out lozenge inert, not just labelled as one', () => {
    const source = board();

    // accessibilityState alone announces "disabled" while the press still lands:
    // a greyed RESET clicked and a greyed SAVE warned. The Pressable needs the
    // prop itself, the way ActionButton pairs them.
    expect(source).toMatchSource(
      /accessibilityState=\{\{ disabled \}\}[\s\S]{0,240}?\n {6}disabled=\{disabled\}/,
    );
    // One owner for the press cue: SfxPressable clicks, so reset must not too.
    // Asserted against the body rather than the first statement, because reset
    // also drops any half-finished tap pick — that is state, not a cue.
    const resetBody =
      source.match(
        /const reset = useCallback\(\(\) => \{([\s\S]*?)\}, \[autoSubs\]\);/,
      )?.[1] ?? '';
    expect(resetBody).toContainSource('setPlan(EMPTY_SUBSTITUTION_PLAN)');
    expect(resetBody).toContainSource('setPicked(null)');
    expect(resetBody).not.toContainSource('playUiClickSfx');
  });

  it('lists two names per row on a phone', () => {
    const source = board();

    expect(source).toContainSource(
      "grid: { flexDirection: 'row', flexWrap: 'wrap'",
    );
    expect(source).toContainSource("gridCell: { width: '48.5%'");
    expect(source).toContainSource('wide ? undefined : styles.grid');
    expect(source).toContainSource('compactName(');
  });
});

describe('match screen wiring', () => {
  it('commits one recorded SUBSTITUTE input per staged pair', () => {
    const source = matchScreen();

    expect(source).toContainSource('<SubstitutionBoard');
    expect(source).toContainSource('onSave={commitSubstitutions}');
    expect(source).toContainSource('for (const swap of swaps) {');
    expect(source).toContainSource("kind: 'SUBSTITUTE'");
    expect(source).toContainSource('tick: match.tick + 1');
    expect(source).toContainSource(
      "console.warn('MatchScreen: the engine rejected a staged substitution'",
    );
  });

  it('drops the old two-tap selection state entirely', () => {
    const source = matchScreen();

    expect(source).not.toContainSource('selectedOutgoing');
    expect(source).not.toContainSource('selectedIncoming');
    expect(source).not.toContainSource('TAP THE PLAYER COMING OFF');
    expect(source).not.toContainSource('MAKE SWAP');
  });

  it('keeps the match paused while the board is open', () => {
    const source = matchScreen();

    expect(source).toContainSource(
      "automaticPauseReasonsRef.current.add('swap')",
    );
    expect(source).toContainSource(
      "automaticPauseReasonsRef.current.delete('swap')",
    );
  });
});
