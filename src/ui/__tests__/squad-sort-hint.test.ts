import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCatalog, type Locale } from '../../i18n';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('Week 12 squad sort hint', () => {
  it('is an automatic Squad-screen cue rather than a Manager\'s Tip', () => {
    const app = read('App.tsx');
    const squad = read('src/ui/screens/SquadTrainingScreen.tsx');
    const tips = read('content/tips.json');
    const viewModels = read('src/application/view-models.ts');
    const registry = read('src/ui/dev-harness/registry.ts');

    expect(tips).not.toContain('player-columns-are-sortable');
    expect(viewModels).not.toContain('SORTABLE_COLUMNS_TIP_ID');
    expect(app).toContain('shouldShowSquadSortHint(store.career)');
    expect(app).toContain('showSortHint={squadSortHintVisible}');
    expect(squad).toContain('showSortHint?: boolean;');
    expect(squad).toContain('tutorialCue={showSortHint ? (');
    expect(squad).toContain("label={t('squadTraining.tapHere')}");
    expect(squad).toContain("detail={t('squadTraining.sortColumn')}");
    expect(registry).toContain('squadSortHintEntry');
  });

  it('dismisses after any completed Squad-screen tap and saves that dismissal', () => {
    const app = read('App.tsx');
    const shell = read('src/ui/ManagementShell.tsx');

    expect(shell).toContain('onPointerUp={dismissGuidanceAfterPress}');
    expect(shell).toContain('onTouchEnd={dismissGuidanceAfterPress}');
    expect(app).toContain("store.activeTab === 'squad' && squadSortHintVisible");
    expect(app).toContain("store.completeGuideMilestone('squad-sort-seen')");
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
    expect(loadCatalog(locale as Locale).strings['squadTraining.sortColumn']).toBe(expected);
  });
});
