import * as THREE from "three";

// Spawn point chosen to keep the player in the open lobby area on the
// south side of the room (z > 0), well clear of all interactive stations
// which sit on the north wall (z <= -2). |z| >= 2 satisfies the desk
// collision guard; the nearest station is the "review" desk at
// [0.8, 0, -3.4], ~7.4m away from this spawn.
export const SPAWN_POINT: readonly [number, number, number] = [0, 0, 4];
export const SPAWN_FACING: number = Math.PI; // facing -Z (toward desks)

export const playerPosition = new THREE.Vector3(SPAWN_POINT[0], SPAWN_POINT[1], SPAWN_POINT[2]);
export const playerActive = { current: false };
