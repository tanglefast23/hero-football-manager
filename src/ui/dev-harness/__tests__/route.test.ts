import {
  devHarnessGroups,
  formatDevHarnessHash,
  parseDevHarnessHash,
  resolveDevHarnessRoute,
  resolvedDevHarnessRoute,
  type DevHarnessRoutableEntry,
} from '../route';

/**
 * Jest runs with `testEnvironment: 'node'` and `require('react-native')`
 * throws there, so no component in the harness can be rendered in a test and
 * the registry itself cannot even be imported. Everything worth asserting was
 * put in `route.ts` for that reason, and stand-in entries below carry the same
 * shape the real ones do.
 */
const ENTRIES: readonly DevHarnessRoutableEntry[] = [
  {
    id: 'awards-ceremony',
    group: 'Season',
    title: 'Division awards',
    cases: [{ id: 'mixed' }, { id: 'sweep' }, { id: 'thin' }, { id: 'barren' }],
  },
  {
    id: 'season-end',
    group: 'Season',
    title: 'Season end',
    cases: [{ id: 'promoted' }],
  },
  {
    id: 'training',
    group: 'Squad',
    title: 'Training',
    cases: [{ id: 'default' }],
  },
];

describe('reading an address', () => {
  it('reads an entry and a case out of the full form', () => {
    expect(parseDevHarnessHash('#/dev/awards-ceremony/sweep')).toEqual({
      entryId: 'awards-ceremony',
      caseId: 'sweep',
    });
  });

  it('reads an entry with no case named', () => {
    expect(parseDevHarnessHash('#/dev/awards-ceremony')).toEqual({
      entryId: 'awards-ceremony',
    });
  });

  /** A hash is a text field a human types into; none of this should matter. */
  it.each([
    ['no leading hash', 'dev/awards-ceremony/sweep'],
    ['a trailing slash', '#/dev/awards-ceremony/sweep/'],
    ['doubled slashes', '#//dev//awards-ceremony//sweep'],
    ['no leading slash', '#dev/awards-ceremony/sweep'],
  ])('tolerates %s', (_label, hash) => {
    expect(parseDevHarnessHash(hash)).toEqual({
      entryId: 'awards-ceremony',
      caseId: 'sweep',
    });
  });

  it('decodes percent-escaped segments', () => {
    expect(parseDevHarnessHash('#/dev/awards%2Dceremony/sweep')).toEqual({
      entryId: 'awards-ceremony',
      caseId: 'sweep',
    });
  });

  /** A stray `%` is a typo, and a typo must not throw on a cold load. */
  it('keeps a malformed escape rather than throwing', () => {
    expect(parseDevHarnessHash('#/dev/100%/sweep')).toEqual({
      entryId: '100%',
      caseId: 'sweep',
    });
  });

  it.each([
    ['an empty hash', ''],
    ['a bare hash', '#'],
    ['the harness root', '#/dev'],
    ['somebody else’s hash', '#gallery/3'],
    ['a path that is not the harness', '#/settings/audio'],
  ])('reads %s as the menu', (_label, hash) => {
    expect(parseDevHarnessHash(hash)).toEqual({});
  });

  it('ignores anything past the case', () => {
    expect(
      parseDevHarnessHash('#/dev/awards-ceremony/sweep/prize/extra'),
    ).toEqual({ entryId: 'awards-ceremony', caseId: 'sweep' });
  });
});

describe('writing an address', () => {
  it('writes the menu, an entry and a case', () => {
    expect(formatDevHarnessHash({})).toBe('#/dev');
    expect(formatDevHarnessHash({ entryId: 'awards-ceremony' })).toBe(
      '#/dev/awards-ceremony',
    );
    expect(
      formatDevHarnessHash({ entryId: 'awards-ceremony', caseId: 'sweep' }),
    ).toBe('#/dev/awards-ceremony/sweep');
  });

  /** A case with no entry is not an address: it must not encode into one. */
  it('drops a case that names no entry', () => {
    expect(formatDevHarnessHash({ caseId: 'sweep' })).toBe('#/dev');
  });

  it('escapes an id that is not url-safe', () => {
    expect(formatDevHarnessHash({ entryId: 'a b', caseId: 'c/d' })).toBe(
      '#/dev/a%20b/c%2Fd',
    );
  });

  it.each([
    {},
    { entryId: 'awards-ceremony' },
    { entryId: 'awards-ceremony', caseId: 'sweep' },
    { entryId: 'a b', caseId: 'c/d' },
  ])('round-trips %j', (route) => {
    expect(parseDevHarnessHash(formatDevHarnessHash(route))).toEqual(route);
  });
});

