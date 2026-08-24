import { copyFor, facesFor } from '../use-copy';
import { LOCALES } from '../locales';

describe('copyFor', () => {
  test('returns a bound t() for the active locale', () => {
    const t = copyFor('en');
    expect(t('settings.language.title')).toBe('Language');
    expect(t.locale).toBe('en');
  });

  test('reuses one pure copy function per locale', () => {
    expect(copyFor('en')).toBe(copyFor('en'));
    expect(copyFor('vi')).toBe(copyFor('vi'));
    expect(copyFor('en')).not.toBe(copyFor('vi'));
  });

  test('every shipped locale returns its own copy, not the English fallback', () => {
    // There is no untranslated locale left to demonstrate fallback with, which
    // is what finishing the translation phases looks like. Fallback itself is
    // still covered by the resolver's own tests.
    expect(copyFor('es')('settings.language.title')).toBe('Idioma');
    expect(copyFor('pt-BR')('settings.language.title')).toBe('Idioma');
    expect(copyFor('fr')('settings.language.title')).toBe('Langue');
    expect(copyFor('de')('settings.language.title')).toBe('Sprache');
    expect(copyFor('id')('settings.language.title')).toBe('Bahasa');
    expect(copyFor('vi')('settings.language.title')).toBe('Ngôn ngữ');
  });

  test('a key nobody has authored returns the key', () => {
    expect(copyFor('en')('does.not.exist')).toBe('does.not.exist');
  });

  test('continuity sponsors stay translated in every shipped locale', () => {
    const expected = {
      en: 'Current sponsor 1 · Monthly sponsor',
      es: 'Patrocinador actual 1 · Pago mensual',
      'pt-BR': 'Patrocinador atual 1 · Pagamento mensal',
      fr: 'Sponsor actuel 1 · Paiement mensuel',
      de: 'Aktueller Sponsor 1 · Monatliche Zahlung',
      id: 'Sponsor saat ini 1 · Pembayaran bulanan',
      vi: 'Nhà tài trợ hiện tại 1 · Trả hằng tháng',
    } as const;

    for (const locale of LOCALES) {
      expect(
        copyFor(locale)('ledger.monthlyContinuitySponsorNumbered', {
          number: 1,
        }),
      ).toBe(expected[locale]);
    }
  });

  test('promotion and empty-inbox copy stay clear in every shipped locale', () => {
    const noMessages = {
      en: 'No messages.',
      es: 'No hay mensajes.',
      'pt-BR': 'Sem mensagens.',
      fr: 'Aucun message.',
      de: 'Keine Nachrichten.',
      id: 'Tidak ada pesan.',
      vi: 'Không có tin nhắn.',
    } as const;

    for (const locale of LOCALES) {
      const t = copyFor(locale);
      expect(
        t('assistantObjective.inboxClear').startsWith(noMessages[locale]),
      ).toBe(true);
      expect(
        t('clubHome.deskClearTheBoard').startsWith(noMessages[locale]),
      ).toBe(true);
      expect(
        t('promotion.recruitmentFund.detail', { amount: '$15,000' }),
      ).toContain('D4');
    }
  });

  test('Hero License purchase copy says the permit works now', () => {
    const expected = {
      en: 'The league registers one more permit for $50,000. Your club can now field 6 heroes at once.',
      es: 'La liga registra un permiso más por $50,000. Tu club ya puede alinear 6 héroes a la vez.',
      'pt-BR':
        'A liga registra mais uma licença por $50,000. Seu clube agora pode escalar 6 heróis de uma vez.',
      fr: 'La ligue enregistre un permis de plus pour $50,000. Ton club peut maintenant aligner 6 héros à la fois.',
      de: 'Die Liga meldet eine weitere Lizenz für $50,000 an. Dein Verein kann jetzt 6 Helden gleichzeitig aufstellen.',
      id: 'Liga mendaftarkan satu izin lagi seharga $50,000. Klubmu sekarang bisa menurunkan 6 pahlawan sekaligus.',
      vi: 'Giải đấu cấp thêm một giấy phép với giá $50,000. CLB của bạn giờ có thể ra sân 6 anh hùng cùng lúc.',
    } as const;

    for (const locale of LOCALES) {
      expect(
        copyFor(locale)('confirm.buyHeroLicense.detail', {
          cost: '$50,000',
          license: 6,
        }),
      ).toBe(expected[locale]);
    }
  });

  test('spoken fan labels keep their Spanish and French accents', () => {
    expect(copyFor('es')('managementShell.fans')).toBe('Afición');
    expect(copyFor('es')('managementShell.fansExplainer')).toBe(
      'Afición. Llenan el campo en casa y compran la tienda, así que cada aficionado es dinero que el club aún no ha ingresado.',
    );
    expect(copyFor('fr')('managementShell.fansExplainer')).toBe(
      "Supporters. Ils remplissent le stade à domicile et achètent à la boutique, donc chaque supporter est de l'argent que le club n'a pas encore encaissé.",
    );
  });

  test('request downsides are named in every shipped locale', () => {
    const expected = {
      en: 'Downside: Squad loses 6 condition',
      es: 'Desventaja: La plantilla pierde 6 de estado',
      'pt-BR': 'Desvantagem: Elenco perde 6 de condição',
      fr: "Inconvénient : L'effectif perd 6 de forme",
      de: 'Nachteil: Kader verliert 6 Kondition',
      id: 'Kerugian: Skuad kehilangan 6 kondisi',
      vi: 'Bất lợi: Cả đội mất 6 thể lực',
    } as const;

    for (const locale of LOCALES) {
      const t = copyFor(locale);
      expect(
        t('playerRequestCard.downside', {
          detail: t('playerRequests.costSquadCondition', { amount: 6 }),
        }),
      ).toBe(expected[locale]);
    }
  });
});

describe('facesFor', () => {
  test('every locale draws from the one pixel family', () => {
    // There is no per-language face swap any more: the Silkscreen derivative
    // covers Vietnamese too, so choosing `vi` no longer redraws the whole UI —
    // including the English still awaiting translation — in a different font.
    for (const locale of LOCALES) {
      expect({ locale, faces: facesFor(locale) }).toEqual({
        locale,
        faces: {
          display: 'HFMSilkscreen_700Bold',
          data: 'HFMSilkscreen_400Regular',
        },
      });
    }
  });

  test('every locale names two distinct faces, so the voice split survives', () => {
    for (const locale of LOCALES) {
      const faces = facesFor(locale);
      expect({ locale, faces }).toMatchObject({ locale });
      expect(faces.display).not.toBe(faces.data);
    }
  });
});
