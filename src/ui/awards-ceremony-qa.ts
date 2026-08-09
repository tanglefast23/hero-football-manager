import { awardCeremonyViewModel } from '../application/award-ceremony-view-model';
import { AWARD_CATEGORIES } from '../game/division-leaders';
import { generatedPlayerLookId } from '../game/player-appearance';
import type {
  AwardCategoryId,
  DivisionAwardPlacement,
  SeasonRecap,
} from '../game/types';
import {
  RUNNER_UP_CEREMONY_LINES,
  WINNER_CEREMONY_LINES,
} from './award-ceremony-lines';
import {
  awardCeremonyStages,
  prizeCountsUp,
  prizeStageIndex,
} from './awards-ceremony-stage';
import type {
  AwardCeremonyBeatViewModel,
  AwardCeremonySpeechTone,
  AwardCeremonyViewModel,
} from './models';

/**
 * Fabricated ceremonies for the development-only awards reel.
 *
 * Nothing here re-implements the ceremony. Each case fabricates the one input
 * the real builder takes — a season recap carrying four podiums — and hands it
 * to `awardCeremonyViewModel`, so the reel shows exactly what a career shows:
 * the same reveal order, the same single walk-on, the same tapered prize. A
 * fixture that assembled the view model by hand could only ever prove itself.
 *
 * Values sit in the ranges a D5 season actually produces — saves 55-65, tackles
 * won 45-65, passes 150-175, goals 20-24 — so the podium is laid out at the
 * string and number widths it will meet in a real career rather than at toy
 * ones.
 */

/** Kept out of the promotion band so the prize is priced at the D5 rate, 120 TP. */
const QA_SEASON = 3;
const QA_DIVISION = 5;
const QA_TARGET_DIVISION = 5;

const USER_CLUB_ID = 'quartz-fc';

/**
 * Deliberately short of every club the podiums name: `moor-end-athletic` has no
 * entry, which is the rival club the pyramid has already regenerated, and the
 * view model falls back to rendering its identifier.
 */
const CLUB_NAMES: ReadonlyMap<string, string> = new Map([
  ['quartz-fc', 'Quartz FC'],
  ['bramble-rovers', 'Bramble Rovers'],
  ['ferrous-united', 'Ferrous United'],
  ['harbor-comets', 'Harbor Comets'],
  ['moonlight-town', 'Moonlight Town'],
  ['thunder-borough', 'Thunder Borough'],
]);

/**
 * Longer than any name the shipped roster holds, because character creation
 * lets one in and a rostrum card is the narrowest place it can land.
 */
const LONG_PLAYER_NAME = 'Konstantin Abercrombie-Vasquez';

export type AwardsCeremonyQaCaseId = 'mixed' | 'sweep' | 'thin' | 'barren';

/** One podium row, written first place first — the order a board is read in. */
interface QaPodiumEntry {
  readonly name: string;
  readonly clubId: string;
  readonly value: number;
}

/** All four boards. A board nobody registered the metric on is an empty list. */
type QaPodiums = Readonly<Record<AwardCategoryId, readonly QaPodiumEntry[]>>;

interface QaCase {
  readonly label: string;
  readonly podiums: QaPodiums;
  /**
   * The boards whose spoken line is pinned to the longest its pool holds. One
   * board per pool, since a board now speaks one line: the reel still stresses
   * the widest winner line and the widest runner-up line in a single pass.
   * Absent leaves every line as the hash picked it.
   */
  readonly longestLinesOn?: readonly AwardCategoryId[];
}

