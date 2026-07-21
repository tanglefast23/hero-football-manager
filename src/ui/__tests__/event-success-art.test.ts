import { loadLaunchContent } from '../../content';
import { eventSuccessMotif } from '../event-success-art';

describe('M4 bespoke risky-success artwork', () => {
  it('authors a unique comic composition for every launch event', () => {
    const events = loadLaunchContent().events.events;
    const motifs = events.map(event => eventSuccessMotif(`${event.art}-success`));

    expect(events).toHaveLength(30);
    expect(motifs.every(Boolean)).toBe(true);
    expect(new Set(motifs.map(motif => `${motif?.symbol}:${motif?.caption}`)).size).toBe(30);
  });
});
