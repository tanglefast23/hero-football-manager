import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  COLUMN_WIDTH,
  NARROW_BAND_COLUMNS,
  TIE_HEIGHT,
  cupBracketBands,
  cupBracketConnectors,
  cupBracketLayout,
  type BracketLayout,
  type BracketTie,
} from '../cup-bracket';
import { useLayoutMode } from '../layout/use-layout-mode';
import type { M2CupRoundViewModel } from '../m2-league-models';
import { PixelText } from './PixelText';
import { useCopy, usePixelStyles, type LocaleFaces } from '../../i18n';

/**
 * The Hero Cup as a bracket rather than a stack of round cards.
 *
 * A knockout is a shape, and the shape is the information: how far you are from
 * the final, and who has to fall for you to get there. Stacked cards told you
 * the round names and nothing about the road.
 *
 * Drawn with plain Views on whole pixels — 2px ink rules, flat fills, no
 * gradients or rounded corners — so it sits beside the rest of the pixel art
 * instead of looking like a chart dropped into the game.
 */

const INK = '#241f2e';
const RULE = 2;
const HEADER_HEIGHT = 26;

export interface CupBracketProps {
  rounds: readonly M2CupRoundViewModel[];
  /** Shown as a plate over the tree once the cup has been won. */
  championName?: string;
}

export function CupBracket({ rounds, championName }: CupBracketProps) {
  const t = useCopy();
  const styles = usePixelStyles(makeStyles);
  const narrow = useLayoutMode() !== 'twoColumn';
  /**
   * Still in the cup, or already out.
   *
   * The tie you are in was always marked, but in the tree's own blue — the same
   * hue as the headers and every connector — and it read as "a tie", not as
   * "yours". Gold is the game's hero accent and appears nowhere else in the
   * tree, so a live run is the one bright thing on the page. Once you are out
   * the gold is withdrawn rather than left to lie: your tie stays findable in
   * blue, but nothing on the tree still claims you are running.
   */
  const userStillIn = !rounds.some(round => round.userOutcomeKind === 'eliminated');
  // A phone gets the tree wrapped into bands rather than five columns it would
  // have to scroll sideways through, which hides the shape the bracket is for.
  const bands = narrow ? cupBracketBands(rounds, NARROW_BAND_COLUMNS) : [cupBracketLayout(rounds)];
  if (bands.length === 0 || bands[0].columns.length === 0) return null;

  return (
    <View>
      {bands.map((band, index) => (
        <View key={band.columns[0].round} style={index === 0 ? null : styles.bandGap}>
          {index > 0 ? (
            <Text style={styles.bandNote}>{t('cupBracket.winnersFromAbove')}</Text>
          ) : null}
          <BracketBand layout={band} userStillIn={userStillIn} />
        </View>
      ))}
      {championName === undefined ? null : (
        <View accessible accessibilityLabel={t('cupBracket.a11y.wonTheHeroCup', { club: championName })} style={styles.champion}>
          <PixelText className="text-xs uppercase text-ink/60">{t('cupBracket.heroCupWinners')}</PixelText>
          <PixelText className="mt-1 text-lg uppercase text-ink" numberOfLines={1}>{championName}</PixelText>
        </View>
      )}
    </View>
  );
}

function BracketBand({ layout, userStillIn }: { layout: BracketLayout; userStillIn: boolean }) {
  const styles = usePixelStyles(makeStyles);
  const connectors = cupBracketConnectors(layout);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // The tree is wider than any phone; it scrolls sideways rather than
      // shrinking to a size where club names stop being readable.
      contentContainerStyle={{ paddingRight: 12 }}
    >
      <View style={{ width: layout.width, height: layout.height + HEADER_HEIGHT }}>
        <View style={styles.headerRow}>
          {layout.columns.map(column => (
            <View key={column.round} style={[styles.header, { left: column.left, width: COLUMN_WIDTH }]}>
              <PixelText className="text-xs uppercase text-blue-dark" numberOfLines={1}>
                {column.label}
              </PixelText>
            </View>
          ))}
        </View>

        <View style={{ height: layout.height }}>
          {/* Connectors first, so ties paint over the elbows rather than under. */}
          {connectors.map(connector => {
            const midX = connector.fromX + (connector.toX - connector.fromX) / 2;
            return (
              <View key={connector.key} pointerEvents="none">
                <View style={[styles.rule, {
                  left: connector.fromX,
                  top: connector.upperY,
                  width: midX - connector.fromX,
                  height: RULE,
                }]} />
                <View style={[styles.rule, {
                  left: connector.fromX,
                  top: connector.lowerY,
                  width: midX - connector.fromX,
                  height: RULE,
                }]} />
                <View style={[styles.rule, {
                  left: midX,
                  top: connector.upperY,
                  width: RULE,
                  height: Math.max(RULE, connector.lowerY - connector.upperY),
                }]} />
                <View style={[styles.rule, {
                  left: midX,
                  top: connector.midY,
                  width: connector.toX - midX,
                  height: RULE,
                }]} />
              </View>
            );
          })}

          {layout.columns.map(column => column.ties.map(tie => (
            <TieCard key={tie.key} tie={tie} left={column.left} userStillIn={userStillIn} />
          )))}
        </View>
      </View>
    </ScrollView>
  );
}

