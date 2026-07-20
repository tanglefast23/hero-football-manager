import coachIdentities from '../../../game/coach-identities.json';
import data from '../management-sprites.json';
import playerPortraits from '../portraits.json';

const COACH_IDS = coachIdentities.map(coach => coach.id);
const COACH_WARDROBES = [
  'suit-tie', 'suit-open-collar', 'blazer-turtleneck', 'cardigan-shirt',
  'sweater-shirt', 'quarter-zip', 'training-polo', 'club-tracksuit',
  'training-shell', 'padded-gilet', 'padded-coat', 'rain-jacket',
  'overcoat-scarf',
];
const FACILITIES = [
  'training-pitch', 'gym', 'tech-center', 'shooting-range', 'keeper-court',
  'medical-bay', 'dorm', 'scout-office', 'coaching-office', 'youth-field',
  'fan-shop', 'stadium-stand', 'hero-lab',
];

describe('management pixel sprites', () => {
  test('ships unique resting and joyful portraits for all 32 curated coaches', () => {
    expect(COACH_IDS).toHaveLength(32);
    const resting = COACH_IDS.map(id => data.sprites[`coach:${id}:rest` as keyof typeof data.sprites]);
    const playerArt = new Set(Object.values(playerPortraits.sprites).map(rows => JSON.stringify(rows)));
    for (const id of COACH_IDS) {
      expect(data.sprites).toHaveProperty(`coach:${id}:rest`);
      expect(data.sprites).toHaveProperty(`coach:${id}:joy`);
      expect(data.sprites[`coach:${id}:joy` as keyof typeof data.sprites])
        .not.toEqual(data.sprites[`coach:${id}:rest` as keyof typeof data.sprites]);
      expect(playerArt.has(JSON.stringify(data.sprites[`coach:${id}:rest` as keyof typeof data.sprites]))).toBe(false);
    }
    expect(new Set(resting.map(rows => JSON.stringify(rows))).size).toBe(COACH_IDS.length);
  });

  test('keeps every curated coach age within the 30-60 hiring band', () => {
    expect(coachIdentities.every(coach => Number.isInteger(coach.age) && coach.age >= 30 && coach.age <= 60)).toBe(true);
    expect(Math.min(...coachIdentities.map(coach => coach.age))).toBe(31);
    expect(Math.max(...coachIdentities.map(coach => coach.age))).toBe(60);
  });

  test('represents the complete formal, smart-casual, training, and weatherwear wardrobe', () => {
    const wardrobes = new Set(coachIdentities.map(coach => coach.wardrobe));
    expect([...wardrobes].sort()).toEqual([...COACH_WARDROBES].sort());
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
