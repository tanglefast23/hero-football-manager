import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { briefingMoments } from '../bert-beat-moments';
import { isIncomeFacilityType } from '../concierge-targets';
import { AssistantGuideFocusSchema } from '../../content/schemas';
import type { BriefingBeat } from '../bert-briefing-beats';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const app = read('App.tsx');
const club = read('src/ui/screens/ClubFinancesScreen.tsx');

const beats = (count: number): BriefingBeat[] =>
  Array.from({ length: count }, (_, pageIndex) => ({
    text: `beat ${pageIndex}`,
    focus: 'assistant' as const,
    kind: 'body' as const,
    pageIndex,
  }));

/**
 * Tapping either board money row used to drop the manager on the ledger with
 * the row's own text still clipped at two lines behind him. These pin the
 * briefing that now finishes the sentence, and the board it walks him to.
 */
describe('the board money rows', () => {
  it('opens the ledger and then says the whole message', () => {
    expect(app).toMatchSource(
      /alertId === 'financial-warning' \|\| alertId === 'emergency-loan'\) \{\s*\n\s*setClubOfficeTab\('finances'\)/,
    );
    expect(app).toContainSource(
      'setOpenedBoardFinanceAlertId(careerTeaches ? alertId : null);',
    );
    expect(app).toContainSource('customMessage={boardFinanceMessage}');
  });

  it('keeps the alert and ledger but suppresses Bert for an Advisor career', () => {
    expect(app).toContainSource('const boardFinanceMessage = !careerTeaches');
    expect(app).toContainSource(
      'setOpenedBoardFinanceAlertId(careerTeaches ? alertId : null);',
    );
    expect(app).toContainSource('setOpenedBoardFinanceAlertId(null);');
  });

  it('consumes the current warning card when Bert finishes the talk', () => {
    expect(app).toContainSource(
      'const completedAlertId = openedBoardFinanceAlertId;',
    );
    expect(app).toMatchSource(
      /store\.dismissInboxProduct\(\s*completedAlertId,\s*wasLoan \? 'permanent' : 'current-week',\s*\);/,
    );
  });

  it('rebuilds the message from the live career rather than the press', () => {
    // Both rows quote numbers that move every week. A copy captured when the
    // row was tapped would reintroduce the defect this replaces.
    expect(app).toMatchSource(
      /boardFinanceMessage = !careerTeaches[\s\S]{0,220}openedBoardFinanceAlertId === null[\s\S]{0,160}boardFinanceBriefing\(store\.career, openedBoardFinanceAlertId, t\)/,
    );
  });

  it('suspends the keyboard rail while the briefing covers the screen', () => {
    expect(app).toMatchSource(
      /guideOverlayVisible = \([\s\S]{0,400}boardFinanceMessage !== undefined/,
    );
  });

  it('takes a bailed-out club to the buildings that earn', () => {
    expect(app).toMatchSource(
      /wasLoan[\s\S]{0,200}setClubOfficeTab\('facility'\);\s*\n\s*setConciergeFocus\('income-facilities'\);/,
    );
  });

  it('leaves the warning on the ledger it was read on', () => {
    // Only the loan ends with a building to point at. The warning's own last
    // line is conditional on funds the club may not have, so marching a broke
    // manager to a menu he cannot buy from would be the wrong next move.
    const onDone = /const wasLoan = [\s\S]*?\n\s{12}\}\}/.exec(app);
    expect(onDone).not.toBeNull();
    expect(onDone![0]).toContainSource('if (wasLoan) {');
  });
});

describe('the look on his face', () => {
  it('opens both messages on the money warning', () => {
    expect(briefingMoments('board-financial-warning', beats(4))[0]).toBe(
      'warning-money',
    );
    expect(briefingMoments('board-emergency-loan', beats(3))[0]).toBe(
      'warning-money',
    );
  });

  it('asks a broke manager to hold tight after pointing out the way out', () => {
    expect(briefingMoments('board-financial-warning', beats(4))).toEqual([
      'warning-money',
      'warning-hard',
      'pointing-out',
      'hold-on',
    ]);
    expect(briefingMoments('board-emergency-loan', beats(3)).at(-1)).toBe(
      'pointing-out',
    );
  });

  it('never repeats a face back to back', () => {
    for (const [sequenceId, count] of [
      ['board-financial-warning', 4],
      ['board-emergency-loan', 3],
    ] as const) {
      const moments = briefingMoments(sequenceId, beats(count));
      expect(new Set(moments).size).toBe(moments.length);
    }
  });
});

describe('the money-making buildings', () => {
  it('is the Fan Shop and the Stadium Stand, and nothing that only costs', () => {
    expect(isIncomeFacilityType('fan-shop')).toBe(true);
    expect(isIncomeFacilityType('stadium-stand')).toBe(true);
    for (const type of [
      'gym',
      'training-pitch',
      'medical-bay',
      'youth-field',
    ] as const) {
      expect(isIncomeFacilityType(type)).toBe(false);
    }
  });

  it('is a focus the guide vocabulary knows', () => {
    expect(
      AssistantGuideFocusSchema.safeParse('income-facilities').success,
    ).toBe(true);
  });

  it('lights every income card and says why', () => {
    expect(club).toContainSource(
      "const guideIncomeFacilities = guideFocus === 'income-facilities';",
    );
    expect(club).toContainSource(
      'const guidedIncome = guideIncomeFacilities && isIncomeFacilityType(entry.type);',
    );
    // Both halves of Bert's line live in the catalog now — the free-crew hint
    // and the one that names the job holding the works crew up.
    expect(club).toContainSource("t('clubFinances.incomeFacilitiesHint')");
    expect(club).toContainSource(
      "t('clubFinances.incomeFacilitiesBusyHint', {",
    );
    expect(club).toContainSource(
      'viewModel.facilities.activeProject === undefined',
    );
    // The same gold treatment the guided Coaching Office card wears, so the two
    // read as one instruction rather than two unrelated highlights.
    expect(club).toMatchSource(
      /\|\| guidedIncome\s*\n\s*\? 'min-h-36 w-full border-2 border-b-4 border-gold-dark/,
    );
    expect(club).toMatchSource(
      /\|\| guidedIncome\s*\n\s*\? styles\.guidedFacilityGlow/,
    );
  });

  it('scrolls them into view, since they are the last two of twelve', () => {
    expect(club).toContainSource(
      'const scrollToIncomeFacilities = useCallback(',
    );
    expect(club).toContainSource('ref={incomeFacilityBuildTargetRef}');
    expect(club).toContainSource('onLayout={scrollToIncomeFacilities}');
  });

  it('cancels its pending scroll when the screen goes away', () => {
    expect(club).toMatchSource(
      /incomeFacilityScrollFrameRef\.current !== null\) \{\s*\n\s*cancelAnimationFrame\(incomeFacilityScrollFrameRef\.current\)/,
    );
  });
});
