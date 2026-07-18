import type { Attrs, PowerId, Role } from '../../sim/types';
import { buildTeamDef, matchAttrsAtMorale, type MatchSquadPlayer } from '../lineup';

const BASE_ATTRS: Attrs = {
  pac: 50,
  sho: 50,
  pas: 50,
  def: 50,
  tec: 50,
  sta: 50,
  ref: 50,
};

function squadPlayer(
  id: string,
  role: Role,
  options: {
    power?: PowerId;
    licensed?: boolean;
    attrs?: Attrs;
    morale?: number;
  } = {},
): MatchSquadPlayer {
  return {
    id,
    name: `Player ${id}`,
    role,
    attrs: options.attrs ?? { ...BASE_ATTRS },
    power: options.power,
    licensed: options.licensed ?? false,
    morale: options.morale ?? 50,
    weeklyWage: 200,
    onHeroWage: false,
    contractSeasonsRemaining: 2,
  };
}

function validRoster(): MatchSquadPlayer[] {
  return [
    squadPlayer('gk', 'GK'),
    squadPlayer('def-1', 'DEF'),
    squadPlayer('def-2', 'DEF'),
    squadPlayer('def-3', 'DEF'),
    squadPlayer('def-4', 'DEF'),
    squadPlayer('mid-1', 'MID'),
    squadPlayer('mid-2', 'MID'),
    squadPlayer('mid-3', 'MID'),
    squadPlayer('mid-4', 'MID'),
    squadPlayer('fwd-speed', 'FWD', { power: 'SUPER_SPEED', licensed: true }),
    squadPlayer('fwd-torch', 'FWD', { power: 'FIRE_TORCH', licensed: true }),
    squadPlayer('bench-hero', 'FWD', { power: 'SUPER_STRENGTH' }),
    squadPlayer('bench-regular', 'MID'),
  ];
}

const STARTING_IDS = [
  'gk',
  'def-1',
  'def-2',
  'def-3',
  'def-4',
  'mid-1',
  'mid-2',
  'mid-3',
  'mid-4',
  'fwd-speed',
  'fwd-torch',
] as const;

