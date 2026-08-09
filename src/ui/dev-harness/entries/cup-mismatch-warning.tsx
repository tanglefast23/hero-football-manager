import { useMemo, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { loadLaunchContent } from '../../../content/load';
import { matchDayViewModel } from '../../../application/view-models';
import { activeCareerMatchday } from '../../../game/career';
import { cupMismatchWarning } from '../../../game/cup-mismatch-warning';
import type { DivisionLevel } from '../../../game/pyramid';
import type { GameState } from '../../../game/types';
import { BertBriefingWalkOn } from '../../BertBriefingWalkOn';
import { FixtureMatchDayScreen } from '../../screens/FixtureMatchDayScreen';
import { devHarnessCareer } from '../career';
import type { DevHarnessEntry } from '../registry';

interface MismatchCase {
  readonly id: string;
  readonly label: string;
  readonly note: string;
  readonly divisionGap: 2 | 3 | 4;
  readonly namesStar: boolean;
}

const MISMATCH_CASES: readonly MismatchCase[] = Object.freeze([
  {
    id: 'two-divisions',
    label: 'Two up',
    note: 'Expected to lose by a couple · no player callout',
    divisionGap: 2,
    namesStar: false,
  },
  {
    id: 'three-divisions-star',
    label: 'Three + star',
    note: 'Heavy-loss warning · names the likeliest scorer',
    divisionGap: 3,
    namesStar: true,
  },
  {
    id: 'four-divisions-star',
    label: 'Four + star',
    note: 'Widest possible mismatch · longest warning copy',
    divisionGap: 4,
    namesStar: true,
  },
]);

const CASE_BY_ID = new Map(
  MISMATCH_CASES.map((candidate) => [candidate.id, candidate]),
);

/** A real career stopped at its first player-controlled Cup formation screen. */
function cupMatchdayCareer(): GameState {
  return devHarnessCareer({
    id: 'cup-mismatch-warning:first-cup-matchday:20260805',
    seed: 20260805,
    seasonBudget: 2,
    stopAt: (state) =>
      state.phase === 'matchday' &&
      activeCareerMatchday(state)?.kind === 'national-cup',
  });
}

/**
 * Varies only the two inputs under review: frozen division gap and the 50/50
 * presentation bit. The screen, teams, lineup, names and warning builder are
 * all production paths.
 */
function mismatchCareer(mismatchCase: MismatchCase): GameState {
  const base = cupMatchdayCareer();
  const matchday = activeCareerMatchday(base);
  if (matchday?.kind !== 'national-cup')
    throw new Error('Cup mismatch harness has no Cup tie');
  const opponentClubId =
    matchday.fixture.homeClubId === base.userClubId
      ? matchday.fixture.awayClubId
      : matchday.fixture.homeClubId;
  return {
    ...base,
    m2: {
      ...base.m2!,
      nationalCups: base.m2!.nationalCups.map((cup) =>
        cup.season !== base.season
          ? cup
          : {
              ...cup,
              seedDivisionByClubId: {
                ...cup.seedDivisionByClubId,
                [base.userClubId]: 5,
                [opponentClubId]: (5 -
                  mismatchCase.divisionGap) as DivisionLevel,
              },
              rounds: cup.rounds.map((round) => ({
                ...round,
                fixtures: round.fixtures.map((fixture) =>
                  fixture.id !== matchday.fixture.id
                    ? fixture
                    : {
                        ...fixture,
                        // Even names the star; odd leaves the second bubble out.
                        matchSeed: mismatchCase.namesStar ? 2 : 1,
                      },
                ),
              })),
            },
      ),
    },
  };
}

export function CupMismatchWarningReel({
  caseId,
}: {
  readonly caseId: string;
}) {
  const mismatchCase = CASE_BY_ID.get(caseId) ?? MISMATCH_CASES[0];
  const { width, height } = useWindowDimensions();
  const content = useMemo(() => loadLaunchContent(), []);
  const state = useMemo(() => mismatchCareer(mismatchCase), [mismatchCase]);
  const warning = useMemo(() => cupMismatchWarning(state), [state]);
  const viewModel = useMemo(
    () => matchDayViewModel(state, content),
    [content, state],
  );
  const [visible, setVisible] = useState(true);
  if (warning === undefined)
    throw new Error(`Cup mismatch case ${mismatchCase.id} produced no warning`);

  return (
    <View style={{ flex: 1 }}>
      <FixtureMatchDayScreen
        viewModel={viewModel}
        onBack={() => {}}
        onToggleHeroLicense={() => {}}
        onSwapStartingPlayer={() => {}}
        onWatchMatch={() => {}}
        onQuickResult={() => {}}
        onOpenSettings={() => {}}
      />
      {visible ? (
        <BertBriefingWalkOn
          key={warning.fixtureId}
          content={content.assistantGuide}
          customMessage={warning}
          navigationAnchor={{
            x: 0,
            y: Math.max(0, height - 78),
            width,
            height: 78,
          }}
          reduceMotion
          onDone={() => setVisible(false)}
        />
      ) : null}
    </View>
  );
}

export const cupMismatchWarningEntry: DevHarnessEntry = Object.freeze({
  id: 'cup-mismatch-warning',
  group: 'Cup',
  title: 'Cup mismatch warning',
  summary:
    'Bert warns about opponents two, three, or four divisions above the club.',
  cases: Object.freeze(
    MISMATCH_CASES.map((candidate) =>
      Object.freeze({
        id: candidate.id,
        label: candidate.label,
        note: candidate.note,
      }),
    ),
  ),
  render: (caseId: string) => <CupMismatchWarningReel caseId={caseId} />,
});
