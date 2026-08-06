import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { clubFinancesViewModel, seasonEndViewModel } from '../../../application/view-models';
import { loadLaunchContent } from '../../../content/load';
import {
  acceptSponsorOffer,
  advanceWeek,
  createSeasonSponsorship,
  divisionSponsorAnchor,
  expireSponsorOfferWindow,
} from '../../../game';
import type { DivisionLevel } from '../../../game/pyramid';
import type { GameState } from '../../../game/types';
import {
  ConfirmationSheet,
  confirmationBackgroundProps,
  type ConfirmationRequest,
} from '../../components/ConfirmationSheet';
import { formatCurrency } from '../../components/Scorecard';
import type { ClubOfficeTab, SponsorOfferViewModel, SponsorSlotViewModel } from '../../models';
import { ClubFinancesScreen } from '../../screens/ClubFinancesScreen';
import { SeasonEndScreen } from '../../screens/SeasonEndScreen';
import { devHarnessCareerAtWeek } from '../career';
import type { DevHarnessEntry } from '../registry';

/** Production Sponsor Desk states used for the required 375pt review matrix. */
type ClubBusinessCaseId =
  | 'd5-locked'
  | 'd5-buzz-0'
  | 'd5-buzz-64'
  | 'd5-buzz-100'
  | 'd5-after-payout'
  | 'd4-offers'
  | 'd4-continuity'
  | 'd3-offers'
  | 'd3-partial'
  | 'd2-offers'
  | 'd2-partial'
  | 'chairman-d2'
  | 'season-end-results'
  | 'long-copy'
  | 'confirm-offer';

const CASES: readonly { id: ClubBusinessCaseId; label: string; note: string }[] = [
  { id: 'd5-locked', label: 'D5 locked', note: 'Season 2: no managed Sponsor Desk or Buzz.' },
  { id: 'd5-buzz-0', label: 'D5 Buzz 0', note: 'Season 3 local advertising; managed offers stay locked.' },
  { id: 'd5-buzz-64', label: 'Buzz 64', note: 'A useful mid-half payout estimate.' },
  { id: 'd5-buzz-100', label: 'Buzz 100', note: 'The capped meter and maximum Buzz payout.' },
  { id: 'd5-after-payout', label: 'After pay', note: 'Meter reset with the durable settlement summary.' },
  { id: 'd4-offers', label: 'D4 offers', note: 'First managed season: one slot and three offers.' },
  { id: 'd4-continuity', label: 'D4 late', note: 'Week 8 continuity income with the offer window closed.' },
  { id: 'd3-offers', label: 'D3 offers', note: 'Two provisional slots, each with its own candidates.' },
  { id: 'd3-partial', label: 'D3 partial', note: 'One signed slot and one still awaiting a choice.' },
  { id: 'd2-offers', label: 'D2 offers', note: 'Three provisional slots without a nine-card wall.' },
  { id: 'd2-partial', label: 'D2 partial', note: 'Two signed slots and one provisional slot.' },
  { id: 'chairman-d2', label: 'Chairman', note: 'Exact nominal and 80% actual receipts.' },
  { id: 'season-end-results', label: 'Season end', note: 'Real Week 30 path: met and missed targets plus the second Buzz payday.' },
  { id: 'long-copy', label: 'Long copy', note: 'Longest sponsor, objective, and Chairman money pressure at 375pt.' },
  { id: 'confirm-offer', label: 'Confirm', note: 'The real accessible sponsor-signing confirmation.' },
];

interface BusinessCase {
  readonly season: number;
  readonly week: number;
  readonly division: DivisionLevel;
  readonly highestDivisionReached: DivisionLevel;
  readonly difficulty: 'COZY' | 'CHAIRMAN';
  readonly buzz: number;
  readonly signedSlots: number;
  readonly afterPayout?: boolean;
  readonly seasonEnd?: boolean;
  readonly longCopy?: boolean;
}

