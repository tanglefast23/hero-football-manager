import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TRUE_ENDING_SEEN_FLAG } from '../../../application/endgame-celebration';
import {
  hallOfFameViewModel,
  recordHallOfFame,
} from '../../../application/hall-of-fame';
import { compareIds } from '../../../game/ordering';
import type { CareerPlayer, GameState, SeasonRecap } from '../../../game/types';
import type { HallOfFameViewModel } from '../../models';
import { HallOfFameScreen } from '../../screens/HallOfFameScreen';
import {
  DevHarnessButton,
  devHarnessControlStyles,
} from '../DevHarnessControls';
import { devHarnessCareerAtSeasonEnd, devHarnessCareerAtWeek } from '../career';
import type { DevHarnessEntry } from '../registry';

/**
 * The Hall of Fame, as the dev harness shows it.
 *
 * The page opens once per career and only after BOTH trophies — a state a
 * played career takes many hours to reach and can never reach twice. Jest runs
 * with no DOM, so without this nobody sees how a long record scrolls, whether a
 * one-season record looks broken, or what the locked page says.
 *
 * Real career, real capture, real view model: each case runs the seeded season
 * clock, marks the true ending, and hands the state to the SHIPPED
 * `recordHallOfFame` and `hallOfFameViewModel`. What is fabricated is only the
 * results — a manager who never intervenes is never promoted and never wins a
 * trophy, so the honours a finished career is made of have to be written onto
 * the recaps before the capture reads them.
 */

/** How the page is framed while it is being reviewed. */
type FrameId = 'panel' | 'full';

export type HallOfFameCaseId = 'long-climb' | 'quick-climb' | 'locked';

/**
 * Declared above the entry, not below it: the entry's `cases` read this while
 * the module is still evaluating, and a `const` below would still be in its
 * temporal dead zone. TypeScript cannot see that through the arrow function,
 * so the only symptom is a blank bundle at runtime.
 */
const CASE_NOTES: Readonly<Record<HallOfFameCaseId, string>> = Object.freeze({
  'long-climb':
    'Six seasons, five tiers, four titles and two Cups · the list scrolls',
  'quick-climb': 'One season, one tier, one title · the shortest legal record',
  locked: 'Climb unfinished · what the button says before the end',
});

/** One season of a doctored career: where it played and how it finished. */
interface FabricatedSeason {
  readonly division: number;
  readonly finalPosition: number;
  readonly cupWon: boolean;
}

/**
 * The seasons a doctored career is made of.
 *
 * The seeded career finishes mid-table in D5 every year, so a record built from
 * it untouched would show one tier, no titles and no Cup — the one shape the
 * page can never actually be opened in.
 *
 * Everything the record shows is derived from this one table: the honours, the
 * climb ladder, the win/draw/loss line and the goals. A club is never credited
 * with four titles and a losing record, because the record and the trophies
 * come from the same six seasons rather than from two different careers.
 */
const LONG_CLIMB_SEASONS: readonly FabricatedSeason[] = Object.freeze([
  { division: 5, finalPosition: 4, cupWon: false },
  { division: 5, finalPosition: 1, cupWon: false },
  { division: 4, finalPosition: 1, cupWon: false },
  { division: 3, finalPosition: 1, cupWon: false },
  // Promoted in second, which is the other way up the pyramid: it is the one
  // rung of the climb ladder that reads "Best 2nd", so the reviewer sees a tier
  // row that was not won as well as four that were.
  { division: 2, finalPosition: 2, cupWon: true },
  { division: 1, finalPosition: 1, cupWon: true },
]);

/** Won it at the first attempt, in the only season it played. */
const QUICK_CLIMB_SEASONS: readonly FabricatedSeason[] = Object.freeze([
  { division: 1, finalPosition: 1, cupWon: true },
]);

/**
 * What each kind of season was worth, as drawn and lost counts and goals per
 * game.
 *
 * Wins are whatever is left of the fixtures the seeded career actually played,
 * so a fabricated season can never claim more games than the schedule holds —
 * only their results are rewritten.
 */
const SEASON_SHAPES = Object.freeze({
  champion: {
    drawn: 3,
    lost: 2,
    goalsForPerGame: 2.4,
    goalsAgainstPerGame: 0.95,
  },
  promoted: {
    drawn: 4,
    lost: 3,
    goalsForPerGame: 2.1,
    goalsAgainstPerGame: 1.2,
  },
  settling: {
    drawn: 5,
    lost: 5,
    goalsForPerGame: 1.6,
    goalsAgainstPerGame: 1.45,
  },
});

