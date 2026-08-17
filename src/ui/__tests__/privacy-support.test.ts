import { readFileSync } from 'fs';
import { join } from 'path';
import {
  PRIVACY_POLICY_URL,
  SUPPORT_EMAIL,
  supportEmailUrl,
} from '../../release/support';
import { LOCALES } from '../../i18n/locales';
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

  // Apple requires the policy URL in App Store Connect metadata AND an easily
  // accessible link to the same page inside the app. These assertions are the
  // guard against the two halves drifting apart between releases.
  test('opens the exact policy submitted to App Store Connect', () => {
    expect(PRIVACY_POLICY_URL).toBe(
      'https://tanglefast23.github.io/hero-football-manager-legal/privacy.html',
    );
    // Public HTTPS with no query, so it cannot become a redirect or a login.
    expect(PRIVACY_POLICY_URL.startsWith('https://')).toBe(true);
    expect(PRIVACY_POLICY_URL).not.toMatchSource(/[?#]/);

    const panel = readFileSync(
      join(process.cwd(), 'src/ui/PrivacySupportPanel.tsx'),
      'utf8',
    );
    expect(panel).toContainSource('onPress={onOpenPrivacyPolicy}');
    expect(panel).toContainSource("t('privacySupport.readPrivacyPolicy')");
    expect(panel).toContainSource(
      "accessibilityLabel={t('privacySupport.a11y.readPrivacyPolicy')}",
    );

    // The handler must open that constant, and must not fail silently — a
    // reviewer taps this offline and has to see why nothing happened.
    const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');
    expect(app).toContainSource('Linking.openURL(PRIVACY_POLICY_URL)');
    expect(app).toContainSource("copyRef.current('app.privacyPolicyCouldNotOpen')");
  });

  test('ships the privacy-link copy in every supported language', () => {
    for (const locale of LOCALES) {
      const copy = loadCatalog(locale).strings;
      for (const key of [
        'privacySupport.readPrivacyPolicy',
        'privacySupport.a11y.readPrivacyPolicy',
        'app.privacyPolicyCouldNotOpen',
      ]) {
        expect(copy[key]?.trim()).toBeTruthy();
      }
    }
  });
});
