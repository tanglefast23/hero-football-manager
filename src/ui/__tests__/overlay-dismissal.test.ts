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

  it('keeps forced beats undismissable', () => {
    // The story event is a decision; there is no dismissing it.
    const event = source('src/ui/screens/StoryEventScreen.tsx');
    expect(event).not.toContain('className="absolute inset-0"');
  });

  /**
   * Bert's briefing used to advance only on its own button, so that an outside
   * tap could not skip an instruction the next objective depended on. The
   * walk-on makes the whole screen the button, which reverses that deliberately
   * — nothing else about a walk-on works if part of the screen is inert.
   *
   * What survives of the old guarantee is the part that mattered: a briefing is
   * never taken off screen by anything other than the player, and one tap can
   * never cost them two lines.
   */
  it('never advances Bert past a line the player did not read', () => {
    const walkOn = source('src/ui/BertBriefingWalkOn.tsx');
    // No timer. The rookie auto-advances because he is making a remark; this is
    // the game teaching, and a timer would pull a rule off mid-sentence.
    expect(walkOn).not.toContain('autoAdvanceMs');

    const overlay = source('src/ui/CharacterSpeechOverlay.tsx');
    // Two taps in one tick both read the same stale index without this, and a
    // skipped line here is a rule the player is never told again.
    expect(overlay).toContain('lineIndexRef');
    expect(overlay).toContain('const next = lineIndexRef.current + 1');
  });

  it('holds the screen while Bert is on it', () => {
    const walkOn = source('src/ui/BertBriefingWalkOn.tsx');
    // The shared overlay is a plain Pressable, so the modal semantics the old
    // framed window had are the wrapper's job now.
    expect(walkOn).toContain('accessibilityViewIsModal');
  });

  it('shows and dismisses Bert instantly without changing the rookie walk-on', () => {
    const bert = source('src/ui/BertBriefingWalkOn.tsx');
    const rookie = source('src/ui/PlayerWalkOnWelcome.tsx');
    const overlay = source('src/ui/CharacterSpeechOverlay.tsx');

    expect(bert).toMatch(/<CharacterSpeechOverlay[\s\S]*?\n\s+instant\n/);
    expect(bert).toContain('walking={false}');
    expect(rookie).not.toMatch(/<CharacterSpeechOverlay[\s\S]*?\n\s+instant\n/);
    expect(overlay).toContain("reduce || instant ? 'speaking' : 'arriving'");
    expect(overlay).toContain('if (instant) {');
    expect(overlay).toContain('onDone();');
  });
});