export function HallOfFameReel({
  caseId,
}: {
  readonly caseId: HallOfFameCaseId;
}) {
  const [frame, setFrame] = useState<FrameId>('panel');
  const [backPresses, setBackPresses] = useState(0);
  const insets = useSafeAreaInsets();
  const viewModel = useMemo(() => hallOfFameCaseViewModel(caseId), [caseId]);

  return (
    <View style={styles.root}>
      <View style={frame === 'panel' ? styles.panelFrame : styles.fullFrame}>
        <View style={frame === 'panel' ? styles.paperPanel : styles.paperFull}>
          <HallOfFameScreen
            viewModel={viewModel}
            onBack={() => setBackPresses((presses) => presses + 1)}
          />
        </View>
      </View>

      <View
        style={[
          styles.controls,
          { paddingBottom: Math.max(10, insets.bottom) },
        ]}
      >
        <Text style={styles.note}>
          {hallOfFameNote(viewModel, backPresses)}
        </Text>
        <View style={devHarnessControlStyles.row}>
          <Text style={devHarnessControlStyles.rowLabel}>FRAME</Text>
          <DevHarnessButton
            label="Settings"
            hint="Show the page at the size Settings gives it: a modal panel at 88 percent height"
            selected={frame === 'panel'}
            onPress={() => setFrame('panel')}
          />
          <DevHarnessButton
            label="Full"
            hint="Show the page full bleed, so nothing about the record is hidden by the panel"
            selected={frame === 'full'}
            onPress={() => setFrame('full')}
          />
        </View>
      </View>
    </View>
  );
}

/** What the reel reports: the sizes that decide whether the page holds up. */
export function hallOfFameNote(
  viewModel: HallOfFameViewModel,
  backPresses: number,
): string {
  const back = `back pressed ${backPresses}×`;
  if (viewModel.status === 'locked')
    return `Locked · ${viewModel.lines.length} lines · ${back}`;
  return [
    `${viewModel.stats.length} figures`,
    `${viewModel.honours.length} honours`,
    `${viewModel.tiers.length} tiers`,
    back,
  ].join(' · ');
}

/** The state each case opens on, built by the shipped capture. */
export function hallOfFameCaseState(caseId: HallOfFameCaseId): GameState {
  if (caseId === 'locked') {
    // Mid-season, nothing banked: exactly what a career in progress carries.
    return devHarnessCareerAtWeek(2, 4);
  }
  const played = devHarnessCareerAtSeasonEnd(caseId === 'long-climb' ? 6 : 1);
  const finished = withHonours(played, caseId);
  return recordHallOfFame({
    ...finished,
    // The flag the capture is keyed on. Set directly rather than by playing the
    // celebration, which needs a whole D1 season the reel is not reviewing.
    eventFlags: [...finished.eventFlags, TRUE_ENDING_SEEN_FLAG],
  });
}

export function hallOfFameCaseViewModel(
  caseId: HallOfFameCaseId,
): HallOfFameViewModel {
  return hallOfFameViewModel(hallOfFameCaseState(caseId));
}

/**
 * Writes the seasons a finished climb must have been made of.
 *
 * Division, final position, results, goals, the Cup champion and the Golden
 * Boot are all rewritten from the case's own season table; the fixture count
 * and the squad remain the seeded career's own. Results are rewritten with the
 * rest deliberately — a manager who never intervenes finishes mid-table, and a
 * record that credited that career's losing season with four titles would put
 * the page in front of a reviewer as numbers no save can hold.
 *
 * The Golden Boot has to be written for the same reason: the harness career
 * settles fixtures from the fixture seed rather than by running the match
 * engine, so its scorelines carry no scorers at all.
 */