const QA_CASES: Readonly<Record<AwardsCeremonyQaCaseId, QaCase>> =
  Object.freeze({
    /**
     * The season that exercises every walk-on rule at once, one board each:
     * keepers a rival win with your man second (your man speaks, the rival does
     * not), defenders your own win, midfielders your first AND second (one
     * walk-on, the winner's), strikers a rival board you are nowhere on, which
     * nobody walks on to at all.
     */
    mixed: {
      label: 'Mixed',
      longestLinesOn: ['saves', 'tacklesWon'],
      podiums: {
        saves: [
          { name: LONG_PLAYER_NAME, clubId: 'thunder-borough', value: 63 },
          { name: 'Nell Barrow', clubId: USER_CLUB_ID, value: 59 },
          { name: 'Sam Mitts', clubId: 'bramble-rovers', value: 55 },
        ],
        tacklesWon: [
          { name: 'Ed Stone', clubId: USER_CLUB_ID, value: 62 },
          { name: 'Bo Hedges', clubId: 'ferrous-united', value: 54 },
          { name: 'Max Tanko', clubId: 'harbor-comets', value: 47 },
        ],
        passesCompleted: [
          { name: 'Gio Marsh', clubId: USER_CLUB_ID, value: 172 },
          { name: 'Ken Ash', clubId: USER_CLUB_ID, value: 165 },
          { name: 'Ravi Chan', clubId: 'moonlight-town', value: 153 },
        ],
        goals: [
          { name: 'Zip Vela', clubId: 'harbor-comets', value: 23 },
          { name: 'Dario Flint', clubId: 'thunder-borough', value: 21 },
          { name: 'Nora Vale', clubId: 'moor-end-athletic', value: 20 },
        ],
      },
    },
    /** Every board, and the taper at full stretch: 120 + 90 + 60 + 30. */
    sweep: {
      label: 'Sweep',
      podiums: {
        saves: [
          { name: 'Nell Barrow', clubId: USER_CLUB_ID, value: 65 },
          { name: 'Sam Mitts', clubId: 'bramble-rovers', value: 60 },
          { name: 'Rufus Okonkwo', clubId: 'ferrous-united', value: 56 },
        ],
        tacklesWon: [
          { name: 'Ed Stone', clubId: USER_CLUB_ID, value: 63 },
          { name: 'Mae Thorn', clubId: USER_CLUB_ID, value: 58 },
          { name: 'Bo Hedges', clubId: 'ferrous-united', value: 50 },
        ],
        passesCompleted: [
          { name: 'Gio Marsh', clubId: USER_CLUB_ID, value: 175 },
          { name: 'Ravi Chan', clubId: 'moonlight-town', value: 168 },
          { name: 'Kit Rowan', clubId: 'harbor-comets', value: 155 },
        ],
        goals: [
          { name: 'Sol Reed', clubId: USER_CLUB_ID, value: 24 },
          { name: 'Zip Vela', clubId: 'harbor-comets', value: 22 },
          { name: 'Dario Flint', clubId: 'thunder-borough', value: 20 },
        ],
      },
    },
    /**
     * Boards a thin division actually produces: one name, two names, and one the
     * metric was never registered on at all.
     */
    thin: {
      label: 'Thin',
      podiums: {
        saves: [{ name: 'Sam Mitts', clubId: 'bramble-rovers', value: 57 }],
        tacklesWon: [
          { name: 'Bo Hedges', clubId: 'ferrous-united', value: 59 },
          { name: 'Ed Stone', clubId: USER_CLUB_ID, value: 51 },
        ],
        passesCompleted: [],
        goals: [
          { name: 'Sol Reed', clubId: USER_CLUB_ID, value: 22 },
          { name: 'Zip Vela', clubId: 'harbor-comets', value: 21 },
          { name: 'Dario Flint', clubId: 'thunder-borough', value: 20 },
        ],
      },
    },
    /**
     * Four full boards and nothing to show for them. Your players place third
     * twice, which is still the highest you finished on those boards, so each of
     * them walks on with a beaten line — and the prize screen has to state the
     * barren season rather than count to zero.
     */
    barren: {
      label: 'Nothing',
      podiums: {
        saves: [
          { name: 'Sam Mitts', clubId: 'bramble-rovers', value: 62 },
          { name: 'Rufus Okonkwo', clubId: 'ferrous-united', value: 58 },
          { name: 'Nell Barrow', clubId: USER_CLUB_ID, value: 55 },
        ],
        tacklesWon: [
          { name: 'Bo Hedges', clubId: 'ferrous-united', value: 64 },
          { name: 'Max Tanko', clubId: 'harbor-comets', value: 57 },
          { name: 'Pip Alder', clubId: 'moonlight-town', value: 49 },
        ],
        passesCompleted: [
          { name: 'Ravi Chan', clubId: 'moonlight-town', value: 174 },
          { name: 'Kit Rowan', clubId: 'harbor-comets', value: 161 },
          { name: 'Ken Ash', clubId: USER_CLUB_ID, value: 152 },
        ],
        goals: [
          { name: 'Zip Vela', clubId: 'harbor-comets', value: 24 },
          { name: 'Dario Flint', clubId: 'thunder-borough', value: 22 },
          { name: 'Mae Thorn', clubId: 'bramble-rovers', value: 20 },
        ],
      },
    },
  });

