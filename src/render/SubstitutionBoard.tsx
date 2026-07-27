import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SfxPressable } from '../ui/components/SfxPressable';
import { playManagementActionSfx, playUiClickSfx } from './management-sfx';
import { MAX_SUBSTITUTIONS } from '../sim/substitutions';
import { energyBand, ENERGY_FILL_COLORS } from './match-energy-ui';
import {
  EMPTY_SUBSTITUTION_PLAN,
  applySwap,
  atSubstitutionLimit,
  benchEntries,
  budgetNote,
  canSave,
  canSwap,
  fieldByTiredness,
  filledShirtLabel,
  incomingFor,
  ineligibleTag,
  planInputs,
  stagedCount,
  undoSwap,
  type SubstitutionBenchPlayer,
  type SubstitutionFieldPlayer,
  type SubstitutionPlan,
} from './substitution-board';

/** Below this the modal stacks and lists two names per row. */
const WIDE_BOARD_MIN_WIDTH = 900;
/** Movement under this counts as a still finger rather than a drag. */
const TAP_SLOP = 8;
/** Hold this long to lift a card. Shorter swipes scroll the list instead. */
const LIFT_DELAY_MS = 180;
/** How long the hover and lift emphasis takes to arrive. */
const EMPHASIS_MS = 110;

interface Rect { x: number; y: number; width: number; height: number }

/** What is under the finger: a field slot, a substitute, or a dimmed leaver. */
type CardId = `field:${number}` | `sub:${string}` | `off:${number}`;

interface DragSource {
  readonly id: CardId;
  readonly kind: 'field' | 'sub' | 'off';
  /** Field slot for 'field' and 'off'. */
  readonly slot?: number;
  /** Bench player for 'sub'. */
  readonly subId?: string;
  readonly isKeeper: boolean;
}

export interface SubstitutionBoardProps {
  field: readonly SubstitutionFieldPlayer[];
  bench: readonly SubstitutionBenchPlayer[];
  substitutionsUsed: number;
  autoSubs: boolean;
  onToggleAutoSubs: () => void;
  onCancel: () => void;
  /** One entry per staged swap, ready for the engine's SUBSTITUTE input. */
  onSave: (swaps: readonly { player: number; replacementId: string }[]) => void;
}

/**
 * The substitution board: a centred modal where every swap is a straight trade.
 *
 * Drag a starter onto a bench player and the two change places. Everyone the
 * dragged player is allowed to trade with lights up, using the same predicate
 * (`canSwap`) that accepts the drop — so what glows and what works cannot
 * disagree. Drop anywhere else and the card springs home.
 *
 * Dressed to docs/01, /08 and /11: the warm cream clubhouse canvas with ink
 * structure, Silkscreen at four sizes, blue carrying every neutral action, and
 * Track A lozenge buttons. Hero gold appears nowhere — docs/08 reserves it for
 * hero and power moments and nothing else. Anything unavailable says why, per the
 * same doc's interaction feedback contract.
 */
