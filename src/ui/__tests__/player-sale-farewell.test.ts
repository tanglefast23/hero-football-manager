import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GUILT_PLAYER_FAREWELL_KEYS,
  PLAYER_FAREWELL_KEYS,
  SAD_PLAYER_FAREWELL_KEYS,
  SENTIMENTAL_PLAYER_FAREWELL_KEYS,
  playerSaleFarewellLine,
  playerSaleFarewellLines,
} from '../player-sale-farewell-lines';
import { MAX_ARRIVAL_LINE_LENGTH } from '../player-arrival-lines';

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), 'utf8');

describe('sold-player farewell walk-on', () => {
  it('has five sad, five sentimental, and five guilt-inducing choices', () => {
    expect(SAD_PLAYER_FAREWELL_KEYS).toHaveLength(5);
    expect(SENTIMENTAL_PLAYER_FAREWELL_KEYS).toHaveLength(5);
    expect(GUILT_PLAYER_FAREWELL_KEYS).toHaveLength(5);
    expect(PLAYER_FAREWELL_KEYS).toHaveLength(15);

    const lines = playerSaleFarewellLines();
    expect(new Set(lines).size).toBe(15);
    for (const line of lines) {
      expect(line.trim()).toBe(line);
      expect(line.length).toBeGreaterThan(0);
      expect(line.length).toBeLessThanOrEqual(MAX_ARRIVAL_LINE_LENGTH);
    }
  });

  it('chooses one stable line for one completed sale', () => {
    const key = '404:2:17:max-tanko';
    const line = playerSaleFarewellLine(key);

    expect(playerSaleFarewellLines()).toContain(line);
    expect(playerSaleFarewellLine(key)).toBe(line);
  });

  it('starts only after a bid is accepted and the player has left the club', () => {
    const app = source('App.tsx');

    expect(app).toContainSource('const acceptingBid = bid !== undefined;');
    expect(app).toMatchSource(
      /const farewellPlayer[\s\S]*?acceptingBid[\s\S]*?selectionKey:/,
    );
    expect(app).toMatchSource(
      /after\.error === null[\s\S]*?player\.clubId === after\.career\?\.userClubId[\s\S]*?setPlayerSaleFarewell\(farewellPlayer\)/,
    );
    expect(app).toContainSource('<PlayerSaleFarewellWalkOn');
  });

  it('uses the same walk-on and speech-bubble rig as the first hire', () => {
    const farewell = source('src/ui/PlayerSaleFarewellWalkOn.tsx');
    const firstHire = source('src/ui/PlayerWalkOnWelcome.tsx');

    for (const contract of [
      '<CharacterSpeechOverlay',
      'PLAYER_SPRITE_CELL.width * SPRITE_SCALE',
      '<PlayerRunSprite',
      'walking',
      'line.length * MS_PER_CHARACTER',
    ]) {
      expect(farewell).toContainSource(contract);
      expect(firstHire).toContainSource(contract);
    }
  });
});
