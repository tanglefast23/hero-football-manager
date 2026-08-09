import { readFileSync } from 'fs';
import { join } from 'path';
import { SUPPORT_EMAIL, supportEmailUrl } from '../../release/support';
import { loadCatalog } from '../../i18n';

describe('Privacy and support release surface', () => {
  test('uses the verified prior public support contact without leaking it into URLs unescaped', () => {
    expect(SUPPORT_EMAIL).toBe('mrjoevu@hotmail.com');
    expect(supportEmailUrl()).toBe(
      'mailto:mrjoevu@hotmail.com?subject=Hero%20Football%20Manager%20support',
    );
  });

  test('states the verified offline privacy behavior and open-source notice in game', () => {
    const panel = readFileSync(
      join(process.cwd(), 'src/ui/PrivacySupportPanel.tsx'),
      'utf8',
    );

    expect(
      loadCatalog('en').strings['privacySupport.heroFootballManagerDoes'],
    ).toContainSource('does not require an account');
    // These are release commitments, so what matters is that the words ship —
    // and they now ship from the catalog rather than the component.
    const copy = loadCatalog('en').strings;
    expect(copy['privacySupport.heroFootballManagerDoes']).toContainSource(
      'does not use ads, analytics, or tracking',
    );
    expect(copy['privacySupport.yourPreferencesPlayerAnd']).toContainSource(
      'career save stay on this device',
    );
    expect(copy['privacySupport.yourPreferencesPlayerAnd']).not.toMatchSource(
      /Export Save|Import Save/i,
    );
    expect(copy['privacySupport.silkscreenFontCopyrightThe']).toContainSource(
      'SIL Open Font License, Version 1.1',
    );
    // Moved into the copy catalog; assert the key AND the English so the
    // guarantee is unchanged rather than merely "a key is present".
    expect(panel).toContainSource(
      "t('privacySupport.a11y.emailHeroFootballManagerSupport')",
    );
    expect(
      loadCatalog('en').strings[
        'privacySupport.a11y.emailHeroFootballManagerSupport'
      ],
    ).toBe('Email Hero Football Manager support');
    expect(panel).toContainSource('accessibilityRole="alert"');
  });
});
