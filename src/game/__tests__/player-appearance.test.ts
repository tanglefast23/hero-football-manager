import {
  assignDistinctPlayerLooks,
  generatedPlayerLookId,
  isPlayerLookIdForRole,
  nextDistinctPlayerLook,
} from '../player-appearance';

describe('persisted player appearances', () => {
  it('allocates missing looks deterministically regardless of source order', () => {
    const players = [
      { id: 'academy-s3-7', role: 'MID' as const },
      { id: 'academy-s3-8', role: 'MID' as const },
      { id: 'academy-keeper', role: 'GK' as const },
    ];
    const first = assignDistinctPlayerLooks(players);
    const reversed = assignDistinctPlayerLooks([...players].reverse());
    expect(new Map(first.map(player => [player.id, player.lookId])))
      .toEqual(new Map(reversed.map(player => [player.id, player.lookId])));
    expect(new Set(first.map(player => player.lookId)).size).toBe(first.length);
  });

  it('keeps an established user face when a later player arrives with the same look', () => {
    const assigned = assignDistinctPlayerLooks([
      { id: 'known-user', role: 'MID' as const, lookId: 'f13' },
      { id: 'returning-opponent', role: 'FWD' as const, lookId: 'f13' },
    ]);
    expect(assigned[0].lookId).toBe('f13');
    expect(assigned[1].lookId).not.toBe('f13');
  });

  it('selects the next free role pool entry without disturbing existing players', () => {
    const player = { id: 'new-youth', role: 'FWD' as const };
    const preferred = generatedPlayerLookId(player.id, player.role);
    const lookId = nextDistinctPlayerLook(player, [
      { id: 'existing', role: 'MID', lookId: preferred },
    ]);
    expect(lookId).not.toBe(preferred);
    expect(isPlayerLookIdForRole(lookId, 'FWD')).toBe(true);
    expect(isPlayerLookIdForRole('g00', 'FWD')).toBe(false);
  });
});
