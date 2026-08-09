import { readFileSync } from 'fs';
import { join } from 'path';
import { TYPE_ART_EXCEPTION, TYPE_SIZE } from '../ui-tokens';

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), 'utf8');
const RAW_TYPE_CLASS = /\btext-(?:xs|sm|base|lg|xl|[2-9]xl|\[[0-9]+px\])/g;

describe('semantic title type and controls', () => {
  test('keeps four content sizes and names every title-art exception', () => {
    expect(TYPE_SIZE).toEqual({
      caption: 'text-[13px]',
      body: 'text-[15px]',
      heading: 'text-[18px]',
      display: 'text-[24px]',
    });
    expect(Object.keys(TYPE_ART_EXCEPTION).sort()).toEqual([
      'titleActionArrow',
      'titleStarWide',
      'titleWordmarkCompact',
      'titleWordmarkWide',
    ]);
  });

  test('uses only semantic sizes on the title landing and language surfaces', () => {
    const title = source('src/ui/screens/TitleLandingScreen.tsx').split(
      'export interface TitleSettingsScreenProps',
    )[0];
    const language = source('src/ui/components/LanguageButton.tsx');

    expect(title.match(RAW_TYPE_CLASS) ?? []).toEqual([]);
    expect(language.match(RAW_TYPE_CLASS) ?? []).toEqual([]);
    expect(title).toContain('TYPE_ART_EXCEPTION.titleWordmarkCompact');
    expect(title).toContain('TYPE_SIZE.caption');
    expect(language).toContain('TYPE_SIZE.body');
  });

  test('routes title, language, and standard actions through one chunky recipe', () => {
    expect(source('src/ui/screens/TitleLandingScreen.tsx')).toContain(
      '<ChunkyControl',
    );
    expect(source('src/ui/components/LanguageButton.tsx')).toContain(
      '<ChunkyControl',
    );
    expect(source('src/ui/components/Scorecard.tsx')).toContain(
      '<ChunkyControl',
    );
    const control = source('src/ui/components/ChunkyControl.tsx');
    expect(control).toContain('CHUNKY_CONTROL_RAMP');
    expect(control).toContain(
      "className={cx('absolute inset-x-0 bottom-0 h-2', ramp.lip)}",
    );
  });

  test('uses an authored language icon instead of a keyboard command glyph', () => {
    const language = source('src/ui/components/LanguageButton.tsx');
    expect(language).toContain('<PixelLanguageIcon');
    expect(language).not.toContain('⌘');
    expect(source('src/ui/components/PixelLanguageIcon.tsx')).toContain(
      'LANGUAGE_ICON',
    );
  });
});
