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
    expect(app).toContain('const transferWindowLessonVisible = careerTeaches');
    expect(app).toContain("store.activeTab === 'market'");
    expect(app).toContain('(store.career.market?.scoutReports.length ?? 0) > 0');
    expect(app).toContain('!isTransferWindowOpen(store.career.week)');
    expect(app).toContain("!hasAssistantGuideMilestone(store.career, 'transfer-window-seen')");
    expect(app).toContain("store.completeGuideMilestone('transfer-window-seen')");
  });

  it('names both windows so the manager can plan around them', () => {
    expect(app).toContain('Weeks 1 to 4, then Weeks 17 and 18');
  });

  it('banks itself silently in Advisor mode', () => {
    const advisor = source('src/ui/advisor-milestones.ts');
    expect(advisor).toContain("if (context.viewingShutMarket) add('transfer-window-seen');");
  });
});

describe('the emergency-loan briefing', () => {
  it('no longer stops for a tap on the cash panel', () => {
    const club = source('src/ui/screens/ClubFinancesScreen.tsx');
    // He explained the bailout, the tutorial waited for a tap, and only then
    // reached the part about building something that earns. One run now.
    expect(club).not.toContain('Review the loan and recurring costs');
    // The clearance that only existed to make room for that cue goes with it.
    // (The grounds section keeps its own mt-20 for a cue it still shows.)
    expect(club).not.toContain("guideFocus === 'emergency-loan' ? 'relative mt-20");
    // The panel stays lit, so his words still have something to point at.
    expect(club).toContain("guideFocus === 'emergency-loan' ? 'relative border-2 border-blue-dark bg-blue-light p-1'");
  });

  it('keeps a focus value for the panel it lights', () => {
    expect(AssistantGuideFocusSchema.safeParse('emergency-loan').success).toBe(true);
  });
});

describe('the insulting-offer warning', () => {
  it('names the walk-out wage on the button, not in small print', () => {
    const market = source('src/ui/screens/MarketScreen.tsx');
    // The rule used to read "an offer below half their ask ends talks
    // immediately" — the half was never worked out, so the first a manager
    // knew of it was the talks being over and the player sulking.
    expect(market).not.toContain('An offer below half their ask ends talks immediately.');
    expect(market).toContain('const walksOut = weeklyWage < viewModel.walkOutWeeklyWage;');
    expect(market).toContain(
      "label={walksOut ? t('market.theyWillWalkOut') : t('market.makeTheOfferArrow')}",
    );
    // The warning moved into the copy catalog with the wage and the floor as
    // placeholders. Asserting the key and the English keeps the guarantee —
    // that the manager is told the number before the talks end, not after.
    expect(market).toContain("t('market.walkOutInsult'");
    expect(loadCatalog('en').strings['market.walkOutInsult'])
      .toContain('is an insult. They walk out below');
  });

  it('derives the floor from the rule the engine enforces', () => {
    const engine = source('src/game/market.ts');
    const viewModel = source('src/application/market-view-model.ts');

    expect(engine).toContain('const insulting = offer.weeklyWage < insultingOfferFloor(negotiation.weeklyAsk);');
    expect(engine).toContain('export function insultingOfferFloor(weeklyAsk: number): number {');
    expect(viewModel).toContain('walkOutWeeklyWage: insultingOfferFloor(negotiation.weeklyAsk),');
  });

  it('renews with the club’s own squad rather than the transfer list', () => {
    const career = source('src/game/market-career.ts');
    // The transfer lookup skips the user's club by design, so using it for a
    // renewal threw `unknown negotiation player <yourPlayer>`.
    expect(career).toContain('? careerSquadNegotiationTarget(state, talks.playerId)');
    expect(career).toContain('function careerSquadNegotiationTarget(');
  });
});
