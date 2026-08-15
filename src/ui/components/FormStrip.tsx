import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { InfoTip } from './InfoTip';
import { PixelText } from './PixelText';
import { useCopy } from '../../i18n';
import {
  FORM_ART_SIZE,
  FORM_CELL_BORDER,
  FORM_CELL_ENTER_MS,
  FORM_CELL_GAP,
  FORM_CELL_SIZE,
  TROPHY_GRID,
  TROPHY_RUNS,
  formCellEnterDelay,
  formStripCapacity,
  formStripWidthEstimate,
  visibleForm,
} from '../form-strip';

export type FormResult = 'W' | 'D' | 'L';

/**
 * The three letters on the form strip, which nothing else in the game defines.
 *
 * Catalog keys rather than English: this map is module scope, where no hook can
 * run, so the lookup happens at the render site that already holds `t`. A win
 * shows no letter at all now, which makes the sentence the only thing that
 * says what a trophy is worth.
 */
const FORM_EXPLAINER: Readonly<Record<FormResult, string>> = {
  W: 'clubHome.form.weekWon',
  D: 'clubHome.form.weekDrawn',
  L: 'clubHome.form.weekLost',
};

const INK = '#241f2e';
const TROPHY_PIXEL = FORM_ART_SIZE / TROPHY_GRID;

/**
 * A win is gold-rimmed and otherwise plain paper, so the only saturated thing
 * in the row is the trophy itself. Filling the cell too would put a band of
 * accent colour across the header and leave nothing for the cup to be.
 */
const CELL_TONE: Readonly<
  Record<FormResult, { border: string; text: string }>
> = {
  W: { border: '#c8862a', text: INK },
  D: { border: 'rgba(36,31,46,0.4)', text: 'rgba(36,31,46,0.55)' },
  L: { border: '#a83440', text: '#a83440' },
};

/** Drawn as run-length Views rather than a Skia canvas: a header carries up to
 *  24 of these and must cost nothing to keep mounted. */
function TrophyGlyph() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: FORM_ART_SIZE, height: FORM_ART_SIZE }}
    >
      {TROPHY_RUNS.map((run) => (
        <View
          key={run.id}
          style={{
            position: 'absolute',
            left: run.x * TROPHY_PIXEL,
            top: run.y * TROPHY_PIXEL,
            width: run.width * TROPHY_PIXEL,
            height: TROPHY_PIXEL,
            backgroundColor: run.color,
          }}
        />
      ))}
    </View>
  );
}

interface FormCellProps {
  result: FormResult;
  delay: number;
  reduceMotion: boolean;
}

/**
 * Pops in rather than simply being there. The strip only ever redraws when the
 * manager arrives at the desk, so the cascade is the moment the week's result
 * lands — and it deals left to right, finishing on the newest match.
 */
function FormCell({ result, delay, reduceMotion }: FormCellProps) {
  const t = useCopy();
  const enter = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const tone = CELL_TONE[result];
  // W/D/L are engine enum values, not letters to show. German reads S/U/N and
  // the league table already carries them, so the strip borrows those keys.
  const letter = t(
    result === 'D' ? 'col.league.drawn' : 'col.league.lost',
  );

  useEffect(() => {
    if (reduceMotion) {
      enter.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: FORM_CELL_ENTER_MS,
      delay,
      // A touch of overshoot so a trophy lands on the shelf instead of fading up.
      easing: Easing.out(Easing.back(1.6)),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, enter, reduceMotion]);

  return (
    <Animated.View
      style={{
        opacity: enter.interpolate({
          inputRange: [0, 0.4, 1],
          outputRange: [0, 1, 1],
        }),
        transform: [
          {
            scale: enter.interpolate({
              inputRange: [0, 1],
              outputRange: [0.6, 1],
            }),
          },
        ],
      }}
    >
      <View style={[styles.cell, { borderColor: tone.border }]}>
        {result === 'W' ? (
          <TrophyGlyph />
        ) : (
          <PixelText
            style={{ color: tone.text }}
            className="text-sm uppercase"
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {letter}
          </PixelText>
        )}
      </View>
    </Animated.View>
  );
}

export interface FormStripProps {
  /** Oldest first, as `recentForm` builds it. The tail is what gets shown. */
  results: readonly { result: FormResult; week: number }[];
  reduceMotion?: boolean;
}

/**
 * Fills the row it is given: the strip measures itself and shows as many of the
 * most recent results as fit, newest hard against the right edge where the
 * heading is. A phone lands around nine or ten, a desktop hits the season cap.
 */
export function FormStrip({ results, reduceMotion = false }: FormStripProps) {
  const t = useCopy();
  const { width: windowWidth } = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setMeasured((previous) => (previous === width ? previous : width));
  };

  const width = measured > 0 ? measured : formStripWidthEstimate(windowWidth);
  const shown = visibleForm(results, formStripCapacity(width));

  return (
    <View
      className="mt-2 w-full flex-row justify-end"
      style={styles.strip}
      onLayout={onLayout}
    >
      {shown.map(({ result, week }, index) => {
        const explanation = t(FORM_EXPLAINER[result], { week });
        return (
          <InfoTip
            // Re-keying on the measured count is deliberate: a rotation that makes
            // room for another result replays the cascade at the new width.
            key={`${shown.length}-${index}-${week}-${result}`}
            align="right"
            text={explanation}
            accessibilityLabel={explanation}
          >
            <FormCell
              result={result}
              delay={formCellEnterDelay(index, shown.length)}
              reduceMotion={reduceMotion}
            />
          </InfoTip>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { gap: FORM_CELL_GAP, minHeight: FORM_CELL_SIZE },
  cell: {
    width: FORM_CELL_SIZE,
    height: FORM_CELL_SIZE,
    borderWidth: FORM_CELL_BORDER,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
