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
import { PLAYER_SPRITE_CELL, PlayerRunSprite } from '../../render/PlayerRunSprite';
import { CharacterSpeechOverlay } from '../CharacterSpeechOverlay';
import { PixelText } from '../components/PixelText';
import { useReducedMotion } from '../use-reduced-motion';
import {
  arrivingPlacing,
  awardCeremonyStages,
  beatResultStageIndex,
  isWalkOnStage,
  nextStageIndex,
  placingRowLabel,
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
  AwardCeremonyViewModel,
} from '../models';

const SPRITE_SCALE = 4;
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
  /** Leaves the ceremony. The prize has already been granted by the transition. */
  onComplete: () => void;
}

/**
 * The four division boards, presented one at a time.
 *
 * Per board: the title card, then third, second and first arriving in turn,
 * then the winner walking on to speak. A RIVAL winner gets exactly the same
 * entry, hop and line as one of the manager's own — a rival taking the Golden
 * Boot off you has to look like he won it, or taking it back next season is
 * worth nothing. Only the prize and the runner-up walk-on know whose player it
 * was.
 *
 * Nothing here decides anything. The prize was granted by the season
 * transition (`startNextFullCareerSeason`), which runs whether this screen is
 * watched to the end, skipped at the first tap, or killed halfway through.
 */