function TieCard({
  tie,
  left,
  userStillIn,
}: {
  tie: BracketTie;
  left: number;
  userStillIn: boolean;
}) {
  const t = useCopy();
  const styles = usePixelStyles(makeStyles);
  const tie_ = tie.placeholder
    ? t('cupBracket.winnerToBeDecided')
    : tie.played
      ? t('cupBracket.a11y.tiePlayed', {
          home: tie.homeName,
          away: tie.awayName,
          score: tie.scoreLabel,
        })
      : t('cupBracket.a11y.tie', { home: tie.homeName, away: tie.awayName });
  // Colour and weight are the sighted half of "this one is yours"; a screen
  // reader gets the same fact said out loud, ahead of the names.
  const label = tie.involvesUserClub ? t('cupBracket.a11y.yourTie', { tie: tie_ }) : tie_;
  const live = tie.involvesUserClub && userStillIn;
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[
        styles.tie,
        { left, top: tie.top, width: COLUMN_WIDTH },
        tie.placeholder ? styles.tiePlaceholder : null,
        // Your own tie is the one you look for first.
        tie.involvesUserClub ? styles.tieUser : null,
        live ? styles.tieUserLive : null,
      ]}
    >
      <TieSide
        name={tie.homeName}
        placeholder={tie.placeholder}
        beaten={tie.played && tie.winnerName !== undefined && tie.winnerName !== tie.homeName}
        mine={tie.userSide === 'home'}
      />
      <View style={styles.tieDivider} />
      <TieSide
        name={tie.awayName}
        placeholder={tie.placeholder}
        beaten={tie.played && tie.winnerName !== undefined && tie.winnerName !== tie.awayName}
        mine={tie.userSide === 'away'}
      />
      {tie.played && tie.scoreLabel.length > 0 ? (
        <View style={styles.score}>
          <Text style={styles.scoreText}>{tie.scoreLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** The loser greys out, so a finished tie reads at a glance without a score. */
function TieSide({
  name,
  placeholder,
  beaten,
  mine,
}: {
  name: string;
  placeholder: boolean;
  beaten: boolean;
  /** Your club, weighted so the eye finds it before it reads the tie. */
  mine: boolean;
}) {
  const styles = usePixelStyles(makeStyles);
  return (
    <Text
      numberOfLines={1}
      style={[
        styles.side,
        placeholder ? styles.sidePlaceholder : null,
        beaten ? styles.sideBeaten : null,
        mine ? styles.sideMine : null,
      ]}
    >
      {name}
    </Text>
  );
}

const makeStyles = (faces: LocaleFaces) => StyleSheet.create({
  headerRow: { height: HEADER_HEIGHT },
  /** Bands are one tree wrapped, so the seam is spacing plus a hand-off note. */
  bandGap: { marginTop: 18 },
  bandNote: {
    color: '#6b6675',
    fontFamily: faces.data,
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  champion: {
    marginTop: 12,
    alignItems: 'center',
    borderWidth: RULE,
    borderBottomWidth: 4,
    borderColor: '#c8862a',
    backgroundColor: '#f7d894',
    paddingVertical: 10,
  },
  header: { position: 'absolute', top: 0 },
  rule: { position: 'absolute', backgroundColor: '#3f6fb5' },
  tie: {
    position: 'absolute',
    height: TIE_HEIGHT,
    justifyContent: 'center',
    borderWidth: RULE,
    borderBottomWidth: 4,
    borderColor: INK,
    backgroundColor: '#ffffff',
    paddingHorizontal: 6,
  },
  tiePlaceholder: { borderColor: '#9a95a4', backgroundColor: '#f4f1ea' },
  tieUser: { borderColor: '#3f6fb5', backgroundColor: '#a3c8f0' },
  /** Still running: gold, and the only gold fill in the tree. */
  tieUserLive: { borderColor: '#c8862a', backgroundColor: '#f7d894' },
  tieDivider: { height: 1, backgroundColor: '#241f2e22', marginVertical: 2 },
  side: { color: INK, fontSize: 12, lineHeight: 16 },
  sidePlaceholder: { color: '#9a95a4' },
  sideBeaten: { color: '#9a95a4', textDecorationLine: 'line-through' },
  // Last, so your own name keeps its weight in the tie you went out in — the
  // strike-through says you lost; the weight still says which one was you.
  sideMine: { color: INK, fontWeight: 'bold' },
  score: {
    position: 'absolute',
    right: -2,
    top: -2,
    paddingHorizontal: 4,
    borderWidth: RULE,
    borderColor: INK,
    backgroundColor: '#edb54a',
  },
  scoreText: { color: INK, fontFamily: faces.data, fontSize: 10, lineHeight: 14 },
});
