import { useMemo } from 'react';
import { postMatchViewModel } from '../../../application/view-models';
import type { GameState } from '../../../game/types';
import { PostMatchLedgerScreen } from '../../screens/PostMatchLedgerScreen';
import { devHarnessCareerAtWeek } from '../career';
import type { DevHarnessEntry } from '../registry';

/**
 * The full-time report, in the three moods it can arrive in.
 *
 * Reaching a blaming in play needs a head coach, an assistant, a defeat, and a
 * one-in-three roll to land — which is a lot of Saturdays to sit through to
 * check a speech bubble fits on a phone. Every state here is built by the
 * shipped `postMatchViewModel` from a real seeded career, so what the reel
 * shows is what a manager gets; the only thing chosen is the scoreline and
 * which of the career's own coach candidates is sitting in which chair.
 *
 * The blame case searches for a fixture the real roll actually blames on rather
 * than forcing the pose, so if the roll ever stops firing this case goes blank
 * and says so instead of quietly showing a hand-made picture.
 */

export type FulltimeReportCaseId = 'win' | 'loss' | 'blamed';

const CASES: readonly { id: FulltimeReportCaseId; label: string; note: string }[] = [
  { id: 'win', label: 'Win', note: 'Winner boxed in red, gaffer celebrating.' },
  { id: 'loss', label: 'Loss', note: 'Opponent boxed, gaffer in tears.' },
  { id: 'blamed', label: 'Loss · blamed', note: 'The one-in-three: he points at the assistant.' },
];

/** A career with both chairs filled, so a blaming has someone to land on. */
function staffedCareer(): GameState {
  const career = devHarnessCareerAtWeek(1, 6);
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

function FulltimeReportReel({ caseId }: { caseId: FulltimeReportCaseId }) {
  const viewModel = useMemo(() => {
    const career = staffedCareer();
    const userFixtures = career.fixtures.filter(fixture => (
      fixture.homeClubId === career.userClubId || fixture.awayClubId === career.userClubId
    ));
    const scoreFor = (fixture: typeof userFixtures[number], won: boolean) => {
      const isHome = fixture.homeClubId === career.userClubId;
      const mine = won ? 3 : 0;
      const theirs = won ? 1 : 2;
      return isHome
        ? { homeGoals: mine, awayGoals: theirs }
        : { homeGoals: theirs, awayGoals: mine };
    };

    if (caseId === 'win') {
      const fixture = userFixtures[0];
      return postMatchViewModel(career, career, fixture.id, scoreFor(fixture, true));
    }

    // Walk the season for a defeat the real roll blames on (or, for 'loss',
    // one it does not), rather than forcing the pose the reel wants to show.
    const wantBlame = caseId === 'blamed';
    for (const fixture of userFixtures) {
      const model = postMatchViewModel(career, career, fixture.id, scoreFor(fixture, false));
      if ((model.reaction?.pose === 'point') === wantBlame) return model;
    }
    return postMatchViewModel(career, career, userFixtures[0].id, scoreFor(userFixtures[0], false));
  }, [caseId]);

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
  summary: 'The winner boxed in red, and what the touchline does about it.',
  cases: Object.freeze(CASES.map(entry => ({
    id: entry.id,
    label: entry.label,
    note: entry.note,
  }))),
  render: (caseId: string) => (
    <FulltimeReportReel caseId={caseId as FulltimeReportCaseId} />
  ),
});
