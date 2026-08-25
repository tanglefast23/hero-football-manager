import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('native pixel portrait performance', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/ui/components/PixelPortrait.tsx'),
    'utf8',
  );

  it('memoizes stable portraits and removes iPhone blink timers', () => {
    expect(source).toContain('export const PixelPortrait = memo(');
    expect(source).toContain("if (Platform.OS === 'ios') return null;");
    expect(source).toContain("Platform.OS !== 'ios' && blinkVariant !== null");
  });
});
