import { readFileSync } from 'fs';
import { join } from 'path';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

/**
 * An outside tap closes anything the player is only reading, and anything whose
 * outside-tap meaning is the safe half of a question. It must never answer a
 * question, confirm a cost, or skip a guided beat.
 */
describe('overlay dismissal', () => {
  const dismissable = [
    ['settings', 'src/ui/SettingsOverlay.tsx'],
    ['post-match summary', 'src/ui/PostMatchSummaryModal.tsx'],
    ['drills popup', 'src/ui/TrainingDrillModal.tsx'],
    ['facility project notice', 'src/ui/FacilityProjectNotice.tsx'],
    ['player signing receipt', 'src/ui/PlayerSigningOverlay.tsx'],
    ['coach staff overlay', 'src/ui/CoachStaffOverlay.tsx'],
    ['facility placement confirmation', 'src/ui/FacilityPlacementConfirmation.tsx'],
  ] as const;

  it.each(dismissable)('closes %s on an outside tap', (_label, path) => {
    const file = source(path);
    const hasBackdropPressable = /className="absolute inset-0"|style={StyleSheet.absoluteFill}/.test(file);

    expect(hasBackdropPressable).toBe(true);
    // The backdrop is a sibling of the panel, never its parent, so taps on the
    // panel's own controls cannot bubble into the dismiss handler.
    expect(file).toContain('accessible={false}');
  });

  it('never lets a stray tap answer the dismissal question', () => {
    const file = source('src/ui/CoachStaffOverlay.tsx');

    // The receipts close on an outside tap; "Dismiss <coach>?" does not.
    expect(file).toContain('{isDismissConfirmation ? null : (');
    expect(file).toContain('onPress={onClose}');
  });

  it('cancels rather than approves when a build confirmation is tapped away', () => {
    const file = source('src/ui/FacilityPlacementConfirmation.tsx');

    expect(file).toContain('onPress={onCancel}');
    expect(file).not.toContain('className="absolute inset-0" onPress={onConfirm}');
  });

  it('keeps forced beats and Bert briefings tap-through-proof', () => {
    // Bert's briefing advances only on its button: it is the game teaching, and
    // an outside tap would skip the instruction the next objective depends on.
    const guide = source('src/ui/AssistantGuideOverlay.tsx');
    expect(guide).not.toContain('onPress={onDismiss}');

    // The story event is a decision; there is no dismissing it.
    const event = source('src/ui/screens/StoryEventScreen.tsx');
    expect(event).not.toContain('className="absolute inset-0"');
  });
});
