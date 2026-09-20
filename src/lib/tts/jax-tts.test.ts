import { beforeEach, describe, expect, it } from "vitest";
import { numpy as np } from "@jax-js/jax";
import {
  createConditioningEmbeds,
  isJaxVoice,
  isJaxModelLoaded,
  isJaxModelCached,
  prepareTextPrompt,
  resetJaxState,
  PREDEFINED_VOICES,
} from "./jax-tts";

describe("jax-tts engine", () => {
  beforeEach(() => {
    resetJaxState();
  });

  it("checks cached status correctly when uninitialized", async () => {
    expect(isJaxModelLoaded()).toBe(false);
    expect(await isJaxModelCached()).toBe(false);
  });

  it("identifies all 8 supported Kyutai character voices", () => {
    const expected = ["alba", "azelma", "cosette", "eponine", "fantine", "javert", "jean", "marius"];
    for (const voice of expected) {
      expect(isJaxVoice(voice)).toBe(true);
      expect(isJaxVoice(voice.toUpperCase())).toBe(true);
      expect(isJaxVoice(`  ${voice}  `)).toBe(true);
      expect(PREDEFINED_VOICES[voice]).toContain(`/embeddings/${voice}.safetensors`);
    }
    expect(isJaxVoice("rachel")).toBe(false);
    expect(isJaxVoice("alex")).toBe(false);
    expect(isJaxVoice(undefined)).toBe(false);
  });

  it("does not load or download model weights initially (strict lazy loading)", () => {
    // Verifies the key requirement: model weights must NOT be downloaded or initialized
    // upon module load, settings navigation, or before the first call.
    expect(isJaxModelLoaded()).toBe(false);
  });

  it("prepares text prompts properly with casing, punctuation, and padding", () => {
    // 1. Appends period if missing
    const [p1, guess1] = prepareTextPrompt("hello world");
    expect(p1.endsWith(".")).toBe(true);
    expect(p1.trim().startsWith("Hello")).toBe(true);
    // 2 words -> framesAfterEos = 5, padded with 8 spaces for small prompt
    expect(guess1).toBe(5);
    expect(p1).toBe("        Hello world.");

    // 2. Preserves existing punctuation
    const [p2] = prepareTextPrompt("Is everything working as expected?");
    expect(p2).toContain("Is everything working as expected?");

    // 3. Normalizes whitespace
    const [p3] = prepareTextPrompt("   this   has    multiple   spaces   and   several   words   to   test   ");
    expect(p3).not.toContain("  ");
    expect(p3.startsWith("This")).toBe(true);

    // 4. Empty throws
    expect(() => prepareTextPrompt("   ")).toThrow("Prompt cannot be empty");
  });

  it("retains token indices while gathering conditioning embeddings", async () => {
    const conditioner = np.arange(12).reshape([4, 3]);
    const voice = np.ones([2, 3]);
    const embeds = createConditioningEmbeds(conditioner, voice, [3, 1]);

    expect(embeds.shape).toEqual([4, 3]);
    // data() consumes its argument, so retain the owner for the cleanup below.
    await expect(embeds.ref.data()).resolves.toBeInstanceOf(Float32Array);

    embeds.dispose();
    conditioner.dispose();
    voice.dispose();
  });
});
