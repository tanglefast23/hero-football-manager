import { useEffect, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import {
  BERT_SPRITE_SIZE,
  BERT_WALK_FRAMES,
  BERT_WALK_STEP_MS,
  type BertWalkFrame,
} from './bert-walk-frames';

/**
 * The players' agent: shades, sharp charcoal suit, gold tie, briefcase.
 *
 * Built the same way as `BertFullBody` — absolutely-positioned rectangles in a
 * 104x180 box, not a bitmap — so he scales crisply and costs nothing to bundle.
 * The two share a screen at season end and have to be made of the same stuff;
 * a sprite-sheet agent beside a rectangle Bert reads as two games.
 *
 * He is deliberately the opposite silhouette to Bert at every point where a
 * glance has to tell them apart on a dimmed screen. Bert is stout, bald,
 * moustached, warm-skinned, in a purple-navy suit with a red tie. The agent is
 * narrow-shouldered, black-haired with a hard side part, clean-shaven and cool,
 * in near-black charcoal with gold. The shades do most of the work: a face with
 * no visible eyes is the one silhouette in this game that reads instantly as
 * "this man is not on your side".
 */
export interface AgentFullBodyProps {
  /**
   * The closing pose: briefcase raised, free hand out flat. Used when he has
   * stopped walking and is naming his number.
   */
  presenting?: boolean;
  /** Runs the two-frame cycle. False parks him on the standing frame. */
  walking?: boolean;
  /** The walk-on draws its own contact shadow, so the baked one doubles up. */
  groundShadow?: boolean;
  /**
   * Whole numbers are safest. He is rectangles rather than a bitmap, so a
   * fraction resamples no texture and costs only a hairline where an edge lands
   * mid-pixel. Halves are fine; avoid anything finer.
   */
  scale?: number;
}

/** The sprite box, shared with Bert so the two stand at a matching height. */
export const AGENT_SPRITE_SIZE = BERT_SPRITE_SIZE;

export function AgentFullBody({
  presenting = false,
  walking = false,
  groundShadow = true,
  scale = 1,
}: AgentFullBodyProps) {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (!walking) {
      setFrameIndex(0);
      return undefined;
    }
    const timer = setInterval(
      () => setFrameIndex(current => (current + 1) % BERT_WALK_FRAMES.length),
      BERT_WALK_STEP_MS,
    );
    return () => clearInterval(timer);
  }, [walking]);

  const frame = BERT_WALK_FRAMES[frameIndex]!;
  // A raised briefcase cannot also swing at his side, so travelling always uses
  // the arms-down variant. Presenting is what he does once he has stopped.
  const showPresenting = presenting && !walking;

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.frame, {
        width: AGENT_SPRITE_SIZE.width * scale,
        height: AGENT_SPRITE_SIZE.height * scale,
      }]}
    >
      {/* Centred inside the frame so the default centre-origin scale lands him
          exactly on its edges. Scaling before the bob keeps a one-pixel bob one
          *sprite* pixel at any size, which is what makes his walk read the same
          next to Bert's when both are scaled up. */}
      <View style={[styles.sprite, { transform: [{ scale }, { translateY: frame.bodyDy }] }]}>
        {groundShadow ? (
          <View style={[styles.groundShadow, raise(1, frame, 'groundShadow')]} />
        ) : null}
        <View style={[styles.leftShoe, raise(6, frame, 'leftShoe')]} />
        <View style={[styles.rightShoe, raise(6, frame, 'rightShoe')]} />
        <View style={[styles.leftLeg, raise(15, frame, 'leftLeg', 39)]} />
        <View style={[styles.rightLeg, raise(15, frame, 'rightLeg', 39)]} />
        <View style={styles.jacket} />
        <View style={styles.shirt} />
        <View style={styles.tie} />
        <View style={styles.tieKnot} />
        <View style={styles.leftLapel} />
        <View style={styles.rightLapel} />
        <View style={styles.pocketSquare} />

        {/* His left arm — the briefcase side. Raised when presenting, hanging
            with the case at his knee otherwise. */}
        {showPresenting ? (
          <>
            <View style={styles.presentingArm} />
            <View style={styles.presentingHand} />
            <View style={styles.raisedCase} />
            <View style={styles.raisedCaseHandle} />
            <View style={styles.raisedCaseClasp} />
          </>
        ) : (
          <>
            <View style={[styles.leftArm, drop(101, frame, 'leftArm')]} />
            <View style={[styles.leftHand, drop(131, frame, 'leftHand')]} />
            <View style={[styles.hangingCaseHandle, drop(141, frame, 'leftHand')]} />
            <View style={[styles.hangingCase, drop(146, frame, 'leftHand')]} />
            <View style={[styles.hangingCaseClasp, drop(154, frame, 'leftHand')]} />
          </>
        )}

        <View style={[styles.rightArm, drop(101, frame, 'rightArm')]} />
        <View style={[styles.rightHand, drop(139, frame, 'rightHand')]} />

        <View style={styles.leftEar} />
        <View style={styles.rightEar} />
        <View style={styles.headTop} />
        <View style={styles.headFace} />
        <View style={styles.headJaw} />
        {/* Hair: a flat slab with a hard side part cut into it, then a widow's
            peak. Three rectangles, and between them the whole "slicked back"
            read that separates him from Bert's bald crown. */}
        <View style={styles.hairSlab} />
        <View style={styles.hairPart} />
        <View style={styles.hairPeak} />
        <View style={styles.leftSideburn} />
        <View style={styles.rightSideburn} />
        {/* The shades, in three pieces: two lenses and the bridge between them.
            Drawn over the face rather than instead of it, so the cheekbones
            still carry the light. */}
        <View style={styles.leftLens} />
        <View style={styles.rightLens} />
        <View style={styles.lensBridge} />
        <View style={styles.leftLensGlint} />
        <View style={styles.nose} />
        <View style={styles.mouth} />
      </View>
    </View>
  );
}

