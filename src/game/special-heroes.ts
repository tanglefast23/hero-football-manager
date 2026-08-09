import type { Attrs, PowerId, Role } from '../sim/types';
import { MAX_PLAYER_ATTRIBUTE } from '../sim/attributes';
import { roleOverall } from './archetype-caps';
import { powerIsCompatibleWithRole } from './power-catalog';
import type { DivisionLevel } from './pyramid';

/**
 * The fifteen named superheroes.
 *
 * Unlike every other opponent, these are characters rather than statistics: a
 * fixed name, role, power and face that the player meets again each season. The
 * strongest rival club in the active division fields the ones assigned to that
 * division; the four marked `scout` are on no club at all and can only be found
 * through a rumoured-hero scouting mission.
 *
 * Role is not a style choice — it is forced by the power, because ROLE_POOL
 * decides which roles can carry which power, and a hero who cannot fire is not
 * a hero. No shipped power is goalkeeper-compatible, so no special is a keeper.
 *
 * Development references only, exactly as the football-legend looks are: the
 * names are deliberate near-misses and no costume is reproduced.
 */
export interface SpecialHero {
  /** Stable across seasons and hosts: the character, not the shirt. */
  readonly id: string;
  readonly lookId: string;
  readonly name: string;
  readonly role: Exclude<Role, 'GK'>;
  readonly power: PowerId;
  /** The division whose strongest rival fields them, or `scout` for the four. */
  readonly placement: DivisionLevel | 'scout';
  /** Rank inside the host club. 1 is the best player on the pitch. */
  readonly order: number;
}

export const SPECIAL_HERO_ROSTER: readonly SpecialHero[] = [
  {
    id: 'special-f171',
    lookId: 'f171',
    name: 'Barry Allan',
    role: 'FWD',
    power: 'SUPER_SPEED',
    placement: 5,
    order: 1,
  },
  {
    id: 'special-f178',
    lookId: 'f178',
    name: 'Scott Somers',
    role: 'FWD',
    power: 'THUNDER_STRIKE',
    placement: 4,
    order: 1,
  },
  {
    id: 'special-f174',
    lookId: 'f174',
    name: 'Steve Rodgers',
    role: 'DEF',
    power: 'RALLY_CRY',
    placement: 3,
    order: 1,
  },
  {
    id: 'special-f177',
    lookId: 'f177',
    name: 'James Howlitt',
    role: 'MID',
    power: 'PHASE_RUN',
    placement: 3,
    order: 2,
  },
  {
    id: 'special-f176',
    lookId: 'f176',
    name: 'Bruno Bannor',
    role: 'DEF',
    power: 'SUPER_STRENGTH',
    placement: 2,
    order: 1,
  },
  {
    id: 'special-f172',
    lookId: 'f172',
    name: 'Pete Parkin',
    role: 'MID',
    power: 'WEB_TRAP',
    placement: 2,
    order: 2,
  },
  {
    id: 'special-f173',
    lookId: 'f173',
    name: 'Toni Starke',
    role: 'FWD',
    power: 'BLINK_RUN',
    placement: 2,
    order: 3,
  },
  {
    id: 'special-f168',
    lookId: 'f168',
    name: 'Bruce Wain',
    role: 'DEF',
    power: 'SHADOW_MARK',
    placement: 1,
    order: 1,
  },
  {
    id: 'special-f170',
    lookId: 'f170',
    name: 'Dinah Prince',
    role: 'MID',
    power: 'GRAVITY_WELL',
    placement: 1,
    order: 2,
  },
  {
    id: 'special-f169',
    lookId: 'f169',
    name: 'Clark Kentley',
    role: 'FWD',
    power: 'FIRE_TORCH',
    placement: 1,
    order: 3,
  },
  {
    id: 'special-f175',
    lookId: 'f175',
    name: 'Don Blaker',
    role: 'FWD',
    power: 'THUNDER_STRIKE',
    placement: 1,
    order: 4,
  },
  {
    id: 'special-f179',
    lookId: 'f179',
    name: 'Stefan Strangeway',
    role: 'MID',
    power: 'PORTAL_PASS',
    placement: 'scout',
    order: 1,
  },
  {
    id: 'special-f180',
    lookId: 'f180',
    name: 'Tchalo Adaku',
    role: 'DEF',
    power: 'SHADOW_MARK',
    placement: 'scout',
    order: 2,
  },
  {
    id: 'special-f181',
    lookId: 'f181',
    name: 'Arthur Currey',
    role: 'MID',
    power: 'ICE_RINK',
    placement: 'scout',
    order: 3,
  },
  {
    id: 'special-f182',
    lookId: 'f182',
    name: 'Oliver Quinn',
    role: 'DEF',
    power: 'FUTURE_SIGHT',
    placement: 'scout',
    order: 4,
  },
];

