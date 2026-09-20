import { describe, expect, it } from "vitest";
import { frameLooksBlankFromLuma } from "./open-computer-frame";

function flat(lum: number, count = 48 * 27): Float64Array {
  return Float64Array.from({ length: count }, () => lum);
}

describe("frameLooksBlankFromLuma", () => {
  it("treats near-black frames as blank", () => {
    expect(frameLooksBlankFromLuma(flat(0.02))).toBe(true);
  });

  it("treats flat mid-tone washes as blank", () => {
    expect(frameLooksBlankFromLuma(flat(0.25))).toBe(true);
  });

  it("accepts a high-contrast desktop-like sample", () => {
    const samples = flat(0.12);
    for (let i = 0; i < samples.length; i += 3) samples[i] = 0.85;
    for (let i = 1; i < samples.length; i += 7) samples[i] = 0.55;
    expect(frameLooksBlankFromLuma(samples)).toBe(false);
  });
});
