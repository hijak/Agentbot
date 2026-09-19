/**
 * Deterministic complementary colors for agent/bot blob avatars.
 * Ported from agenthosting.app `dashboard/src/lib/agent-colors.ts`.
 */

function generateRandomHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const goldenRatioConjugate = 0.618033988749895;
  const randomValue = Math.abs(Math.sin(hash) * 10000) % 1;
  return ((randomValue + goldenRatioConjugate) % 1) * 360;
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Four harmonious hex colors from a stable seed (agent id / bot name). */
export function generateAgentColors(seed: string): string[] {
  const baseHue = generateRandomHue(seed);
  return [
    hslToHex(baseHue, 0.85, 0.55),
    hslToHex((baseHue + 180) % 360, 0.75, 0.55),
    hslToHex((baseHue + 120) % 360, 0.7, 0.5),
    hslToHex((baseHue + 60) % 360, 0.8, 0.5),
  ];
}
