import * as THREE from "three";

export const WALK_SPEED = 1.1;
export const WALK_FREQ = 6;
export const BOB_AMPLITUDE = 0.055;
export const LIMB_SWING = 0.32;
export const YAW_DAMP = 6;

/** Basic sinusoid phase from elapsed time. */
export function phase(t: number, offset = 0): number {
  return Math.sin(t * WALK_FREQ + offset);
}

/** Easing-friendly damp toward a target yaw. */
export function dampYaw(
  current: number,
  target: number,
  delta: number
): number {
  return THREE.MathUtils.damp(current, target, YAW_DAMP, delta);
}
