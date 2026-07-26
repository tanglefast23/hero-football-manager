import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { SfxPressable } from '../ui/components/SfxPressable';
import { BertFullBody } from '../ui/AssistantGuideOverlay';
import { playManagementActionSfx, playUiClickSfx } from './management-sfx';
import { MAX_SUBSTITUTIONS } from '../sim/substitutions';
import { energyBand, ENERGY_FILL_COLORS } from './match-energy-ui';
import {
  EMPTY_SUBSTITUTION_PLAN,
  SUBSTITUTION_REJECTION_MESSAGES,
  bringOn,
  canSave,
  fieldByTiredness,
  isBenched,
  isComingOn,
  planInputs,
  planProblem,
  recallToField,
  replacementFor,
  returnToBench,
  sendToBench,
  stagedCount,
  type SubstitutionBenchPlayer,
  type SubstitutionFieldPlayer,
  type SubstitutionPlan,
} from './substitution-board';

/** Bert's standing instruction, shown until a rule needs explaining instead. */
const BERT_DIRECTION = 'Drag your tired players down to the bench, then drag replacements onto the field. As many as you like — save when you are happy.';
/** Below this the modal stacks into one column and drops the portraits. */
const WIDE_BOARD_MIN_WIDTH = 900;
/** A release inside this radius is a tap, not a drag. */
const TAP_SLOP = 8;

