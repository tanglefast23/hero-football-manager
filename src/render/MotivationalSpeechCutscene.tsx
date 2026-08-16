import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { loadLaunchContent } from '../content';
import { useCopy, proseSlug } from '../i18n';
import { CharacterSpeechOverlay } from '../ui/CharacterSpeechOverlay';
import { CrossPlatformModal } from '../ui/components/CrossPlatformModal';
import { resolveCoachPortraitId } from '../ui/components/coach-portrait';
import { ManagementSprite } from '../ui/components/ManagementSprite';
import { startTheme, stopTheme } from './audio';
import {
  playCoachVoice,
  playSpeechThunder,
  startSpeechGospel,
  stopCoachSpeechAudio,
  teardownCoachSpeechAudio,
} from './coach-speech-audio';

/**
 * The half-time motivational speech, as the manager sees it.
 *
 * Four seconds: thunder and a white flash, the head coach large in the middle
 * of the screen saying his piece, and `+X` cards popping all over the pitch
 * while a gospel bed runs under the lot. The match theme is paused for the
 * duration and resumes when it ends.
 *
 * WHAT THIS COMPONENT DOES NOT OWN. The bubble, the taps, the focus trap and
 * the accessibility escape all belong to `CharacterSpeechOverlay`, which is
 * already the app's one talking-character surface — `RivalHeroIntroScreen` uses
 * it in exactly this configuration (centred, `instant`, character drawn by the
 * parent). This wrapper owns only what is genuinely new: the flash, the cards,
 * the audio, the big coach, and the four-second cap.
 *
 * The lift itself is not here. It was recorded as a `MOTIVATIONAL_SPEECH` match
 * input before this ever opened, so nothing on screen can change the result.
 */

/** The whole cutscene, however it ends. */
const CUTSCENE_MS = 4_000;
/** White-out, then gone. Reduced motion gets a gentle dim instead. */
const FLASH_MS = 450;
const DIM_MS = 250;
/** The coach lands like a slam rather than growing. */
const COACH_ENTER_MS = 260;
/** Mouth open, mouth shut. Slow enough to read as speech, not as a strobe. */
const FLAP_MS = 130;
/** How many lines a tap can walk through before the cutscene gives up. */
const LINES_PER_RUN = 4;
/** Cards, and how far apart they start. 16 × 180ms fills the middle 3s. */
const CARD_COUNT = 16;
const CARD_STAGGER_MS = 180;
const CARD_POP_MS = 160;
const CARD_HOLD_MS = 500;
const CARD_FADE_MS = 200;
/** Source pixels of one management sprite, and the whole-multiple scale used. */
const COACH_SPRITE_SOURCE_WIDTH = 24;
const COACH_SPRITE_SOURCE_HEIGHT = 29;
const COACH_SCALE = 8;
/** A line takes about this long to say. Matches the Bert voice's short band. */
const VOICE_MS = 1_400;

export interface MotivationalSpeechCutsceneProps {
  /** The `+X` on every card — the second half's lift, by current division. */
  readonly boost: number;
  readonly coachName: string;
  readonly coachPortraitId: string;
  readonly reduceMotion?: boolean;
  /** Fires exactly once, however the cutscene ended. */
  readonly onDone: () => void;
}

interface CardSpot {
  readonly id: number;
  readonly leftRatio: number;
  readonly topRatio: number;
  readonly delayMs: number;
}