export function SubstitutionBoard({
  field,
  bench,
  substitutionsUsed,
  autoSubs,
  onToggleAutoSubs,
  onCancel,
  onSave,
}: SubstitutionBoardProps) {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BOARD_MIN_WIDTH;
  const [plan, setPlan] = useState<SubstitutionPlan>(EMPTY_SUBSTITUTION_PLAN);
  const [drag, setDrag] = useState<DragSource | null>(null);
  /** The eligible card currently under the carried one, if any. */
  const [dropTarget, setDropTarget] = useState<CardId | null>(null);
  const cardViews = useRef(new Map<CardId, View>()).current;
  const cardRects = useRef(new Map<CardId, Rect>()).current;

  const substitutionsRemaining = Math.max(0, MAX_SUBSTITUTIONS - substitutionsUsed);
  const orderedField = useMemo(() => fieldByTiredness(field), [field]);
  const rows = useMemo(() => benchEntries(bench, field, plan), [bench, field, plan]);
  const staged = stagedCount(plan);
  const atLimit = atSubstitutionLimit(plan, substitutionsRemaining);
  const saveable = canSave(plan);
  const note = budgetNote(plan, substitutionsRemaining);

  const starterAt = useCallback(
    (slot: number) => field.find(player => player.index === slot),
    [field],
  );
  const subById = useCallback(
    (id: string) => bench.find(player => player.id === id),
    [bench],
  );

  const registerCard = useCallback((id: CardId) => (view: View | null) => {
    if (view === null) cardViews.delete(id);
    else cardViews.set(id, view);
  }, [cardViews]);

  /**
   * Measured fresh on every drag start rather than on layout: the board scrolls,
   * and a rect captured at layout time would hit-test against where a card used
   * to be.
   */
  const measureCards = useCallback(() => {
    cardRects.clear();
    cardViews.forEach((view, id) => {
      view.measureInWindow?.((x, y, cardWidth, height) => {
        cardRects.set(id, { x, y, width: cardWidth, height });
      });
    });
  }, [cardRects, cardViews]);

  const cardAt = useCallback((pageX: number, pageY: number): CardId | null => {
    for (const [id, rect] of cardRects) {
      if (
        pageX >= rect.x && pageX <= rect.x + rect.width
        && pageY >= rect.y && pageY <= rect.y + rect.height
      ) return id;
    }
    return null;
  }, [cardRects]);

  /**
   * One predicate for the light and for the drop. A dimmed leaver only ever
   * accepts its own partner back.
   */
  const isEligible = useCallback((source: DragSource, target: CardId): boolean => {
    if (source.kind === 'field' && source.slot !== undefined) {
      const starter = starterAt(source.slot);
      if (starter === undefined) return false;
      if (target === `off:${source.slot}`) return incomingFor(plan, source.slot) !== null;
      if (target.startsWith('sub:')) {
        const sub = subById(target.slice(4));
        return sub !== undefined && canSwap(plan, starter, sub, substitutionsRemaining);
      }
      return false;
    }
    if (source.kind === 'sub' && source.subId !== undefined) {
      const sub = subById(source.subId);
      if (sub === undefined || !target.startsWith('field:')) return false;
      const starter = starterAt(Number(target.slice(6)));
      return starter !== undefined && canSwap(plan, starter, sub, substitutionsRemaining);
    }
    if (source.kind === 'off' && source.slot !== undefined) {
      // The leaver goes back only into the shirt he left.
      return target === `field:${source.slot}`;
    }
    return false;
  }, [plan, starterAt, subById, substitutionsRemaining]);

  const commit = useCallback((next: SubstitutionPlan) => {
    playUiClickSfx();
    setPlan(next);
  }, []);

  const resolveDrop = useCallback((source: DragSource, target: CardId | null) => {
    if (target === null || !isEligible(source, target)) return;
    if (source.kind === 'off' && source.slot !== undefined) {
      commit(undoSwap(plan, source.slot));
      return;
    }
    if (source.kind === 'field' && source.slot !== undefined) {
      if (target === `off:${source.slot}`) {
        commit(undoSwap(plan, source.slot));
        return;
      }
      const starter = starterAt(source.slot);
      const sub = subById(target.slice(4));
      if (starter !== undefined && sub !== undefined) commit(applySwap(plan, starter, sub));
      return;
    }
    if (source.kind === 'sub' && source.subId !== undefined) {
      const sub = subById(source.subId);
      const starter = starterAt(Number(target.slice(6)));
      if (starter !== undefined && sub !== undefined) commit(applySwap(plan, starter, sub));
    }
  }, [commit, isEligible, plan, starterAt, subById]);

  // The button is disabled with nothing staged, so a player never reaches the
  // refusal; it stays as the backstop for any caller that forgets to pass it.
  const save = useCallback(() => {
    if (!saveable) {
      playManagementActionSfx('warning');
      return;
    }
    onSave(planInputs(plan));
  }, [onSave, plan, saveable]);

  // No cue here: this runs from a SfxPressable, which already clicks. `commit`
  // below keeps its own because a drop is a gesture, not a press.
  const reset = useCallback(() => {
    setPlan(EMPTY_SUBSTITUTION_PLAN);
  }, []);

  const dragProps = {
    onDragStart: (source: DragSource) => {
      measureCards();
      setDrag(source);
    },
    onDragEnd: () => {
      setDrag(null);
      setDropTarget(null);
    },
    // Every eligible card lights up, but only the one actually under the finger
    // promises the trade — the same hit test the drop itself uses, so the badge
    // can never name a card the release would miss.
    onDragMove: (source: DragSource, pageX: number, pageY: number) => {
      const over = cardAt(pageX, pageY);
      setDropTarget(over !== null && over !== source.id && isEligible(source, over) ? over : null);
    },
    onDrop: (source: DragSource, pageX: number, pageY: number) => {
      resolveDrop(source, cardAt(pageX, pageY));
    },
  };

  return (
    <View style={styles.overlay}>
      <SfxPressable accessible={false} onPress={onCancel} style={StyleSheet.absoluteFill}>
        <View style={styles.scrim} />
      </SfxPressable>

      <View
        accessibilityViewIsModal
        style={[styles.board, wide ? styles.boardWide : styles.boardNarrow]}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>MATCH PAUSED</Text>
            <Text style={styles.title}>SUBSTITUTIONS</Text>
            <Text style={styles.hint}>HOLD A PLAYER, DRAG ONTO THEIR REPLACEMENT</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.counter, atLimit ? styles.counterSpent : null]}>
              {substitutionsUsed + staged}/{MAX_SUBSTITUTIONS}
            </Text>
            <SfxPressable
              accessibilityRole="switch"
              accessibilityLabel={`Automatic substitutions ${autoSubs ? 'on' : 'off'}`}
              accessibilityState={{ checked: autoSubs }}
              onPress={onToggleAutoSubs}
              style={[styles.autoSub, autoSubs ? styles.autoSubOn : null]}
            >
              <Text style={styles.autoSubText}>{autoSubs ? '☑ AUTO' : '☐ AUTO'}</Text>
            </SfxPressable>
          </View>
        </View>

        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={styles.scroll}
        >
          {/* The carried card can only rise above its own column's siblings, so
              the column holding it is raised too — otherwise a starter dragged
              towards the bench slid underneath the bench column, which paints
              after it. */}
          <View style={wide ? styles.columns : styles.columnsStacked}>
            <View style={[
              styles.column,
              styles.fieldColumn,
              drag?.kind === 'field' ? styles.columnCarrying : null,
            ]}>
              <Text style={styles.columnTitle}>FIELD</Text>
              <Text style={styles.columnHint}>MOST TIRED FIRST</Text>
              <View style={wide ? undefined : styles.grid}>
                {orderedField.map(player => {
                  const incomingId = incomingFor(plan, player.index);
                  const incoming = incomingId === null ? undefined : subById(incomingId);
                  const id: CardId = `field:${player.index}`;
                  return (
                    <DragCard
                      key={id}
                      id={id}
                      source={{
                        id,
                        kind: 'field',
                        slot: player.index,
                        isKeeper: (incoming?.role ?? player.role) === 'GK',
                      }}
                      lit={drag !== null && drag.id !== id && isEligible(drag, id)}
                      hint={dropTarget === id ? 'SWAP' : null}
                      compact={!wide}
                      holdToLift={!wide}
                      registerCard={registerCard}
                      {...dragProps}
                      accessibilityLabel={incoming === undefined
                        ? `${player.name}, ${player.role}, ${Math.round(player.condition)} percent energy. Hold and drag onto a bench player to trade them.`
                        : `${incoming.name}, ${incoming.role}, on for ${player.name}. Hold and drag onto ${player.name} on the bench to undo.`}
                      style={styles.card}
                    >
                      <View style={styles.cardCopy}>
                        <Text numberOfLines={1} style={incoming === undefined ? styles.name : styles.nameSwapped}>
                          {compactName(incoming?.name ?? player.name, !wide)}
                          <Text style={styles.role}> {incoming?.role ?? player.role}</Text>
                        </Text>
                        {incoming === undefined ? (
                          <>
                            <Text style={styles.meta}>{Math.round(player.condition)}%</Text>
                            <View style={styles.energyTrack}>
                              <View
                                style={[
                                  styles.energyFill,
                                  { backgroundColor: ENERGY_FILL_COLORS[energyBand(player.condition)] },
                                  { width: `${Math.max(0, Math.min(100, player.condition))}%` },
                                ]}
                              />
                            </View>
                          </>
                        ) : (
                          <Text style={styles.metaSwapped}>
                            {filledShirtLabel(compactName(player.name, !wide))}
                          </Text>
                        )}
                      </View>
                    </DragCard>
                  );
                })}
              </View>
            </View>

            <View style={[styles.column, drag !== null && drag.kind !== 'field' ? styles.columnCarrying : null]}>
              <Text style={styles.columnTitle}>BENCH</Text>
              <Text style={styles.columnHint}>FRESH LEGS ENTER AT 100%</Text>
              {rows.length === 0 ? (
                <Text style={styles.emptyBench}>NOBODY LEFT ON THE BENCH.</Text>
              ) : (
                <View style={wide ? undefined : styles.grid}>
                  {rows.map(entry => {
                    if (entry.kind === 'available') {
                      const id: CardId = `sub:${entry.sub.id}`;
                      const lit = drag !== null && drag.id !== id && isEligible(drag, id);
                      // While a starter is held, a card that cannot take them says
                      // why — docs/08: nothing refuses silently.
                      const reason = drag === null || drag.kind !== 'field' || lit
                        ? null
                        : ineligibleTag(entry.sub.role === 'GK', drag.isKeeper, atLimit);
                      return (
                        <DragCard
                          key={id}
                          id={id}
                          source={{ id, kind: 'sub', subId: entry.sub.id, isKeeper: entry.sub.role === 'GK' }}
                          lit={lit}
                          hint={dropTarget === id ? 'SWAP' : null}
                          compact={!wide}
                          holdToLift={!wide}
                          registerCard={registerCard}
                          {...dragProps}
                          accessibilityLabel={`${entry.sub.name}, ${entry.sub.role}, fresh. Hold and drag onto a player on the field to trade them.`}
                          style={styles.card}
                        >
                          <View style={styles.cardCopy}>
                            <Text numberOfLines={1} style={styles.name}>
                              {compactName(entry.sub.name, !wide)}
                              <Text style={styles.role}> {entry.sub.role}</Text>
                            </Text>
                            <Text style={reason === null ? styles.meta : styles.metaBlocked}>
                              {reason ?? '100%'}
                            </Text>
                            {/* A full green bar, so a bench player reads against
                                the field on the same scale instead of asking you
                                to compare a bar with a bare number. */}
                            <View style={styles.energyTrack}>
                              <View style={[
                                styles.energyFill,
                                { backgroundColor: ENERGY_FILL_COLORS.green, width: '100%' },
                              ]} />
                            </View>
                          </View>
                        </DragCard>
                      );
                    }
                    const id: CardId = `off:${entry.starter.index}`;
                    return (
                      <DragCard
                        key={id}
                        id={id}
                        source={{ id, kind: 'off', slot: entry.starter.index, isKeeper: entry.starter.role === 'GK' }}
                        lit={drag !== null && drag.id !== id && isEligible(drag, id)}
                        hint={dropTarget === id ? 'KEEP ON' : null}
                        compact={!wide}
                        holdToLift={!wide}
                        registerCard={registerCard}
                        {...dragProps}
                        accessibilityLabel={`${entry.starter.name} is coming off. Hold and drag onto their shirt on the field to keep them on.`}
                        style={[styles.card, styles.cardDimmed]}
                      >
                        <View style={styles.cardCopy}>
                          <Text numberOfLines={1} style={styles.nameDimmed}>
                            {compactName(entry.starter.name, !wide)}
                            <Text style={styles.roleDimmed}> {entry.starter.role}</Text>
                          </Text>
                          <Text style={styles.metaDimmed}>COMING OFF</Text>
                        </View>
                      </DragCard>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        <Text
          accessible
          accessibilityRole="alert"
          style={[styles.note, atLimit ? styles.noteSpent : null]}
        >
          {note}
        </Text>

        <View style={styles.actions}>
          <LozengeButton
            label="CANCEL"
            accessibilityLabel="Cancel and close without substituting"
            tone="grey"
            onPress={onCancel}
          />
          <LozengeButton
            label="RESET"
            accessibilityLabel="Reset the board and put everyone back"
            tone="grey"
            disabled={staged === 0}
            onPress={reset}
          />
          <LozengeButton
            label="SAVE"
            accessibilityLabel={saveable
              ? `Save ${staged} substitution${staged === 1 ? '' : 's'}`
              : 'Nothing to save yet'}
            tone="blue"
            wide
            disabled={!saveable}
            onPress={save}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * Track A from docs/11: a fat pixel lozenge — 2px ink outline, chunky corners, a
 * gloss band across the top 40%, and a darker lip along the bottom. Pressing it
 * drops the button 2px and collapses the gloss, so it reads as pushed in.
 */
function LozengeButton({
  label,
  accessibilityLabel,
  tone,
  wide = false,
  disabled = false,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  tone: 'grey' | 'blue';
  wide?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const face = disabled ? styles.faceDisabled : tone === 'blue' ? styles.faceBlue : styles.faceGrey;
  const gloss = disabled ? styles.glossDisabled : tone === 'blue' ? styles.glossBlue : styles.glossGrey;
  return (
    <SfxPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      // Both halves, always: announcing "disabled" while still taking the press
      // is a button that looks dead and acts alive. ActionButton pairs them the
      // same way.
      disabled={disabled}
      pressSfx="click"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        wide ? styles.buttonWide : null,
        face,
        // Opacity is set here so SfxPressable's fallback dim never fires: the
        // pressed state is the drop and the collapsed gloss, not a fade.
        { opacity: 1, transform: [{ translateY: pressed && !disabled ? 2 : 0 }] },
      ]}
    >
      {({ pressed }) => (
        <>
          {pressed && !disabled ? null : <View style={[styles.gloss, gloss]} />}
          <Text style={styles.buttonLabel}>{label}</Text>
        </>
      )}
    </SfxPressable>
  );
}

/**
 * A draggable card that is also a drop target. Cards spring home on release —
 * the plan decides where players live, never the gesture's resting place.
 */
function DragCard({
  id,
  source,
  lit,
  hint,
  compact,
  holdToLift,
  registerCard,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDrop,
  accessibilityLabel,
  style,
  children,
}: {
  id: CardId;
  source: DragSource;
  lit: boolean;
  /** Shown over this card while a compatible partner is carried onto it. */
  hint: string | null;
  compact: boolean;
  /** The stacked board scrolls, so there a card must be held before it lifts. */
  holdToLift: boolean;
  registerCard: (id: CardId) => (view: View | null) => void;
  onDragStart: (source: DragSource) => void;
  onDragMove: (source: DragSource, pageX: number, pageY: number) => void;
  onDragEnd: () => void;
  onDrop: (source: DragSource, pageX: number, pageY: number) => void;
  accessibilityLabel: string;
  style: object | readonly object[];
  children: React.ReactNode;
}) {
  const offset = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [lifted, setLifted] = useState(false);
  const [hovered, setHovered] = useState(false);
  const liftedRef = useRef(false);
  const liftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * The responder is built once, so it must never read props directly: the plan
   * it closed over would be the plan from the first render, and staging a second
   * swap against that stale copy would silently erase the first.
   */
  const latest = useRef({ source, onDragStart, onDragMove, onDragEnd, onDrop, holdToLift });
  latest.current = { source, onDragStart, onDragMove, onDragEnd, onDrop, holdToLift };

  /**
   * 0 at rest, 1 under the pointer, 2 while carried. One value so a card cannot
   * be caught between two competing animations.
   */
  const emphasis = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(emphasis, {
      toValue: lifted ? 2 : hovered ? 1 : 0,
      duration: EMPHASIS_MS,
      useNativeDriver: true,
    }).start();
  }, [emphasis, hovered, lifted]);
  const scale = emphasis.interpolate({ inputRange: [0, 1, 2], outputRange: [1, 1.02, 1.06] });

  const release = useCallback(() => {
    if (liftTimer.current !== null) clearTimeout(liftTimer.current);
    liftTimer.current = null;
    liftedRef.current = false;
    setLifted(false);
    offset.setValue({ x: 0, y: 0 });
    latest.current.onDragEnd();
  }, [offset]);

  const lift = useCallback(() => {
    if (liftTimer.current !== null) clearTimeout(liftTimer.current);
    liftTimer.current = null;
    liftedRef.current = true;
    setLifted(true);
    latest.current.onDragStart(latest.current.source);
  }, []);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Held, not merely touched. A card that lifted on contact would swallow
        // every swipe and leave the list unscrollable on a phone.
        liftTimer.current = setTimeout(lift, LIFT_DELAY_MS);
      },
      // Until the card lifts, the list may take the gesture back and scroll;
      // once lifted, it may not.
      onPanResponderTerminationRequest: () => !liftedRef.current,
      onPanResponderMove: (_event, gesture) => {
        if (!liftedRef.current) {
          if (Math.abs(gesture.dx) <= TAP_SLOP && Math.abs(gesture.dy) <= TAP_SLOP) return;
          // Moving early means a scroll on the stacked board, where the columns
          // are one long list — but on the wide board nothing scrolls sideways
          // and a mouse always moves before the hold elapses, so waiting there
          // just made the card refuse to pick up. Movement IS the drag.
          if (latest.current.holdToLift) {
            if (liftTimer.current !== null) clearTimeout(liftTimer.current);
            liftTimer.current = null;
            return;
          }
          lift();
        }
        offset.setValue({ x: gesture.dx, y: gesture.dy });
        latest.current.onDragMove(latest.current.source, gesture.moveX, gesture.moveY);
      },
      onPanResponderRelease: (_event, gesture) => {
        const dropping = liftedRef.current;
        const { source: from, onDrop: drop } = latest.current;
        release();
        // A tap never drops: every swap needs a partner, so there is no sensible
        // one-tap action.
        if (dropping) drop(from, gesture.moveX, gesture.moveY);
      },
      onPanResponderTerminate: () => release(),
    }),
  ).current;

  return (
    <Animated.View
      ref={registerCard(id)}
      {...responder.panHandlers}
      // Hover is a pointer affordance and simply never fires on a touch screen,
      // so the board loses nothing there.
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        style,
        compact ? styles.gridCell : null,
        lit ? styles.cardLit : null,
        hovered && !lifted ? styles.cardHovered : null,
        // The one card the release would actually take. Every eligible card is
        // already lit, so the target has to out-shout them, not just join them.
        hint === null ? null : styles.cardTargeted,
        lifted ? styles.cardLifted : null,
        { transform: [...offset.getTranslateTransform(), { scale }] },
      ]}
    >
      {hint === null ? null : (
        <View pointerEvents="none" style={styles.dropHint}>
          <Text style={styles.dropHintLabel}>{hint}</Text>
          <Text style={styles.dropHintTail}>▼</Text>
        </View>
      )}
      {children}
    </Animated.View>
  );
}

