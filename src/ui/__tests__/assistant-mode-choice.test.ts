import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ASSISTANT_MODE_CHOICE, shouldAskAssistantMode } from '../assistant-mode-choice';
import { BERT_MOMENTS } from '../bert-poses';

describe("the question Bert asks a manager who has won everything", () => {
  it('offers exactly the two jobs, Teacher first', () => {
    expect(ASSISTANT_MODE_CHOICE.options.map(option => option.mode))
      .toEqual(['teacher', 'advisor']);
  });

  it('names what each choice changes', () => {
    for (const option of ASSISTANT_MODE_CHOICE.options) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.detail.length).toBeGreaterThan(0);
      expect(option.accessibilityLabel).toContain(option.label);
      expect(option.accessibilityLabel).toContain(option.detail);
    }
  });

  it('uses a pose from the approved set', () => {
    expect(Object.keys(BERT_MOMENTS)).toContain(ASSISTANT_MODE_CHOICE.moment);
  });

  it('asks only after the device has completed the climb', () => {
    expect(shouldAskAssistantMode(false)).toBe(false);
    expect(shouldAskAssistantMode(true)).toBe(true);
  });

  it('keeps the question separate from its VoiceOver actions', () => {
    const source = readFileSync(
      join(__dirname, '../screens/AssistantModeChoiceScreen.tsx'),
      'utf8',
    );
    const pageWrapper = source.slice(source.indexOf('<ScrollView'), source.indexOf('ASSISTANT_MODE_CHOICE.kicker'));
    expect(pageWrapper).not.toContain('accessible');
    expect(source).toContain('accessibilityRole="text"');
    expect(source).toContain('accessibilityLabel={ASSISTANT_MODE_CHOICE.line}');
    expect(source).toContain('accessibilityLabel={option.accessibilityLabel}');
  });
});

describe('the app wires the choice to every teaching surface', () => {
  const app = readFileSync(join(__dirname, '../../../App.tsx'), 'utf8');
  const settings = readFileSync(join(__dirname, '../SettingsOverlay.tsx'), 'utf8');

  it('routes veterans through the choice and first-timers directly into a career', () => {
    expect(app).toContain("landingView === 'assistant-mode'");
    expect(app).toContain('shouldAskAssistantMode(preferencesRef.current.climbCompleted)');
    expect(app).toContain('store.startNewCareer(undefined, assistantMode)');
  });

  it('gates raw story copy and every named lesson on the one derived predicate', () => {
    for (const fragment of [
      'const careerTeaches =',
      'assistantSequenceId = !careerTeaches',
      'facilityComboReveal = !careerTeaches',
      'cupExitConsolationVisible = careerTeaches',
      'tripleSpeedIntroVisible = careerTeaches',
      'fansLessonVisible = careerTeaches',
      'fansLedgerTourVisible = careerTeaches',
      'guideCopy={!careerTeaches',
      'conditionWarningSeen={!careerTeaches',
      'guideQuickTrain={careerTeaches',
      'showManagerTips={careerTeaches}',
    ]) {
      expect(app).toContain(fragment);
    }
  });

  it('clears active teaching state before changing Bert to Advisor', () => {
    const handler = app.slice(app.indexOf('const handleSetAssistantMode'), app.indexOf('const startNewCareer'));
    for (const setter of [
      'setRequestedAssistantSequenceId(null)',
      'setConciergeFocus(null)',
      'setManagerTipGuideRequest(null)',
      'setActiveGuideFocus(undefined)',
    ]) {
      expect(handler).toContain(setter);
    }
    expect(handler).toContain('store.setAssistantMode(assistantMode)');
  });

  it('replaces the narrow tips toggle with a career-only Bert row', () => {
    expect(app).not.toContain('managerTipsEnabled');
    expect(settings).not.toContain('managerTipsEnabled');
    expect(settings).toContain('assistantMode?: AssistantMode');
    expect(settings).toContain('onSetAssistantMode?:');
    expect(settings).toContain('assistantMode !== undefined && onSetAssistantMode !== undefined');
  });
});
