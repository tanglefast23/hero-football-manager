import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { postMatchViewModel } from '../../../application/view-models';
import type { GameState } from '../../../game/types';
import { PostMatchLedgerScreen } from '../../screens/PostMatchLedgerScreen';
import { devHarnessCareerAtWeek } from '../career';
import type { DevHarnessEntry } from '../registry';

/**
 * The full-time report, in every mood it can arrive in.
 *
 * Reaching a blaming in play needs a head coach, an assistant, a defeat, and a
 * one-in-three roll to land, and reaching a giant-killing needs the cup draw to
 * pair a bottom-tier club with a top-tier one — which is a lot of Saturdays to
 * sit through to check a speech bubble fits on a phone. Every state here is
 * built by the shipped `postMatchViewModel` from a real seeded career, so what
 * the reel shows is what a manager gets; the only things chosen are the
 * scoreline and which of the career's own coach candidates sits in which chair.
 *
 * The blame case searches for a fixture the real roll actually blames on rather
 * than forcing the pose, so if the roll ever stops firing this case goes blank
 * and says so instead of quietly showing a hand-made picture. The cup cases
 * search the real draw the same way.
 *
 * Three of the cup pools are missing here on purpose. `cupWinRoutine` and
 * `cupLossWeak` need an opponent below you and `cupWinBetter` needs a gap of
 * exactly one, and the harness career sits in D5 with nothing underneath it.
 * They are second-season copy; a reel that faked them would prove nothing.
 */

export type FulltimeReportCaseId =
  | 'win'
  | 'rout'
  | 'draw'
  | 'loss'
  | 'hiding'
  | 'blamed'
  | 'cup-giant'
  | 'cup-even';

const CASES: readonly {
  id: FulltimeReportCaseId;
  label: string;
  note: string;
}[] = [
  {
    id: 'win',
    label: 'Win · close',
    note: 'Won by two. Relieved rather than delighted.',
  },
  {
    id: 'rout',
    label: 'Win · big',
    note: 'Won by four. He has run out of things to shout.',
  },
  {
    id: 'draw',
    label: 'Draw',
    note: 'Neutral result copy, and he stands at rest to say so.',
  },
  {
    id: 'loss',
    label: 'Loss · close',
    note: 'Beaten by two, and in tears about it.',
  },
  {
    id: 'hiding',
    label: 'Loss · big',
    note: 'Beaten by four. No speech exists for that.',
  },
  {
    id: 'blamed',
    label: 'Loss · blamed',
    note: 'The one-in-three: he points at the assistant.',
  },
  {
    id: 'cup-giant',
    label: 'Cup · giant-killed',
    note: 'Beat a club four divisions up.',
  },
  {
    id: 'cup-even',
    label: 'Cup · level tie',
    note: 'Beat a club out of our own division.',
  },
];

/** Both chairs filled, so a blaming has someone to land on. */
function staffedCareer(week: number): GameState {
  const career = devHarnessCareerAtWeek(1, week);
  const candidates = career.market?.coachCandidates ?? [];
  if (career.market === undefined || candidates.length < 2) return career;
  return {
    ...career,
    market: {
      ...career.market,
      headCoach: career.market.headCoach ?? candidates[0],
      assistantCoach: career.market.assistantCoach ?? candidates[1],
    },
  };
}

/** How many divisions above the club its cup opponent was, at the draw. */
function cupTiersAbove(
  career: GameState,
  fixtureId: string,
  opponentClubId: string,
): number {
  const seeds = career.m2?.nationalCups.find((cup) =>
    cup.rounds.some((round) => round.fixtures.some((f) => f.id === fixtureId)),
  )?.seedDivisionByClubId;
  const mine = seeds?.[career.userClubId];
  const theirs = seeds?.[opponentClubId];
  return mine === undefined || theirs === undefined ? 0 : mine - theirs;
}

function FulltimeReportReel({ caseId }: { caseId: FulltimeReportCaseId }) {
  const viewModel = useMemo(() => {
    // Week 10 is the first with a second cup round played, which is where the
    // draw happens to pair this club with a top-tier one.
    const career = staffedCareer(caseId.startsWith('cup-') ? 10 : 6);
    const goals = (
      fixture: { homeClubId: string },
      mine: number,
      theirs: number,
    ) =>
      fixture.homeClubId === career.userClubId
        ? { homeGoals: mine, awayGoals: theirs }
        : { homeGoals: theirs, awayGoals: mine };

    if (caseId.startsWith('cup-')) {
      const wantGiant = caseId === 'cup-giant';
      const cupFixtures = (career.m2?.nationalCups ?? [])
        .flatMap((cup) => cup.rounds)
        .flatMap((round) => round.fixtures)
        .filter(
          (f) =>
            f.homeClubId === career.userClubId ||
            f.awayClubId === career.userClubId,
        );
      for (const fixture of cupFixtures) {
        const opponent =
          fixture.homeClubId === career.userClubId
            ? fixture.awayClubId
            : fixture.homeClubId;
        const tiers = cupTiersAbove(career, fixture.id, opponent);
        if (tiers >= 2 === wantGiant) {
          return postMatchViewModel(
            career,
            career,
            fixture.id,
            goals(fixture, 2, 1),
          );
        }
      }
      return undefined;
    }

    const userFixtures = career.fixtures.filter(
      (fixture) =>
        fixture.homeClubId === career.userClubId ||
        fixture.awayClubId === career.userClubId,
    );
    const first = userFixtures[0];
    if (caseId === 'win')
      return postMatchViewModel(career, career, first.id, goals(first, 3, 1));
    if (caseId === 'rout')
      return postMatchViewModel(career, career, first.id, goals(first, 4, 0));
    if (caseId === 'draw')
      return postMatchViewModel(career, career, first.id, goals(first, 1, 1));
    if (caseId === 'hiding')
      return postMatchViewModel(career, career, first.id, goals(first, 0, 4));

    // Walk the season for a defeat the real roll blames on (or, for 'loss',
    // one it does not), rather than forcing the pose the reel wants to show.
    const wantBlame = caseId === 'blamed';
    for (const fixture of userFixtures) {
      const model = postMatchViewModel(
        career,
        career,
        fixture.id,
        goals(fixture, 1, 3),
      );
      if ((model.reaction?.pose === 'point') === wantBlame) return model;
    }
    return undefined;
  }, [caseId]);

  if (viewModel === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-paper p-6">
        <Text className="text-center text-ink">
          No fixture in this career produces that case. The roll or the draw has
          changed.
        </Text>
      </View>
    );
  }

  return (
    <PostMatchLedgerScreen
      viewModel={viewModel}
      onContinue={() => {}}
      onOpenSettings={() => {}}
    />
  );
}

export const fulltimeReportEntry: DevHarnessEntry = Object.freeze({
  id: 'fulltime-report',
  group: 'Match',
  title: 'Full-time report',
  summary: 'Our result in green or red, and what the gaffer says about it.',
  cases: Object.freeze(
    CASES.map((entry) => ({
      id: entry.id,
      label: entry.label,
      note: entry.note,
    })),
  ),
  render: (caseId: string) => (
    <FulltimeReportReel caseId={caseId as FulltimeReportCaseId} />
  ),
});