function withHonours(state: GameState, caseId: HallOfFameCaseId): GameState {
  const strikers = leadingStrikers(state);
  const seasons =
    caseId === 'quick-climb' ? QUICK_CLIMB_SEASONS : LONG_CLIMB_SEASONS;
  const recaps = (state.seasonRecaps ?? []).map((recap): SeasonRecap => {
    // Two names sharing six seasons, so the reel shows a career total that had
    // to be summed rather than one season copied out.
    const scorer = strikers[recap.season % strikers.length];
    const booted: SeasonRecap =
      scorer === undefined
        ? recap
        : {
            ...recap,
            topScorer: {
              playerId: scorer.id,
              playerName: scorer.name,
              label: 'Golden Boot',
              detail: `${9 + recap.season * 2} goals`,
            },
          };
    const plan = seasons[recap.season - 1];
    // Defensive: a career run past the table is left exactly as it was played
    // rather than half-fabricated.
    if (plan === undefined) return booted;
    return {
      ...booted,
      division: plan.division,
      finalPosition: plan.finalPosition,
      ...seasonResults(recap.played, seasonShape(seasons, recap.season - 1)),
    };
  });
  const cupSeasons = seasons
    .map((season, index) => (season.cupWon ? index + 1 : 0))
    .filter((season) => season > 0);
  return {
    ...state,
    seasonRecaps: recaps,
    ...(state.m2 === undefined
      ? {}
      : {
          m2: {
            ...state.m2,
            nationalCups: state.m2.nationalCups.map((cup) =>
              cupSeasons.includes(cup.season)
                ? { ...cup, championClubId: state.userClubId }
                : cup,
            ),
          },
        }),
  };
}

/**
 * Which kind of season this was, read off the table rather than declared.
 *
 * A title is a champion's season; a season that ends one tier higher than it
 * started was a promotion; anything else is the club settling into the level.
 */
function seasonShape(
  seasons: readonly FabricatedSeason[],
  index: number,
): keyof typeof SEASON_SHAPES {
  const season = seasons[index];
  if (season === undefined) return 'settling';
  if (season.finalPosition === 1) return 'champion';
  const next = seasons[index + 1];
  return next !== undefined && next.division < season.division
    ? 'promoted'
    : 'settling';
}

/** The results a season of that kind carried, over the games it played. */
function seasonResults(played: number, shape: keyof typeof SEASON_SHAPES) {
  const { drawn, lost, goalsForPerGame, goalsAgainstPerGame } =
    SEASON_SHAPES[shape];
  // Clamped so the three always sum to the fixtures played, whatever the
  // schedule length is.
  const seasonDrawn = Math.min(drawn, played);
  const seasonLost = Math.min(lost, played - seasonDrawn);
  return {
    played,
    won: played - seasonDrawn - seasonLost,
    drawn: seasonDrawn,
    lost: seasonLost,
    goalsFor: Math.round(played * goalsForPerGame),
    goalsAgainst: Math.round(played * goalsAgainstPerGame),
  };
}

/** The two men a fabricated Golden Boot goes to, picked deterministically. */
function leadingStrikers(state: GameState): CareerPlayer[] {
  return state.players
    .filter(
      (player) => player.clubId === state.userClubId && player.role === 'FWD',
    )
    .sort(
      (left, right) =>
        right.attrs.sho - left.attrs.sho || compareIds(left.id, right.id),
    )
    .slice(0, 2);
}

export const hallOfFameEntry: DevHarnessEntry = Object.freeze({
  id: 'hall-of-fame',
  group: 'Season',
  title: 'Hall of Fame',
  summary: 'The career record, kept from the summit and opened from Settings.',
  cases: Object.freeze([
    { id: 'long-climb', label: 'Long climb', note: CASE_NOTES['long-climb'] },
    {
      id: 'quick-climb',
      label: 'Quick climb',
      note: CASE_NOTES['quick-climb'],
    },
    { id: 'locked', label: 'Locked', note: CASE_NOTES.locked },
  ]),
  render: (caseId: string) => (
    <HallOfFameReel caseId={caseId as HallOfFameCaseId} />
  ),
});

/**
 * The page is a sub-page of the Settings modal, so the panel frame reproduces
 * that box exactly — same paper, same 88% height, same dimmed backdrop. A
 * record reviewed full-bleed would never show the scroll the real one has.
 */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#241f2e' },
  panelFrame: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    // Clears the control bar. The Back control is the bottom row of the page,
    // and a reel that covered it would hide the one thing under review.
    paddingBottom: 96,
    backgroundColor: 'rgba(36,31,46,0.55)',
  },
  fullFrame: { flex: 1 },
  paperPanel: {
    width: '100%',
    maxWidth: 512,
    height: '88%',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#241f2e',
    backgroundColor: '#f4f1ea',
    padding: 20,
  },
  paperFull: {
    flex: 1,
    backgroundColor: '#f4f1ea',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 88,
  },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    gap: 6,
    borderTopWidth: 3,
    borderTopColor: '#edb54a',
    backgroundColor: 'rgba(18,16,25,0.94)',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  note: { color: '#d7cfe4', fontSize: 12, lineHeight: 17 },
});
