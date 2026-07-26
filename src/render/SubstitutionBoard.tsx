import { useCallback, useMemo, useRef, useState } from 'react';
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
  canSave,
  canSwap,
  fieldByTiredness,
  filledShirtLabel,
  incomingFor,
  planInputs,
  stagedCount,
  undoSwap,
  type SubstitutionBenchPlayer,
  type SubstitutionFieldPlayer,
  type SubstitutionPlan,
} from './substitution-board';

/** Below this the modal stacks and lists two names per row. */
const WIDE_BOARD_MIN_WIDTH = 900;
/** A release inside this radius is a tap, not a drag. */
const TAP_SLOP = 8;

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
 * dragged player is allowed to trade with glows while the finger is down, so what
 * lights up and what works are the same predicate (`canSwap`). Drop anywhere else
 * and the card springs home — there is no state where the eleven is short, which
 * is why the board needs no warnings and no assistant explaining itself.
 *
 * A traded starter stays visible in the bench column, dimmed and sunk to the
 * bottom; dragging that pair back onto each other undoes the swap.
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
  const cardViews = useRef(new Map<CardId, View>()).current;
  const cardRects = useRef(new Map<CardId, Rect>()).current;

  const substitutionsRemaining = Math.max(0, MAX_SUBSTITUTIONS - substitutionsUsed);
  const orderedField = useMemo(() => fieldByTiredness(field), [field]);
  const rows = useMemo(() => benchEntries(bench, field, plan), [bench, field, plan]);
  const staged = stagedCount(plan);
  const atLimit = atSubstitutionLimit(plan, substitutionsRemaining);
  const saveable = canSave(plan);

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
   * One predicate for the glow and for the drop. A dimmed leaver only ever
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

  const save = useCallback(() => {
    if (!saveable) {
      playManagementActionSfx('warning');
      return;
    }
    onSave(planInputs(plan));
  }, [onSave, plan, saveable]);

  const reset = useCallback(() => {
    playUiClickSfx();
    setPlan(EMPTY_SUBSTITUTION_PLAN);
  }, []);

  const dragProps = {
    onDragStart: (source: DragSource) => {
      measureCards();
      setDrag(source);
    },
    onDragEnd: () => setDrag(null),
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
            <Text style={styles.hint}>DRAG A PLAYER ONTO THEIR REPLACEMENT</Text>
          </View>
          <View style={styles.headerRight}>
            {/* Red is the whole message at the limit: nothing will light up. */}
            <Text style={[styles.counter, atLimit ? styles.counterSpent : null]}>
              {substitutionsUsed + staged} / {MAX_SUBSTITUTIONS}
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
          <View style={wide ? styles.columns : styles.columnsStacked}>
            <View style={[styles.column, styles.fieldColumn]}>
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
                      source={{ id, kind: 'field', slot: player.index }}
                      lit={drag !== null && drag.id !== id && isEligible(drag, id)}
                      compact={!wide}
                      registerCard={registerCard}
                      {...dragProps}
                      accessibilityLabel={incoming === undefined
                        ? `${player.name}, ${player.role}, ${Math.round(player.condition)} percent energy. Drag onto a bench player to trade them.`
                        : `${incoming.name}, ${incoming.role}, on for ${player.name}. Drag onto ${player.name} on the bench to undo.`}
                      style={incoming === undefined ? styles.card : styles.cardSwapped}
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

            <View style={styles.column}>
              <Text style={styles.columnTitle}>BENCH</Text>
              <Text style={styles.columnHint}>FRESH LEGS ENTER AT 100%</Text>
              {rows.length === 0 ? (
                <Text style={styles.emptyBench}>NOBODY LEFT ON THE BENCH.</Text>
              ) : (
                <View style={wide ? undefined : styles.grid}>
                  {rows.map(entry => {
                    if (entry.kind === 'available') {
                      const id: CardId = `sub:${entry.sub.id}`;
                      return (
                        <DragCard
                          key={id}
                          id={id}
                          source={{ id, kind: 'sub', subId: entry.sub.id }}
                          lit={drag !== null && drag.id !== id && isEligible(drag, id)}
                          compact={!wide}
                          registerCard={registerCard}
                          {...dragProps}
                          accessibilityLabel={`${entry.sub.name}, ${entry.sub.role}, fresh. Drag onto a player on the field to trade them.`}
                          style={styles.card}
                        >
                          <View style={styles.cardCopy}>
                            <Text numberOfLines={1} style={styles.name}>
                              {compactName(entry.sub.name, !wide)}
                              <Text style={styles.role}> {entry.sub.role}</Text>
                            </Text>
                            <Text style={styles.meta}>100%</Text>
                          </View>
                        </DragCard>
                      );
                    }
                    const id: CardId = `off:${entry.starter.index}`;
                    return (
                      <DragCard
                        key={id}
                        id={id}
                        source={{ id, kind: 'off', slot: entry.starter.index }}
                        lit={drag !== null && drag.id !== id && isEligible(drag, id)}
                        compact={!wide}
                        registerCard={registerCard}
                        {...dragProps}
                        accessibilityLabel={`${entry.starter.name} is coming off. Drag onto their shirt on the field to keep them on.`}
                        style={styles.cardDimmed}
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

        <View style={styles.actions}>
          <SfxPressable
            accessibilityRole="button"
            accessibilityLabel="Cancel and close without substituting"
            onPress={onCancel}
            style={[styles.button, styles.cancelButton]}
          >
            <Text style={styles.cancelText}>CANCEL</Text>
          </SfxPressable>
          <SfxPressable
            accessibilityRole="button"
            accessibilityLabel="Reset the board and put everyone back"
            accessibilityState={{ disabled: staged === 0 }}
            disabled={staged === 0}
            onPress={reset}
            style={[styles.button, styles.resetButton, staged === 0 ? styles.buttonBlocked : null]}
          >
            <Text style={styles.resetText}>RESET</Text>
          </SfxPressable>
          <SfxPressable
            accessibilityRole="button"
            accessibilityLabel={saveable
              ? `Save ${staged} substitution${staged === 1 ? '' : 's'}`
              : 'Nothing to save yet'}
            onPress={save}
            style={[styles.button, styles.saveButton, saveable ? null : styles.buttonBlocked]}
          >
            <Text style={styles.saveText}>SAVE{staged > 0 ? ` ${staged}` : ''}</Text>
          </SfxPressable>
        </View>
      </View>
    </View>
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
  compact,
  registerCard,
  onDragStart,
  onDragEnd,
  onDrop,
  accessibilityLabel,
  style,
  children,
}: {
  id: CardId;
  source: DragSource;
  lit: boolean;
  compact: boolean;
  registerCard: (id: CardId) => (view: View | null) => void;
  onDragStart: (source: DragSource) => void;
  onDragEnd: () => void;
  onDrop: (source: DragSource, pageX: number, pageY: number) => void;
  accessibilityLabel: string;
  style: object;
  children: React.ReactNode;
}) {
  const offset = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [dragging, setDragging] = useState(false);
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_event, gesture) => (
        Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2
      ),
      onPanResponderGrant: () => {
        setDragging(true);
        onDragStart(source);
      },
      onPanResponderMove: (_event, gesture) => {
        offset.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_event, gesture) => {
        setDragging(false);
        onDragEnd();
        offset.setValue({ x: 0, y: 0 });
        // A tap is not a drop: with every swap needing a partner, there is no
        // sensible one-tap action, so a tap deliberately does nothing.
        if (Math.abs(gesture.dx) < TAP_SLOP && Math.abs(gesture.dy) < TAP_SLOP) return;
        onDrop(source, gesture.moveX, gesture.moveY);
      },
      onPanResponderTerminate: () => {
        setDragging(false);
        onDragEnd();
        offset.setValue({ x: 0, y: 0 });
      },
    }),
  ).current;

  return (
    <Animated.View
      ref={registerCard(id)}
      {...responder.panHandlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        style,
        compact ? styles.gridCell : null,
        lit ? styles.cardLit : null,
        dragging ? styles.cardDragging : null,
        { transform: offset.getTranslateTransform() },
      ]}
    >
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

// Palette from the pixel bible (docs/11): ink #241f2e, ink-soft #3a3350,
// card #2d283c, cream #f4f1ea, muted #bcb7c4, structure #6b6675, gold #edb54a,
// red #d94f52.
const PIXEL_BOLD = 'Silkscreen_700Bold';
const PIXEL = 'Silkscreen_400Regular';

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
  scrim: { flex: 1, backgroundColor: 'rgba(20,16,28,0.82)' },
  board: {
    width: '100%',
    borderWidth: 3,
    borderColor: '#6b6675',
    borderBottomWidth: 6,
    borderBottomColor: '#16121f',
    borderRadius: 4,
    backgroundColor: '#2d283c',
    padding: 20,
    gap: 16,
  },
  boardWide: { maxWidth: 920, maxHeight: '92%' },
  boardNarrow: { maxWidth: 520, maxHeight: '94%' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  scrollContent: { gap: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  headerCopy: { flex: 1, minWidth: 0 },
  headerRight: { alignItems: 'flex-end', gap: 8 },
  eyebrow: { color: '#bcb7c4', fontFamily: PIXEL, fontSize: 11, letterSpacing: 1 },
  title: { color: '#f4f1ea', fontFamily: PIXEL_BOLD, fontSize: 22, letterSpacing: 1, marginTop: 4 },
  hint: { color: '#8e88a0', fontFamily: PIXEL, fontSize: 10, letterSpacing: 0.8, marginTop: 6 },
  counter: { color: '#f4f1ea', fontFamily: PIXEL_BOLD, fontSize: 16, fontVariant: ['tabular-nums'] },
  counterSpent: { color: '#f06b6e' },
  autoSub: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: '#49415f',
    borderBottomWidth: 4,
    borderBottomColor: '#16121f',
    borderRadius: 3,
    backgroundColor: '#3a3350',
  },
  autoSubOn: { backgroundColor: '#35618e', borderColor: '#77a4d8' },
  autoSubText: { color: '#f4f1ea', fontFamily: PIXEL_BOLD, fontSize: 12 },
  columns: { flexDirection: 'row', gap: 16 },
  columnsStacked: { gap: 16 },
  column: {
    flex: 1,
    minWidth: 0,
    gap: 8,
    borderWidth: 2,
    borderColor: '#49415f',
    borderRadius: 3,
    backgroundColor: '#241f2e',
    padding: 12,
  },
  fieldColumn: { flexGrow: 1.15 },
  columnTitle: { color: '#f4f1ea', fontFamily: PIXEL_BOLD, fontSize: 14, letterSpacing: 1 },
  columnHint: { color: '#8e88a0', fontFamily: PIXEL, fontSize: 10, letterSpacing: 0.8, marginTop: -4 },
  emptyBench: { color: '#8e88a0', fontFamily: PIXEL, fontSize: 11, paddingVertical: 12 },
  // Two names per row on a phone, so a whole squad fits without scrolling.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridCell: { width: '48.5%', minHeight: 62 },
  card: {
    minHeight: 56,
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#49415f',
    borderBottomWidth: 3,
    borderBottomColor: '#16121f',
    borderRadius: 3,
    backgroundColor: '#3a3350',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cardSwapped: {
    minHeight: 56,
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#edb54a',
    borderStyle: 'dashed',
    borderRadius: 3,
    backgroundColor: 'rgba(237,181,74,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cardDimmed: {
    minHeight: 56,
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#3a3350',
    borderBottomWidth: 3,
    borderBottomColor: '#16121f',
    borderRadius: 3,
    backgroundColor: '#241f2e',
    paddingHorizontal: 10,
    paddingVertical: 8,
    opacity: 0.55,
  },
  // Everyone the dragged player may trade with. Same recipe as the training
  // screen's glow so one lit thing looks like another across the game.
  cardLit: {
    borderColor: '#edb54a',
    opacity: 1,
    boxShadow: '0 0 12px 4px rgba(237, 181, 74, 0.75)',
    shadowColor: '#edb54a',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 9,
    elevation: 10,
  },
  cardDragging: { borderColor: '#a3c8f0', zIndex: 40, elevation: 14 },
  cardCopy: { minWidth: 0 },
  name: { color: '#f4f1ea', fontFamily: PIXEL_BOLD, fontSize: 14 },
  nameSwapped: { color: '#f7d894', fontFamily: PIXEL_BOLD, fontSize: 14 },
  nameDimmed: { color: '#bcb7c4', fontFamily: PIXEL_BOLD, fontSize: 14 },
  role: { color: '#a3c8f0', fontFamily: PIXEL_BOLD, fontSize: 11, letterSpacing: 0.5 },
  roleDimmed: { color: '#8e88a0', fontFamily: PIXEL_BOLD, fontSize: 11, letterSpacing: 0.5 },
  meta: { color: '#bcb7c4', fontFamily: PIXEL, fontSize: 10, marginTop: 4, letterSpacing: 0.6 },
  metaSwapped: { color: '#edb54a', fontFamily: PIXEL, fontSize: 10, marginTop: 4, letterSpacing: 0.6 },
  metaDimmed: { color: '#8e88a0', fontFamily: PIXEL, fontSize: 10, marginTop: 4, letterSpacing: 0.6 },
  energyTrack: { height: 6, marginTop: 6, backgroundColor: '#16121f', overflow: 'hidden' },
  energyFill: { height: 6 },
  actions: { flexDirection: 'row', gap: 12 },
  button: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderRadius: 3,
  },
  buttonBlocked: { opacity: 0.45 },
  cancelButton: { flex: 1, borderColor: '#6b6675', borderBottomColor: '#16121f', backgroundColor: '#3a3350' },
  cancelText: { color: '#bcb7c4', fontFamily: PIXEL_BOLD, fontSize: 15, letterSpacing: 1 },
  resetButton: { flex: 1, borderColor: '#c8862a', borderBottomColor: '#16121f', backgroundColor: '#3a3350' },
  resetText: { color: '#edb54a', fontFamily: PIXEL_BOLD, fontSize: 15, letterSpacing: 1 },
  saveButton: { flex: 1.4, borderColor: '#a3c8f0', borderBottomColor: '#2b5a97', backgroundColor: '#3f6fb5' },
  saveText: { color: '#ffffff', fontFamily: PIXEL_BOLD, fontSize: 15, letterSpacing: 1 },
});