export function MotivationalSpeechCutscene({
  boost,
  coachName,
  coachPortraitId,
  reduceMotion = false,
  onDone,
}: MotivationalSpeechCutsceneProps) {
  const t = useCopy();
  const { height, width } = useWindowDimensions();

  /**
   * The four lines this run will show, translated, sampled without replacement.
   *
   * Sampling without replacement is what gives the owner's tap rule for free:
   * the first bubble is random, every tap moves to a DIFFERENT random line, and
   * the tap past the last one ends the cutscene early. The overlay's ordinary
   * tap-to-advance does all of it — there is no tap handler in this file.
   *
   * Resolved through `t` and never from the raw JSON. The English sentence is
   * the key's source, so `coach.speech.<slug>` is what a locale translates, and
   * a pool read straight out of `content/` would ship English to six languages.
   */
  const lines = useMemo(() => {
    const pool = loadLaunchContent().coachSpeechLines.lines.map((line) =>
      t(`coach.speech.${proseSlug(line)}`),
    );
    const shuffled = [...pool];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swap]] = [shuffled[swap]!, shuffled[index]!];
    }
    return shuffled.slice(0, LINES_PER_RUN);
  }, [t]);

  /**
   * Generated ONCE, not during render. A re-render that re-rolled these would
   * teleport every card that is currently mid-animation.
   */
  const cards = useRef<readonly CardSpot[] | null>(null);
  if (cards.current === null) {
    cards.current = Array.from({ length: CARD_COUNT }, (_unused, id) => ({
      id,
      // Kept off the extreme edges so a card is never half off screen, and out
      // of the middle band where the coach and his bubble already are.
      leftRatio: 0.06 + Math.random() * 0.76,
      topRatio:
        Math.random() < 0.5
          ? 0.05 + Math.random() * 0.2
          : 0.62 + Math.random() * 0.24,
      delayMs: Math.round(id * CARD_STAGGER_MS + Math.random() * 60),
    }));
  }

  const coachWidth = COACH_SPRITE_SOURCE_WIDTH * COACH_SCALE;
  const coachHeight = COACH_SPRITE_SOURCE_HEIGHT * COACH_SCALE;
  // The coach stands a little below centre, which leaves the bubble the top of
  // the screen and the cards the corners.
  const groundOffset = Math.max(
    0,
    Math.round(height * 0.5 - coachHeight * 0.5),
  );

  // One identity for the whole cutscene, expression varied on top of it. A
  // legend coach's portrait id is not in the sheet, and resolving per
  // expression would hash `:point` and `:joy` to two different stand-ins —
  // the coach would change face eight times a second.
  const portraitId = useMemo(
    () => resolveCoachPortraitId(coachPortraitId),
    [coachPortraitId],
  );

  const [mouthOpen, setMouthOpen] = useState(false);
  const flash = useRef(new Animated.Value(1)).current;
  const coachScale = useRef(new Animated.Value(reduceMotion ? 1 : 0.6)).current;

  /**
   * `finish` and unmount are DIFFERENT events and must stay that way.
   *
   * `finish` completes the cutscene: it silences the speech audio, gives the
   * match its theme back, and tells the parent once. Unmount only cancels —
   * MatchScreen's own cleanup is already stopping the theme and tearing down
   * match audio, so a `startTheme()` from here would raise a wanted flag
   * against a player that is being released.
   */
  const finishedRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const finish = useRef(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    stopCoachSpeechAudio();
    startTheme();
    onDoneRef.current();
  }).current;

  /**
   * The coach speaks once per LINE, and its identity must be stable.
   *
   * `CharacterSpeechOverlay` is not memoized and its announce effect depends on
   * `[lineIndex, onLineChange]` (`CharacterSpeechOverlay.tsx:549`). The mouth
   * flap below re-renders this component every 130ms, so an inline arrow here
   * would hand the overlay a NEW callback eight times a second, re-fire that
   * effect, and re-seek the voice on every flap — the exact "re-seeked on a
   * timer plays only its first sound" failure `coach-speech-audio.ts` is
   * written to avoid. A ref keeps one identity for the life of the cutscene.
   *
   * This also covers the FIRST line: the overlay reports line 0 on mount, so
   * the effect below must not speak as well or the opening line seeks twice.
   */
  const speakLine = useRef(() => playCoachVoice(VOICE_MS)).current;

  // Audio, the entrance, the mouth, and the hard cap. One effect, because they
  // start together and its cleanup is the cancel-only unmount path.
  useEffect(() => {
    stopTheme();
    startSpeechGospel();
    playSpeechThunder();
    // The voice is NOT started here. The overlay announces line 0 on mount and
    // `speakLine` handles it, so speaking here too would seek the opening line
    // twice — and the second seek cancels the first on iOS.

    Animated.timing(flash, {
      toValue: 0,
      duration: reduceMotion ? DIM_MS : FLASH_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    if (!reduceMotion) {
      Animated.timing(coachScale, {
        toValue: 1,
        duration: COACH_ENTER_MS,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: true,
      }).start();
    }

    const flap = reduceMotion
      ? null
      : setInterval(() => setMouthOpen((open) => !open), FLAP_MS);
    const cap = setTimeout(finish, CUTSCENE_MS);

    return () => {
      if (flap !== null) clearInterval(flap);
      clearTimeout(cap);
      // Cancel only. No onDone, no startTheme — see `finish` above.
      teardownCoachSpeechAudio();
    };
  }, [coachScale, finish, flash, reduceMotion]);

  return (
    <CrossPlatformModal
      animationType="none"
      onRequestClose={finish}
      transparent
      visible
    >
      <View style={styles.root}>
        {/* The cards sit behind the coach and are decorative: a screen reader
            gets the coach's line, not sixteen identical numbers. */}
        <View
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        >
          {cards.current.map((card) => (
            <BoostCard
              key={card.id}
              boost={boost}
              left={card.leftRatio * width}
              reduceMotion={reduceMotion}
              spot={card}
              top={card.topRatio * height}
            />
          ))}
        </View>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.coach,
            { bottom: groundOffset, left: width / 2 - coachWidth / 2 },
            { transform: [{ scale: coachScale }] },
          ]}
        >
          <ManagementSprite
            accessibilityLabel={coachName}
            spriteKey={`coach:${portraitId}:${mouthOpen ? 'joy' : 'point'}`}
            width={coachWidth}
          />
        </Animated.View>

        {/* NO `typewriter`. A typewritten line spends its first tap finishing
            itself, and the owner's rule is that EVERY tap moves to a new line.
            The coach reads as talking from the mouth flap and his voice, which
            is what was asked for; a reveal would also eat most of a 4s budget
            on a 64-character line. */}
        <CharacterSpeechOverlay
          accessibilityLabel={coachName}
          characterCentreRatio={0.5}
          characterHeight={coachHeight}
          characterWidth={coachWidth}
          focusOnMount
          groundOffset={groundOffset}
          handleAccessibilityEscape
          hideCharacter
          instant
          lines={lines}
          onDone={finish}
          onLineChange={speakLine}
          reduceMotion={reduceMotion}
        />

        {/* Last child, over everything, and never in the way of a tap. */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.flash,
            reduceMotion ? styles.flashDim : null,
            { opacity: flash },
          ]}
        />
      </View>
    </CrossPlatformModal>
  );
}

