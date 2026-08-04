import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ASSISTANT_MODE_CHOICE } from '../assistant-mode-choice';
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