/** The club id a scout-only special carries until somebody signs them. */
export const SPECIAL_UNATTACHED_CLUB_ID = 'unattached';

export const SPECIAL_HERO_LOOK_IDS: readonly string[] = SPECIAL_HERO_ROSTER.map(
  (hero) => hero.lookId,
);

const SPECIAL_HERO_IDS = new Set(SPECIAL_HERO_ROSTER.map((hero) => hero.id));

export function isSpecialHeroId(playerId: string): boolean {
  return SPECIAL_HERO_IDS.has(playerId);
}

export function specialHeroesForDivision(
  division: DivisionLevel,
): readonly SpecialHero[] {
  return SPECIAL_HERO_ROSTER.filter((hero) => hero.placement === division)
    .slice()
    .sort((left, right) => left.order - right.order);
}

export function scoutOnlySpecialHeroes(): readonly SpecialHero[] {
  return SPECIAL_HERO_ROSTER.filter((hero) => hero.placement === 'scout')
    .slice()
    .sort((left, right) => left.order - right.order);
}

/** How far clear of the best ordinary player the weakest special sits. */
const LEAD_OVER_BEST_ORDINARY = 8;
/** Gap between consecutive specials at the same club, so the ranking is never a coin flip. */
const GAP_BETWEEN_SPECIALS = 3;

export function specialHeroTargetOverall(
  base: number,
  count: number,
  order: number,
): number {
  if (!Number.isSafeInteger(base) || base < 1)
    throw new Error('special hero base overall must be a positive integer');
  if (!Number.isSafeInteger(count) || count < 1)
    throw new Error('special hero count must be a positive integer');
  if (!Number.isSafeInteger(order) || order < 1 || order > count) {
    throw new Error('special hero order must be between 1 and the count');
  }
  return (
    base + LEAD_OVER_BEST_ORDINARY + GAP_BETWEEN_SPECIALS * (count - order)
  );
}

/**
 * Role shape, as offsets that sum to zero.
 *
 * `roleOverall` is the mean of the six outfield attributes and is identical for
 * DEF, MID and FWD — the role does not weight it. So "strong for the role"
 * cannot come out of the overall and has to be built into the spread. Because
 * the offsets sum to zero, applying them to a flat target leaves the mean, and
 * therefore the overall, exactly on target.
 */
const ROLE_OFFSETS: Readonly<
  Record<
    Exclude<Role, 'GK'>,
    Readonly<Record<keyof Omit<Attrs, 'ref'>, number>>
  >
> = {
  FWD: { pac: 10, sho: 16, pas: -4, def: -22, tec: 6, sta: -6 },
  MID: { pac: 0, sho: -14, pas: 16, def: -6, tec: 12, sta: -8 },
  DEF: { pac: 2, sho: -24, pas: -2, def: 20, tec: -4, sta: 8 },
};

/**
 * The role's attributes from most to least characteristic. Points that have to
 * be *added* go to the front of this list, and points that have to be *taken
 * away* come off the back — so paying for a clamp sharpens the role's profile
 * instead of flattening it.
 */
const ATTRIBUTES_BY_IMPORTANCE: Readonly<
  Record<Exclude<Role, 'GK'>, readonly (keyof Omit<Attrs, 'ref'>)[]>