/** One `+X`, popped in and gone. */
function BoostCard({
  boost,
  left,
  reduceMotion,
  spot,
  top,
}: {
  readonly boost: number;
  readonly left: number;
  readonly reduceMotion: boolean;
  readonly spot: CardSpot;
  readonly top: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.delay(spot.delayMs),
      Animated.timing(progress, {
        toValue: 1,
        duration: reduceMotion ? 1 : CARD_POP_MS,
        easing: Easing.out(Easing.back(2.4)),
        useNativeDriver: true,
      }),
      Animated.delay(CARD_HOLD_MS),
      Animated.timing(progress, {
        toValue: 0,
        duration: CARD_FADE_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [progress, reduceMotion, spot.delayMs]);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          left,
          top,
          opacity: progress,
          transform: reduceMotion
            ? []
            : [
                {
                  scale: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1],
                  }),
                },
              ],
        },
      ]}
    >
      <Text style={styles.cardText}>{`+${boost}`}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  coach: { position: 'absolute' },
  flash: { backgroundColor: '#ffffff' },
  // Reduced motion gets a dark veil rather than a white strobe. A full-screen
  // white flash is a photosensitivity risk, not only a matter of taste.
  flashDim: { backgroundColor: '#241f2e' },
  card: {
    position: 'absolute',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 3,
    borderColor: '#241f2e',
    borderRadius: 8,
    backgroundColor: '#ffe14d',
    shadowColor: '#241f2e',
    shadowOffset: { width: 4, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  cardText: {
    color: '#241f2e',
    fontSize: 22,
    fontWeight: 'bold',
  },
});
