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
import {
  BlurMask,
  Canvas,
  DashPathEffect,
  RoundedRect,
} from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';
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
  filledShirtLabel,
  isBenched,
  isComingOn,
  openShirtLabel,
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
const BERT_DIRECTION = 'Drag your tired players down to the bench, then drag replacements into their shirts. As many as you like — save when you are happy.';
/** Below this the modal stacks and lists two names per row. */
const WIDE_BOARD_MIN_WIDTH = 900;
/** A release inside this radius is a tap, not a drag. */
const TAP_SLOP = 8;
/** Dash pattern for an open shirt, and how fast it marches when armed. */
const DASH_INTERVALS = [11, 11] as const;
const DASH_MARCH_PT_PER_SECOND = 44;
const SHIRT_RADIUS = 3;
const SHIRT_STROKE = 3;
const SHIRT_DASH_IDLE = '#c8862a';
const SHIRT_DASH_ARMED = '#f7d894';

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
 * Sending a starter down opens their shirt as a dotted box naming them; dropping
 * a substitute in fills it and takes that substitute out of the right-hand column
 * — they are on the pitch now, so listing them as available would be a lie.
 *
 * Dragging is the headline gesture, but every card is also a plain tap that does
 * the obvious thing for where the card currently is, which keeps the board usable
 * with a screen reader or a thumb that would rather not drag.
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
  const [draggingRole, setDraggingRole] = useState<'GK' | 'OUTFIELD' | null>(null);
  const [draggingKind, setDraggingKind] = useState<'field' | 'bench' | null>(null);
  const zonesRef = useRef<ZoneRects>({});

  const substitutionsRemaining = Math.max(0, MAX_SUBSTITUTIONS - substitutionsUsed);
  const orderedField = useMemo(() => fieldByTiredness(field), [field]);
  // A substitute already in a shirt is on the pitch, so they leave this column.
  const availableBench = useMemo(
    () => bench.filter(player => !isComingOn(plan, player.id)),
    [bench, plan],
  );
  const problem = planProblem(plan, substitutionsRemaining);
  const saveable = canSave(plan, substitutionsRemaining);
  const staged = stagedCount(plan);
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

  const startDrag = useCallback((kind: 'field' | 'bench', role: SubstitutionFieldPlayer['role']) => {
    setDraggingKind(kind);
    setDraggingRole(role === 'GK' ? 'GK' : 'OUTFIELD');
  }, []);
  const endDrag = useCallback(() => {
    setDraggingKind(null);
    setDraggingRole(null);
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

  const dropStarter = useCallback((player: SubstitutionFieldPlayer, zone: DropZone | null) => {
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

  const dropSubstitute = useCallback((player: SubstitutionBenchPlayer, zone: DropZone | null) => {
    if (zone === 'field') {
      const move = bringOn(plan, player, field);
      applyMove(
        move.plan,
        move.rejection === undefined ? undefined : SUBSTITUTION_REJECTION_MESSAGES[move.rejection],
      );
      return;
    }
    if ((zone === 'subs' || zone === 'bench') && isComingOn(plan, player.id)) {
      // Out of the shirt, back to the column — the shirt reopens, the starter
      // stays on the bench.
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

  const reset = useCallback(() => {
    playUiClickSfx();
    setPlan(EMPTY_SUBSTITUTION_PLAN);
    setMessage(null);
  }, []);

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
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.counter}>{substitutionsUsed + staged} / {MAX_SUBSTITUTIONS}</Text>
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
            always reachable on a phone and on a short desktop window alike. */}
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={styles.scroll}
        >
          <View style={wide ? styles.columns : styles.columnsStacked}>
            <View onLayout={measureZone('field')} style={[styles.column, styles.fieldColumn]}>
              <Text style={styles.columnTitle}>FIELD</Text>
              <Text style={styles.columnHint}>MOST TIRED FIRST</Text>
              <View style={wide ? null : styles.grid}>
                {orderedField.map(player => {
                  const incoming = bench.find(sub => sub.id === replacementFor(plan, player.index));
                  const benched = isBenched(plan, player.index);
                  // Only shirts this dragged substitute could legally fill march.
                  const armed = benched
                    && incoming === undefined
                    && draggingKind === 'bench'
                    && draggingRole === (player.role === 'GK' ? 'GK' : 'OUTFIELD');
                  return benched ? (
                    <ShirtRow
                      key={player.index}
                      outgoing={player}
                      incoming={incoming}
                      armed={armed}
                      compact={!wide}
                      onDragStart={startDrag}
                      onDragEnd={endDrag}
                      onDrop={zone => (incoming === undefined
                        ? dropStarter(player, zone)
                        : dropSubstitute(incoming, zone))}
                      zoneAt={zoneAt}
                    />
                  ) : (
                    <StarterRow
                      key={player.index}
                      player={player}
                      showPortrait={wide}
                      compact={!wide}
                      onDragStart={startDrag}
                      onDragEnd={endDrag}
                      onDrop={zone => dropStarter(player, zone)}
                      zoneAt={zoneAt}
                    />
                  );
                })}
              </View>
            </View>

            <View
              onLayout={measureZone('subs')}
              style={[styles.column, draggingKind === 'field' ? styles.columnArmed : null]}
            >
              <Text style={styles.columnTitle}>SUBSTITUTIONS</Text>
              <Text style={styles.columnHint}>FRESH LEGS ENTER AT 100%</Text>
              {availableBench.length === 0 ? (
                <Text style={styles.emptyBench}>
                  {bench.length === 0 ? 'NOBODY LEFT ON THE BENCH.' : 'EVERY SUBSTITUTE IS ON.'}
                </Text>
              ) : (
                <View style={wide ? null : styles.grid}>
                  {availableBench.map(player => (
                    <SubstituteRow
                      key={player.id}
                      player={player}
                      showPortrait={wide}
                      compact={!wide}
                      onDragStart={startDrag}
                      onDragEnd={endDrag}
                      onDrop={zone => dropSubstitute(player, zone)}
                      zoneAt={zoneAt}
                    />
                  ))}
                </View>
              )}
            </View>
          </View>

          <View
            onLayout={measureZone('bench')}
            style={[styles.benchStrip, draggingKind === 'field' ? styles.benchStripArmed : null]}
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
                        {player.role} · {slot.replacementId === null ? 'NEEDS COVER' : 'COVERED'}
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
              : problem ?? 'Nothing to save yet'}
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

/** Shared drag behaviour. Cards spring home; the plan decides where they live. */
function useCardDrag({
  onDragStart,
  onDragEnd,
  onDrop,
  zoneAt,
  onTap,
}: {
  onDragStart: () => void;
  onDragEnd: () => void;
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
      onPanResponderGrant: () => onDragStart(),
      onPanResponderMove: (_event, gesture) => {
        offset.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_event, gesture) => {
        onDragEnd();
        offset.setValue({ x: 0, y: 0 });
        if (Math.abs(gesture.dx) < TAP_SLOP && Math.abs(gesture.dy) < TAP_SLOP) {
          onTap();
          return;
        }
        onDrop(zoneAt(gesture.moveX, gesture.moveY));
      },
      onPanResponderTerminate: () => {
        onDragEnd();
        offset.setValue({ x: 0, y: 0 });
      },
    }),
  ).current;

  return { offset, handlers: responder.panHandlers };
}

/**
 * The dotted shirt border, drawn in Skia so its dashes can actually march. A
 * View's dashed border has no animatable offset; DashPathEffect has a phase.
 * The phase counts DOWN because a rounded rect path runs clockwise, so a falling
 * phase carries the dashes forward along it.
 */
function MarchingBorder({ width, height, armed }: { width: number; height: number; armed: boolean }) {
  const clock = useSharedValue(0);
  useFrameCallback((info) => {
    'worklet';
    clock.value = info.timeSinceFirstFrame ?? 0;
  }, armed);
  const phase = useDerivedValue(() => (
    armed ? -((clock.value / 1000) * DASH_MARCH_PT_PER_SECOND) : 0
  ));

  if (width <= 0 || height <= 0) return null;
  const inset = SHIRT_STROKE / 2;
  return (
    <Canvas pointerEvents="none" style={[StyleSheet.absoluteFill, { width, height }]}>
      <RoundedRect
        x={inset}
        y={inset}
        width={Math.max(0, width - SHIRT_STROKE)}
        height={Math.max(0, height - SHIRT_STROKE)}
        r={SHIRT_RADIUS}
        style="stroke"
        strokeWidth={SHIRT_STROKE}
        color={armed ? SHIRT_DASH_ARMED : SHIRT_DASH_IDLE}
      >
        <DashPathEffect intervals={[...DASH_INTERVALS]} phase={phase} />
        {armed ? <BlurMask blur={3} style="solid" /> : null}
      </RoundedRect>
    </Canvas>
  );
}

/** An open or filled shirt: the hole a benched starter leaves behind. */
function ShirtRow({
  outgoing,
  incoming,
  armed,
  compact,
  onDragStart,
  onDragEnd,
  onDrop,
  zoneAt,
}: {
  outgoing: SubstitutionFieldPlayer;
  incoming?: SubstitutionBenchPlayer;
  armed: boolean;
  compact: boolean;
  onDragStart: (kind: 'field' | 'bench', role: SubstitutionFieldPlayer['role']) => void;
  onDragEnd: () => void;
  onDrop: (zone: DropZone | null) => void;
  zoneAt: (pageX: number, pageY: number) => DropZone | null;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const filled = incoming !== undefined;
  const { offset, handlers } = useCardDrag({
    // A filled shirt drags its substitute back out; an empty one drags the
    // starter back on.
    onDragStart: () => onDragStart(filled ? 'bench' : 'field', outgoing.role),
    onDragEnd,
    onDrop,
    zoneAt,
    onTap: () => onDrop(filled ? 'subs' : 'field'),
  });

  return (
    <Animated.View
      {...handlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={filled
        ? `${incoming.name}, ${incoming.role}, on for ${outgoing.name}. Tap to send them back to the bench.`
        : `${outgoing.name}'s ${outgoing.role} shirt is empty. Drag a substitute in, or tap to keep ${outgoing.name} on.`}
      onLayout={event => setSize({
        width: event.nativeEvent.layout.width,
        height: event.nativeEvent.layout.height,
      })}
      style={[
        styles.shirt,
        filled ? styles.shirtFilled : null,
        compact ? styles.gridCell : null,
        { transform: offset.getTranslateTransform() },
      ]}
    >
      <MarchingBorder width={size.width} height={size.height} armed={armed} />
      {filled && !compact ? (
        <View style={styles.portrait}>
          <Text style={styles.portraitInitials}>{initials(incoming.name)}</Text>
        </View>
      ) : null}
      <View style={styles.rowCopy}>
        <Text numberOfLines={1} style={styles.shirtName}>
          {filled ? incoming.name : openShirtLabel(compact ? surname(outgoing.name) : outgoing.name, compact)}
          <Text style={styles.role}> {filled ? incoming.role : outgoing.role}</Text>
        </Text>
        <Text style={styles.shirtMeta}>
          {filled ? filledShirtLabel(outgoing.name) : `${outgoing.role} SHIRT · EMPTY`}
        </Text>
      </View>
      {compact ? null : <Text style={styles.grip}>⠿</Text>}
    </Animated.View>
  );
}

function StarterRow({
  player,
  showPortrait,
  compact,
  onDragStart,
  onDragEnd,
  onDrop,
  zoneAt,
}: {
  player: SubstitutionFieldPlayer;
  showPortrait: boolean;
  compact: boolean;
  onDragStart: (kind: 'field' | 'bench', role: SubstitutionFieldPlayer['role']) => void;
  onDragEnd: () => void;
  onDrop: (zone: DropZone | null) => void;
  zoneAt: (pageX: number, pageY: number) => DropZone | null;
}) {
  const { offset, handlers } = useCardDrag({
    onDragStart: () => onDragStart('field', player.role),
    onDragEnd,
    onDrop,
    zoneAt,
    onTap: () => onDrop('bench'),
  });
  const band = energyBand(player.condition);

  return (
    <Animated.View
      {...handlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${player.name}, ${player.role}, ${Math.round(player.condition)} percent energy. Tap to send them to the bench.`}
      style={[
        styles.row,
        player.sentOff ? styles.rowSentOff : null,
        compact ? styles.gridCell : null,
        { transform: offset.getTranslateTransform() },
      ]}
    >
      {showPortrait ? (
        <View style={styles.portrait}>
          <Text style={styles.portraitInitials}>{initials(player.name)}</Text>
        </View>
      ) : null}
      <View style={styles.rowCopy}>
        <Text numberOfLines={1} style={styles.rowName}>
          {compact ? surname(player.name) : player.name}
          <Text style={styles.role}> {player.role}</Text>
        </Text>
        <Text style={styles.rowMeta}>{Math.round(player.condition)}%</Text>
        <View style={styles.energyTrack}>
          <View
            style={[
              styles.energyFill,
              { backgroundColor: ENERGY_FILL_COLORS[band] },
              { width: `${Math.max(0, Math.min(100, player.condition))}%` },
            ]}
          />
        </View>
      </View>
      {compact ? null : <Text style={styles.grip}>⠿</Text>}
    </Animated.View>
  );
}

function SubstituteRow({
  player,
  showPortrait,
  compact,
  onDragStart,
  onDragEnd,
  onDrop,
  zoneAt,
}: {
  player: SubstitutionBenchPlayer;
  showPortrait: boolean;
  compact: boolean;
  onDragStart: (kind: 'field' | 'bench', role: SubstitutionFieldPlayer['role']) => void;
  onDragEnd: () => void;
  onDrop: (zone: DropZone | null) => void;
  zoneAt: (pageX: number, pageY: number) => DropZone | null;
}) {
  const { offset, handlers } = useCardDrag({
    onDragStart: () => onDragStart('bench', player.role),
    onDragEnd,
    onDrop,
    zoneAt,
    onTap: () => onDrop('field'),
  });

  return (
    <Animated.View
      {...handlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${player.name}, ${player.role}, fresh. Tap to bring them on.`}
      style={[
        styles.row,
        compact ? styles.gridCell : null,
        { transform: offset.getTranslateTransform() },
      ]}
    >
      {showPortrait ? (
        <View style={[styles.portrait, styles.portraitBench]}>
          <Text style={styles.portraitInitials}>{initials(player.name)}</Text>
        </View>
      ) : null}
      <View style={styles.rowCopy}>
        <Text numberOfLines={1} style={styles.rowName}>
          {compact ? surname(player.name) : player.name}
          <Text style={styles.role}> {player.role}</Text>
        </Text>
        <Text style={styles.rowMeta}>100%</Text>
      </View>
      {compact ? null : <Text style={styles.grip}>⠿</Text>}
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
// card #2d283c, cream #f4f1ea, muted #bcb7c4, structure #6b6675, gold #edb54a,
// red #d94f52. Wood tones for the bench come from the extended world ramp.
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
  counter: { color: '#f4f1ea', fontFamily: PIXEL_BOLD, fontSize: 16, fontVariant: ['tabular-nums'] },
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
  // Two names per row on a phone, so a squad fits without scrolling.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridCell: { width: '48.5%', minHeight: 62 },
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
  rowSentOff: { opacity: 0.4 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowName: { color: '#f4f1ea', fontFamily: PIXEL_BOLD, fontSize: 14 },
  rowMeta: { color: '#bcb7c4', fontFamily: PIXEL, fontSize: 10, marginTop: 4, letterSpacing: 0.6 },
  role: { color: '#a3c8f0', fontFamily: PIXEL_BOLD, fontSize: 11, letterSpacing: 0.5 },
  // The shirt has no View border of its own: MarchingBorder draws it in Skia.
  shirt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    borderRadius: 3,
    backgroundColor: 'rgba(237,181,74,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  shirtFilled: { backgroundColor: 'rgba(237,181,74,0.12)' },
  shirtName: { color: '#f7d894', fontFamily: PIXEL_BOLD, fontSize: 14 },
  shirtMeta: { color: '#edb54a', fontFamily: PIXEL, fontSize: 10, marginTop: 4, letterSpacing: 0.6 },
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
  portraitInitials: { color: '#f4f1ea', fontFamily: PIXEL_BOLD, fontSize: 13 },
  energyTrack: { height: 6, marginTop: 6, backgroundColor: '#16121f', overflow: 'hidden' },
  energyFill: { height: 6 },
  grip: { color: '#6b6675', fontFamily: PIXEL_BOLD, fontSize: 16 },
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

export { BERT_DIRECTION };
