import { createCareer } from '../../game/career';
import {
  beginCareerTransferTalks,
  completeCareerTransfer,
  resolveCareerScoutClock,
  startCareerScoutMission,
  submitCareerTransferOffer,
} from '../../game/market-career';
import {
  addCreatedPlayer,
  beginStoryOnboarding,
} from '../../game/onboarding/story-onboarding';
import { DEFAULT_CREATION_RATINGS } from '../../game/onboarding/player-creation';
import { STORY_STARTING_ROSTER_SIZE } from '../../game/story-progression';
import { hasAssistantGuideSequenceCompleted } from '../../game/assistant-guide';
import {
  careerRosterCapacity,
  reconcileStoryYouthIntake,
  signYouthIntakeOffer,
} from '../../game/youth-intake';
import {
  dueAssistantInboxGuideSequences,
  reconcileSatisfiedAssistantGuideSequences,
} from '../assistant-guide';
import { createLaunchCareerSetup } from '../launch';
import {
  careerMarketScoutOptions,
  careerMarketViewModelSource,
} from '../market-source-adapter';
import { marketViewModel } from '../market-view-model';

function createdStory(seed = 20260718) {
  const begun = beginStoryOnboarding(createCareer(createLaunchCareerSetup(
    seed,
    undefined,
  )));
  return addCreatedPlayer(begun, {
    name: 'Jo Rook',
    ratings: DEFAULT_CREATION_RATINGS,
  });
}

