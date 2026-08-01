import playerRequestsJson from '../../../content/player-requests.json';
import { EVENT_OBJECTS } from '../event-pixel-art';
import { EVENT_SPRITE_ROWS } from '../event-pixel-sprites';

const REQUESTS = playerRequestsJson.requests;

describe('player request artwork', () => {
  it('has a sprite for every name the catalog references', () => {
    const missing = REQUESTS
      .flatMap(request => request.art)
      .filter(sprite => EVENT_SPRITE_ROWS[sprite] === undefined);

    expect(missing).toEqual([]);
  });

  it('keeps every request sprite a 16 by 16 grid', () => {
    for (const sprite of new Set(REQUESTS.flatMap(request => request.art))) {
      const rows = EVENT_SPRITE_ROWS[sprite];
      expect(rows).toHaveLength(16);
      for (const row of rows) expect(row).toHaveLength(16);
    }
  });

  it('registers an art key for every request so EventPixelScene can draw it', () => {
    for (const request of REQUESTS) {
      expect(EVENT_OBJECTS[`request-${request.id}`]).toEqual(request.art);
    }
  });

  it('reuses the shared vocabulary rather than inventing sprites nothing else can use', () => {
    // 21 of the 30 compose entirely from sprites the event catalog already had;
    // only nine objects were genuinely new. If this drops sharply, someone has
    // started drawing a bespoke sprite per request.
    const eventSprites = new Set(
      Object.entries(EVENT_OBJECTS)
        .filter(([key]) => key.startsWith('event-'))
        .flatMap(([, sprites]) => sprites),
    );
    const reused = REQUESTS.filter(request => request.art.every(s => eventSprites.has(s)));

    expect(reused.length).toBeGreaterThanOrEqual(20);
  });
});
