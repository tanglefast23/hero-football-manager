import { loadLaunchContent } from '../../content/load';
import { createCareer } from '../../game';
import {
  completeAssistantGuideMilestone,
  hasAssistantGuideMilestone,
} from '../../game/assistant-guide';
import { createLaunchCareerSetup } from '../../application/launch';
import { briefingBeats } from '../bert-briefing-beats';
import { briefingMoments } from '../bert-beat-moments';
import {
  EXPIRED_CONTRACT_REVEAL_MARGIN,
  isExpiredContractRevealed,
} from '../expired-contract-reveal';
import { advisorMilestonesToBank, type AdvisorMilestoneContext } from '../advisor-milestones';

const NO_CONTEXT: AdvisorMilestoneContext = {
  enteredManagement: false,
  viewingSquad: false,
  viewingHome: false,
  viewingFinances: false,
  viewingShutMarket: false,
  lowConditionMatchday: false,
  viewingExpiredContract: false,
};

/**
 * A page 900 tall showing a section that starts 2000 down: the review's real
 * shape, where the renewal queue sits under the settlement, the recap, the
 * promotion rewards and a ten-row league table.
 */
const SECTION_TOP = 2000;
const VIEWPORT = 900;

describe('the renewal queue has to be on screen before Bert talks about it', () => {
  it('stays silent while the section is still below the fold', () => {
    expect(isExpiredContractRevealed({
      sectionTop: SECTION_TOP,
      viewportHeight: VIEWPORT,
      scrollOffset: 0,
    })).toBe(false);
    // One pixel short of the margin. This is the case an inlined `>=` gets
    // wrong, and the case nothing would report.
    expect(isExpiredContractRevealed({
      sectionTop: SECTION_TOP,
      viewportHeight: VIEWPORT,
      scrollOffset: SECTION_TOP - VIEWPORT + EXPIRED_CONTRACT_REVEAL_MARGIN - 1,
    })).toBe(false);
  });

  it('fires once the heading has cleared the fold', () => {
    expect(isExpiredContractRevealed({
      sectionTop: SECTION_TOP,
      viewportHeight: VIEWPORT,
      scrollOffset: SECTION_TOP - VIEWPORT + EXPIRED_CONTRACT_REVEAL_MARGIN,
    })).toBe(true);
  });

  it('fires without a scroll when the window is tall enough to show it', () => {
    // A desktop window deep enough that the queue is visible at rest. No scroll
    // event ever arrives here, so the layout callbacks are the only report.
    expect(isExpiredContractRevealed({
      sectionTop: SECTION_TOP,
      viewportHeight: SECTION_TOP + EXPIRED_CONTRACT_REVEAL_MARGIN,
      scrollOffset: 0,
    })).toBe(true);
  });

  it('answers false while either measurement is still missing', () => {
    // Both are the mount-time state. Read as "visible", each would deliver the
    // lesson over the league table — the exact failure the gate prevents.
    expect(isExpiredContractRevealed({
      sectionTop: undefined,
      viewportHeight: VIEWPORT,
      scrollOffset: 0,
    })).toBe(false);
    expect(isExpiredContractRevealed({
      sectionTop: 0,
      viewportHeight: 0,
      scrollOffset: 0,
    })).toBe(false);
  });
});

describe('what Bert actually says about an expired contract', () => {
  const content = loadLaunchContent();

  it('reads three beats out of the catalog, one per page', () => {
    const beats = briefingBeats(content.assistantGuide, 'expired-contract');
    expect(beats).toHaveLength(3);
    // The three doors, named. A lesson that describes the screen without
    // listing the ways off it is the one the manager needed and did not get.
    const spoken = beats.map(beat => beat.text.toLowerCase()).join(' ');
    expect(spoken).toContain('leave');
    expect(spoken).toContain('sign');
    expect(spoken).toContain('agent');
    // The advice the owner asked for, and the reason behind it.
    expect(beats[2]!.text.toLowerCase()).toContain('always meet the agent');
  });

  it('changes face between the rules and the advice', () => {
    const beats = briefingBeats(content.assistantGuide, 'expired-contract');
    const moments = briefingMoments('expired-contract', beats);
    expect(moments).toEqual(['explaining', 'listing', 'confiding']);
  });
});

describe('the lesson is said once per career', () => {
  const career = createCareer(createLaunchCareerSetup(20260807));

  it('starts unsaid and stays said', () => {
    expect(hasAssistantGuideMilestone(career, 'expired-contract-seen')).toBe(false);
    const after = completeAssistantGuideMilestone(career, 'expired-contract-seen');
    expect(hasAssistantGuideMilestone(after, 'expired-contract-seen')).toBe(true);
    // Idempotent: reaching the section again in the same career must not append
    // a second flag to the save.
    expect(completeAssistantGuideMilestone(after, 'expired-contract-seen'))
      .toBe(after);
  });

  it('banks silently for an Advisor who reaches the section', () => {
    const advisor = { ...career, assistantMode: 'advisor' as const };
    expect(advisorMilestonesToBank(advisor, NO_CONTEXT))
      .not.toContain('expired-contract-seen');
    expect(advisorMilestonesToBank(advisor, {
      ...NO_CONTEXT,
      viewingExpiredContract: true,
    })).toContain('expired-contract-seen');
  });

  it('banks nothing for a Teacher, who is shown it instead', () => {
    expect(advisorMilestonesToBank(career, {
      ...NO_CONTEXT,
      viewingExpiredContract: true,
    })).toEqual([]);
  });
});
