import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(
  join(process.cwd(), 'src/ui/screens/StoryEventScreen.tsx'),
  'utf8',
);

describe('story-event target picker contracts', () => {
  test('uses one mutually exclusive picker and resets it for a new event or result', () => {
    expect(source).toContain(
      "useState<'player' | 'coach' | 'facility' | null>(null)",
    );
    expect(source).toMatch(
      /useEffect\(\(\) => \{\s*setPickerOpen\(null\);\s*\}, \[resolved, viewModel\.id\]\)/,
    );
  });

  test('passes the exact selected player, coach, and facility identifiers', () => {
    expect(source).toContain('onSelectPlayer?.(candidate.id)');
    expect(source).toContain('onSelectCoach?.(candidate.role)');
    expect(source).toContain('onSelectFacility?.(candidate.buildingId)');
  });

  test('keeps carried targets read-only and disables every choice until a target is ready', () => {
    expect(source).toContain('viewModel.playerLocked !== true');
    expect(source).toContain('viewModel.coachLocked !== true');
    expect(source).toContain('viewModel.facilityLocked !== true');
    expect(source).toContain(
      'const needsTarget = needsPlayer || needsCoach || needsFacility',
    );
    expect(source).toContain('accessibilityState={{ disabled }}');
    expect(source).toContain('disabled={disabled}');
    expect(source).toContain('opacity-40');
  });

  test('keeps target rows and decision cards at static touch-safe heights', () => {
    expect(source).toContain("'min-h-12 flex-row items-center gap-3");
    expect(source).toContain("'min-h-12 border-b border-ink/15");
    expect(source).toContain('min-h-20 flex-row items-center border-2 p-3');
  });

  test('renders a guarded escape only for the no-target defensive state', () => {
    expect(source).toContain('{viewModel.targetUnavailable ? (');
    expect(source).toContain("t('storyEvent.noEligibleTarget')");
    expect(source).toContain('onPress={onSkipUnavailable}');
  });
});