export interface AwardsCeremonyQaCase {
  readonly id: AwardsCeremonyQaCaseId;
  readonly label: string;
}

/** The reel's case list, in the order the buttons are drawn. */
export const AWARDS_CEREMONY_QA_CASES: readonly AwardsCeremonyQaCase[] =
  Object.freeze(
    (Object.keys(QA_CASES) as AwardsCeremonyQaCaseId[]).map((id) =>
      Object.freeze({ id, label: QA_CASES[id].label }),
    ),
  );

/**
 * One fabricated ceremony, built by the production view model.
 *
 * Pure and cheap: the reel rebuilds it whenever the case changes rather than
 * holding four of them, and the same case always produces the same lines,
 * because the speech pool is keyed on player, season and category.
 */
export function awardsCeremonyQaViewModel(
  caseId: AwardsCeremonyQaCaseId,
): AwardCeremonyViewModel {
  const qaCase = QA_CASES[caseId];
  const viewModel = awardCeremonyViewModel({
    recap: qaRecap(qaCase.podiums),
    userClubId: USER_CLUB_ID,
    clubNames: CLUB_NAMES,
    targetDivision: QA_TARGET_DIVISION,
  });
  return qaCase.longestLinesOn === undefined
    ? viewModel
    : withLongestLines(viewModel, qaCase.longestLinesOn);
}

/**
 * Assigned looks for the manager's own players, and none for the rivals.
 *
 * That is the split a real career has, and it is the split worth seeing: an
 * assigned look takes a different branch from the hashed fallback. The ID is
 * salted so the two branches visibly disagree — a look generated for the role
 * is valid for it by construction, so the reel cannot hand the sprite an ID
 * that throws.
 */
export function awardsCeremonyQaLookIds(
  viewModel: AwardCeremonyViewModel,
): ReadonlyMap<string, string> {
  return new Map(
    viewModel.beats.flatMap((beat) => {
      const { role } = AWARD_CATEGORIES[beat.categoryId];
      return beat.placings
        .filter((placing) => placing.isUserPlayer)
        .map(
          (placing) =>
            [
              placing.playerId,
              generatedPlayerLookId(`${placing.playerId}:qa`, role),
            ] as const,
        );
    }),
  );
}

export type AwardsCeremonyQaTargetId = AwardCategoryId | 'prize';

export interface AwardsCeremonyQaTarget {
  readonly id: AwardsCeremonyQaTargetId;
  readonly label: string;
  /**
   * What the button says. Five full board names wrap onto a second row of
   * controls, and every row of controls is a row of the ceremony covered up —
   * so the buttons carry the board's own position line instead.
   */
  readonly code: string;
}

/**
 * Where the reel can start, labelled by the boards themselves so the jump list
 * cannot drift out of the ceremony's own reveal order.
 */
export function awardsCeremonyQaTargets(
  viewModel: AwardCeremonyViewModel,
): readonly AwardsCeremonyQaTarget[] {
  return [
    ...viewModel.beats.map((beat) => ({
      id: beat.categoryId,
      label: beat.boardLabel,
      code: AWARD_CATEGORIES[beat.categoryId].role,
    })),
    { id: 'prize' as const, label: 'Prize', code: 'PRIZE' },
  ];
}

/**
 * The stage a chosen jump opens on: a board's title card, or the prize.
 *
 * Reaching the fourth board in a running career costs three boards of tapping;
 * reaching the prize costs all four. This is the whole reason the reel exists,
 * so it lands on the real stage list rather than on a ceremony trimmed to the
 * board being reviewed.
 */
export function awardsCeremonyQaStageIndex(
  viewModel: AwardCeremonyViewModel,
  target: AwardsCeremonyQaTargetId,
): number {
  const stages = awardCeremonyStages(viewModel);
  if (target === 'prize') return prizeStageIndex(stages);
  const beatIndex = viewModel.beats.findIndex(
    (beat) => beat.categoryId === target,
  );
  const board = stages.findIndex(
    (stage) => stage.kind === 'board' && stage.beatIndex === beatIndex,
  );
  return board === -1 ? 0 : board;
}

/**
 * What the reviewer should be watching for, in one line.
 *
 * Read off the built view model rather than written per case, so a note can
 * never claim a walk-on the ceremony is not about to play.
 */
