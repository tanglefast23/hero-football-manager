import { faceForKey, voiceOf } from '../voice';
import { localeMeta } from '../locales';

describe('voiceOf', () => {
  test('chrome is display type', () => {
    expect(voiceOf('settings.language.title')).toBe('display');
    expect(voiceOf('creation.stat.pac.label')).toBe('display');
  });

  test('columns and money are the data voice', () => {
    expect(voiceOf('col.league.points')).toBe('data');
  });

  test('long prose is body, which is not a pixel face at all', () => {
    expect(voiceOf('event.derby-night.body')).toBe('body');
    expect(voiceOf('bert.first-match.line')).toBe('body');
    expect(faceForKey('event.derby-night.body', localeMeta('en').faces)).toBeNull();
  });

  test('a display key resolves to the locale s display face', () => {
    expect(faceForKey('settings.language.title', localeMeta('vi').faces))
      .toBe('Handjet_700Bold');
    expect(faceForKey('col.league.points', localeMeta('vi').faces))
      .toBe('Handjet_400Regular');
  });
});
