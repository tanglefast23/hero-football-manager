import sheetData from '../sprites.json';
import { deriveBackFacingFrame, loadSpriteSheet } from '../loader';
import { keeperReadyFrameForTeam, runFrameForTeam } from '../facing';

describe('direction-aware match sprites', () => {
  it('uses rear views for the team attacking toward the top goal', () => {
    expect(runFrameForTeam(0, 'run0')).toBe('back0');
    expect(runFrameForTeam(0, 'run1')).toBe('back1');
    expect(keeperReadyFrameForTeam(0, 'ready1')).toBe('backReady1');
    expect(runFrameForTeam(1, 'run0')).toBe('run0');
    expect(keeperReadyFrameForTeam(1, 'ready0')).toBe('ready0');
  });

  it('keeps the authored silhouette and stride while removing face details', () => {
    const front = sheetData.sprites['r:f00:run0'];
    const back = deriveBackFacingFrame(front);
    expect(back).toHaveLength(front.length);
    expect(back.map(row => row.length)).toEqual(front.map(row => row.length));
    expect(back.slice(0, 7)).toEqual(front.slice(0, 7));
    expect(back.slice(7, 15)).not.toEqual(front.slice(7, 15));
    expect(back[8]).not.toContain('W');
    expect(back.slice(24)).toEqual(front.slice(24));
  });

  it('derives rear run and keeper-ready art for selected identities', () => {
    const sheet = loadSpriteSheet(['r:f00', 'u:g01']);
    expect(sheet.sprites).toHaveProperty('r:f00:back0');
    expect(sheet.sprites).toHaveProperty('r:f00:back1');
    expect(sheet.sprites).toHaveProperty('u:g01:backReady0');
    expect(sheet.sprites).toHaveProperty('u:g01:backReady1');
  });
});