function caseConfiguration(caseId: ClubBusinessCaseId): BusinessCase {
  switch (caseId) {
    case 'd5-locked':
      return { season: 2, week: 3, division: 5, highestDivisionReached: 5, difficulty: 'COZY', buzz: 0, signedSlots: 0 };
    case 'd5-buzz-0':
      return { season: 3, week: 3, division: 5, highestDivisionReached: 5, difficulty: 'COZY', buzz: 0, signedSlots: 0 };
    case 'd5-buzz-64':
      return { season: 3, week: 12, division: 5, highestDivisionReached: 5, difficulty: 'COZY', buzz: 64, signedSlots: 0 };
    case 'd5-buzz-100':
      return { season: 3, week: 14, division: 5, highestDivisionReached: 5, difficulty: 'COZY', buzz: 100, signedSlots: 0 };
    case 'd5-after-payout':
      return { season: 3, week: 16, division: 5, highestDivisionReached: 5, difficulty: 'COZY', buzz: 0, signedSlots: 0, afterPayout: true };
    case 'd4-continuity':
      return { season: 3, week: 8, division: 4, highestDivisionReached: 4, difficulty: 'COZY', buzz: 38, signedSlots: 0 };
    case 'd3-offers':
      return { season: 3, week: 2, division: 3, highestDivisionReached: 3, difficulty: 'COZY', buzz: 46, signedSlots: 0 };
    case 'd3-partial':
      return { season: 3, week: 2, division: 3, highestDivisionReached: 3, difficulty: 'COZY', buzz: 46, signedSlots: 1 };
    case 'd2-offers':
      return { season: 4, week: 2, division: 2, highestDivisionReached: 2, difficulty: 'COZY', buzz: 71, signedSlots: 0 };
    case 'd2-partial':
      return { season: 4, week: 2, division: 2, highestDivisionReached: 2, difficulty: 'COZY', buzz: 71, signedSlots: 2 };
    case 'chairman-d2':
      return { season: 4, week: 2, division: 2, highestDivisionReached: 2, difficulty: 'CHAIRMAN', buzz: 71, signedSlots: 2 };
    case 'season-end-results':
      return { season: 4, week: 30, division: 3, highestDivisionReached: 3, difficulty: 'CHAIRMAN', buzz: 64, signedSlots: 2, seasonEnd: true };
    case 'long-copy':
      return { season: 4, week: 2, division: 2, highestDivisionReached: 2, difficulty: 'CHAIRMAN', buzz: 88, signedSlots: 0, longCopy: true };
    case 'confirm-offer':
    case 'd4-offers':
      return { season: 3, week: 2, division: 4, highestDivisionReached: 4, difficulty: 'COZY', buzz: 32, signedSlots: 0 };
  }
}

function ClubBusinessReel({ caseId }: { readonly caseId: ClubBusinessCaseId }) {
  const [career, setCareer] = useState(() => businessCareer(caseId));
  const [activeTab, setActiveTab] = useState<ClubOfficeTab>('finances');
  const reduceMotion = caseId !== 'confirm-offer';
  const viewModel = useMemo(() => clubFinancesViewModel(career), [career]);
  const initialOffer = viewModel.sponsorship?.slots.flatMap(slot => (
    slot.offers.map(offer => ({ offer, slot }))
  ))[0];
  const [pending, setPending] = useState<{
    readonly offer: SponsorOfferViewModel;
    readonly slot: SponsorSlotViewModel;
  } | null>(() => caseId === 'confirm-offer' ? initialOffer ?? null : null);
  const confirmation = pending === null ? null : sponsorConfirmation(pending.offer, pending.slot, () => {
    setCareer(current => ({
      ...current,
      clubBusiness: {
        ...current.clubBusiness,
        sponsorship: acceptSponsorOffer(current.clubBusiness.sponsorship, {
          offerId: pending.offer.offerId,
          season: current.season,
          week: current.week,
        }),
      },
    }));
  });

  return (
    <View className="flex-1 bg-paper">
      <View className="flex-1" {...confirmationBackgroundProps(confirmation !== null)}>
        <ClubFinancesScreen
          viewModel={viewModel}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onBuildTrainingGround={() => {}}
          onReviewSponsorOffer={(offer, slot) => setPending({ offer, slot })}
          reduceMotion={reduceMotion}
        />
      </View>
      <ConfirmationSheet
        confirmation={confirmation}
        reduceMotion={reduceMotion}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          confirmation?.onConfirm();
          setPending(null);
        }}
      />
    </View>
  );
}

