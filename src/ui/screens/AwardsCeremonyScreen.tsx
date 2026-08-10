import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AWARD_CATEGORIES } from '../../game/division-leaders';
import type { AwardCategoryId } from '../../game/types';
import {
  PLAYER_SPRITE_CELL,
  PlayerRunSprite,
} from '../../render/PlayerRunSprite';
import { CharacterSpeechOverlay } from '../CharacterSpeechOverlay';
import { PixelText } from '../components/PixelText';
import { formatCurrency } from '../components/Scorecard';
import { useReducedMotion } from '../use-reduced-motion';
import {
  arrivingPlacing,
  awardCeremonyStages,
  beatResultStageIndex,
  isWalkOnStage,
  nextStageIndex,
  stageAutoplayMs,
  placingRowLabel,
  podiumNameType,
  podiumRows,
  prizeAccessibilityLabel,
  prizeCountValue,
  prizeCountsUp,
  prizeDetailLine,
  prizeStageIndex,
  stageAccessibilityLabel,
  stageBeat,
  type AwardCeremonyStage,
} from '../awards-ceremony-stage';
import type {
  AwardCeremonyBeatViewModel,
  AwardCeremonyPlacingViewModel,
  AwardCeremonySpeakerViewModel,
  AwardCeremonyViewModel,
} from '../models';
import { useCopy } from '../../i18n';

const SPRITE_SCALE = 4;
/**
 * The band at the top of the stage that belongs to the skip controls.
 *
 * The title is centred on the whole screen, and at the 375pt floor "Division
 * Awards" in 16pt pixel type is about 188pt wide — wider than what is left
 * beside a skip control, so no arrangement of side padding lets the two share a
 * row without wrapping the title or breaking it outright at 320pt. Reserving
 * the band above it instead means the header cannot reach the controls at ANY
 * width, and the title keeps the full measure to be centred in.
 *
 * Derived from the control's own geometry, so growing a button or adding a
 * third one moves the header with it rather than silently colliding.
 */
const SKIP_ROW_INSET = 12;
const SKIP_BUTTON_HEIGHT = 44;
const SKIP_ROW_GAP = 8;
/** Two stacked controls is the most the ceremony ever shows at once. */
const SKIP_CONTROL_COUNT = 2;
const SKIP_CONTROL_BAND =
  SKIP_ROW_INSET +
  SKIP_BUTTON_HEIGHT * SKIP_CONTROL_COUNT +
  SKIP_ROW_GAP * (SKIP_CONTROL_COUNT - 1) +
  SKIP_ROW_INSET;
/** Clearance from the bottom edge, so the podium list stays readable behind him. */
const GROUND_OFFSET = 96;
/** How high the winner hops, and how long each half of the hop takes. */
const JUMP_HEIGHT = 26;
const JUMP_UP_MS = 200;
const JUMP_DOWN_MS = 180;
/** Matches PlayerWalkOnWelcome: a short line still gets time to be read. */
const MIN_LINE_MS = 2_400;
const MS_PER_CHARACTER = 60;

export interface AwardsCeremonyScreenProps {
  viewModel: AwardCeremonyViewModel;
  /**
   * Assigned looks by player ID, for the manager's own squad and any rival the
   * career still holds. A player who is not in it falls back to the stable hash
   * of his ID, which is what the match itself draws him with.
   */
  lookIds?: ReadonlyMap<string, string>;
  reduceMotion?: boolean;
  /**
   * Which stage the ceremony opens on. A career always opens on the first
   * board; this exists for the development QA reel, which has to reach the
   * fourth board and the prize without tapping through everything before them.
   * Read once, so a caller that changes it has to remount.
   */
  initialStageIndex?: number;
  /** Leaves the ceremony. The prize has already been granted by the transition. */
  onComplete: () => void;
}

