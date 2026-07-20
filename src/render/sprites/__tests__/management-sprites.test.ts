import data from '../management-sprites.json';

const COACH_IDS = [
  'amara-okafor', 'kenji-sato', 'valentina-cruz', 'imani-adeyemi',
  'freja-lindholm', 'priya-nair', 'mateo-silva', 'hana-park',
  'leila-haddad', 'nia-thompson', 'tomas-ferreira', 'aiko-tanaka',
  'sibusiso-dlamini', 'sofia-rossi', 'jamal-rahman', 'mei-chen',
];
const FACILITIES = [
  'training-pitch', 'gym', 'tech-center', 'shooting-range', 'keeper-court',
  'medical-bay', 'dorm', 'scout-office', 'coaching-office', 'youth-field',
  'fan-shop', 'stadium-stand', 'hero-lab',
];

describe('management pixel sprites', () => {
  test('ships unique resting and joyful portraits for all sixteen curated coaches', () => {
    const portraits = COACH_IDS.map(id => data.sprites[`coach:${id}:rest` as keyof typeof data.sprites]);
    for (const id of COACH_IDS) {
      expect(data.sprites).toHaveProperty(`coach:${id}:rest`);
      expect(data.sprites).toHaveProperty(`coach:${id}:joy`);
      expect(data.sprites[`coach:${id}:joy` as keyof typeof data.sprites])
        .not.toEqual(data.sprites[`coach:${id}:rest` as keyof typeof data.sprites]);
    }
    expect(new Set(portraits.map(rows => JSON.stringify(rows))).size).toBe(COACH_IDS.length);
  });

  test('ships three hard-pixel levels for every facility plus a worksite', () => {
    for (const type of FACILITIES) for (const level of [1, 2, 3]) {
      const rows = data.sprites[`facility:${type}:l${level}` as keyof typeof data.sprites];
      expect(rows).toHaveLength(32);
      expect(rows.every(row => row.length === 32)).toBe(true);
    }
    expect(data.sprites['facility:worksite']).toHaveLength(32);
  });

  test('uses only declared palette keys', () => {
    for (const rows of Object.values(data.sprites)) for (const row of rows) for (const key of row) {
      expect(Object.prototype.hasOwnProperty.call(data.palette, key)).toBe(true);
    }
  });
});
