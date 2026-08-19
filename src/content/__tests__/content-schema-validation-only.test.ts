import * as fs from 'node:fs';

// load.ts skips the zod parse in production builds on the promise that the
// schema is validation-only: the raw JSON and the parsed result are the same
// shape. A default, transform, coercion or catch would break that promise
// silently — production would ship the raw shape while dev and CI see the
// transformed one. If you need one, remove the production skip in load.ts in
// the same commit.
test('the launch content schema validates and never transforms', () => {
  const schema = fs.readFileSync('src/content/schemas.ts', 'utf8');
  for (const marker of [
    '.default(',
    '.transform(',
    '.preprocess',
    '.coerce',
    '.catch(',
  ]) {
    expect(schema).not.toContain(marker);
  }
});
