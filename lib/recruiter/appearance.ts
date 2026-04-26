export type RecruiterAppearance = {
  hairColor: string;
  skinTone: string;
  outfitColor: string;
  bodyVariant: 0 | 1 | 2;
  accessory: "none" | "glasses" | "clipboard" | "coffee" | "laptop";
  hairStyle: 0 | 1 | 2 | 3;
};

const HAIR = ["#1f1611", "#3b2418", "#5a4022", "#8b6635", "#b8853b", "#a1a1a1", "#222831", "#4f1f1f"];
const SKIN = ["#f3d3b1", "#e0a98a", "#bd8a64", "#8d5a3e", "#5a3a2a"];
const OUTFIT = ["#2d3a4a", "#3a4d5b", "#5a6b7d", "#3a4f3a", "#5a3a3a", "#3a3a5a", "#5a4a2a", "#444444"];
const ACCESSORY = ["none", "glasses", "clipboard", "coffee", "laptop"] as const;

export function generateAppearance(seed: number): RecruiterAppearance {
  const r = mulberry32(seed);
  return {
    hairColor: HAIR[Math.floor(r() * HAIR.length)],
    skinTone: SKIN[Math.floor(r() * SKIN.length)],
    outfitColor: OUTFIT[Math.floor(r() * OUTFIT.length)],
    bodyVariant: Math.floor(r() * 3) as 0 | 1 | 2,
    accessory: ACCESSORY[Math.floor(r() * ACCESSORY.length)],
    hairStyle: Math.floor(r() * 4) as 0 | 1 | 2 | 3,
  };
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
