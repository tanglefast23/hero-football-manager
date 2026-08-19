import {
  FORMATION_IDS,
  formationRoleForSlot,
  type FormationId,
} from '../../sim/tactics';
import type { MatchEvent } from '../../sim/types';
import {
  applyRoleLabelEvent,
  CLOSED_ROLE_LABEL_WINDOW,
  LABELLED_SLOT_COUNT,
  packRoles,
  ROLE_LABEL_CELLS,
  ROLE_LABEL_TICKS,
  roleAt,
  roleLabelsVisible,
} from '../formation-role-labels';

const change = (
  t: number,
  team: 0 | 1,
  formation: FormationId = '4-3-3',
): MatchEvent => ({
  t,
  kind: 'FORMATION_CHANGED',
  team,
  formation,
});

describe('formation role label window', () => {
  it('opens on the controlled team change and points at that team of eleven', () => {
    const home = applyRoleLabelEvent(
      CLOSED_ROLE_LABEL_WINDOW,
      change(100, 0),
      0,
    );
    expect(home.openTick).toBe(100);
    expect(home.firstSlot).toBe(1);
    const away = applyRoleLabelEvent(
      CLOSED_ROLE_LABEL_WINDOW,
      change(100, 1),
      1,
    );
    expect(away.firstSlot).toBe(12);
  });

  it('ignores the uncontrolled team', () => {
    expect(
      applyRoleLabelEvent(CLOSED_ROLE_LABEL_WINDOW, change(100, 1), 0),
    ).toBe(CLOSED_ROLE_LABEL_WINDOW);
  });

  it('holds for exactly ROLE_LABEL_TICKS and not one tick more', () => {
    const open = applyRoleLabelEvent(
      CLOSED_ROLE_LABEL_WINDOW,
      change(100, 0),
      0,
    );
    expect(roleLabelsVisible(open, 100)).toBe(true);
    expect(roleLabelsVisible(open, 100 + ROLE_LABEL_TICKS - 1)).toBe(true);
    expect(roleLabelsVisible(open, 100 + ROLE_LABEL_TICKS)).toBe(false);
    expect(roleLabelsVisible(CLOSED_ROLE_LABEL_WINDOW, 100)).toBe(false);
  });

  it.each(['GOAL', 'MISS', 'HALF_TIME', 'FULL_TIME'] as const)(
    'closes early on %s',
    (kind) => {
      const open = applyRoleLabelEvent(
        CLOSED_ROLE_LABEL_WINDOW,
        change(100, 0),
        0,
      );
      const closed = applyRoleLabelEvent(
        open,
        {
          t: 110,
          kind,
          by: 3,
          team: 0,
          scoredById: 'x',
        } as unknown as MatchEvent,
        0,
      );
      expect(roleLabelsVisible(closed, 111)).toBe(false);
    },
  );

  it('is untouched by an unrelated event', () => {
    const open = applyRoleLabelEvent(
      CLOSED_ROLE_LABEL_WINDOW,
      change(100, 0),
      0,
    );
    const after = applyRoleLabelEvent(
      open,
      {
        t: 110,
        kind: 'PASS',
        from: 1,
        to: 2,
        ok: true,
      } as unknown as MatchEvent,
      0,
    );
    expect(after).toBe(open);
    expect(roleLabelsVisible(after, 130)).toBe(true);
  });

  it('restarts rather than extends on a second change', () => {
    const first = applyRoleLabelEvent(
      CLOSED_ROLE_LABEL_WINDOW,
      change(100, 0, '4-3-3'),
      0,
    );
    const second = applyRoleLabelEvent(first, change(120, 0, '3-4-3'), 0);
    expect(second.openTick).toBe(120);
    expect(second.packedRoles).toBe(packRoles('3-4-3'));
    expect(roleLabelsVisible(second, 150)).toBe(true);
  });
});

describe('role packing', () => {
  it.each(FORMATION_IDS)('round-trips every slot of %s', (formation) => {
    const packed = packRoles(formation);
    for (let index = 0; index < LABELLED_SLOT_COUNT; index += 1) {
      // Equality against the engine, not membership: a packing bug that mapped
      // every slot to MID would still be inside the set of three codes.
      expect(roleAt(packed, index)).toBe(
        formationRoleForSlot(formation, index + 1),
      );
    }
  });

  it('keeps the 5-3-2 slot-8 exception: the right mid becomes the fifth defender', () => {
    const packed = packRoles('5-3-2');
    expect(roleAt(packed, 7)).toBe('DEF');
    expect(roleAt(packRoles('4-4-2'), 7)).toBe('MID');
  });

  it('draws a lit cell for every label', () => {
    expect(ROLE_LABEL_CELLS).toHaveLength(3);
    for (const cells of ROLE_LABEL_CELLS) {
      expect(cells.length).toBeGreaterThan(0);
      expect(cells.length % 2).toBe(0);
    }
  });
});