describe('buildTeamDef', () => {
  it('selects 11 from a larger roster and preserves lineup order', () => {
    const team = buildTeamDef(
      { id: 'rovers', name: 'Hero Rovers' },
      validRoster(),
      STARTING_IDS,
    );

    expect(team).toMatchObject({ id: 'rovers', name: 'Hero Rovers' });
    expect(team.players).toHaveLength(11);
    expect(team.players.map(player => player.id)).toEqual(STARTING_IDS);
    expect(team.players[0].role).toBe('GK');
    expect(team.players[9].power).toBe('SUPER_SPEED');
    expect(team.players[10].power).toBe('FIRE_TORCH');
  });

  it('requires an owned hero to be licensed or benched', () => {
    const lineupIds = [
      ...STARTING_IDS.slice(0, 8),
      'fwd-speed',
      'fwd-torch',
      'bench-hero',
    ];

    expect(() => buildTeamDef(
      { id: 'rovers', name: 'Hero Rovers' },
      validRoster(),
      lineupIds,
    )).toThrow(/must be licensed or benched/);

    expect(() => buildTeamDef(
      { id: 'rovers', name: 'Hero Rovers' },
      validRoster(),
      STARTING_IDS,
    )).not.toThrow();
  });

  it('enforces the licensed-hero cap only across the selected lineup', () => {
    const roster = validRoster().map(player => (
      player.id === 'bench-hero' ? { ...player, licensed: true } : player
    ));
    const lineupIds = [
      ...STARTING_IDS.slice(0, 8),
      'fwd-speed',
      'fwd-torch',
      'bench-hero',
    ];

    expect(() => buildTeamDef(
      { id: 'rovers', name: 'Hero Rovers' },
      roster,
      lineupIds,
    )).toThrow(/at most 2 licensed heroes/);

    expect(() => buildTeamDef(
      { id: 'rovers', name: 'Hero Rovers' },
      roster,
      STARTING_IDS,
    )).not.toThrow();
  });

  it('rejects duplicate, unknown, or incorrectly sized lineup selections', () => {
    const roster = validRoster();

    expect(() => buildTeamDef(
      { id: 'rovers', name: 'Hero Rovers' },
      roster,
      [...STARTING_IDS.slice(0, 10), 'fwd-speed'],
    )).toThrow(/unique/);

    expect(() => buildTeamDef(
      { id: 'rovers', name: 'Hero Rovers' },
      roster,
      [...STARTING_IDS.slice(0, 10), 'missing'],
    )).toThrow(/Unknown/);

    expect(() => buildTeamDef(
      { id: 'rovers', name: 'Hero Rovers' },
      roster,
      STARTING_IDS.slice(0, 10),
    )).toThrow(/exactly 11/);
  });

  it('rejects duplicate roster IDs and licensed players without powers', () => {
    const roster = validRoster();
    expect(() => buildTeamDef(
      { id: 'rovers', name: 'Hero Rovers' },
      [...roster, { ...roster[0] }],
      STARTING_IDS,
    )).toThrow(/unique/);

    const invalidLicense = roster.map(player => (
      player.id === 'bench-regular' ? { ...player, licensed: true } : player
    ));
    expect(() => buildTeamDef(
      { id: 'rovers', name: 'Hero Rovers' },
      invalidLicense,
      STARTING_IDS,
    )).toThrow(/must own a power/);
  });

  it('requires exactly one goalkeeper in slot 0', () => {
    const roster = validRoster();
    const wrongSlot = [...STARTING_IDS];
    [wrongSlot[0], wrongSlot[1]] = [wrongSlot[1], wrongSlot[0]];

    expect(() => buildTeamDef(
      { id: 'rovers', name: 'Hero Rovers' },
      roster,
      wrongSlot,
    )).toThrow(/slot 0/);

    const secondKeeper = roster.map(player => (
      player.id === 'def-1' ? { ...player, role: 'GK' as const } : player
    ));
    expect(() => buildTeamDef(
      { id: 'rovers', name: 'Hero Rovers' },
      secondKeeper,
      STARTING_IDS,
    )).toThrow(/exactly one goalkeeper/);
  });

  it('validates attributes as integer values from 1 to 99', () => {
    const roster = validRoster().map(player => (
      player.id === 'bench-regular'
        ? { ...player, attrs: { ...player.attrs, pac: 99.5 } }
        : player
    ));

    expect(() => buildTeamDef(
      { id: 'rovers', name: 'Hero Rovers' },
      roster,
      STARTING_IDS,
    )).toThrow(/integer from 1 to 99/);
  });

  it('pins the canonical morale modifier into the match attributes', () => {
    const roster = validRoster().map(player => (
      player.id === 'mid-1' ? { ...player, morale: 100 } : player
    ));

    const team = buildTeamDef(
      { id: 'rovers', name: 'Hero Rovers' },
      roster,
      STARTING_IDS,
    );

    expect(team.players.find(player => player.id === 'mid-1')?.attrs).toEqual({
      pac: 55,
      sho: 55,
      pas: 55,
      def: 55,
      tec: 55,
      sta: 55,
      ref: 55,
    });
    expect(team.players.find(player => player.id === 'mid-2')?.attrs).toEqual(BASE_ATTRS);
  });

  it('maps the full morale band to -10% through +10% and clamps attributes', () => {
    expect(matchAttrsAtMorale(BASE_ATTRS, 0).pac).toBe(45);
    expect(matchAttrsAtMorale(BASE_ATTRS, 50).pac).toBe(50);
    expect(matchAttrsAtMorale(BASE_ATTRS, 100).pac).toBe(55);
    expect(matchAttrsAtMorale({ ...BASE_ATTRS, pac: 99, sho: 1 }, 100)).toMatchObject({
      pac: 99,
      sho: 1,
    });
  });

  it.each([-1, 101, 1.5, Number.NaN])('rejects invalid morale %p', morale => {
    const roster = validRoster().map(player => (
      player.id === 'bench-regular' ? { ...player, morale } : player
    ));
    expect(() => buildTeamDef(
      { id: 'rovers', name: 'Hero Rovers' },
      roster,
      STARTING_IDS,
    )).toThrow(/morale must be an integer from 0 to 100/);
  });

  it('deep-copies match players and attributes without mutating the inputs', () => {
    const club = { id: 'rovers', name: 'Hero Rovers' };
    const roster = validRoster();
    const beforeClub = JSON.stringify(club);
    const beforeRoster = JSON.stringify(roster);
    const beforeLineup = JSON.stringify(STARTING_IDS);

    const team = buildTeamDef(club, roster, STARTING_IDS);

    expect(team.players[0]).not.toBe(roster[0]);
    expect(team.players[0].attrs).not.toBe(roster[0].attrs);
    team.players[0].attrs.pac = 99;
    expect(roster[0].attrs.pac).toBe(50);
    expect(JSON.stringify(club)).toBe(beforeClub);
    expect(JSON.stringify(roster)).toBe(beforeRoster);
    expect(JSON.stringify(STARTING_IDS)).toBe(beforeLineup);
  });
});
