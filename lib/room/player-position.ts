import * as THREE from "three";

/**
 * Player movement bounds inside the room. Defined here so both the runtime
 * clamp (player-character.tsx) and tests can share the single source of truth.
 *
 * - X span: -9 to 9 keeps the player away from the east/west walls (bookshelf
 *   at x=9.9, wall TV at x=-9.9).
 * - Z span: -1.4 to 5.6 keeps the player out of the north-wall station strip
 *   (z<=-2) and away from the back wall windows (z=-5).
 */
export const BOUNDS = { minX: -9, maxX: 9, minZ: -1.4, maxZ: 5.6 } as const;

/**
 * Spawn point chosen to land the player in the open lobby area south of the
 * stations and north of the sofa/coffee-table cluster. Constraints satisfied:
 *
 * - Inside BOUNDS (z=1.0 is well inside [-1.4, 5.6]).
 * - >= 1m from every station on the north wall (nearest is "submit" at
 *   [5.0, 0, -2.0], ~5.83m away; "review" at [0.8, 0, -3.4] is ~4.47m away).
 * - >= 1m from every furniture footprint:
 *   - Sofa center [0, 0, 3.0]: 2.0m (sofa front face at z=3.65 is 1.35m away).
 *   - Coffee table [0, 0, 4.6]: 3.6m.
 *   - Floor lamp [-1.7, 0, 4.2]: 3.62m.
 *   - Plants (fern, palm, succulent): all > 5m.
 *   - Bookshelf [9.9, 0, 1.8]: 9.93m.
 *
 * Player faces -Z (toward the desks) so the user immediately sees the agent
 * stations on first paint.
 */
export const SPAWN_POINT: readonly [number, number, number] = [0, 0, 1.0];
export const SPAWN_FACING: number = Math.PI; // facing -Z (toward desks)

export const playerPosition = new THREE.Vector3(SPAWN_POINT[0], SPAWN_POINT[1], SPAWN_POINT[2]);
export const playerActive = { current: false };
