import * as TWEEN from "@tweenjs/tween.js";

export type EaseName = "linear" | "cubicInOut" | "quadOut" | "expoInOut";

const EASINGS: Record<EaseName, (k: number) => number> = {
  linear: TWEEN.Easing.Linear.None,
  cubicInOut: TWEEN.Easing.Cubic.InOut,
  quadOut: TWEEN.Easing.Quadratic.Out,
  expoInOut: TWEEN.Easing.Exponential.InOut,
};

export function tweenValue(
  from: number,
  to: number,
  durationMs: number,
  ease: EaseName,
  onUpdate: (v: number) => void,
  onComplete?: () => void,
): TWEEN.Tween<{ v: number }> {
  const obj = { v: from };
  const tween = new TWEEN.Tween(obj)
    .to({ v: to }, durationMs)
    .easing(EASINGS[ease])
    .onUpdate(() => onUpdate(obj.v));
  if (onComplete) tween.onComplete(onComplete);
  tween.start();
  return tween;
}

export function updateTweens(now: number) {
  TWEEN.update(now);
}