export function awardsCeremonyQaNote(
  viewModel: AwardCeremonyViewModel,
  target: AwardsCeremonyQaTargetId,
): string {
  if (target === 'prize') {
    const { prize } = viewModel;
    return prizeCountsUp(prize)
      ? `${prize.boardsWon} of 4 boards · counts up to $${prize.totalMoney.toLocaleString('en-US')}`
      : 'No board won · states the barren season instead of counting to zero';
  }
  const beat = viewModel.beats.find(
    (candidate) => candidate.categoryId === target,
  );
  return beat === undefined ? 'No such board' : beatNote(beat);
}

function beatNote(beat: AwardCeremonyBeatViewModel): string {
  const count = beat.placings.length;
  if (count === 0) return 'Empty board · no winner, nobody walks on';
  const rows = `${count} placing${count === 1 ? '' : 's'}`;
  const winner = beat.placings.find((placing) => placing.position === 1);
  const won = winner?.isUserPlayer === true ? 'yours wins' : 'rival wins';
  return `${rows} · ${won} · ${walkOnNote(beat)}`;
}

/** The one thing the reviewer is here to check: who, if anyone, walks on. */
function walkOnNote(beat: AwardCeremonyBeatViewModel): string {
  const { speaker } = beat;
  if (speaker === undefined)
    return 'none of yours on the podium · nobody walks on';
  if (speaker.tone === 'runner-up') {
    // The podium is cut to three, so a beaten speaker is second or third.
    const place = speaker.placing.position === 2 ? '2nd' : '3rd';
    return `your ${place} walks on · the rival winner does not`;
  }
  const second = beat.placings.find((placing) => placing.position === 2);
  return second?.isUserPlayer === true
    ? 'yours 1st AND 2nd · only the winner walks on'
    : 'your winner walks on alone';
}

/**
 * Pins the named boards' spoken line to the longest its pool holds.
 *
 * The pools cap at `MAX_ARRIVAL_LINE_LENGTH` and the bubble is 320pt wide, so
 * the ceiling is where wrapping breaks if it breaks — and which line a beat
 * draws is a hash of player, season and category, which a reviewer cannot
 * steer. Read out of the pools rather than written here, so retuning them
 * retunes the worst case with them.
 */
function withLongestLines(
  viewModel: AwardCeremonyViewModel,
  categoryIds: readonly AwardCategoryId[],
): AwardCeremonyViewModel {
  return {
    ...viewModel,
    beats: viewModel.beats.map((beat) =>
      !categoryIds.includes(beat.categoryId) || beat.speaker === undefined
        ? beat
        : {
            ...beat,
            speaker: {
              ...beat.speaker,
              line: longestLine(poolFor(beat.speaker.tone)),
            },
          },
    ),
  };
}

/** The pool a beat's one speaker drew from, and therefore its worst case. */
function poolFor(tone: AwardCeremonySpeechTone): readonly string[] {
  return tone === 'winner' ? WINNER_CEREMONY_LINES : RUNNER_UP_CEREMONY_LINES;
}

function longestLine(lines: readonly string[]): string {
  return lines.reduce(
    (widest, line) => (line.length > widest.length ? line : widest),
    '',
  );
}

/**
 * A completed D5 season carrying the case's podiums.
 *
 * Everything but `divisionAwards` is filler the ceremony never reads; it is
 * spelled out anyway because `SeasonRecap` is the real input type and a partial
 * one would have to be cast.
 */
function qaRecap(podiums: QaPodiums): SeasonRecap {
  return {
    season: QA_SEASON,
    division: QA_DIVISION,
    finalPosition: 4,
    played: 18,
    won: 8,
    drawn: 4,
    lost: 6,
    goalsFor: 34,
    goalsAgainst: 29,
    cashChange: 4_200,
    closingCash: 61_400,
    trainingCapsReached: 0,
    cupResult: 'Quarter-final',
    divisionAwards: Object.fromEntries(
      (Object.keys(AWARD_CATEGORIES) as AwardCategoryId[]).map((category) => [
        category,
        podiums[category].map(placement),
      ]),
    ) as Record<AwardCategoryId, DivisionAwardPlacement[]>,
  };
}

function placement(entry: QaPodiumEntry): DivisionAwardPlacement {
  return {
    playerId: qaPlayerId(entry.name),
    playerName: entry.name,
    clubId: entry.clubId,
    value: entry.value,
  };
}

/** Named players keep one ID across cases, so a face follows a name around. */
function qaPlayerId(name: string): string {
  return `qa-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}`;
}