export function AwardsCeremonyScreen({
  viewModel,
  lookIds,
  reduceMotion = false,
  onComplete,
}: AwardsCeremonyScreenProps) {
  const reduce = useReducedMotion(reduceMotion);
  const stages = useMemo(() => awardCeremonyStages(viewModel), [viewModel]);
  const [stageIndex, setStageIndex] = useState(0);
  const stage = stages[Math.min(stageIndex, stages.length - 1)] ?? FALLBACK_STAGE;
  const beat = stageBeat(viewModel, stage);
  const walkOn = isWalkOnStage(stage);

  const advance = useCallback(() => {
    setStageIndex(current => nextStageIndex(stages, current));
  }, [stages]);
  const skipWalkOn = useCallback(() => {
    setStageIndex(current => beatResultStageIndex(stages, current));
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
        accessibilityLabel={stageAccessibilityLabel(viewModel, stage)}
        accessibilityHint={stage.kind === 'prize'
          ? 'Tap anywhere to finish'
          : 'Tap anywhere to continue the ceremony'}
        onPress={stage.kind === 'prize' ? onComplete : advance}
        // Static style only: a function-form style on a Pressable drops layout
        // properties on iOS, and this one has to fill the screen.
        style={styles.stage}
      >
        <View style={styles.header}>
          <PixelText className="text-[10px] uppercase tracking-[3px] text-gold">
            {viewModel.seasonLabel}
          </PixelText>
          <PixelText className="mt-1 text-base uppercase text-paper">
            Division Awards
          </PixelText>
        </View>

        {stage.kind === 'prize' || beat === undefined ? (
          <PrizePanel viewModel={viewModel} reduceMotion={reduce} />
        ) : (
          <BoardPanel beat={beat} stage={stage} />
        )}

        <View style={styles.footer}>
          <PixelText className="text-[10px] uppercase tracking-[2px] text-paper/60">
            {stage.kind === 'prize' ? 'Tap to finish' : 'Tap to continue'}
          </PixelText>
        </View>
      </Pressable>

      {walkOn && beat !== undefined ? (
        <AwardWalkOn
          key={`${stage.beatIndex}:${stage.kind}`}
          beat={beat}
          stage={stage}
          lookIds={lookIds}
          reduceMotion={reduce}
          onDone={advance}
        />
      ) : null}

      <View style={styles.skipRow}>
        {walkOn ? (
          <SkipButton label="Skip ▸" hint="Skip to the podium" onPress={skipWalkOn} />
        ) : null}
        {stage.kind === 'prize' ? null : (
          <SkipButton label="Skip all ▸▸" hint="Skip to the prize" onPress={skipCeremony} />
        )}
      </View>
    </SafeAreaView>
  );
}

/** A stage to render when the view model somehow carries no beats at all. */
const FALLBACK_STAGE: AwardCeremonyStage = { kind: 'prize', beatIndex: -1, revealed: 0 };

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
      <PixelText className="text-[10px] uppercase text-paper">{label}</PixelText>
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
  const rows = podiumRows(beat, stage);
  const arriving = arrivingPlacing(beat, stage);

  return (
    <View style={styles.board}>
      <View style={styles.boardTitle}>
        <PixelText className="text-[10px] uppercase tracking-[3px] text-ink/60">
          {beat.metricLabel}
        </PixelText>
        <PixelText className="mt-1 text-2xl uppercase text-ink">{beat.boardLabel}</PixelText>
      </View>

      {rows.length === 0 ? (
        <Text className="px-4 py-6 text-center text-sm leading-5 text-paper/60">
          {stage.kind === 'board' ? 'And the award goes to…' : beat.emptyLabel}
        </Text>
      ) : (
        <View style={styles.podium}>
          {rows.map(placing => (
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
  // One highlight per board, so the eye always knows where the beat is: the
  // name that has just landed carries the gold, the rest of the podium settles
  // back to paper — or to blue, which is the League board's mark for your own.
  const surface = arriving
    ? 'border-gold-dark bg-gold-light'
    : placing.isUserPlayer
      ? 'border-blue-dark bg-blue-light'
      : 'border-ink/40 bg-paper';

  return (
    <View
      accessible
      accessibilityLabel={placingRowLabel(placing, metricLabel)}
      className={`min-h-12 flex-row items-center border-2 border-b-4 px-3 py-2 ${surface}`}
    >
      <PixelText variant="data" className="w-8 text-base text-ink">{placing.position}</PixelText>
      <View className="min-w-0 flex-1 pr-2">
        <Text className="text-base font-bold text-ink" numberOfLines={1}>{placing.playerName}</Text>
        <Text className="mt-0.5 text-sm text-ink/50" numberOfLines={1}>{placing.clubName}</Text>
      </View>
      <PixelText variant="data" className="text-base text-ink">{placing.value}</PixelText>
    </View>
  );
}

/**
 * The ceremony's last beat: what the four boards paid.
 *
 * The figure shown is `totalTrainingPoints` and nothing else. The prize tapers
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
  const { prize } = viewModel;
  const counts = prizeCountsUp(prize);
  const total = prize.totalTrainingPoints;
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
    <View accessible accessibilityLabel={prizeAccessibilityLabel(prize)} style={styles.board}>
      <View style={styles.boardTitle}>
        <PixelText className="text-[10px] uppercase tracking-[3px] text-ink/60">
          Award prize
        </PixelText>
        {counts ? (
          <PixelText variant="data" className="mt-2 text-4xl text-ink">
            {shown} TP
          </PixelText>
        ) : (
          <PixelText className="mt-2 text-2xl uppercase text-ink">Nothing this year</PixelText>
        )}
      </View>
      <Text className="px-4 pb-5 pt-3 text-center text-sm leading-5 text-paper/80">
        {prizeDetailLine(prize)}
      </Text>
    </View>
  );
}

/**
 * The winner — or the manager's runner-up — walking on to say one line.
 *
 * The same overlay the transfer welcome uses, so a ceremony arrival and a
 * signing arrival are visibly the same event: nothing new to learn, and one
 * path to fix when the walk changes.
 */
function AwardWalkOn({
  beat,
  stage,
  lookIds,
  reduceMotion,
  onDone,
}: {
  beat: AwardCeremonyBeatViewModel;
  stage: AwardCeremonyStage;
  lookIds?: ReadonlyMap<string, string>;
  reduceMotion: boolean;
  onDone: () => void;
}) {
  const speaker = stage.kind === 'winner' ? beat.winner : beat.runnerUp;
  const line = stage.kind === 'winner' ? beat.winnerLine : beat.runnerUpLine;
  if (speaker === undefined || line === undefined) return null;

  // The board's own position line. A keeper board can only be topped by a
  // keeper, so the category is a better source for the sprite than any field
  // the placing would have to carry around for it.
  const role = AWARD_CATEGORIES[beat.categoryId].role;
  const lookId = lookIds?.get(speaker.playerId);

  return (
    <CharacterSpeechOverlay
      lines={[line]}
      characterWidth={PLAYER_SPRITE_CELL.width * SPRITE_SCALE}
      characterHeight={PLAYER_SPRITE_CELL.height * SPRITE_SCALE}
      groundOffset={GROUND_OFFSET}
      autoAdvanceMs={Math.max(MIN_LINE_MS, line.length * MS_PER_CHARACTER)}
      reduceMotion={reduceMotion}
      accessibilityLabel={`${speaker.playerName} says: ${line}`}
      renderCharacter={({ phase, walking }) => (
        <CelebratingPlayer
          playerId={speaker.playerId}
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
        transform: [{
          translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -JUMP_HEIGHT] }),
        }],
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

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  header: { alignItems: 'center', paddingBottom: 16 },
  footer: { alignItems: 'center', paddingTop: 16 },
  board: {
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
  skipRow: { position: 'absolute', right: 12, top: 12, zIndex: 20, gap: 8 },
  skipButton: {
    minWidth: 96,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(244,241,234,0.55)',
    backgroundColor: 'rgba(36,31,46,0.82)',
    paddingHorizontal: 12,
  },
});
