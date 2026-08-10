/**
 * One establishing-shot composition shared by all five square backdrops.
 *
 * Showing substantially more of the art, bottom anchored, makes the location
 * readable. The hero stands on the same authored stage mark in every scene; on
 * Bruce's backdrop that mark is the foreground cave stair instead of a
 * centre-cropped rock wall.
 */
export interface RivalHeroSceneComposition {
  readonly backdropZoom: number;
  readonly backdropAnchorX: number;
  readonly backdropAnchorY: number;
  readonly heroX: number;
  readonly heroY: number;
}

/** Mobile centres the square stage so its top and bottom letterboxes match. */
export const RIVAL_HERO_PORTRAIT_COMPOSITION: RivalHeroSceneComposition =
  Object.freeze({
    backdropZoom: 1.08,
    backdropAnchorX: 0.5,
    backdropAnchorY: 0.5,
    heroX: 0.5,
    heroY: 0.88,
  });

/** Wide screens balance source coverage with a stronger environmental footprint. */
export const RIVAL_HERO_LANDSCAPE_COMPOSITION: RivalHeroSceneComposition =
  Object.freeze({
    backdropZoom: 1.35,
    backdropAnchorX: 0.5,
    backdropAnchorY: 1,
    heroX: 0.5,
    heroY: 0.88,
  });

export function rivalHeroSceneComposition(
  width: number,
  height: number,
): RivalHeroSceneComposition {
  return height >= width
    ? RIVAL_HERO_PORTRAIT_COMPOSITION
    : RIVAL_HERO_LANDSCAPE_COMPOSITION;
}