> = {
  FWD: ['sho', 'pac', 'tec', 'sta', 'pas', 'def'],
  MID: ['pas', 'tec', 'pac', 'sta', 'def', 'sho'],
  DEF: ['def', 'sta', 'pac', 'tec', 'pas', 'sho'],
};

const OUTFIELD_ATTRIBUTES = ['pac', 'sho', 'pas', 'def', 'tec', 'sta'] as const;

/**
 * Builds the six outfield attributes so that `roleOverall` lands exactly on
 * `target` while the role's own stats carry the spike.
 *
 * The clamp handling conserves the sum rather than approximating it. A special
 * whose rating is a pixel off the number it claims is indistinguishable from a
 * balance decision, so the invariant is asserted here in production rather than
 * only in a test.
 */
export function specialHeroAttrs(
  role: Exclude<Role, 'GK'>,
  target: number,
): Attrs {
  if (
    !Number.isSafeInteger(target) ||
    target < 1 ||
    target > MAX_PLAYER_ATTRIBUTE
  ) {
    throw new Error(
      'special hero target overall must be a valid attribute value',
    );
  }
  const offsets = ROLE_OFFSETS[role];
  const values = new Map<keyof Omit<Attrs, 'ref'>, number>();
  const clamped = new Set<keyof Omit<Attrs, 'ref'>>();
  // Positive means the clamps left the sum too high, so points must come back off.
  let surplus = 0;
  for (const attribute of OUTFIELD_ATTRIBUTES) {
    const raw = target + offsets[attribute];
    const bounded = Math.min(MAX_PLAYER_ATTRIBUTE, Math.max(1, raw));
    if (bounded !== raw) clamped.add(attribute);
    surplus += bounded - raw;
    values.set(attribute, bounded);
  }
  // A floor clamp raises the sum and a ceiling clamp lowers it. Either way the
  // mean has moved, and only the attributes that did not clamp can pay it back.
  const importance = ATTRIBUTES_BY_IMPORTANCE[role];
  const givers = surplus > 0 ? [...importance].reverse() : importance;
  for (const attribute of givers) {
    if (surplus === 0) break;
    if (clamped.has(attribute)) continue;
    const current = values.get(attribute)!;
    if (surplus > 0) {
      const moved = Math.min(surplus, current - 1);
      values.set(attribute, current - moved);
      surplus -= moved;
    } else {
      const moved = Math.min(-surplus, MAX_PLAYER_ATTRIBUTE - current);
      values.set(attribute, current + moved);
      surplus += moved;
    }
  }
  if (surplus !== 0) {
    throw new Error(
      `special hero overall ${target} cannot be reached for a ${role}`,
    );
  }
  const attrs: Attrs = {
    pac: values.get('pac')!,
    sho: values.get('sho')!,
    pas: values.get('pas')!,
    def: values.get('def')!,
    tec: values.get('tec')!,
    sta: values.get('sta')!,
    // Never read by an outfield roleOverall, but the attribute is required and
    // assertAttributeValue rejects anything outside 1..MAX.
    ref: target,
  };
  const achieved = roleOverall(role, attrs);
  if (achieved !== target) {
    throw new Error(
      `special hero overall landed on ${achieved}, not ${target}`,
    );
  }
  return attrs;
}

export function validateSpecialHeroRoster(): void {
  const ids = new Set<string>();
  const looks = new Set<string>();
  for (const hero of SPECIAL_HERO_ROSTER) {
    if (ids.has(hero.id)) throw new Error(`duplicate special hero ${hero.id}`);
    if (looks.has(hero.lookId))
      throw new Error(`duplicate special hero look ${hero.lookId}`);
    ids.add(hero.id);
    looks.add(hero.lookId);
    if (!powerIsCompatibleWithRole(hero.power, hero.role)) {
      throw new Error(
        `${hero.name} cannot carry ${hero.power} as a ${hero.role}`,
      );
    }
  }
}
