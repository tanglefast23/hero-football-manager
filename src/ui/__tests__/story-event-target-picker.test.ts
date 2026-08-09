import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(
  join(process.cwd(), 'src/ui/screens/StoryEventScreen.tsx'),
  'utf8',
);

describe('story-event target picker contracts', () => {
  test('uses one mutually exclusive picker and resets it for a new event or result', () => {
    expect(source).toContainSource(
      "useState<'player' | 'coach' | 'facility' | null>(null)",
    );
    expect(source).toMatchSource(
      /useEffect\(\(\) => \{\s*setPickerOpen\(null\);\s*\}, \[resolved, viewModel\.id\]\)/,
    );
  });

  test('passes the exact selected player, coach, and facility identifiers', () => {
    expect(source).toContainSource('onSelectPlayer?.(candidate.id)');
    expect(source).toContainSource('onSelectCoach?.(candidate.role)');
    expect(source).toContainSource('onSelectFacility?.(candidate.buildingId)');
  });

  test('keeps carried targets read-only and disables every choice until a target is ready', () => {
    expect(source).toContainSource('viewModel.playerLocked !== true');
    expect(source).toContainSource('viewModel.coachLocked !== true');
    expect(source).toContainSource('viewModel.facilityLocked !== true');
    expect(source).toContainSource(
      'const needsTarget = needsPlayer || needsCoach || needsFacility',
    );
    expect(source).toContainSource('accessibilityState={{ disabled }}');
    expect(source).toContainSource('disabled={disabled}');
    expect(source).toContainSource('opacity-40');
  });

  test('keeps target rows and decision cards at static touch-safe heights', () => {
    expect(source).toContainSource("'min-h-12 flex-row items-center gap-3");
    expect(source).toContainSource("'min-h-12 border-b border-ink/15");
    expect(source).toContainSource(
      'min-h-20 flex-row items-center border-2 p-3',
    );
  });

  test('renders a guarded escape only for the no-target defensive state', () => {
    expect(source).toContainSource('{viewModel.targetUnavailable ? (');
    expect(source).toContainSource("t('storyEvent.noEligibleTarget')");
    expect(source).toContainSource('onPress={onSkipUnavailable}');
  });
});