/**
 * The four division boards, presented one at a time.
 *
 * Per board: the title card, the top three arriving together, then ONE walk-on
 * — the manager's highest-placed player on that podium, and nobody else. A
 * rival never walks on, so a board the manager is nowhere on shows its podium
 * and moves along.
 *
 * It plays itself. Every stage but the walk-on and the prize holds for its own
 * beat and then advances; a tap advances immediately, so tapping through is
 * still the fast path rather than the only path. The walk-on hands over when
 * the sprite has finished speaking, and the prize waits for the button because
 * it is the screen the manager came for.
 *
 * Nothing here decides anything. The prize was granted by the season
 * transition (`startNextFullCareerSeason`), which runs whether this screen is
 * watched to the end, skipped at the first tap, or killed halfway through.
 */
export function AwardsCeremonyScreen({
  viewModel,
  lookIds,
  reduceMotion = false,
  initialStageIndex = 0,
  onComplete,
}: AwardsCeremonyScreenProps) {
  const t = useCopy();
  const reduce = useReducedMotion(reduceMotion);
  const stages = useMemo(() => awardCeremonyStages(viewModel), [viewModel]);
  const [stageIndex, setStageIndex] = useState(Math.max(0, initialStageIndex));
  const stage =
    stages[Math.min(stageIndex, stages.length - 1)] ?? FALLBACK_STAGE;
  const beat = stageBeat(viewModel, stage);
  const walkOn = isWalkOnStage(stage);

  const advance = useCallback(() => {
    setStageIndex((current) => nextStageIndex(stages, current));
  }, [stages]);

  // The clock that plays the ceremony. Keyed on the index as well as the stage
  // so an advance always restarts the hold, and cleared on every change so a
  // tap can never leave a stale timer to skip the stage it lands on.
  useEffect(() => {
    const hold = stageAutoplayMs(stage, reduce);
    if (hold === null) return undefined;
    const timer = setTimeout(advance, hold);
    return () => clearTimeout(timer);
  }, [advance, reduce, stage, stageIndex]);
  const skipWalkOn = useCallback(() => {
    setStageIndex((current) => beatResultStageIndex(stages, current));
  }, [stages]);
  const skipCeremony = useCallback(() => {
    setStageIndex(prizeStageIndex(stages));
  }, [stages]);

  return (
    <SafeAreaView
      className="flex-1 bg-ink"
      edges={['top', 'left', 'right', 'bottom']}
    >
      <Pressable
        accessibilityRole="button"
        // The label carries the podium, not just the action: this control
        // covers the whole screen, and an accessible parent hides the rows
        // underneath it from VoiceOver.
        accessibilityLabel={stageAccessibilityLabel(viewModel, stage, t)}
        accessibilityHint={
          stage.kind === 'prize'
            ? t('awardsCeremony.a11y.tapAnywhereToFinish')
            : t('awardsCeremony.a11y.ceremonyPlaysItself')
        }
        onPress={stage.kind === 'prize' ? onComplete : advance}
        // Static style only: a function-form style on a Pressable drops layout
        // properties on iOS, and this one has to fill the screen.
        style={styles.stage}
      >
        <View style={styles.headerBlock}>
          {/* The skip controls' own row in the column. They are drawn over it,
              because they have to sit above the speech overlay, but the space
              is allocated here so the title can never arrive underneath them. */}
          <View style={styles.controlBand} />
          <View style={styles.header}>
            <PixelText className="text-[10px] uppercase tracking-[3px] text-gold-dark">
              {viewModel.seasonLabel}
            </PixelText>
            <PixelText className="mt-1 text-base uppercase text-ink">
              {t('awardsCeremony.divisionAwards')}
            </PixelText>
          </View>
        </View>

        {stage.kind === 'prize' || beat === undefined ? (
          <PrizePanel viewModel={viewModel} reduceMotion={reduce} />
        ) : (
          <BoardPanel beat={beat} stage={stage} />
        )}

        <View style={styles.footer}>
          <PixelText className="text-[10px] uppercase tracking-[2px] text-ink/60">
            {stage.kind === 'prize'
              ? t('awardsCeremony.tapToFinish')
              : t('awardsCeremony.tapToSkipAhead')}
          </PixelText>
        </View>
      </Pressable>

      {walkOn && beat?.speaker !== undefined ? (
        <AwardWalkOn
          key={`${stage.beatIndex}:${stage.kind}`}
          categoryId={beat.categoryId}
          speaker={beat.speaker}
          lookIds={lookIds}
          reduceMotion={reduce}
          onDone={advance}
        />
      ) : null}

      <View style={styles.skipRow}>
        {walkOn ? (
          <SkipButton
            label={`${t('awardsCeremony.skip')} ▸`}
            hint={t('awardsCeremony.a11y.skipToThePodium')}
            onPress={skipWalkOn}
          />
        ) : null}
        {stage.kind === 'prize' ? null : (
          <SkipButton
            label={`${t('awardsCeremony.skipAll')} ▸▸`}
            hint={t('awardsCeremony.a11y.skipToThePrize')}
            onPress={skipCeremony}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

/** A stage to render when the view model somehow carries no beats at all. */
const FALLBACK_STAGE: AwardCeremonyStage = {
  kind: 'prize',
  beatIndex: -1,
  revealed: 0,
};

function SkipButton({
  label,
  hint,
  onPress,
}: {
  label: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint}
      onPress={onPress}
      // The height is in the static style, never in a pressed-state callback:
      // a function-form style collapses a Pressable to zero height on iOS.
      style={styles.skipButton}
    >
      <PixelText className="text-[10px] uppercase text-paper">
        {label}
      </PixelText>
    </Pressable>
  );
}

/** One board: its title, and however much of its podium has been revealed. */
function BoardPanel({
  beat,
  stage,
}: {
  beat: AwardCeremonyBeatViewModel;
  stage: AwardCeremonyStage;
}) {
  const t = useCopy();
  const rows = podiumRows(beat, stage);
  const arriving = arrivingPlacing(beat, stage);

  return (
    <View style={styles.board}>
      <View style={styles.boardTitle}>
        <PixelText className="text-[10px] uppercase tracking-[3px] text-ink/60">
          {beat.metricLabel}
        </PixelText>
        <PixelText className="mt-1 text-2xl uppercase text-ink">
          {beat.boardLabel}
        </PixelText>
      </View>

      {rows.length === 0 ? (
        <Text className="px-4 py-6 text-center text-sm leading-5 text-paper/60">
          {stage.kind === 'board'
            ? t('awardsCeremony.andTheAwardGoesTo')
            : beat.emptyLabel}
        </Text>
      ) : (
        <View style={styles.podium}>
          {rows.map((placing) => (
            <PodiumRow
              key={placing.playerId}
              placing={placing}
              metricLabel={beat.metricLabel}
              arriving={placing.playerId === arriving?.playerId}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function PodiumRow({
  placing,
  metricLabel,
  arriving,
}: {
  placing: AwardCeremonyPlacingViewModel;
  metricLabel: string;
  arriving: boolean;
}) {
  const t = useCopy();
  // One highlight per board, so the eye always knows where the beat is: the
  // name that has just landed carries the gold, the rest of the podium settles
  // back to paper — or to blue, which is the League board's mark for your own.
  const surface = arriving
    ? 'border-gold-dark bg-gold-light'
    : placing.isUserPlayer
      ? 'border-blue-dark bg-blue-light'
      : 'border-ink/40 bg-paper';
  // A long name is set smaller, never wrapped: see `podiumNameType`. Every row
  // stays 48pt whichever size it lands on, so one long name cannot reflow the
  // two rows already standing beneath it.
  const { nameClass, clubClass } = podiumNameType(placing.playerName);

  return (
    <View
      accessible
      accessibilityLabel={placingRowLabel(placing, metricLabel, t)}
      // The floor is PODIUM_ROW_MIN_HEIGHT, spelled out because NativeWind
      // compiles class strings and cannot read a constant.
      className={`min-h-[68px] flex-row items-center border-2 border-b-4 px-3 py-2 ${surface}`}
    >
      <PixelText variant="data" className="w-8 text-base text-ink">
        {placing.position}
      </PixelText>
      <View className="min-w-0 flex-1 pr-2">
        <Text className={`font-bold text-ink ${nameClass}`} numberOfLines={1}>
          {placing.playerName}
        </Text>
        <Text className={`mt-0.5 text-ink/50 ${clubClass}`} numberOfLines={1}>
          {placing.clubName}
        </Text>
      </View>
      <PixelText variant="data" className="text-base text-ink">
        {placing.value}
      </PixelText>
    </View>
  );
}

/**
 * The ceremony's last beat: what the four boards paid.
 *
 * The figure shown is `totalMoney` and nothing else. The prize tapers
 * per board, so multiplying the per-board rate by the count would overstate
 * every season the club won more than one.
 */
function PrizePanel({
  viewModel,
  reduceMotion,
}: {
  viewModel: AwardCeremonyViewModel;
  reduceMotion: boolean;
}) {
  const t = useCopy();
  const { prize } = viewModel;
  const counts = prizeCountsUp(prize);
  const total = prize.totalMoney;
  const [shown, setShown] = useState(counts && !reduceMotion ? 0 : total);

  // Frame-driven, not a timer sampling the clock: the value belongs to the
  // frame it is painted in, so a dropped frame shortens the climb rather than
  // stuttering it, and the total is reached by arriving at progress 1 instead
  // of by a final tick that may never be scheduled.
  useEffect(() => {
    if (!counts || reduceMotion) {
      setShown(total);
      return undefined;
    }
    let start: number | undefined;
    let frame = 0;
    const step = (timestamp: number) => {
      if (start === undefined) start = timestamp;
      const value = prizeCountValue(total, timestamp - start);
      setShown(value);
      if (value < total) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [counts, reduceMotion, total]);

  return (
    <View
      accessible
      accessibilityLabel={prizeAccessibilityLabel(prize, t)}
      style={styles.board}
    >
      <View style={styles.boardTitle}>
        <PixelText className="text-[10px] uppercase tracking-[3px] text-ink/60">
          {t('awardsCeremony.awardPrize')}
        </PixelText>
        {counts ? (
          <PixelText variant="data" className="mt-2 text-4xl text-ink">
            {formatCurrency(t, shown)}
          </PixelText>
        ) : (
          <PixelText className="mt-2 text-2xl uppercase text-ink">
            {t('awardsCeremony.nothingThisYear')}
          </PixelText>
        )}
      </View>
      <Text className="px-4 pb-5 pt-3 text-center text-sm leading-5 text-paper/80">
        {prizeDetailLine(prize, t)}
      </Text>
    </View>
  );
}

/**
 * The manager's highest-placed player on this board, walking on to say one
 * line. Whether it reads as a win or a near miss was decided by the view model,
 * which drew the line from the matching pool.
 *
 * The same overlay the transfer welcome uses, so a ceremony arrival and a
 * signing arrival are visibly the same event: nothing new to learn, and one
 * path to fix when the walk changes.
 */
function AwardWalkOn({
  categoryId,
  speaker,
  lookIds,
  reduceMotion,
  onDone,
}: {
  categoryId: AwardCategoryId;
  speaker: AwardCeremonySpeakerViewModel;
  lookIds?: ReadonlyMap<string, string>;
  reduceMotion: boolean;
  onDone: () => void;
}) {
  const t = useCopy();
  const { placing, line } = speaker;
  // The board's own position line. A keeper board can only be topped by a
  // keeper, so the category is a better source for the sprite than any field
  // the placing would have to carry around for it.
  const role = AWARD_CATEGORIES[categoryId].role;
  const lookId = lookIds?.get(placing.playerId);

  return (
    <CharacterSpeechOverlay
      lines={[line]}
      characterWidth={PLAYER_SPRITE_CELL.width * SPRITE_SCALE}
      characterHeight={PLAYER_SPRITE_CELL.height * SPRITE_SCALE}
      groundOffset={GROUND_OFFSET}
      autoAdvanceMs={Math.max(MIN_LINE_MS, line.length * MS_PER_CHARACTER)}
      reduceMotion={reduceMotion}
      accessibilityLabel={t('awardsCeremony.a11y.playerSays', {
        player: placing.playerName,
        line,
      })}
      renderCharacter={({ phase, walking }) => (
        <CelebratingPlayer
          playerId={placing.playerId}
          role={role}
          {...(lookId === undefined ? {} : { lookId })}
          jumping={phase === 'speaking'}
          walking={walking}
          reduceMotion={reduceMotion}
        />
      )}
      onDone={onDone}
    />
  );
}

/**
 * One hop as he arrives on his mark.
 *
 * Reduced motion drops the hop and not the sprite: the line, the name and the
 * podium all still say who won, so nothing is lost but the flourish.
 */
function CelebratingPlayer({
  playerId,
  role,
  lookId,
  jumping,
  walking,
  reduceMotion,
}: {
  playerId: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  lookId?: string;
  jumping: boolean;
  walking: boolean;
  reduceMotion: boolean;
}) {
  const hop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion || !jumping) return undefined;
    const animation = Animated.sequence([
      Animated.timing(hop, {
        toValue: 1,
        duration: JUMP_UP_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(hop, {
        toValue: 0,
        duration: JUMP_DOWN_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [hop, jumping, reduceMotion]);

  return (
    <Animated.View
      style={{
        transform: [
          {
            translateY: hop.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -JUMP_HEIGHT],
            }),
          },
        ],
      }}
    >
      <PlayerRunSprite
        playerId={playerId}
        role={role}
        {...(lookId === undefined ? {} : { lookId })}
        scale={SPRITE_SCALE}
        walking={walking}
      />
    </Animated.View>
  );
}

/** The two-column content width every other card in the game stops at. */
const CEREMONY_MAX_WIDTH = 1180;

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: '#f4f1ea',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerBlock: {
    width: '100%',
    maxWidth: CEREMONY_MAX_WIDTH,
    alignSelf: 'center',
  },
  controlBand: { height: SKIP_CONTROL_BAND },
  header: { alignItems: 'center', paddingBottom: 16 },
  footer: {
    alignItems: 'center',
    paddingTop: 16,
    maxWidth: CEREMONY_MAX_WIDTH,
    alignSelf: 'center',
    width: '100%',
  },
  board: {
    // The podium is a card, and cards in this game stop at the two-column
    // content width. Left unbounded it ran the full width of a desktop window,
    // so a three-name table was stretched across two thousand pixels with the
    // names at one end and the numbers at the other.
    width: '100%',
    maxWidth: CEREMONY_MAX_WIDTH,
    alignSelf: 'center',
    borderWidth: 3,
    borderColor: '#edb54a',
    backgroundColor: 'rgba(58,51,80,0.92)',
  },
  boardTitle: {
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: '#edb54a',
    backgroundColor: '#f4f1ea',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  podium: { gap: 8, padding: 12 },
  skipRow: {
    position: 'absolute',
    right: SKIP_ROW_INSET,
    top: SKIP_ROW_INSET,
    zIndex: 20,
    gap: SKIP_ROW_GAP,
  },
  skipButton: {
    minWidth: 96,
    minHeight: SKIP_BUTTON_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(244,241,234,0.55)',
    backgroundColor: 'rgba(36,31,46,0.82)',
    paddingHorizontal: 12,
  },
});