function ClubBusinessSeasonEndReel({ caseId }: { readonly caseId: ClubBusinessCaseId }) {
  const [career] = useState(() => businessCareer(caseId));
  const content = useMemo(() => loadLaunchContent(), []);
  const viewModel = useMemo(() => seasonEndViewModel(career, content, 1), [career, content]);

  return (
    <SeasonEndScreen
      viewModel={viewModel}
      onSelectContractTerm={() => {}}
      onRenewContract={() => {}}
      onReleaseContract={() => {}}
      onStartRenewal={() => {}}
      onSubmitRenewalOffer={() => {}}
      onCloseRenewal={() => {}}
      onPrimaryAction={() => {}}
      onOpenSettings={() => {}}
    />
  );
}

function sponsorConfirmation(
  offer: SponsorOfferViewModel,
  slot: SponsorSlotViewModel,
  onConfirm: () => void,
): ConfirmationRequest {
  return {
    title: `Sign ${offer.sponsorName}?`,
    detail: `${slot.slotLabel}. Contract ${formatCurrency(offer.nominalMonthlyFee)} per month.${
      offer.actualMonthlyFee === offer.nominalMonthlyFee
        ? ''
        : ` On Chairman, the club receives ${formatCurrency(offer.actualMonthlyFee)} per month.`
    } Objective: ${offer.objectiveLabel}. Target bonus ${formatCurrency(offer.nominalBonus)}.${
      offer.actualBonus === offer.nominalBonus
        ? ''
        : ` The club receives ${formatCurrency(offer.actualBonus)} on Chairman.`
    }`,
    confirmLabel: 'Sign deal',
    returnFocusId: `sponsor-slots-panel-${slot.slot}`,
    onConfirm,
  };
}

function businessCareer(caseId: ClubBusinessCaseId): GameState {
  const config = caseConfiguration(caseId);
  const base = devHarnessCareerAtWeek(1, 1, 20260805);
  if (base.m2 === undefined || base.sponsorRules === undefined) {
    throw new Error('Club Business harness requires M2 and sponsor rules');
  }
  const withDivision = moveUserClub(base, config.division, config.highestDivisionReached);
  const nominalAnchor = divisionSponsorAnchor(config.division);
  let sponsorship = createSeasonSponsorship({
    rules: base.sponsorRules,
    careerSeed: base.careerSeed,
    season: config.season,
    division: config.division,
    difficulty: config.difficulty,
    highestDivisionReached: config.highestDivisionReached,
    nominalAnchor,
  });
  for (let slot = 0; slot < config.signedSlots; slot += 1) {
    const offer = sponsorship.offers.find(candidate => (
      candidate.slot === slot && candidate.profile === (slot % 2 === 0 ? 'BALANCED' : 'STEADY')
    ));
    if (offer !== undefined) {
      sponsorship = acceptSponsorOffer(sponsorship, {
        offerId: offer.offerId,
        season: config.season,
        week: Math.min(config.week, 4),
      });
    }
  }
  if (config.week >= 5) {
    sponsorship = expireSponsorOfferWindow(sponsorship, config.season, config.week);
  }
  if (config.longCopy) {
    sponsorship = withLongCopyPressure(sponsorship);
  }
  const clubs = withDivision.clubs.map(club => club.id === withDivision.userClubId
    ? { ...club, cash: 67_450, sponsorMonthlyFee: nominalAnchor }
    : club);

  const ready: GameState = {
    ...withDivision,
    season: config.season,
    week: config.week,
    phase: 'manage',
    difficulty: config.difficulty,
    clubs,
    fixtures: withDivision.fixtures.map(fixture => ({ ...fixture, season: config.season })),
    clubBusiness: {
      ...withDivision.clubBusiness,
      sponsorship,
      buzz: config.afterPayout
        ? {
            value: 0,
            lastSettledSeason: config.season,
            lastSettledHalf: 1,
            lastSettlementSummary: {
              season: config.season,
              half: 1,
              before: 52,
              rawEarned: 12,
              realizedEarned: 12,
              prePayoutValue: 64,
              payout: 1_280,
              resetValue: 0,
              impacts: [],
            },
          }
        : { value: config.buzz },
      pendingUserMatchImpacts: [],
    },
  };
  return config.seasonEnd ? advanceWeek(prepareRealSeasonEnd(ready)) : ready;
}

