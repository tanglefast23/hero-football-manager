import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCatalog, type Locale } from '../../i18n';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('Week 12 squad sort hint', () => {
  it("is an automatic Squad-screen cue rather than a Manager's Tip", () => {
    const app = read('App.tsx');
    const squad = read('src/ui/screens/SquadTrainingScreen.tsx');
    const tips = read('content/tips.json');
    const viewModels = read('src/application/view-models.ts');
    const registry = read('src/ui/dev-harness/registry.ts');

    expect(tips).not.toContainSource('player-columns-are-sortable');
    expect(viewModels).not.toContainSource('SORTABLE_COLUMNS_TIP_ID');
    expect(app).toContainSource('shouldShowSquadSortHint(store.career)');
    expect(app).toContainSource('showSortHint={squadSortHintVisible}');
    expect(squad).toContainSource('showSortHint?: boolean;');
    expect(squad).toContainSource('tutorialCue={showSortHint ? (');
    expect(squad).toContainSource("label={t('squadTraining.tapHere')}");
    expect(squad).toContainSource("detail={t('squadTraining.sortColumn')}");
    expect(registry).toContainSource('squadSortHintEntry');
  });

  it('dismisses after any completed Squad-screen tap and saves that dismissal', () => {
    const app = read('App.tsx');
    const shell = read('src/ui/ManagementShell.tsx');

    expect(shell).toContainSource('onPointerUp={dismissGuidanceAfterPress}');
    expect(shell).toContainSource('onTouchEnd={dismissGuidanceAfterPress}');
    expect(app).toContainSource(
      "store.activeTab === 'squad' && squadSortHintVisible",
    );
    expect(app).toContainSource(
      "store.completeGuideMilestone('squad-sort-seen')",
    );
  });

  it.each([
    ['en', 'To sort column'],
    ['es', 'Ordena la columna'],
    ['pt-BR', 'Para ordenar a coluna'],
    ['fr', 'Pour trier la colonne'],
    ['id', 'Urutkan kolom'],
    ['de', 'Spalte sortieren'],
    ['vi', 'Để sắp xếp cột'],
  ] as const)('ships the instruction in %s', (locale, expected) => {
    expect(
      loadCatalog(locale as Locale).strings['squadTraining.sortColumn'],
    ).toBe(expected);
  });
});
