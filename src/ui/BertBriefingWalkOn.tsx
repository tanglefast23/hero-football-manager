import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import type { AssistantGuideContent, AssistantGuideFocus } from '../content/schemas';
import { bertVoiceDurationMs, playBertVoice, stopBertVoice } from '../render/bert-voice';
import { BertFullBody } from './BertFullBody';
import { beatFocus, briefingBeats } from './bert-briefing-beats';
import { NavigationRing, TutorialSpotlight } from './TutorialSpotlight';
import { TutorialTapCue } from './TutorialTapCue';
import { BERT_SPRITE_SIZE } from './bert-walk-frames';
import { CharacterSpeechOverlay } from './CharacterSpeechOverlay';
import { tutorialCuePosition, type TutorialAnchorLayout } from './tutorial-cue-position';

/**
 * Only used until the tab rail has measured itself — the same fallback, and the
 * same reason, as the rookie's walk-on: a fixed clearance cannot be right on
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
  sequenceId: string;
  moneyAnchor?: TutorialAnchorLayout | null;
  navigationAnchor?: TutorialAnchorLayout | null;
  reduceMotion?: boolean;
  /**
   * The lit anchor is measured by screens far above this one, and measurement
   * is gated on knowing which focus is live. Reporting it upward is what keeps
   * the money cutout from going dark the moment the beat that needs it arrives.
   */
  onFocusChange?: (focus: AssistantGuideFocus | undefined) => void;
  /** Fires once, after he has walked off — the sequence is complete then. */
  onDone: () => void;
}

/**
 * Bert's briefing, delivered as a walk-on.
 *
 * This replaces a framed window that boxed him in a card beside its own copy.
 * He now walks onto the screen he is talking about and says his piece one
 * bubble at a time, with the dimming and the lit cutout kept underneath — the
 * charm was never the reason the money beat worked, the spotlight was.
 *
 * One entrance per sequence, not per page: the three-page opening is a single
 * arrival whose spotlight moves as he talks.
 */
export function BertBriefingWalkOn({
  content,
  sequenceId,
  moneyAnchor,
  navigationAnchor,
  reduceMotion = false,
  onFocusChange,
  onDone,
}: BertBriefingWalkOnProps) {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const [beatIndex, setBeatIndex] = useState(0);

  const beats = useMemo(
    () => briefingBeats(content, sequenceId),
    [content, sequenceId],
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

  const spotlightAnchor = focus === 'money' ? moneyAnchor : null;
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
        characterWidth={BERT_SPRITE_SIZE.width * BERT_SCALE}
        characterHeight={BERT_SPRITE_SIZE.height * BERT_SCALE}
        groundOffset={groundOffset}
        reduceMotion={reduceMotion}
        bubbleScale={BERT_BUBBLE_SCALE}
        // No auto-advance. The rookie remarks and moves on; this is the game
        // teaching, and a timer would pull a rule off screen mid-sentence.
        mirrorSprite={false}
        onLineChange={setBeatIndex}
        accessibilityLabel={beat === undefined
          ? undefined
          : `${content.assistant.name}: ${beat.text}`}
        renderCharacter={({ walking }) => (
          <BertFullBody
            // Objectives are authored in capitals, which is what sets the one
            // line stating the next move apart from the flavour around it.
            pointing={focus !== 'assistant'}
            walking={walking}
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