describe('resolving an address against the registry', () => {
  it('lands on the entry and case a full address names', () => {
    expect(
      resolveDevHarnessRoute(ENTRIES, {
        entryId: 'awards-ceremony',
        caseId: 'thin',
      }),
    ).toEqual({ kind: 'entry', entryId: 'awards-ceremony', caseId: 'thin' });
  });

  it('takes the first case when an address names none', () => {
    expect(
      resolveDevHarnessRoute(ENTRIES, { entryId: 'awards-ceremony' }),
    ).toEqual({ kind: 'entry', entryId: 'awards-ceremony', caseId: 'mixed' });
  });

  it('shows the menu when the address names nothing', () => {
    expect(resolveDevHarnessRoute(ENTRIES, {})).toEqual({ kind: 'menu' });
  });

  /**
   * The fallback that matters: an entry renamed or a case dropped leaves live
   * bookmarks behind, and landing on the menu is the only outcome that keeps a
   * reviewer able to get anywhere.
   */
  it('falls back to the menu for an entry the registry does not hold', () => {
    expect(
      resolveDevHarnessRoute(ENTRIES, { entryId: 'no-such-entry' }),
    ).toEqual({ kind: 'menu' });
    expect(
      resolveDevHarnessRoute(ENTRIES, {
        entryId: 'no-such-entry',
        caseId: 'sweep',
      }),
    ).toEqual({ kind: 'menu' });
  });

  it('falls back to the menu for a case the entry does not hold', () => {
    expect(
      resolveDevHarnessRoute(ENTRIES, {
        entryId: 'awards-ceremony',
        caseId: 'gone',
      }),
    ).toEqual({ kind: 'menu' });
  });

  it('falls back to the menu for an entry with no cases at all', () => {
    const empty: readonly DevHarnessRoutableEntry[] = [
      { id: 'stub', group: 'Season', title: 'Stub', cases: [] },
    ];

    expect(resolveDevHarnessRoute(empty, { entryId: 'stub' })).toEqual({
      kind: 'menu',
    });
  });

  it('resolves against an empty registry without throwing', () => {
    expect(
      resolveDevHarnessRoute([], {
        entryId: 'awards-ceremony',
        caseId: 'sweep',
      }),
    ).toEqual({ kind: 'menu' });
  });

  /** What the harness writes back, so the URL and the screen agree. */
  it('reports the address it settled on', () => {
    const route = { entryId: 'awards-ceremony' };
    const resolution = resolveDevHarnessRoute(ENTRIES, route);

    expect(formatDevHarnessHash(resolvedDevHarnessRoute(resolution))).toBe(
      '#/dev/awards-ceremony/mixed',
    );
    expect(
      formatDevHarnessHash(
        resolvedDevHarnessRoute(
          resolveDevHarnessRoute(ENTRIES, { entryId: 'gone' }),
        ),
      ),
    ).toBe('#/dev');
  });

  /** Correcting an address must settle, or the harness rewrites the URL forever. */
  it('leaves an already-resolved address alone', () => {
    for (const entry of ENTRIES) {
      for (const entryCase of entry.cases) {
        const route = { entryId: entry.id, caseId: entryCase.id };
        const settled = resolvedDevHarnessRoute(
          resolveDevHarnessRoute(ENTRIES, route),
        );

        expect(settled).toEqual(route);
      }
    }
  });

  it('resolves a hash end to end', () => {
    expect(
      resolveDevHarnessRoute(ENTRIES, parseDevHarnessHash('#/dev/training')),
    ).toEqual({ kind: 'entry', entryId: 'training', caseId: 'default' });
    expect(
      resolveDevHarnessRoute(
        ENTRIES,
        parseDevHarnessHash('#/dev/nonsense/at/all'),
      ),
    ).toEqual({ kind: 'menu' });
  });
});

describe('the menu’s sections', () => {
  it('groups entries and keeps registration order inside each', () => {
    expect(devHarnessGroups(ENTRIES)).toEqual([
      { name: 'Season', entries: [ENTRIES[0], ENTRIES[1]] },
      { name: 'Squad', entries: [ENTRIES[2]] },
    ]);
  });

  /** Adding an entry must not reshuffle the sections already on the menu. */
  it('orders groups by where each first appeared', () => {
    const reordered = [ENTRIES[2], ENTRIES[0], ENTRIES[1]];

    expect(devHarnessGroups(reordered).map((group) => group.name)).toEqual([
      'Squad',
      'Season',
    ]);
  });

  it('handles an empty registry', () => {
    expect(devHarnessGroups([])).toEqual([]);
  });
});
