import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import type { AssistantGuideContent, AssistantGuideFocus } from '../content/schemas';
import { bertVoiceDurationMs, playBertVoice, stopBertVoice } from '../render/bert-voice';
import { BertFullBody } from './BertFullBody';
import { beatFocus, briefingBeats } from './bert-briefing-beats';
import { beatMoment } from './bert-beat-moments';
import { NavigationRing, TutorialSpotlight } from './TutorialSpotlight';
import { TutorialTapCue } from './TutorialTapCue';
import { BERT_SPRITE_SIZE } from './bert-walk-frames';
import { CharacterSpeechOverlay } from './CharacterSpeechOverlay';
import { tutorialCuePosition, type TutorialAnchorLayout } from './tutorial-cue-position';

/**
 * Only used until the tab rail has measured itself — the same fallback, and the
 * same reason as the rookie's welcome: a fixed clearance cannot be right on
 * both a phone and a desktop window.
 */
const FALLBACK_GROUND_OFFSET = 78;

/**
 * How much bigger he stands than his authored 104x180.
 *
 * Life size read as a doll on a dimmed screen; double filled better than half a
 * phone. This sits between them.
 *
 * `docs/11-art-style.md` asks for whole-number scaling and `PlayerRunSprite`
 * repeats it, but both are aimed at bitmaps, where a fractional scale resamples
 * a texture and turns crunchy pixels to mush. Bert is solid rectangles: 1.5x
 * resamples nothing and only lands some *edges* on half-pixels, which the
 * compositor resolves as a hairline rather than a blur. That is the reason this
 * one figure is allowed a fraction and the sprite atlas is not.
 */
const BERT_SCALE = 1.5;
/** Enough to keep the type in proportion with him without crowding a phone. */
const BERT_BUBBLE_SCALE = 1.15;

export interface BertBriefingWalkOnProps {
  content: AssistantGuideContent;
  sequenceId?: string;
  /** A one-off persisted remark, such as a Cup giant-killing celebration. */
  customMessage?: {
    readonly title: string;
    readonly body: string | readonly string[];
  };
  moneyAnchor?: TutorialAnchorLayout | null;
  navigationAnchor?: TutorialAnchorLayout | null;
  /** The League sub-tab the beat is about, so the scrim lifts off it. */
  subTabAnchor?: TutorialAnchorLayout | null;
  reduceMotion?: boolean;
  /**
   * The lit anchor is measured by screens far above this one, and measurement
   * is gated on knowing which focus is live. Reporting it upward is what keeps
   * the money cutout from going dark the moment the beat that needs it arrives.
   */
  onFocusChange?: (focus: AssistantGuideFocus | undefined) => void;
  /** Fires once the player dismisses his final line. */
  onDone: () => void;
}

/**
 * Bert's briefing, delivered directly on the current screen.
 *
 * This replaces a framed window that boxed him in a card beside its own copy.
 * He appears on the screen he is talking about and says his piece one bubble
 * at a time, with the dimming and the lit cutout kept underneath — the charm
 * was never the reason the money beat worked, the spotlight was.
 *
 * The three-page opening remains one uninterrupted briefing whose spotlight
 * moves as he talks.
 */
export function BertBriefingWalkOn({
  content,
  sequenceId,
  customMessage,
  moneyAnchor,
  navigationAnchor,
  subTabAnchor,
  reduceMotion = false,
  onFocusChange,
  onDone,
}: BertBriefingWalkOnProps) {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const [beatIndex, setBeatIndex] = useState(0);

  const beats = useMemo(
    () => customMessage === undefined
      ? briefingBeats(content, sequenceId ?? '')
      : (typeof customMessage.body === 'string'
          ? [customMessage.body]
          : customMessage.body
        ).map((text, pageIndex) => ({
          text,
          focus: 'assistant' as const,
          kind: 'body' as const,
          pageIndex,
        })),
    [content, customMessage, sequenceId],
  );
  const beat = beats[Math.min(beatIndex, Math.max(0, beats.length - 1))];
  const focus = beatFocus(beats, beatIndex);

  useEffect(() => {
    onFocusChange?.(focus);
  }, [focus, onFocusChange]);

  // He ticks his way through each bubble for as long as its copy takes to say,
  // and stops the moment the player taps on — a tick still running under the
  // next line reads as two people talking.
  useEffect(() => {
    if (beat === undefined) return undefined;
    playBertVoice(bertVoiceDurationMs(beat.text));
    return () => stopBertVoice();
  }, [beat]);

  const groundOffset = navigationAnchor
    ? Math.max(0, viewportHeight - navigationAnchor.y)
    : FALLBACK_GROUND_OFFSET;

  if (beats.length === 0) return null;

  const spotlightAnchor = focus === 'money'
    ? moneyAnchor
    : focus === 'navigation'
      ? navigationAnchor
      // The board beats point at a sub-tab rather than a chip or the rail, and
      // a tab talked about under the scrim reads as one he is not talking
      // about.
      : focus === 'division-leaders' || focus === 'national-cup'
        ? subTabAnchor
        : null;
  const moneyCuePosition = focus === 'money' && moneyAnchor
    ? tutorialCuePosition(moneyAnchor, viewportWidth)
    : null;

  return (
    <View
      accessibilityViewIsModal
      accessibilityLabel={`${content.assistant.name}, ${content.assistant.role}`}
      style={StyleSheet.absoluteFill}
    >
      <TutorialSpotlight
        anchor={spotlightAnchor}
        viewportWidth={viewportWidth}
        viewportHeight={viewportHeight}
      />

      {moneyCuePosition ? (
        <TutorialTapCue label="Look here" detail="Weekly money" direction="up" style={moneyCuePosition} />
      ) : null}

      {focus === 'navigation' && navigationAnchor ? (
        <NavigationRing anchor={navigationAnchor} />
      ) : null}

      <CharacterSpeechOverlay
        lines={beats.map(entry => entry.text)}
        heading={customMessage?.title}
        characterWidth={BERT_SPRITE_SIZE.width * BERT_SCALE}
        characterHeight={BERT_SPRITE_SIZE.height * BERT_SCALE}
        groundOffset={groundOffset}
        reduceMotion={reduceMotion}
        instant
        typewriter
        bubbleScale={BERT_BUBBLE_SCALE}
        // No auto-advance. The rookie remarks and moves on; this is the game
        // teaching, and a timer would pull a rule off screen mid-sentence.
        mirrorSprite={false}
        onLineChange={setBeatIndex}
        accessibilityLabel={beat === undefined
          ? undefined
          : `${content.assistant.name}: ${beat.text}`}
        renderCharacter={() => (
          <BertFullBody
            pointing={focus !== 'assistant'}
            // The look is matched to the line, so it changes as he talks. It
            // supersedes `pointing` whenever one is found; `pointing` remains
            // the fallback for a sequence with no authored run.
            moment={beatMoment(sequenceId ?? 'national-cup', beats, beatIndex)}
            walking={false}
            scale={BERT_SCALE}
            // The overlay draws its own contact shadow; his built-in one would
            // stack a second, darker patch under the same feet.
            groundShadow={false}
          />
        )}
        onDone={onDone}
      />
    </View>
  );
}