describe('story recruitment pacing', () => {
  it('opens two real roster slots and preserves the cheaper starting payroll', () => {
    const launch = createCareer(createLaunchCareerSetup(20260718));
    const launchClub = launch.clubs.find(club => club.id === launch.userClubId)!;
    const begun = beginStoryOnboarding(launch);
    const begunClub = begun.clubs.find(club => club.id === begun.userClubId)!;
    const story = addCreatedPlayer(begun, {
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    const storyClub = story.clubs.find(club => club.id === story.userClubId)!;

    expect(begun.players.filter(player => player.clubId === begun.userClubId)).toHaveLength(14);
    expect(begun.players.some(player => player.id === 'bramble-rovers-p13')).toBe(false);
    expect(begun.players.some(player => player.id === 'bramble-rovers-p16')).toBe(false);
    expect(begunClub.weeklyWages).toBe(launchClub.weeklyWages - 242);
    expect(begun.youthIntake).toMatchObject({ status: 'CLOSED', offers: [] });

    expect(story.players.filter(player => player.clubId === story.userClubId))
      .toHaveLength(STORY_STARTING_ROSTER_SIZE);
    expect(careerRosterCapacity(story)).toBe(17);
    expect(storyClub.weeklyWages).toBe(3_074);
  });

  it('reveals Youth in Week 2, Cup in Week 5, and Scouting in Week 15', () => {
    const weekOne = createdStory();
    const weekOneMarket = marketViewModel(careerMarketViewModelSource(weekOne));
    expect(weekOneMarket.sections).toEqual(['COACHES']);
    expect(weekOneMarket.youth).toBeUndefined();
    expect(dueAssistantInboxGuideSequences(weekOne)).not.toEqual(expect.arrayContaining([
      'youth-intake',
      'scout-mission',
      'transfer-list',
      'roster-cap',
      'national-cup',
    ]));

    const weekTwo = reconcileStoryYouthIntake({ ...weekOne, week: 2 });
    expect(weekTwo.youthIntake).toMatchObject({ status: 'OPEN' });
    expect(marketViewModel(careerMarketViewModelSource(weekTwo)).sections)
      .toEqual(['YOUTH', 'COACHES']);
    expect(dueAssistantInboxGuideSequences(weekTwo)).toContain('youth-intake');
    expect(dueAssistantInboxGuideSequences(weekTwo)).not.toContain('national-cup');

    const weekFive = reconcileStoryYouthIntake({ ...weekTwo, week: 5 });
    expect(weekFive.youthIntake).toMatchObject({ status: 'CLOSED', offers: [] });
    expect(dueAssistantInboxGuideSequences(weekFive)).toContain('national-cup');

    const weekFourteen = { ...weekFive, week: 14 };
    const localBrief = careerMarketScoutOptions(weekFourteen)[0];
    expect(() => startCareerScoutMission(
      weekFourteen,
      weekFourteen.market!,
      localBrief.region,
      localBrief.focus,
    )).toThrow('Week 15');

    const weekFifteen = { ...weekFive, week: 15 };
    expect(marketViewModel(careerMarketViewModelSource(weekFifteen)).sections)
      .toEqual(['YOUTH', 'SCOUT', 'COACHES']);
    expect(dueAssistantInboxGuideSequences(weekFifteen)).toContain('scout-mission');
  });

  it('keeps the Season 1 pacing gates after an old save loses its onboarding marker', () => {
    const migratedWeekOne = {
      ...createdStory(20260722),
      week: 1,
      onboarding: undefined,
      eventFlags: [
        'guide:bert:inbox:queued:youth-intake',
        'guide:bert:inbox:delivered:s1:w1:guide:youth-intake',
        'guide:bert:sequence-complete:youth-intake',
        'guide:bert:inbox:queued:scout-mission',
        'guide:bert:inbox:queued:transfer-list',
      ],
    };

    const repaired = reconcileSatisfiedAssistantGuideSequences(migratedWeekOne);
    expect(repaired.eventFlags.some(flag => (
      flag.includes('youth-intake')
      || flag.includes('scout-mission')
      || flag.includes('transfer-list')
    ))).toBe(false);
    expect(marketViewModel(careerMarketViewModelSource(repaired)).sections).toEqual(['COACHES']);
    expect(dueAssistantInboxGuideSequences(repaired)).not.toEqual(expect.arrayContaining([
      'youth-intake',
      'scout-mission',
      'transfer-list',
    ]));

    const weekTwo = reconcileStoryYouthIntake({ ...repaired, week: 2 });
    expect(marketViewModel(careerMarketViewModelSource(weekTwo)).sections)
      .toEqual(['YOUTH', 'COACHES']);
    expect(dueAssistantInboxGuideSequences(weekTwo)).toContain('youth-intake');
  });

  it('allows one youth, times the first scout for the window, then teaches the 17-player cap', () => {
    const weekTwo = reconcileStoryYouthIntake({ ...createdStory(24680), week: 2 });
    const youthOffer = weekTwo.youthIntake!.offers[0];
    const youth = signYouthIntakeOffer(weekTwo, weekTwo.youthIntake!, youthOffer.player.id);
    const withYouth = { ...youth.state, youthIntake: youth.intake };

    expect(withYouth.players.filter(player => player.clubId === withYouth.userClubId)).toHaveLength(16);
    expect(withYouth.youthIntake).toMatchObject({ status: 'CLOSED', offers: [] });

    const weekFifteen = { ...withYouth, week: 15 };
    const localBrief = careerMarketScoutOptions(weekFifteen)[0];
    const started = startCareerScoutMission(
      weekFifteen,
      weekFifteen.market!,
      localBrief.region,
      localBrief.focus,
    );
    const dueWeek = started.market.activeScoutMission!.dueWeek;
    expect([17, 18]).toContain(dueWeek);

    const dueState = { ...started.state, week: dueWeek };
    const reported = resolveCareerScoutClock(dueState, started.market);
    const cash = dueState.clubs.find(club => club.id === dueState.userClubId)!.cash;
    const affordableTalks = reported.scoutReports
      .map(report => beginCareerTransferTalks(dueState, reported, report.playerId))
      .find(candidate => candidate.transferTalks!.transferQuote.fee <= cash);
    expect(affordableTalks).toBeDefined();
    let talks = affordableTalks!;
    talks = submitCareerTransferOffer(talks, {
      weeklyWage: talks.transferTalks!.negotiation.weeklyAsk,
      termSeasons: 2,
      perk: 'GUARANTEED_STARTER',
    });
    const signed = completeCareerTransfer(dueState, talks);
    const fullStory = { ...signed.state, market: signed.market };
    const market = marketViewModel(careerMarketViewModelSource(fullStory));

    expect(fullStory.players.filter(player => player.clubId === fullStory.userClubId)).toHaveLength(17);
    expect(market.sections).toEqual(['YOUTH', 'SCOUT', 'TRANSFERS', 'COACHES']);
    expect(market.transfers.some(listing => listing.direction === 'SELL')).toBe(true);
    expect(dueAssistantInboxGuideSequences(fullStory)).toContain('roster-cap');
    expect(fullStory.cashTransactions?.at(-1)).toMatchObject({ kind: 'transfer-buy' });
  });

  it('retires a queued first-scout objective as soon as the mission starts', () => {
    const weekFifteen = { ...createdStory(13579), week: 15 };
    const brief = careerMarketScoutOptions(weekFifteen)[0];
    const queued = {
      ...weekFifteen,
      eventFlags: [
        ...(weekFifteen.eventFlags ?? []),
        'guide:bert:inbox:queued:scout-mission',
        'guide:bert:inbox:delivered:s1:w15:guide:scout-mission',
      ],
    };
    const started = startCareerScoutMission(
      queued,
      queued.market!,
      brief.region,
      brief.focus,
    );
    const reconciled = reconcileSatisfiedAssistantGuideSequences({
      ...started.state,
      market: started.market,
    });

    expect(hasAssistantGuideSequenceCompleted(reconciled, 'scout-mission')).toBe(true);
    expect(dueAssistantInboxGuideSequences(reconciled)).not.toContain('scout-mission');
  });
});
