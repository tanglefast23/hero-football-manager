import { clubCrestRuns, clubCrestSpec } from '../club-crest-art';

describe('club crest art', () => {
  it('keeps authored club colors and gives generated clubs stable identities', () => {
    expect(clubCrestSpec('Harbor Comets')).toEqual({
      primary: '#2F55B8',
      secondary: '#F4F1EA',
      pattern: 'solid',
      motif: 'comet',
    });
    expect(clubCrestSpec('Alder City')).toMatchObject({
      primary: '#31703F',
      motif: 'leaf',
      pattern: 'quarters',
    });
    expect(clubCrestSpec('Alder Rovers')).not.toEqual(
      clubCrestSpec('Alder City'),
    );
    expect(clubCrestRuns('Joe Athletic')).toEqual(
      clubCrestRuns('Joe Athletic'),
    );
    expect(clubCrestRuns('Joe Athletic').length).toBeGreaterThan(10);
  });

  it('gives all 50 generated pyramid clubs a distinct crest', () => {
    const prefixes = [
      'Alder',
      'Beacon',
      'Copper',
      'Dunwich',
      'Elm',
      'Fable',
      'Garnet',
      'Harbour',
      'Iron',
      'Juniper',
    ];
    const suffixes = ['Athletic', 'City', 'Rovers', 'United', 'Wanderers'];
    const specs = prefixes.flatMap((prefix) =>
      suffixes.map((suffix) =>
        JSON.stringify(clubCrestSpec(`${prefix} ${suffix}`)),
      ),
    );

    expect(new Set(specs).size).toBe(50);
  });
});
