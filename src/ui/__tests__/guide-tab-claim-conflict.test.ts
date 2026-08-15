import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('guide tab claim conflict', () => {
  const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

  it('lets the Cup guide defer a pending facility combo reveal', () => {
    const discovery = app.slice(
      app.indexOf('const firstCupRoundOf32GuideOwed ='),
      app.indexOf("Bert's one consolation"),
    );
    expect(discovery).toContainSource('firstCupRoundOf32GuideOwed');
    expect(discovery).toMatchSource(
      /store\.career === null \|\|\s*firstCupRoundOf32GuideOwed\s*\? undefined/,
    );
  });
});
