import type { Attrs, PlayerDef, Role, TeamDef, PowerId } from './types';

function p(id: string, name: string, role: Role, attrs: Attrs, power?: PowerId): PlayerDef {
  return { id, name, role, attrs, power };
}
const a = (pac: number, sho: number, pas: number, def: number, tec: number, sta: number, ref: number): Attrs =>
  ({ pac, sho, pas, def, tec, sta, ref });

export const ROVERS: TeamDef = {
  id: 'rovers', name: 'Bramble Rovers',
  players: [
    p('r0', 'Sam Mitts', 'GK', a(40, 20, 45, 40, 35, 60, 62)),
    p('r1', 'Ed Stone', 'DEF', a(55, 30, 50, 62, 45, 65, 10)),
    p('r2', 'Bo Hedges', 'DEF', a(52, 28, 48, 60, 42, 68, 10)),
    p('r3', 'Max Tanko', 'DEF', a(50, 25, 45, 64, 40, 70, 10)),
    p('r4', 'Ty Brooks', 'DEF', a(58, 32, 52, 58, 48, 64, 10)),
    p('r5', 'Gio Marsh', 'MID', a(60, 45, 62, 50, 58, 66, 10)),
    p('r6', 'Ken Ash', 'MID', a(56, 42, 65, 48, 60, 62, 10)),
    p('r7', 'Leo Quick', 'MID', a(62, 44, 58, 45, 56, 68, 10)),
    p('r8', 'Ravi Chan', 'MID', a(58, 40, 60, 52, 54, 64, 10)),
    p('r9', 'Dario Flint', 'FWD', a(66, 62, 48, 25, 60, 60, 10), 'FIRE_TORCH'),
    p('r10', 'Zip Vela', 'FWD', a(72, 58, 45, 22, 62, 58, 10), 'SUPER_SPEED'),
  ],
};

export const UNITED: TeamDef = {
  id: 'united', name: 'Ferrous United',
  players: [
    p('u0', 'Vic Palm', 'GK', a(42, 22, 46, 42, 36, 62, 64)),
    p('u1', 'Ali Frost', 'DEF', a(56, 30, 50, 63, 46, 66, 10)),
    p('u2', 'Jon Crag', 'DEF', a(53, 28, 48, 61, 43, 67, 10)),
    p('u3', 'Rex Bould', 'DEF', a(51, 26, 46, 65, 41, 69, 10), 'SUPER_STRENGTH'),
    p('u4', 'Nik Vale', 'DEF', a(57, 31, 51, 59, 47, 65, 10)),
    p('u5', 'Oz Reeds', 'MID', a(59, 44, 61, 51, 57, 65, 10)),
    p('u6', 'Cal Dunn', 'MID', a(57, 43, 64, 49, 59, 63, 10)),
    p('u7', 'Ian Slate', 'MID', a(61, 45, 57, 46, 55, 67, 10)),
    p('u8', 'Uri Kemp', 'MID', a(57, 41, 59, 53, 53, 63, 10)),
    p('u9', 'Abe Torro', 'FWD', a(65, 61, 47, 26, 59, 61, 10)),
    p('u10', 'Moe Lyle', 'FWD', a(70, 57, 44, 23, 61, 59, 10)),
  ],
};
