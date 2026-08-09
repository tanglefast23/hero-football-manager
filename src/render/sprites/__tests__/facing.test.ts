import sheetData from '../sprites.json';
import { deriveBackFacingFrame, loadSpriteSheet } from '../loader';
import { keeperReadyFrameFacingBall, runFrameFacingBall } from '../facing';

const HERO_IDS = Array.from({ length: 15 }, (_, index) => `f${168 + index}`);

function paintedInterior(row: string): string {
  const first = [...row].findIndex((token) => token !== '.');
  const last =
    row.length - 1 - [...row].reverse().findIndex((token) => token !== '.');
  return first < 0 || last - first < 2 ? '' : row.slice(first + 1, last);
}

describe('direction-aware match sprites', () => {
  it('shows the rear view when the ball is up-screen of the player', () => {
    expect(runFrameFacingBall(500, 200, 'run0')).toBe('back0');
    expect(runFrameFacingBall(500, 200, 'run1')).toBe('back1');
    expect(keeperReadyFrameFacingBall(500, 200, 'ready1')).toBe('backReady1');
  });

  it('shows the face when the ball is level with or below the player', () => {
    expect(runFrameFacingBall(500, 800, 'run0')).toBe('run0');
    expect(runFrameFacingBall(500, 500, 'run1')).toBe('run1');
    expect(keeperReadyFrameFacingBall(500, 800, 'ready0')).toBe('ready0');
    expect(keeperReadyFrameFacingBall(500, 500, 'ready0')).toBe('ready0');
  });

  it('keeps the authored silhouette and stride while removing face details', () => {
    const front = sheetData.sprites['r:f00:run0'];
    const back = deriveBackFacingFrame(front);
    expect(back).toHaveLength(front.length);
    expect(back.map((row) => row.length)).toEqual(
      front.map((row) => row.length),
    );
    expect(back.slice(0, 7)).toEqual(front.slice(0, 7));
    expect(back.slice(7, 15)).not.toEqual(front.slice(7, 15));
    expect(back[8]).not.toContain('W');
    // Below the waist the silhouette is untouched; only the near boot changes
    // colour, turning sole-side out for a player running away from the camera.
    const silhouette = (rows: readonly string[]) =>
      rows.map((row) => row.replace(/[^.]/g, '#'));
    expect(silhouette(back.slice(24))).toEqual(silhouette(front.slice(24)));
    expect(back.slice(24)).not.toEqual(front.slice(24));
  });

  it('derives rear run and keeper-ready art for selected identities', () => {
    const sheet = loadSpriteSheet(['r:f00', 'u:g01']);
    expect(sheet.sprites).toHaveProperty('r:f00:back0');
    expect(sheet.sprites).toHaveProperty('r:f00:back1');
    expect(sheet.sprites).toHaveProperty('u:g01:backReady0');
    expect(sheet.sprites).toHaveProperty('u:g01:backReady1');
  });

  it('keeps every special hero recognisable in a logical rear view', () => {
    const source = sheetData as typeof sheetData & {
      rearHeads: Record<
        string,
        {
          head: string;
          lower: string;
          bands?: { row: number; token: string }[];
        }
      >;
    };
    expect(Object.keys(source.rearHeads)).toEqual(HERO_IDS);
    const visualIds = HERO_IDS.flatMap((id) => [`r:${id}`, `u:${id}`]);
    const sheet = loadSpriteSheet(visualIds);

    for (const visualId of visualIds) {
      const lookId = visualId.split(':')[1];
      const style = source.rearHeads[lookId];
      for (const frame of ['0', '1'] as const) {
        const front = sheet.sprites[`${visualId}:run${frame}`];
        const back = sheet.sprites[`${visualId}:back${frame}`];
        expect(back.slice(0, 7)).toEqual(front.slice(0, 7));
        for (let row = 7; row <= 12; row += 1) {
          const band = style.bands?.find((candidate) => candidate.row === row);
          expect(new Set(paintedInterior(back[row]))).toEqual(
            new Set([band?.token ?? style.head]),
          );
        }
        for (let row = 13; row <= 14; row += 1) {
          expect(new Set(paintedInterior(back[row]))).toEqual(
            new Set([style.lower]),
          );
        }
        expect(back.slice(7, 13).join('')).not.toMatch(/[Ww]/);
      }
    }
  });

  it('keeps black hero headgear black and carries the red visor around the rear', () => {
    const sheet = loadSpriteSheet([
      'u:f168',
      'u:f170',
      'u:f176',
      'u:f177',
      'u:f178',
      'u:f180',
      'u:f182',
    ]);
    for (const lookId of ['f168', 'f170', 'f176', 'f177', 'f180']) {
      expect(
        new Set(paintedInterior(sheet.sprites[`u:${lookId}:back0`][10])),
      ).toEqual(new Set(['K']));
    }
    expect(new Set(paintedInterior(sheet.sprites['u:f178:back0'][8]))).toEqual(
      new Set(['R']),
    );
    expect(new Set(paintedInterior(sheet.sprites['u:f178:back0'][9]))).toEqual(
      new Set(['r']),
    );
    expect(new Set(paintedInterior(sheet.sprites['u:f182:back0'][14]))).toEqual(
      new Set(['T']),
    );
  });
});