/** Surnames only in a two-up cell, where a full name would not fit. */
function compactName(name: string, compact: boolean): string {
  if (!compact) return name;
  const parts = name.split(' ').filter(part => part.length > 0);
  return parts[parts.length - 1] ?? name;
}

// docs/08 design language: 60% warm cream surfaces, 30% dark ink structure, and
// an accent that means "hero" — so gold appears nowhere on this board. Blue
// (#5a8fd6 face / #a3c8f0 gloss / #3f6fb5 lip) carries confirm and every neutral
// action; grey is disabled and secondary; red-dark speaks only for the spent
// limit. Type is Silkscreen at the doc's four sizes (13/15/18/24), two weights.
const PIXEL_BOLD = 'Silkscreen_700Bold';
const PIXEL = 'Silkscreen_400Regular';
const INK = '#241f2e';
const PAPER = '#f4f1ea';

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 30,
  },
  scrim: { flex: 1, backgroundColor: 'rgba(36,31,46,0.72)' },
  board: {
    width: '100%',
    borderWidth: 3,
    borderColor: INK,
    borderRadius: 4,
    backgroundColor: PAPER,
    padding: 20,
    gap: 16,
    // Ink contact shadow rather than a soft blur, per docs/11.
    shadowColor: INK,
    shadowOffset: { width: 8, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 0,
    elevation: 12,
  },
  boardWide: { maxWidth: 920, maxHeight: '92%' },
  boardNarrow: { maxWidth: 520, maxHeight: '94%' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  scrollContent: { gap: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  headerCopy: { flex: 1, minWidth: 0 },
  headerRight: { alignItems: 'flex-end', gap: 8 },
  eyebrow: { color: '#6b6675', fontFamily: PIXEL, fontSize: 13, letterSpacing: 1 },
  title: { color: INK, fontFamily: PIXEL_BOLD, fontSize: 24, letterSpacing: 1, marginTop: 4 },
  hint: { color: '#6b6675', fontFamily: PIXEL, fontSize: 13, letterSpacing: 0.6, marginTop: 6 },
  counter: { color: INK, fontFamily: PIXEL_BOLD, fontSize: 18, fontVariant: ['tabular-nums'] },
  counterSpent: { color: '#a83440' },
  autoSub: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: INK,
    borderBottomWidth: 4,
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },
  autoSubOn: { backgroundColor: '#a3c8f0' },
  autoSubText: { color: INK, fontFamily: PIXEL_BOLD, fontSize: 15 },
  columns: { flexDirection: 'row', gap: 16 },
  columnsStacked: { gap: 16 },
  column: {
    flex: 1,
    minWidth: 0,
    gap: 8,
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 3,
    backgroundColor: '#ffffff',
    padding: 12,
  },
  fieldColumn: { flexGrow: 1.15 },
  columnTitle: { color: INK, fontFamily: PIXEL_BOLD, fontSize: 15, letterSpacing: 1 },
  columnHint: { color: '#9a95a4', fontFamily: PIXEL, fontSize: 13, letterSpacing: 0.6, marginTop: -4 },
  emptyBench: { color: '#9a95a4', fontFamily: PIXEL, fontSize: 13, paddingVertical: 12 },
  // Two names per row on a phone, so a whole squad fits without scrolling.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridCell: { width: '48.5%', minHeight: 64 },
  card: {
    minHeight: 58,
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: INK,
    borderBottomWidth: 4,
    borderRadius: 3,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cardDimmed: { backgroundColor: '#f4f1ea', borderColor: '#9a95a4', opacity: 0.6 },
  // Blue, not gold: docs/08 reserves the gold accent for hero and power moments.
  cardLit: {
    borderColor: '#3f6fb5',
    opacity: 1,
    boxShadow: '0 0 0 3px rgba(90, 143, 214, 0.45)',
    shadowColor: '#5a8fd6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 7,
    elevation: 10,
  },
  // Under the pointer but not yet carried: enough to say "this one is live",
  // deliberately weaker than cardLit so a drop target still wins the eye.
  cardHovered: {
    borderColor: '#5a8fd6',
    boxShadow: '0 0 0 2px rgba(90, 143, 214, 0.25)',
  },
  cardLifted: {
    borderColor: '#3f6fb5',
    zIndex: 40,
    elevation: 14,
    boxShadow: '0 8px 0 0 rgba(36, 31, 46, 0.30), 0 0 0 3px rgba(90, 143, 214, 0.55)',
    shadowColor: '#241f2e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
  },
  /**
   * The card the drop would land on. A filled blue face under a heavy ring: at
   * a glance you can see which bench player is coming on without reading a
   * word, and it cannot be confused with the softer ring every merely-eligible
   * card wears.
   */
  cardTargeted: {
    borderColor: '#3f6fb5',
    backgroundColor: '#a3c8f0',
    opacity: 1,
    boxShadow: '0 0 0 4px rgba(63, 111, 181, 0.85)',
    shadowColor: '#3f6fb5',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 12,
  },
  /**
   * The macOS-trash promise: the target says what the release will do, above
   * the card and pointing down at it, so the badge never covers the name you
   * are aiming for.
   */
  dropHint: {
    position: 'absolute',
    top: -30,
    alignSelf: 'center',
    alignItems: 'center',
    zIndex: 60,
  },
  dropHintLabel: {
    color: '#f4f1ea',
    fontFamily: PIXEL_BOLD,
    fontSize: 12,
    letterSpacing: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: '#f4f1ea',
    borderRadius: 4,
    backgroundColor: '#3f6fb5',
    overflow: 'hidden',
  },
  dropHintTail: { color: '#3f6fb5', fontSize: 12, lineHeight: 10, marginTop: -1 },
  /** Raised so the card being carried out of it clears the other column. */
  columnCarrying: { zIndex: 30 },
  cardCopy: { minWidth: 0 },
  name: { color: INK, fontFamily: PIXEL_BOLD, fontSize: 15 },
  nameSwapped: { color: '#3f6fb5', fontFamily: PIXEL_BOLD, fontSize: 15 },
  nameDimmed: { color: '#6b6675', fontFamily: PIXEL_BOLD, fontSize: 15 },
  role: { color: '#6b6675', fontFamily: PIXEL_BOLD, fontSize: 13, letterSpacing: 0.5 },
  roleDimmed: { color: '#9a95a4', fontFamily: PIXEL_BOLD, fontSize: 13, letterSpacing: 0.5 },
  meta: { color: '#6b6675', fontFamily: PIXEL, fontSize: 13, marginTop: 4, letterSpacing: 0.6 },
  metaSwapped: { color: '#3f6fb5', fontFamily: PIXEL, fontSize: 13, marginTop: 4, letterSpacing: 0.6 },
  metaBlocked: { color: '#a83440', fontFamily: PIXEL, fontSize: 13, marginTop: 4, letterSpacing: 0.6 },
  metaDimmed: { color: '#9a95a4', fontFamily: PIXEL, fontSize: 13, marginTop: 4, letterSpacing: 0.6 },
  energyTrack: { height: 6, marginTop: 6, backgroundColor: '#d9d3e0', overflow: 'hidden' },
  energyFill: { height: 6 },
  note: { color: '#6b6675', fontFamily: PIXEL, fontSize: 13, letterSpacing: 0.6, lineHeight: 20 },
  noteSpent: { color: '#a83440' },
  actions: { flexDirection: 'row', gap: 12 },
  button: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: INK,
    borderBottomWidth: 5,
    borderRadius: 4,
    paddingHorizontal: 10,
  },
  buttonWide: { flex: 1.4 },
  faceBlue: { backgroundColor: '#5a8fd6', borderBottomColor: '#3f6fb5' },
  faceGrey: { backgroundColor: '#9a95a4', borderBottomColor: '#6b6675' },
  faceDisabled: { backgroundColor: '#c9c5d0', borderBottomColor: '#9a95a4' },
  // The gloss is a bold band across the top 40%, not a hairline.
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: '40%' },
  glossBlue: { backgroundColor: '#a3c8f0' },
  glossGrey: { backgroundColor: '#c9c5d0' },
  glossDisabled: { backgroundColor: '#d9d3e0' },
  buttonLabel: {
    color: PAPER,
    fontFamily: PIXEL_BOLD,
    fontSize: 15,
    letterSpacing: 1,
    textShadowColor: INK,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
});
