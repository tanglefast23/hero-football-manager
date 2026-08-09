import coachIdentities from '../../../game/coach-identities.json';
import data from '../management-sprites.json';
import playerPortraits from '../portraits.json';

const COACH_IDS = coachIdentities.map((coach) => coach.id);
const COACH_WARDROBES = [
  'suit-tie',
  'suit-open-collar',
  'blazer-turtleneck',
  'cardigan-shirt',
  'sweater-shirt',
  'quarter-zip',
  'training-polo',
  'club-tracksuit',
  'training-shell',
  'padded-gilet',
  'padded-coat',
  'rain-jacket',
  'overcoat-scarf',
];
const FACILITIES = [
  'training-pitch',
  'gym',
  'tech-center',
  'shooting-range',
  'keeper-court',
  'medical-bay',
  'dorm',
  'scout-office',
  'coaching-office',
  'youth-field',
  'fan-shop',
  'stadium-stand',
];

describe('management pixel sprites', () => {
  test('ships unique resting and joyful portraits for all 32 curated coaches', () => {
    expect(COACH_IDS).toHaveLength(32);
    const resting = COACH_IDS.map(
      (id) => data.sprites[`coach:${id}:rest` as keyof typeof data.sprites],
    );
    const playerArt = new Set(
      Object.values(playerPortraits.sprites).map((rows) =>
        JSON.stringify(rows),
      ),
    );
    for (const id of COACH_IDS) {
      expect(data.sprites).toHaveProperty(`coach:${id}:rest`);
      expect(data.sprites).toHaveProperty(`coach:${id}:joy`);
      expect(
        data.sprites[`coach:${id}:joy` as keyof typeof data.sprites],
      ).not.toEqual(
        data.sprites[`coach:${id}:rest` as keyof typeof data.sprites],
      );
      expect(
        playerArt.has(
          JSON.stringify(
            data.sprites[`coach:${id}:rest` as keyof typeof data.sprites],
          ),
        ),
      ).toBe(false);
    }
    expect(new Set(resting.map((rows) => JSON.stringify(rows))).size).toBe(
      COACH_IDS.length,
    );
  });

  test('keeps every curated coach age within the 30-60 hiring band', () => {
    expect(
      coachIdentities.every(
        (coach) =>
          Number.isInteger(coach.age) && coach.age >= 30 && coach.age <= 60,
      ),
    ).toBe(true);
    expect(Math.min(...coachIdentities.map((coach) => coach.age))).toBe(31);
    expect(Math.max(...coachIdentities.map((coach) => coach.age))).toBe(60);
  });

  test('represents the complete formal, smart-casual, training, and weatherwear wardrobe', () => {
    const wardrobes = new Set(coachIdentities.map((coach) => coach.wardrobe));
    expect([...wardrobes].sort()).toEqual([...COACH_WARDROBES].sort());
  });

  test('ships three hard-pixel levels for every facility plus a worksite', () => {
    for (const type of FACILITIES)
      for (const level of [1, 2, 3]) {
        const rows =
          data.sprites[
            `facility:${type}:l${level}` as keyof typeof data.sprites
          ];
        expect(rows).toHaveLength(32);
        expect(rows.every((row) => row.length === 32)).toBe(true);
      }
    expect(data.sprites['facility:worksite']).toHaveLength(32);
  });

  test('gives every coach a face for winning, losing, and blaming', () => {
    // The full-time report reads these straight off the head coach's portrait
    // id, so a missing pose is a broken report rather than a missing sprite.
    for (const coach of coachIdentities) {
      const rest =
        data.sprites[`coach:${coach.id}:rest` as keyof typeof data.sprites];
      for (const pose of ['joy', 'cry', 'point'] as const) {
        const rows =
          data.sprites[
            `coach:${coach.id}:${pose}` as keyof typeof data.sprites
          ];
        expect(rows).toBeDefined();
        expect(rows).toHaveLength(29);
        // A pose that came out identical to the resting face would show a calm
        // gaffer after a 0-4 and nobody would know the feature was broken.
        expect(rows.join('\n')).not.toEqual(rest.join('\n'));
      }
    }
  });

  test('cries in tears and points with an arm', () => {
    // Spot-checked on one coach rather than all 32: this asserts the drawing
    // reads as what it claims, which is the same drawing code for everyone.
    const cry =
      data.sprites['coach:amara-okafor:cry' as keyof typeof data.sprites];
    const point =
      data.sprites['coach:amara-okafor:point' as keyof typeof data.sprites];
    const rest =
      data.sprites['coach:amara-okafor:rest' as keyof typeof data.sprites];

    // 'B' is the blue in the palette and appears nowhere on a resting face.
    expect(rest.join('')).not.toContain('B');
    expect(cry.join('')).toContain('B');

    // The pointing arm reaches further right than any resting silhouette does.
    const rightmost = (rows: readonly string[]) =>
      Math.max(...rows.map((row) => row.replace(/\.+$/, '').length));
    expect(rightmost(point)).toBeGreaterThan(rightmost(rest));
  });

  test('uses only declared palette keys', () => {
    for (const rows of Object.values(data.sprites))
      for (const row of rows)
        for (const key of row) {
          expect(Object.prototype.hasOwnProperty.call(data.palette, key)).toBe(
            true,
          );
        }
  });
});
