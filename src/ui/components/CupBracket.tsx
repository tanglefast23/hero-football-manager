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

/**
 * The Global Cup as a bracket rather than a stack of round cards.
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
  const narrow = useLayoutMode() !== 'twoColumn';
  // A phone gets the tree wrapped into bands rather than five columns it would
  // have to scroll sideways through, which hides the shape the bracket is for.
  const bands = narrow ? cupBracketBands(rounds, NARROW_BAND_COLUMNS) : [cupBracketLayout(rounds)];
  if (bands.length === 0 || bands[0].columns.length === 0) return null;

  return (
    <View>
      {bands.map((band, index) => (
        <View key={band.columns[0].round} style={index === 0 ? null : styles.bandGap}>
          {index > 0 ? (
            <Text style={styles.bandNote}>WINNERS FROM ABOVE</Text>
          ) : null}
          <BracketBand layout={band} />
        </View>
      ))}
      {championName === undefined ? null : (
        <View accessible accessibilityLabel={`${championName} won the Global Cup`} style={styles.champion}>
          <PixelText className="text-xs uppercase text-ink/60">Global Cup winners</PixelText>
          <PixelText className="mt-1 text-lg uppercase text-ink" numberOfLines={1}>{championName}</PixelText>
        </View>
      )}
    </View>
  );
}

function BracketBand({ layout }: { layout: BracketLayout }) {
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
            <TieCard key={tie.key} tie={tie} left={column.left} />
          )))}
        </View>
      </View>
    </ScrollView>
  );
}

function TieCard({ tie, left }: { tie: BracketTie; left: number }) {
  const label = tie.placeholder
    ? 'Winner to be decided'
    : `${tie.homeName} versus ${tie.awayName}${tie.played ? `, ${tie.scoreLabel}` : ''}`;
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
      ]}
    >
      <TieSide
        name={tie.homeName}
        placeholder={tie.placeholder}
        beaten={tie.played && tie.winnerName !== undefined && tie.winnerName !== tie.homeName}
      />
      <View style={styles.tieDivider} />
      <TieSide
        name={tie.awayName}
        placeholder={tie.placeholder}
        beaten={tie.played && tie.winnerName !== undefined && tie.winnerName !== tie.awayName}
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
function TieSide({ name, placeholder, beaten }: { name: string; placeholder: boolean; beaten: boolean }) {
  return (
    <Text
      numberOfLines={1}
      style={[styles.side, placeholder ? styles.sidePlaceholder : null, beaten ? styles.sideBeaten : null]}
    >
      {name}
    </Text>
  );
}

const styles = StyleSheet.create({
  headerRow: { height: HEADER_HEIGHT },
  /** Bands are one tree wrapped, so the seam is spacing plus a hand-off note. */
  bandGap: { marginTop: 18 },
  bandNote: {
    color: '#6b6675',
    fontFamily: 'Silkscreen_400Regular',
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
  tieDivider: { height: 1, backgroundColor: '#241f2e22', marginVertical: 2 },
  side: { color: INK, fontSize: 12, lineHeight: 16 },
  sidePlaceholder: { color: '#9a95a4' },
  sideBeaten: { color: '#9a95a4', textDecorationLine: 'line-through' },
  score: {
    position: 'absolute',
    right: -2,
    top: -2,
    paddingHorizontal: 4,
    borderWidth: RULE,
    borderColor: INK,
    backgroundColor: '#edb54a',
  },
  scoreText: { color: INK, fontFamily: 'Silkscreen_400Regular', fontSize: 10, lineHeight: 14 },
});