type DropZone = 'field' | 'subs' | 'bench';
type ZoneRects = Partial<Record<DropZone, { x: number; y: number; width: number; height: number }>>;

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
 * The substitution board: a centred modal (never a full-width bar) where the
 * manager stages every swap they want and commits them together.
 *
 * Field on the left, most tired first, because that is the decision being made.
 * The bench along the bottom is the drop target for taking someone off, and the
 * substitutes column feeds the holes that opens. Dragging is the headline
 * gesture, but every card is also a plain tap — a tap does the obvious thing for
 * where the card currently is, which keeps the board usable with a keyboard, a
 * screen reader, or a thumb that would rather not drag.
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
  const [message, setMessage] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const zonesRef = useRef<ZoneRects>({});

  const substitutionsRemaining = Math.max(0, MAX_SUBSTITUTIONS - substitutionsUsed);
  const orderedField = useMemo(() => fieldByTiredness(field), [field]);
  const problem = planProblem(plan, substitutionsRemaining);
  const saveable = canSave(plan, substitutionsRemaining);
  const staged = stagedCount(plan);
  // Bert leads with the how-to, switches to whatever rule was just broken, and
  // ends on the all-clear. One voice, one place to look.
  const speech = message
    ?? (staged === 0 ? BERT_DIRECTION : problem)
    ?? 'That is a full eleven. Save it and we play on.';

  const measureZone = useCallback((zone: DropZone) => (event: LayoutChangeEvent) => {
    // measureInWindow, not the layout event's own x/y: drops are hit-tested
    // against absolute gesture coordinates, which are page-relative.
    const target = event.target as unknown as {
      measureInWindow?: (callback: (x: number, y: number, w: number, h: number) => void) => void;
    };
    target.measureInWindow?.((x, y, zoneWidth, height) => {
      zonesRef.current = { ...zonesRef.current, [zone]: { x, y, width: zoneWidth, height } };
    });
  }, []);

  const zoneAt = useCallback((pageX: number, pageY: number): DropZone | null => {
    const zones = zonesRef.current;
    for (const zone of ['bench', 'field', 'subs'] as const) {
      const rect = zones[zone];
      if (rect === undefined) continue;
      if (
        pageX >= rect.x && pageX <= rect.x + rect.width
        && pageY >= rect.y && pageY <= rect.y + rect.height
      ) return zone;
    }
    return null;
  }, []);

  const applyMove = useCallback((next: SubstitutionPlan, rejection?: string) => {
    if (rejection !== undefined) {
      playManagementActionSfx('warning');
      setMessage(rejection);
      return;
    }
    playUiClickSfx();
    setMessage(null);
    setPlan(next);
  }, []);

  const dropFieldPlayer = useCallback((player: SubstitutionFieldPlayer, zone: DropZone | null) => {
    if (zone === 'bench' || zone === 'subs') {
      const move = sendToBench(plan, player, substitutionsRemaining);
      applyMove(
        move.plan,
        move.rejection === undefined ? undefined : SUBSTITUTION_REJECTION_MESSAGES[move.rejection],
      );
      return;
    }
    if (zone === 'field' && isBenched(plan, player.index)) {
      applyMove(recallToField(plan, player.index));
    }
  }, [applyMove, plan, substitutionsRemaining]);

  const dropBenchPlayer = useCallback((player: SubstitutionBenchPlayer, zone: DropZone | null) => {
    if (zone === 'field') {
      const move = bringOn(plan, player, field);
      applyMove(
        move.plan,
        move.rejection === undefined ? undefined : SUBSTITUTION_REJECTION_MESSAGES[move.rejection],
      );
      return;
    }
    if ((zone === 'subs' || zone === 'bench') && isComingOn(plan, player.id)) {
      applyMove(returnToBench(plan, player.id));
    }
  }, [applyMove, field, plan]);

  const save = useCallback(() => {
    if (!saveable) {
      playManagementActionSfx('warning');
      setMessage(problem);
      return;
    }
    onSave(planInputs(plan));
  }, [onSave, plan, problem, saveable]);

  return (
    <View style={styles.overlay}>
      <SfxPressable
        accessible={false}
        onPress={onCancel}
        style={StyleSheet.absoluteFill}
      >
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
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.counter}>
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

        {/* The board scrolls between its fixed header and its actions, so SAVE is
            always reachable — on a stacked phone layout and on a short desktop
            window alike. */}
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={styles.scroll}
        >
        <View style={wide ? styles.columns : styles.columnsStacked}>
          <View
            onLayout={measureZone('field')}
            style={[styles.column, styles.fieldColumn, dragging === 'bench' ? styles.columnArmed : null]}
          >
            <Text style={styles.columnTitle}>FIELD</Text>
            <Text style={styles.columnHint}>MOST TIRED FIRST</Text>
            {orderedField.map(player => (
              <FieldRow
                key={player.index}
                player={player}
                incoming={bench.find(sub => sub.id === replacementFor(plan, player.index))}
                benched={isBenched(plan, player.index)}
                showPortrait={wide}
                onDragStateChange={setDragging}
                onDrop={zone => dropFieldPlayer(player, zone)}
                zoneAt={zoneAt}
              />
            ))}
          </View>

          <View
            onLayout={measureZone('subs')}
            style={[styles.column, dragging === 'field' ? styles.columnArmed : null]}
          >
            <Text style={styles.columnTitle}>SUBSTITUTIONS</Text>
            <Text style={styles.columnHint}>FRESH LEGS ENTER AT 100%</Text>
            {bench.length === 0 ? (
              <Text style={styles.emptyBench}>NOBODY LEFT ON THE BENCH.</Text>
            ) : bench.map(player => (
              <BenchRow
                key={player.id}
                player={player}
                comingOn={isComingOn(plan, player.id)}
                showPortrait={wide}
                onDragStateChange={setDragging}
                onDrop={zone => dropBenchPlayer(player, zone)}
                zoneAt={zoneAt}
              />
            ))}
          </View>
        </View>

        <View
          onLayout={measureZone('bench')}
          style={[styles.benchStrip, dragging === 'field' ? styles.benchStripArmed : null]}
        >
          <Text style={styles.columnTitle}>BENCH</Text>
          <View style={styles.benchSeats}>
            <BenchArt />
            <View style={styles.benchOccupants}>
              {plan.slots.length === 0 ? (
                <Text style={styles.benchEmptyHint}>DROP A TIRED PLAYER HERE</Text>
              ) : plan.slots.map(slot => {
                const player = field.find(candidate => candidate.index === slot.player);
                if (player === undefined) return null;
                return (
                  <SfxPressable
                    key={slot.player}
                    accessibilityRole="button"
                    accessibilityLabel={`${player.name} is coming off. Tap to put them back on the field.`}
                    onPress={() => applyMove(recallToField(plan, slot.player))}
                    style={styles.benchChip}
                  >
                    <Text numberOfLines={1} style={styles.benchChipName}>{surname(player.name)}</Text>
                    <Text style={styles.benchChipMeta}>
                      {slot.replacementId === null ? 'NEEDS COVER' : 'COVERED'}
                    </Text>
                  </SfxPressable>
                );
              })}
            </View>
          </View>
        </View>
        </ScrollView>

        <View style={styles.bertRow}>
          {wide ? (
            <View style={styles.bertSprite}>
              <BertFullBody pointing />
            </View>
          ) : null}
          <View
            accessible
            accessibilityRole="alert"
            accessibilityLabel={speech}
            style={[styles.speech, message === null ? null : styles.speechProblem]}
          >
            <Text style={styles.speechName}>BERT RUDGE</Text>
            <Text style={styles.speechText}>{speech}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <SfxPressable
            accessibilityRole="button"
            accessibilityLabel="Cancel these substitutions"
            onPress={onCancel}
            style={[styles.button, styles.cancelButton]}
          >
            <Text style={styles.cancelText}>CANCEL</Text>
          </SfxPressable>
          <SfxPressable
            accessibilityRole="button"
            accessibilityLabel={saveable
              ? `Save ${staged} substitution${staged === 1 ? '' : 's'}`
              : problem ?? 'Nothing to save yet'}
            onPress={save}
            style={[styles.button, styles.saveButton, saveable ? null : styles.saveButtonBlocked]}
          >
            <Text style={styles.saveText}>
              SAVE{staged > 0 ? ` ${staged}` : ''}
            </Text>
          </SfxPressable>
        </View>
      </View>
    </View>
  );
}

