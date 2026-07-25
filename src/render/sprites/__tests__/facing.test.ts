import sheetData from '../sprites.json';
import { deriveBackFacingFrame, loadSpriteSheet } from '../loader';
import { keeperReadyFrameFacingBall, runFrameFacingBall } from '../facing';

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
    expect(back.map(row => row.length)).toEqual(front.map(row => row.length));
    expect(back.slice(0, 7)).toEqual(front.slice(0, 7));
    expect(back.slice(7, 15)).not.toEqual(front.slice(7, 15));
    expect(back[8]).not.toContain('W');
    // Below the waist the silhouette is untouched; only the near boot changes
    // colour, turning sole-side out for a player running away from the camera.
    const silhouette = (rows: readonly string[]) => rows.map(row => row.replace(/[^.]/g, '#'));
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
});
