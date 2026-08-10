import { loadLaunchContent } from '../../content';
import {
  EVENT_SPRITE_CELL,
  EVENT_SPRITE_ROWS,
  eventObjectIds,
  eventObjectLayout,
  eventSpriteRuns,
} from '../event-pixel-art';

describe('event story-object pixel art', () => {
  it('gives every launch event two or three story objects with real sprites', () => {
    const events = loadLaunchContent().events.events;
    expect(events).toHaveLength(53);
    for (const event of events) {
      const objects = eventObjectIds(event.art);
      expect(objects.length).toBeGreaterThanOrEqual(2);
      expect(objects.length).toBeLessThanOrEqual(3);
      for (const spriteId of objects) {
        expect(EVENT_SPRITE_ROWS[spriteId]).toBeDefined();
      }
      // The success view reuses the same objects via the -success key.
      expect(eventObjectIds(`${event.art}-success`)).toEqual(objects);
    }
  });

  it('keeps every sprite a strict 16x16 grid of palette characters', () => {
    const spriteIds = Object.keys(EVENT_SPRITE_ROWS);
    expect(spriteIds.length).toBeGreaterThan(0);
    for (const spriteId of spriteIds) {
      const rows = EVENT_SPRITE_ROWS[spriteId];
      expect(rows).toHaveLength(EVENT_SPRITE_CELL);
      for (const row of rows) {
        expect(row).toHaveLength(EVENT_SPRITE_CELL);
      }
      // Runs build without throwing and draw at least a dozen pixels.
      const runs = eventSpriteRuns(spriteId);
      const pixels = runs.reduce((total, run) => total + run.width, 0);
      expect(pixels).toBeGreaterThan(12);
      // Every sprite carries the chunky ink outline of the house style.
      expect(rows.some((row) => row.includes('K'))).toBe(true);
    }
  });

  it('lays out objects deterministically inside the stage', () => {
    for (const count of [2, 3] as const) {
      const layout = eventObjectLayout('event-trophy-rat', count);
      expect(layout).toHaveLength(count);
      expect(layout).toEqual(eventObjectLayout('event-trophy-rat', count));
      for (const slot of layout) {
        expect(slot.leftPercent).toBeGreaterThanOrEqual(5);
        expect(slot.leftPercent).toBeLessThanOrEqual(85);
        expect(slot.topOffset).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