/**
 * A bottom-anchored part. `dy` is measured down the screen, so raising the part
 * means increasing its distance from the bottom edge.
 *
 * Overrides plain box properties rather than composing a transform: the arms
 * carry authored `rotate` transforms, and a second `transform` in a later style
 * object replaces the first outright instead of merging with it.
 */
function raise(
  bottom: number,
  frame: BertWalkFrame,
  part: keyof BertWalkFrame['parts'],
  height?: number,
): ViewStyle {
  const delta = frame.parts[part];
  return height === undefined
    ? { bottom: bottom - delta.dy }
    : { bottom: bottom - delta.dy, height: height + (delta.dh ?? 0) };
}

/** A top-anchored part, where `dy` down the screen is simply a larger `top`. */
function drop(
  top: number,
  frame: BertWalkFrame,
  part: keyof BertWalkFrame['parts'],
): ViewStyle {
  return { top: top + frame.parts[part].dy };
}

/**
 * The palette, named once.
 *
 * `SUIT` is near-black rather than the charcoal it started as. Charcoal was
 * chosen against a white panel; standing on the same dimmed screen Bert stands
 * on, it sat close enough to the dim that his shoulders vanished and he read as
 * a floating head. The same mistake Bert's hair made, in the same place.
 */
const SUIT = '#241f2e';
const SUIT_LIGHT = '#3a3350';
const SHIRT = '#f4f1ea';
const GOLD = '#edb54a';
const SKIN = '#eab48c';
const SKIN_SHADE = '#cf9268';
const HAIR = '#16121f';
const LENS = '#16121f';
const LEATHER = '#6a4326';

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center' },
  sprite: { width: 104, height: 180 },
  groundShadow: { position: 'absolute', left: 18, bottom: 1, width: 70, height: 9, backgroundColor: '#c9c5d0' },

  leftShoe: { position: 'absolute', left: 29, bottom: 6, width: 23, height: 9, backgroundColor: '#16121f' },
  rightShoe: { position: 'absolute', right: 25, bottom: 6, width: 23, height: 9, backgroundColor: '#16121f' },
  leftLeg: { position: 'absolute', left: 33, bottom: 15, width: 17, height: 39, backgroundColor: SUIT },
  rightLeg: { position: 'absolute', right: 29, bottom: 15, width: 17, height: 39, backgroundColor: SUIT },

  // Narrower than Bert's 60-wide jacket: he is tailored, Bert is comfortable.
  jacket: { position: 'absolute', left: 27, top: 88, width: 52, height: 52, backgroundColor: SUIT },
  shirt: { position: 'absolute', left: 44, top: 90, width: 17, height: 44, backgroundColor: SHIRT },
  tie: { position: 'absolute', left: 49, top: 99, width: 7, height: 33, backgroundColor: GOLD },
  tieKnot: { position: 'absolute', left: 47, top: 93, width: 11, height: 8, backgroundColor: '#c8862a' },
  leftLapel: { position: 'absolute', left: 34, top: 92, width: 16, height: 26, backgroundColor: SUIT_LIGHT, transform: [{ rotate: '16deg' }] },
  rightLapel: { position: 'absolute', right: 33, top: 92, width: 16, height: 26, backgroundColor: SUIT_LIGHT, transform: [{ rotate: '-16deg' }] },
  pocketSquare: { position: 'absolute', right: 34, top: 112, width: 10, height: 5, backgroundColor: GOLD },

  // Shorter than the free arm on the other side: this one is carrying, and a
  // carried arm hangs from the shoulder rather than swinging the full length.
  leftArm: { position: 'absolute', left: 20, top: 101, width: 12, height: 32, backgroundColor: SUIT, transform: [{ rotate: '4deg' }] },
  leftHand: { position: 'absolute', left: 21, top: 131, width: 12, height: 12, backgroundColor: SKIN },
  rightArm: { position: 'absolute', right: 18, top: 101, width: 12, height: 42, backgroundColor: SUIT, transform: [{ rotate: '-4deg' }] },
  rightHand: { position: 'absolute', right: 19, top: 139, width: 12, height: 14, backgroundColor: SKIN },

  // The briefcase at rest hangs off the left hand and travels with it, so the
  // walk swings the case rather than leaving it hovering beside a moving arm.
  // Hip height, clear of the ground shadow at bottom 1. A case resting on the
  // floor reads as luggage he has put down, which is the opposite of a man who
  // has come in to deliver one number and leave.
  hangingCase: { position: 'absolute', left: 9, top: 146, width: 32, height: 22, backgroundColor: LEATHER },
  hangingCaseHandle: { position: 'absolute', left: 19, top: 141, width: 12, height: 6, backgroundColor: '#3d2a22' },
  hangingCaseClasp: { position: 'absolute', left: 32, top: 154, width: 6, height: 5, backgroundColor: GOLD },

  presentingArm: { position: 'absolute', left: 10, top: 99, width: 28, height: 12, backgroundColor: SUIT, transform: [{ rotate: '-12deg' }] },
  presentingHand: { position: 'absolute', left: 4, top: 95, width: 14, height: 13, backgroundColor: SKIN },
  // Kept inside the 104-wide box. At left -6 it hung over the sprite's edge and
  // was clipped by the frame, which crops at exactly the sprite bounds.
  raisedCase: { position: 'absolute', left: 0, top: 105, width: 34, height: 26, backgroundColor: LEATHER },
  raisedCaseHandle: { position: 'absolute', left: 11, top: 100, width: 13, height: 6, backgroundColor: '#3d2a22' },
  raisedCaseClasp: { position: 'absolute', left: 11, top: 115, width: 7, height: 5, backgroundColor: GOLD },

  leftEar: { position: 'absolute', left: 21, top: 44, width: 11, height: 24, backgroundColor: SKIN_SHADE },
  rightEar: { position: 'absolute', right: 21, top: 44, width: 11, height: 24, backgroundColor: SKIN_SHADE },
  headTop: { position: 'absolute', left: 32, top: 14, width: 42, height: 22, backgroundColor: SKIN },
  headFace: { position: 'absolute', left: 27, top: 28, width: 52, height: 46, backgroundColor: SKIN },
  headJaw: { position: 'absolute', left: 33, top: 68, width: 40, height: 22, backgroundColor: SKIN_SHADE },

  hairSlab: { position: 'absolute', left: 27, top: 12, width: 52, height: 20, backgroundColor: HAIR },
  // The part: a thin bright line raked across the slab, off centre. This is the
  // single detail that turns a black rectangle into slicked hair.
  hairPart: { position: 'absolute', left: 58, top: 13, width: 4, height: 16, backgroundColor: '#3a3350', transform: [{ rotate: '9deg' }] },
  hairPeak: { position: 'absolute', left: 44, top: 28, width: 16, height: 7, backgroundColor: HAIR },
  leftSideburn: { position: 'absolute', left: 27, top: 30, width: 7, height: 18, backgroundColor: HAIR },
  rightSideburn: { position: 'absolute', right: 26, top: 30, width: 7, height: 18, backgroundColor: HAIR },

  leftLens: { position: 'absolute', left: 32, top: 45, width: 18, height: 12, backgroundColor: LENS },
  rightLens: { position: 'absolute', right: 31, top: 45, width: 18, height: 12, backgroundColor: LENS },
  lensBridge: { position: 'absolute', left: 49, top: 48, width: 8, height: 3, backgroundColor: LENS },
  // One bright corner. Without it the lenses are two dead holes; with it they
  // are glass, and he is a man wearing sunglasses indoors on purpose.
  leftLensGlint: { position: 'absolute', left: 34, top: 47, width: 6, height: 3, backgroundColor: '#6b6675' },

  nose: { position: 'absolute', left: 47, top: 57, width: 11, height: 14, backgroundColor: SKIN_SHADE },
  // A flat line, not Bert's open mouth. He is not pleased to be here either.
  mouth: { position: 'absolute', left: 44, top: 78, width: 17, height: 4, backgroundColor: '#8a4f38' },
});
