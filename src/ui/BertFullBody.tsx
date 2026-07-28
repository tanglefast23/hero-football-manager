import { useEffect, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import {
  BERT_SPRITE_SIZE,
  BERT_WALK_FRAMES,
  BERT_WALK_STEP_MS,
  type BertWalkFrame,
} from './bert-walk-frames';

export interface BertFullBodyProps {
  /** The talking pose: one arm out at whatever he is describing. */
  pointing: boolean;
  /**
   * Runs the two-frame cycle. False parks him on the standing frame, which is
   * the authored pose exactly — same contract as `PlayerRunSprite`.
   */
  walking?: boolean;
  /**
   * The walk-on draws its own contact shadow under the character, so the one
   * baked into the figure would double up.
   */
  groundShadow?: boolean;
  /**
   * Whole numbers are safest. He is rectangles rather than a bitmap, so a
   * fraction resamples no texture and costs only a hairline where an edge lands
   * mid-pixel — unlike `PlayerRunSprite`, whose scale must stay integral or the
   * atlas blurs. Halves are fine; avoid anything finer.
   */
  scale?: number;
}

/**
 * The Gaffer: bald crown, heavy brow, moustache and old club suit.
 *
 * He is thirty absolutely-positioned rectangles rather than a sprite, so he
 * scales crisply and costs nothing to bundle — but it also means his walk is
 * arithmetic on those rectangles instead of a row of cells in the atlas. The
 * offsets live in `bert-walk-frames.ts`; this file only applies them.
 */
export function BertFullBody({
  pointing,
  walking = false,
  groundShadow = true,
  scale = 1,
}: BertFullBodyProps) {
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

  const frame = BERT_WALK_FRAMES[frameIndex];
  // A pointing arm cannot also swing, so travelling always uses the arms-down
  // variant. Pointing is what he does once he has stopped and started talking.
  const showPointing = pointing && !walking;

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.bertFrame, {
        width: BERT_SPRITE_SIZE.width * scale,
        height: BERT_SPRITE_SIZE.height * scale,
      }]}
    >
      {/* Centred inside the frame so the default centre-origin scale lands him
          exactly on its edges, with no transform-origin to get wrong. Scaling
          before the bob means a one-pixel bob is one *sprite* pixel at any
          size, which is what keeps the walk reading the same when he grows. */}
      <View
        style={[styles.bertSprite, { transform: [{ scale }, { translateY: frame.bodyDy }] }]}
      >
      {groundShadow ? (
        <View style={[styles.bertGroundShadow, raise(1, frame, 'groundShadow')]} />
      ) : null}
      <View style={[styles.bertLeftShoe, raise(6, frame, 'leftShoe')]} />
      <View style={[styles.bertRightShoe, raise(6, frame, 'rightShoe')]} />
      <View style={[styles.bertLeftLeg, raise(15, frame, 'leftLeg', 37)]} />
      <View style={[styles.bertRightLeg, raise(15, frame, 'rightLeg', 37)]} />
      <View style={styles.bertJacket} />
      <View style={styles.bertShirt} />
      <View style={styles.bertTie} />
      <View style={styles.bertLeftLapelle} />
      <View style={styles.bertRightLapelle} />
      {showPointing ? (
        <>
          <View style={styles.bertPointingArm} />
          <View style={styles.bertPointingHand} />
          <View style={styles.bertPointingFinger} />
        </>
      ) : (
        <>
          <View style={[styles.bertLeftArm, drop(101, frame, 'leftArm')]} />
          <View style={[styles.bertLeftHand, drop(137, frame, 'leftHand')]} />
        </>
      )}
      <View style={[styles.bertRightArm, drop(101, frame, 'rightArm')]} />
      <View style={[styles.bertRightHand, drop(137, frame, 'rightHand')]} />
      <View style={styles.bertLeftEar} />
      <View style={styles.bertRightEar} />
      <View style={styles.bertHeadTop} />
      <View style={styles.bertHeadFace} />
      <View style={styles.bertHeadJaw} />
      <View style={styles.bertLeftHair} />
      <View style={styles.bertRightHair} />
      <View style={styles.bertBaldHighlight} />
      <View style={styles.bertLeftBrow} />
      <View style={styles.bertRightBrow} />
      <View style={styles.bertLeftEye} />
      <View style={styles.bertRightEye} />
      <View style={styles.bertNose} />
      <View style={styles.bertNoseLight} />
      <View style={styles.bertMoustacheLeft} />
      <View style={styles.bertMoustacheRight} />
        <View style={styles.bertMouth} />
      </View>
    </View>
  );
}

