import type {
  M2CupFixtureViewModel,
  M2CupRoundViewModel,
  M2DivisionLevelViewModel,
} from './m2-league-models';

/**
 * Pure geometry for the Hero Cup bracket.
 *
 * The tree is laid out here rather than in the component so the spacing rules —
 * every round half as tall, ties centred on the pair they came from — can be
 * tested without a renderer. The component only paints what this returns.
 */

/** The bracket opens at the Round of 32. The play-in is 18 scrappy ties nobody reads as a tree. */
export const BRACKET_FIRST_ROUND = 2;

/** One tie slot, in pixels, so connectors land on whole pixels like the sprites do. */
export const TIE_HEIGHT = 44;
export const TIE_GAP = 8;
export const COLUMN_WIDTH = 148;
export const COLUMN_GAP = 28;

export interface BracketTie {
  readonly key: string;
  /** Vertical centre of the tie within the column, in pixels. */
  readonly centreY: number;
  readonly top: number;
  readonly homeName: string;
  readonly homeDivision?: M2DivisionLevelViewModel;
  readonly awayName: string;
  readonly awayDivision?: M2DivisionLevelViewModel;
  readonly scoreLabel: string;
  readonly played: boolean;
  readonly winnerName?: string;
  readonly involvesUserClub: boolean;
  /** Which side of the tie is yours, so the card can weight that one name. */
  readonly userSide?: 'home' | 'away';
  /** A round that has not been drawn yet shows placeholders, not names. */
  readonly placeholder: boolean;
}

export interface BracketColumn {
  readonly round: number;
  readonly label: string;
  readonly left: number;
  readonly ties: readonly BracketTie[];
}

export interface BracketLayout {
  readonly columns: readonly BracketColumn[];
  readonly width: number;
  readonly height: number;
}

const PLACEHOLDER = 'TBD';

function tieFrom(
  fixture: M2CupFixtureViewModel | undefined,
  key: string,
  centreY: number,
): BracketTie {
  if (fixture === undefined) {
    return {
      key,
      centreY,
      top: centreY - TIE_HEIGHT / 2,
      homeName: PLACEHOLDER,
      awayName: PLACEHOLDER,
      scoreLabel: '',
      played: false,
      involvesUserClub: false,
      placeholder: true,
    };
  }
  return {
    key,
    centreY,
    top: centreY - TIE_HEIGHT / 2,
    homeName: fixture.homeClubName,
    homeDivision: fixture.homeDivision,
    awayName: fixture.awayClubName,
    awayDivision: fixture.awayDivision,
    scoreLabel: fixture.scoreLabel,
    played: fixture.status === 'PLAYED',
    ...(fixture.winnerName === undefined
      ? {}
      : { winnerName: fixture.winnerName }),
    involvesUserClub: fixture.involvesUserClub,
    ...(fixture.userSide === undefined ? {} : { userSide: fixture.userSide }),
    placeholder: false,
  };
}

/**
 * How many ties a round holds, derived from the first bracket round rather than
 * from what has been drawn: an undrawn Quarter-final still needs its four empty
 * slots, or the tree would collapse as the cup progressed and re-expand later.
 */
function tieCountFor(roundIndex: number, firstRoundTies: number): number {
  return Math.max(1, Math.round(firstRoundTies / 2 ** roundIndex));
}

export function cupBracketLayout(
  rounds: readonly M2CupRoundViewModel[],
): BracketLayout {
  const bracketRounds = rounds
    .filter((round) => round.round >= BRACKET_FIRST_ROUND)
    .sort((a, b) => a.round - b.round);
  if (bracketRounds.length === 0) return { columns: [], width: 0, height: 0 };

  // The widest drawn round sets the tree; an undrawn opener falls back to its
  // declared match count so the shape is right before a ball is kicked.
  const firstRoundTies = Math.max(
    1,
    bracketRounds[0].fixtures.length > 0
      ? bracketRounds[0].fixtures.length
      : bracketRounds[0].matchCount,
  );
  const slot = TIE_HEIGHT + TIE_GAP;
  const height = firstRoundTies * slot;

  const columns = bracketRounds.map((round, index) => {
    const count = tieCountFor(index, firstRoundTies);
    // Each round's ties sit centred on the pair that feeds them, which is what
    // makes the connectors straight: spacing doubles every column.
    const spacing = height / count;
    const ties = Array.from({ length: count }, (_unused, tieIndex) =>
      tieFrom(
        round.fixtures[tieIndex],
        `${round.round}:${tieIndex}`,
        spacing * tieIndex + spacing / 2,
      ),
    );
    return {
      round: round.round,
      label: round.label,
      left: index * (COLUMN_WIDTH + COLUMN_GAP),
      ties,
    };
  });

  return {
    columns,
    width:
      columns.length * COLUMN_WIDTH +
      Math.max(0, columns.length - 1) * COLUMN_GAP,
    height,
  };
}

/**
 * A phone cannot show five columns at a readable size, and scrolling sideways
 * hides the shape — which is the only thing a bracket is for. So the tree wraps
 * into bands of two: Round of 32 with Round of 16, then Quarter- with Semi-
 * final, and the Final left over on its own. Two columns is 324px, which fits a
 * 375pt phone; three did not, and the Final fell off the right edge.
 *
 * Winners carry from the bottom of one band to the top of the next, which is
 * the same reading order as the wide tree.
 */
export const NARROW_BAND_COLUMNS: readonly number[] = [2, 2];

export function cupBracketBands(
  rounds: readonly M2CupRoundViewModel[],
  columnsPerBand: readonly number[],
): readonly BracketLayout[] {
  const bracketRounds = rounds
    .filter((round) => round.round >= BRACKET_FIRST_ROUND)
    .sort((a, b) => a.round - b.round);
  const bands: BracketLayout[] = [];
  let cursor = 0;
  for (const width of columnsPerBand) {
    if (cursor >= bracketRounds.length) break;
    // Each band is laid out on its own, so its first column drives its height:
    // the Quarter-final band is four ties tall, not sixteen.
    bands.push(cupBracketLayout(bracketRounds.slice(cursor, cursor + width)));
    cursor += width;
  }
  if (cursor < bracketRounds.length)
    bands.push(cupBracketLayout(bracketRounds.slice(cursor)));
  return bands.filter((band) => band.columns.length > 0);
}

export interface BracketConnector {
  readonly key: string;
  /** Elbow from a pair of ties into the one they feed: across, down, across. */
  readonly fromX: number;
  readonly toX: number;
  readonly upperY: number;
  readonly lowerY: number;
  readonly midY: number;
}

/** One elbow per pair, so the tree reads as a tree and not as stacked lists. */
export function cupBracketConnectors(
  layout: BracketLayout,
): readonly BracketConnector[] {
  const connectors: BracketConnector[] = [];
  for (let index = 0; index < layout.columns.length - 1; index += 1) {
    const column = layout.columns[index];
    const next = layout.columns[index + 1];
    next.ties.forEach((target, targetIndex) => {
      const upper = column.ties[targetIndex * 2];
      const lower = column.ties[targetIndex * 2 + 1];
      if (upper === undefined || lower === undefined) return;
      connectors.push({
        key: `${column.round}:${targetIndex}`,
        fromX: column.left + COLUMN_WIDTH,
        toX: next.left,
        upperY: upper.centreY,
        lowerY: lower.centreY,
        midY: target.centreY,
      });
    });
  }
  return connectors;
}