/** Shared drag behaviour. Cards spring home; the plan decides where they live. */
function useCardDrag({
  kind,
  onDragStateChange,
  onDrop,
  zoneAt,
  onTap,
}: {
  kind: 'field' | 'bench';
  onDragStateChange: (kind: string | null) => void;
  onDrop: (zone: DropZone | null) => void;
  zoneAt: (pageX: number, pageY: number) => DropZone | null;
  onTap: () => void;
}) {
  const offset = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_event, gesture) => (
        Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2
      ),
      onPanResponderGrant: () => onDragStateChange(kind),
      onPanResponderMove: (_event, gesture) => {
        offset.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_event, gesture) => {
        onDragStateChange(null);
        offset.setValue({ x: 0, y: 0 });
        if (Math.abs(gesture.dx) < TAP_SLOP && Math.abs(gesture.dy) < TAP_SLOP) {
          onTap();
          return;
        }
        onDrop(zoneAt(gesture.moveX, gesture.moveY));
      },
      onPanResponderTerminate: () => {
        onDragStateChange(null);
        offset.setValue({ x: 0, y: 0 });
      },
    }),
  ).current;

  return { offset, handlers: responder.panHandlers };
}

function FieldRow({
  player,
  incoming,
  benched,
  showPortrait,
  onDragStateChange,
  onDrop,
  zoneAt,
}: {
  player: SubstitutionFieldPlayer;
  incoming?: SubstitutionBenchPlayer;
  benched: boolean;
  showPortrait: boolean;
  onDragStateChange: (kind: string | null) => void;
  onDrop: (zone: DropZone | null) => void;
  zoneAt: (pageX: number, pageY: number) => DropZone | null;
}) {
  const { offset, handlers } = useCardDrag({
    kind: 'field',
    onDragStateChange,
    onDrop,
    zoneAt,
    // A tap means "the obvious thing": off to the bench, or back on if staged.
    onTap: () => onDrop(benched ? 'field' : 'bench'),
  });
  const band = energyBand(player.condition);

  return (
    <Animated.View
      {...handlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={benched
        ? `${player.name} is coming off${incoming === undefined ? ' and needs cover' : `, replaced by ${incoming.name}`}. Tap to keep them on.`
        : `${player.name}, ${player.role}, ${Math.round(player.condition)} percent energy. Tap to send them to the bench.`}
      style={[
        styles.row,
        benched ? styles.rowBenched : null,
        player.sentOff ? styles.rowSentOff : null,
        { transform: offset.getTranslateTransform() },
      ]}
    >
      {showPortrait ? (
        <View style={[styles.portrait, benched ? styles.portraitBenched : null]}>
          <Text style={styles.portraitInitials}>{initials(player.name)}</Text>
        </View>
      ) : null}
      <View style={styles.rowCopy}>
        <Text numberOfLines={1} style={styles.rowName}>
          {benched && incoming !== undefined ? incoming.name : player.name}
        </Text>
        <Text style={styles.rowMeta}>
          {benched
            ? incoming === undefined ? 'OPEN — DRAG A SUB IN' : `ON FOR ${surname(player.name).toUpperCase()}`
            : `${player.role} · ${Math.round(player.condition)}%`}
        </Text>
        {benched ? null : (
          <View style={styles.energyTrack}>
            <View
              style={[
                styles.energyFill,
                { backgroundColor: ENERGY_FILL_COLORS[band] },
                { width: `${Math.max(0, Math.min(100, player.condition))}%` },
              ]}
            />
          </View>
        )}
      </View>
      <Text style={styles.grip}>⠿</Text>
    </Animated.View>
  );
}

function BenchRow({
  player,
  comingOn,
  showPortrait,
  onDragStateChange,
  onDrop,
  zoneAt,
}: {
  player: SubstitutionBenchPlayer;
  comingOn: boolean;
  showPortrait: boolean;
  onDragStateChange: (kind: string | null) => void;
  onDrop: (zone: DropZone | null) => void;
  zoneAt: (pageX: number, pageY: number) => DropZone | null;
}) {
  const { offset, handlers } = useCardDrag({
    kind: 'bench',
    onDragStateChange,
    onDrop,
    zoneAt,
    onTap: () => onDrop(comingOn ? 'subs' : 'field'),
  });

  return (
    <Animated.View
      {...handlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={comingOn
        ? `${player.name} is coming on. Tap to leave them on the bench.`
        : `${player.name}, ${player.role}, fresh. Tap to bring them on.`}
      style={[
        styles.row,
        comingOn ? styles.rowComingOn : null,
        { transform: offset.getTranslateTransform() },
      ]}
    >
      {showPortrait ? (
        <View style={[styles.portrait, styles.portraitBench]}>
          <Text style={styles.portraitInitials}>{initials(player.name)}</Text>
        </View>
      ) : null}
      <View style={styles.rowCopy}>
        <Text numberOfLines={1} style={styles.rowName}>{player.name}</Text>
        <Text style={styles.rowMeta}>{player.role} · 100%</Text>
      </View>
      <Text style={comingOn ? styles.comingOnFlag : styles.grip}>{comingOn ? 'ON ▸' : '⠿'}</Text>
    </Animated.View>
  );
}

/** Pixel bench: four legs, two planks and a contact shadow, per docs/11. */
function BenchArt() {
  return (
    <View accessible={false} style={styles.benchArt}>
      <View style={styles.benchShadow} />
      <View style={[styles.benchLeg, { left: 10 }]} />
      <View style={[styles.benchLeg, { right: 10 }]} />
      <View style={styles.benchSeat} />
      <View style={styles.benchSeatLight} />
      <View style={styles.benchBackLeg} />
      <View style={styles.benchBack} />
      <View style={styles.benchBackLight} />
    </View>
  );
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(part => part.length > 0)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}

function surname(name: string): string {
  const parts = name.split(' ').filter(part => part.length > 0);
  return parts[parts.length - 1] ?? name;
}

// Palette from the pixel bible (docs/11): ink #241f2e, ink-soft #3a3350,
// card #2d283c, cream #f4f1ea, muted #bcb7c4, structure #6b6675,
// gold #edb54a, red #d94f52, pitch green #3f8a4a. Wood tones for the bench come
// from the extended world ramp.
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
  counter: {
    color: '#f4f1ea',
    fontFamily: PIXEL_BOLD,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
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
  columnArmed: { borderColor: '#edb54a' },
  columnTitle: { color: '#f4f1ea', fontFamily: PIXEL_BOLD, fontSize: 14, letterSpacing: 1 },
  columnHint: { color: '#8e88a0', fontFamily: PIXEL, fontSize: 10, letterSpacing: 0.8, marginTop: -4 },
  emptyBench: { color: '#8e88a0', fontFamily: PIXEL, fontSize: 11, paddingVertical: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    borderWidth: 2,
    borderColor: '#49415f',
    borderBottomWidth: 3,
    borderBottomColor: '#16121f',
    borderRadius: 3,
    backgroundColor: '#3a3350',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  rowBenched: { backgroundColor: '#2b2438', borderColor: '#edb54a', borderStyle: 'dashed' },
  rowComingOn: { backgroundColor: '#2f5233', borderColor: '#65b96e' },
  rowSentOff: { opacity: 0.4 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowName: { color: '#f4f1ea', fontFamily: PIXEL_BOLD, fontSize: 14 },
  rowMeta: { color: '#bcb7c4', fontFamily: PIXEL, fontSize: 10, marginTop: 4, letterSpacing: 0.6 },
  portrait: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#241f2e',
    backgroundColor: '#5a8fd6',
  },
  portraitBench: { backgroundColor: '#6b6675' },
  portraitBenched: { backgroundColor: '#3a3350' },
  portraitInitials: { color: '#f4f1ea', fontFamily: PIXEL_BOLD, fontSize: 13 },
  energyTrack: { height: 6, marginTop: 6, backgroundColor: '#16121f', overflow: 'hidden' },
  energyFill: { height: 6 },
  grip: { color: '#6b6675', fontFamily: PIXEL_BOLD, fontSize: 16 },
  comingOnFlag: { color: '#65b96e', fontFamily: PIXEL_BOLD, fontSize: 12 },
  benchStrip: {
    gap: 8,
    borderWidth: 2,
    borderColor: '#49415f',
    borderRadius: 3,
    backgroundColor: '#241f2e',
    padding: 12,
  },
  benchStripArmed: { borderColor: '#edb54a', backgroundColor: '#2b2438' },
  benchSeats: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  benchOccupants: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8, minHeight: 48 },
  benchEmptyHint: { color: '#8e88a0', fontFamily: PIXEL, fontSize: 10, letterSpacing: 0.8, alignSelf: 'center' },
  benchChip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderWidth: 2,
    borderColor: '#edb54a',
    borderBottomWidth: 3,
    borderBottomColor: '#16121f',
    borderRadius: 3,
    backgroundColor: '#3a3350',
  },
  benchChipName: { color: '#f4f1ea', fontFamily: PIXEL_BOLD, fontSize: 13 },
  benchChipMeta: { color: '#edb54a', fontFamily: PIXEL, fontSize: 9, marginTop: 2, letterSpacing: 0.6 },
  // --- pixel bench, drawn from blocks so it stays on the pixel grid ---
  benchArt: { width: 96, height: 56 },
  benchShadow: { position: 'absolute', left: 6, bottom: 0, width: 84, height: 5, backgroundColor: 'rgba(0,0,0,0.35)' },
  benchLeg: { position: 'absolute', bottom: 4, width: 8, height: 18, backgroundColor: '#6a4326' },
  benchBackLeg: { position: 'absolute', left: 42, bottom: 20, width: 8, height: 16, backgroundColor: '#6a4326' },
  benchSeat: { position: 'absolute', left: 4, bottom: 20, width: 88, height: 10, backgroundColor: '#8a5a2b' },
  benchSeatLight: { position: 'absolute', left: 4, bottom: 28, width: 88, height: 3, backgroundColor: '#a9713a' },
  benchBack: { position: 'absolute', left: 4, bottom: 36, width: 88, height: 9, backgroundColor: '#8a5a2b' },
  benchBackLight: { position: 'absolute', left: 4, bottom: 43, width: 88, height: 3, backgroundColor: '#a9713a' },
  bertRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  bertSprite: { width: 104, height: 180, marginBottom: -8 },
  speech: {
    flex: 1,
    minWidth: 0,
    borderWidth: 2,
    borderColor: '#f4f1ea',
    borderBottomWidth: 4,
    borderBottomColor: '#16121f',
    borderRadius: 4,
    backgroundColor: '#3f6fb5',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  speechProblem: { backgroundColor: '#a83440', borderColor: '#f2938c' },
  speechName: { color: '#d9e9fb', fontFamily: PIXEL, fontSize: 10, letterSpacing: 1 },
  speechText: { color: '#ffffff', fontFamily: PIXEL, fontSize: 13, lineHeight: 20, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 12 },
  button: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderRadius: 3,
  },
  cancelButton: { borderColor: '#6b6675', borderBottomColor: '#16121f', backgroundColor: '#3a3350' },
  cancelText: { color: '#bcb7c4', fontFamily: PIXEL_BOLD, fontSize: 15, letterSpacing: 1 },
  saveButton: { borderColor: '#a3c8f0', borderBottomColor: '#2b5a97', backgroundColor: '#3f6fb5' },
  saveButtonBlocked: { opacity: 0.45 },
  saveText: { color: '#ffffff', fontFamily: PIXEL_BOLD, fontSize: 15, letterSpacing: 1 },
});

export { BERT_DIRECTION };
