import { readFileSync } from 'fs';
import { join } from 'path';
import { SUPPORT_EMAIL, supportEmailUrl } from '../../release/support';

describe('Privacy and support release surface', () => {
  test('uses the verified prior public support contact without leaking it into URLs unescaped', () => {
    expect(SUPPORT_EMAIL).toBe('mrjoevu@hotmail.com');
    expect(supportEmailUrl()).toBe('mailto:mrjoevu@hotmail.com?subject=Hero%20Football%20Manager%20support');
  });

  test('states the verified offline privacy behavior and open-source notice in game', () => {
    const panel = readFileSync(join(process.cwd(), 'src/ui/PrivacySupportPanel.tsx'), 'utf8');

    expect(panel).toContain('does not require an account');
    expect(panel).toContain('does not use ads, analytics, or tracking');
    expect(panel).toContain('only when you deliberately choose Export Save');
    expect(panel).toContain('SIL Open Font License, Version 1.1');
    expect(panel).toContain('Email Hero Football Manager support');
    expect(panel).toContain('accessibilityRole="alert"');
  });
});