function prepareRealSeasonEnd(state: GameState): GameState {
  let assignedUserWin = false;
  return {
    ...state,
    fixtures: state.fixtures.map(fixture => {
      const userIsHome = fixture.homeClubId === state.userClubId;
      const userIsAway = fixture.awayClubId === state.userClubId;
      const giveUserWin = !assignedUserWin && (userIsHome || userIsAway);
      if (giveUserWin) assignedUserWin = true;
      return {
        ...fixture,
        season: state.season,
        status: 'played' as const,
        score: giveUserWin
          ? {
              homeGoals: userIsHome ? 2 : 0,
              awayGoals: userIsAway ? 2 : 0,
            }
          : { homeGoals: 0, awayGoals: 0 },
      };
    }),
    clubBusiness: {
      ...state.clubBusiness,
      sponsorship: {
        ...state.clubBusiness.sponsorship,
        activeContracts: state.clubBusiness.sponsorship.activeContracts.map((contract, index) => ({
          ...contract,
          provisional: false,
          objective: index === 0
            ? {
                kind: 'LEAGUE_WINS' as const,
                label: 'Win 1 league match',
                target: 1,
                nominalBonus: 1_001,
              }
            : {
                kind: 'LEAGUE_GOALS' as const,
                label: 'Score 99 league goals',
                target: 99,
                nominalBonus: 999,
              },
          objectiveOutcome: undefined,
        })),
      },
      buzz: { value: state.clubBusiness.buzz.value },
      pendingUserMatchImpacts: [],
    },
  };
}

function withLongCopyPressure(
  sponsorship: GameState['clubBusiness']['sponsorship'],
): GameState['clubBusiness']['sponsorship'] {
  return {
    ...sponsorship,
    offers: sponsorship.offers.map(offer => (
      offer.slot === 0 && offer.profile === 'BOLD'
        ? {
            ...offer,
            sponsorName: 'Northstar Community Equipment Cooperative',
            offerLine: 'Backing every fearless football story in the neighbourhood.',
            // D2's largest authored Bold terms, with only the copy lengthened.
            nominalMonthlyFee: 2_400,
            objective: {
              ...offer.objective,
              label: "Finish in the league's top 2 after a demanding 18-match campaign",
              nominalBonus: 17_335,
            },
          }
        : offer
    )),
  };
}

/** Swap the user with one generated club so the harness remains a valid five-division pyramid. */
function moveUserClub(
  state: GameState,
  division: DivisionLevel,
  highestDivisionReached: DivisionLevel,
): GameState {
  if (state.m2 === undefined || division === 5) {
    return state.m2 === undefined
      ? state
      : { ...state, m2: { ...state.m2, highestDivisionReached } };
  }
  const source = state.m2.pyramid.divisions.find(candidate => candidate.level === 5);
  const destination = state.m2.pyramid.divisions.find(candidate => candidate.level === division);
  const user = source?.clubs.find(club => club.id === state.userClubId);
  const displaced = destination?.clubs[0];
  if (source === undefined || destination === undefined || user === undefined || displaced === undefined) {
    throw new Error(`Club Business harness cannot move the user to D${division}`);
  }
  return {
    ...state,
    m2: {
      ...state.m2,
      highestDivisionReached,
      pyramid: {
        ...state.m2.pyramid,
        divisions: state.m2.pyramid.divisions.map(candidate => {
          if (candidate.level === 5) {
            return {
              ...candidate,
              clubs: candidate.clubs.map(club => club.id === user.id
                ? { ...displaced, division: 5 }
                : club),
            };
          }
          if (candidate.level === division) {
            return {
              ...candidate,
              clubs: candidate.clubs.map(club => club.id === displaced.id
                ? { ...user, division }
                : club),
            };
          }
          return candidate;
        }),
      },
    },
  };
}

export const clubBusinessEntry: DevHarnessEntry = Object.freeze({
  id: 'club-business',
  group: 'Club',
  title: 'Club Business',
  summary: 'Sponsor slots, offers, objectives, Buzz, and the signing question.',
  cases: Object.freeze(CASES),
  render: (caseId: string) => caseId === 'season-end-results'
    ? <ClubBusinessSeasonEndReel caseId={caseId} />
    : <ClubBusinessReel caseId={caseId as ClubBusinessCaseId} />,
});
