export type DeskPosition = {
  position: readonly [number, number, number];
  facing: number; // radians
};

export const RECRUITER_ARC_RADIUS = 7;
export const RECRUITER_ARC_CENTER: readonly [number, number, number] = [0, 0, -2];
export const RECRUITER_ANGLES_DEG = [-40, -20, 0, 20, 40];

export function deskPositionForIndex(index: number): DeskPosition {
  const angleDeg = RECRUITER_ANGLES_DEG[index] ?? 0;
  const angleRad = (angleDeg * Math.PI) / 180;
  const x = RECRUITER_ARC_CENTER[0] + Math.sin(angleRad) * RECRUITER_ARC_RADIUS;
  const z = RECRUITER_ARC_CENTER[2] - Math.cos(angleRad) * RECRUITER_ARC_RADIUS;
  return {
    position: [x, 0, z],
    facing: Math.PI - angleRad,
  };
}
