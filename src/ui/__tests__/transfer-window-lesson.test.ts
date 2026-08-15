import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AssistantGuideFocusSchema } from '../../content/schemas';
import { loadCatalog } from '../../i18n';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('the shut-window lesson', () => {
  const app = source('App.tsx');

  it('fires once, on the screen that is refusing', () => {
    // A scouting report is the permission to negotiate, so holding one while
    // the desk says SHUT reads as a broken report rather than the calendar.
    expect(app).toContainSource(
      'const transferWindowLessonVisible = careerTeaches',
    );
    expect(app).toContainSource("store.activeTab === 'market'");
    expect(app).toContainSource(
      '(store.career.market?.scoutReports.length ?? 0) > 0',
    );
    expect(app).toContainSource('!isTransferWindowOpen(store.career.week)');
    expect(app).toContainSource(
      "!hasAssistantGuideMilestone(store.career, 'transfer-window-seen')",
    );
    expect(app).toContainSource("visibleConciergeFocus !== 'scout-report'");
    expect(app).toContainSource(
      "store.completeGuideMilestone('transfer-window-seen')",
    );
  });

  it('names both windows so the manager can plan around them', () => {
    expect(app).toContainSource("t('bert.custom.transferWindow.body1')");
    expect(
      loadCatalog('en').strings['bert.custom.transferWindow.body1'],
    ).toContain('Weeks 1 to 4, then Weeks 17 and 18');
    expect(app).not.toContainSource('That report is yours to keep');
  });

  it('banks itself silently in Advisor mode', () => {
    const advisor = source('src/ui/advisor-milestones.ts');
    expect(advisor).toContainSource(
      "if (context.viewingShutMarket) add('transfer-window-seen');",
    );
  });
});

describe('the first transfer negotiation lesson', () => {
  it('opens immediately after the first successful transfer approach', () => {
    const app = source('App.tsx');

    expect(app).toMatchSource(
      /!hasAssistantGuideSequenceCompleted\(\s*store\.career,\s*'transfer-negotiation'/,
    );
    expect(app).toMatchSource(
      /openAssistantGuide\(\s*'transfer-negotiation',\s*'market-transfers'/,
    );
  });

  it('only calls the completed transfer squad full when the squad is full', () => {
    const store = source('src/application/store.ts');

    expect(store).toContainSource(
      'userCareerRosterCount(next) >= careerRosterCapacity(next)',
    );
    expect(store).toContainSource("? t('store.transferCompleteSquadFull')");
    expect(store).toContainSource(": t('playerSigning.transferComplete')");
  });
});

describe('the emergency-loan briefing', () => {
  it('no longer stops for a tap on the cash panel', () => {
    const club = source('src/ui/screens/ClubFinancesScreen.tsx');
    // He explained the bailout, the tutorial waited for a tap, and only then
    // reached the part about building something that earns. One run now.
    expect(club).not.toContainSource('Review the loan and recurring costs');
    // The clearance that only existed to make room for that cue goes with it.
    // (The grounds section keeps its own mt-20 for a cue it still shows.)
    expect(club).not.toContainSource(
      "guideFocus === 'emergency-loan' ? 'relative mt-20",
    );
    // The panel stays lit, so his words still have something to point at.
    expect(club).toContainSource(
      "? 'relative border-2 border-blue-dark bg-blue-light p-1'",
    );
  });

  it('keeps a focus value for the panel it lights', () => {
    expect(AssistantGuideFocusSchema.safeParse('emergency-loan').success).toBe(
      true,
    );
  });
});

describe('the insulting-offer warning', () => {
  it('names the walk-out wage on the button, not in small print', () => {
    const market = source('src/ui/screens/MarketScreen.tsx');
    // The rule used to read "an offer below half their ask ends talks
    // immediately" — the half was never worked out, so the first a manager
    // knew of it was the talks being over and the player sulking.
    expect(market).not.toContainSource(
      'An offer below half their ask ends talks immediately.',
    );
    expect(market).toContainSource(
      'const walksOut = weeklyWage < viewModel.walkOutWeeklyWage;',
    );
    expect(market).toContainSource(
      "label={walksOut ? t('market.theyWillWalkOut') : t('market.makeTheOfferArrow')}",
    );
    expect(market).toContainSource(
      'disabled={walksOut || selectedPerkBlocked}',
    );
    // The warning moved into the copy catalog with the wage and the floor as
    // placeholders. Asserting the key and the English keeps the guarantee —
    // that the manager is told the number before the talks end, not after.
    expect(market).toContainSource("t('market.walkOutInsult'");
    expect(loadCatalog('en').strings['market.walkOutInsult']).toContainSource(
      'is an insult. They walk out below',
    );
  });

  it('derives the floor from the rule the engine enforces', () => {
    const engine = source('src/game/market.ts');
    const viewModel = source('src/application/market-view-model.ts');

    expect(engine).toContainSource(
      'const insulting = offer.weeklyWage < insultingOfferFloor(negotiation.weeklyAsk);',
    );
    expect(engine).toContainSource(
      'export function insultingOfferFloor(weeklyAsk: number): number {',
    );
    expect(viewModel).toContainSource(
      'walkOutWeeklyWage: insultingOfferFloor(negotiation.weeklyAsk),',
    );
  });

  it('renews with the club’s own squad rather than the transfer list', () => {
    const career = source('src/game/market-career.ts');
    // The transfer lookup skips the user's club by design, so using it for a
    // renewal threw `unknown negotiation player <yourPlayer>`.
    expect(career).toContainSource(
      '? careerSquadNegotiationTarget(state, talks.playerId)',
    );
    expect(career).toContainSource('function careerSquadNegotiationTarget(');
  });
});