/**
 * A bottom-anchored part. `dy` is measured down the screen, so raising the part
 * means increasing its distance from the bottom edge.
 *
 * These override plain box properties rather than composing a transform: the
 * arms carry authored `rotate` transforms, and a second `transform` in a later
 * style object replaces the first outright instead of merging with it.
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

const styles = StyleSheet.create({
  bertFrame: { alignItems: 'center', justifyContent: 'center' },
  bertSprite: { width: 104, height: 180 },
  bertGroundShadow: { position: 'absolute', left: 14, bottom: 1, width: 78, height: 9, backgroundColor: '#c9c5d0' },
  bertLeftShoe: { position: 'absolute', left: 26, bottom: 6, width: 25, height: 10, backgroundColor: '#241f2e' },
  bertRightShoe: { position: 'absolute', right: 22, bottom: 6, width: 25, height: 10, backgroundColor: '#241f2e' },
  bertLeftLeg: { position: 'absolute', left: 31, bottom: 15, width: 18, height: 37, backgroundColor: '#3a3350' },
  bertRightLeg: { position: 'absolute', right: 26, bottom: 15, width: 18, height: 37, backgroundColor: '#3a3350' },
  bertJacket: { position: 'absolute', left: 23, top: 88, width: 60, height: 51, backgroundColor: '#3a3350' },
  bertShirt: { position: 'absolute', left: 43, top: 91, width: 20, height: 43, backgroundColor: '#f4f1ea' },
  bertTie: { position: 'absolute', left: 49, top: 96, width: 9, height: 35, backgroundColor: '#d94f52' },
  bertLeftLapelle: { position: 'absolute', left: 31, top: 93, width: 18, height: 26, backgroundColor: '#5b3a91', transform: [{ rotate: '18deg' }] },
  bertRightLapelle: { position: 'absolute', right: 30, top: 93, width: 18, height: 26, backgroundColor: '#5b3a91', transform: [{ rotate: '-18deg' }] },
  bertPointingArm: { position: 'absolute', left: 3, top: 101, width: 33, height: 13, backgroundColor: '#3a3350', transform: [{ rotate: '-8deg' }] },
  bertPointingHand: { position: 'absolute', left: 0, top: 98, width: 15, height: 14, backgroundColor: '#cf9268' },
  bertPointingFinger: { position: 'absolute', left: -8, top: 101, width: 13, height: 6, backgroundColor: '#eab48c' },
  bertLeftArm: { position: 'absolute', left: 16, top: 101, width: 13, height: 42, backgroundColor: '#3a3350', transform: [{ rotate: '5deg' }] },
  bertLeftHand: { position: 'absolute', left: 17, top: 137, width: 13, height: 15, backgroundColor: '#cf9268' },
  bertRightArm: { position: 'absolute', right: 14, top: 101, width: 13, height: 42, backgroundColor: '#3a3350', transform: [{ rotate: '-5deg' }] },
  bertRightHand: { position: 'absolute', right: 15, top: 137, width: 13, height: 15, backgroundColor: '#cf9268' },
  bertLeftEar: { position: 'absolute', left: 17, top: 42, width: 13, height: 28, backgroundColor: '#cf9268' },
  bertRightEar: { position: 'absolute', right: 17, top: 42, width: 13, height: 28, backgroundColor: '#cf9268' },
  bertHeadTop: { position: 'absolute', left: 31, top: 12, width: 44, height: 23, backgroundColor: '#eab48c' },
  bertHeadFace: { position: 'absolute', left: 24, top: 27, width: 58, height: 48, backgroundColor: '#eab48c' },
  bertHeadJaw: { position: 'absolute', left: 31, top: 68, width: 44, height: 24, backgroundColor: '#cf9268' },
  // Silver, not the mid-grey he was drawn with. That grey was chosen against
  // the briefing card's pale panel; standing on a dimmed screen it sat within a
  // few points of the dim itself and his hair simply disappeared.
  bertLeftHair: { position: 'absolute', left: 22, top: 22, width: 10, height: 27, backgroundColor: '#c9c4d6' },
  bertRightHair: { position: 'absolute', right: 21, top: 22, width: 10, height: 27, backgroundColor: '#c9c4d6' },
  bertBaldHighlight: { position: 'absolute', left: 40, top: 17, width: 21, height: 5, backgroundColor: '#f7d7ba' },
  bertLeftBrow: { position: 'absolute', left: 30, top: 41, width: 15, height: 7, backgroundColor: '#6a4326', transform: [{ rotate: '8deg' }] },
  bertRightBrow: { position: 'absolute', right: 29, top: 41, width: 15, height: 7, backgroundColor: '#6a4326', transform: [{ rotate: '-8deg' }] },
  bertLeftEye: { position: 'absolute', left: 36, top: 50, width: 5, height: 5, backgroundColor: '#241f2e' },
  bertRightEye: { position: 'absolute', right: 35, top: 50, width: 5, height: 5, backgroundColor: '#241f2e' },
  bertNose: { position: 'absolute', left: 42, top: 48, width: 25, height: 24, backgroundColor: '#cf9268' },
  bertNoseLight: { position: 'absolute', left: 46, top: 51, width: 13, height: 7, backgroundColor: '#f7d7ba' },
  bertMoustacheLeft: { position: 'absolute', left: 31, top: 70, width: 22, height: 10, backgroundColor: '#6a4326', transform: [{ rotate: '8deg' }] },
  bertMoustacheRight: { position: 'absolute', right: 29, top: 70, width: 22, height: 10, backgroundColor: '#6a4326', transform: [{ rotate: '-8deg' }] },
  bertMouth: { position: 'absolute', left: 46, top: 82, width: 13, height: 4, backgroundColor: '#a83440' },
});
