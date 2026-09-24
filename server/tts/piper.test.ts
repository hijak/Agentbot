// The integrated Piper engine's pure pieces: sentence splitting, WAV
// encoding, and the synthesis flow over injected seams (the real
// phonemizer/onnx chain is proven against the verification fixture, where
// the pinned assets download for real).
import { describe, expect, it } from "vitest";

import {
  listPiperVoices,
  PIPER_VOICES,
  splitIntoSentences,
  synthesizePiper,
  wavBytes,
  type PiperSeams,
} from "./piper.ts";

describe("Piper sentence splitting", () => {
  it("turns the flat BOS/EOS stream into one id block per sentence", () => {
    // [1,0,55,0,10,0,2] is one sentence: BOS, h, i, EOS with pads.
    expect(splitIntoSentences([1, 0, 55, 0, 10, 0, 2])).toEqual([[1, 0, 55, 0, 10, 0, 2]]);
  });

  it("keeps the EOS that joins two sentences out of both blocks", () => {
    const ids = [1, 0, 55, 0, 2, 1, 0, 31, 0, 2];
    expect(splitIntoSentences(ids)).toEqual([
      [1, 0, 55, 0, 2],
      [1, 0, 31, 0, 2],
    ]);
  });

  it("drops leading ids that arrive before any BOS", () => {
    expect(splitIntoSentences([99, 1, 0, 55, 0, 2])).toEqual([[1, 0, 55, 0, 2]]);
  });

  it("ignores an unterminated trailing sentence rather than inventing an EOS", () => {
    expect(splitIntoSentences([1, 0, 55, 0, 2, 1, 0, 31])).toEqual([[1, 0, 55, 0, 2]]);
  });

  it("yields nothing for an empty or punctuation-only stream", () => {
    expect(splitIntoSentences([])).toEqual([]);
    expect(splitIntoSentences([3, 3, 3])).toEqual([]);
  });
});

describe("Piper WAV encoding", () => {
  it("writes a mono 16-bit PCM header with the voice's sample rate", () => {
    const bytes = wavBytes(Float32Array.from([0, 0.5, -0.5]), 22050);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = (offset: number) => String.fromCharCode(...Array.from(bytes.slice(offset, offset + 4)));
    expect(tag(0)).toBe("RIFF");
    expect(view.getUint32(4, true)).toBe(36 + 3 * 2);
    expect(tag(8)).toBe("WAVE");
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(22050);
    expect(view.getUint32(28, true)).toBe(44_100); // byte rate
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
    expect(tag(36)).toBe("data");
    expect(view.getUint32(40, true)).toBe(3 * 2);
  });

  it("clamps samples outside [-1, 1] instead of wrapping", () => {
    const bytes = wavBytes(Float32Array.from([2, -2]), 16000);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32767);
  });
});

describe("Piper synthesis (seamed)", () => {
  const settings: PiperSeams["settings"] = async () => ({
    espeakVoice: "en-us",
    sampleRate: 22050,
    scales: [0.667, 1, 0.8],
  });

  it("synthesizes text to wav bytes through every stage", async () => {
    const seen: Array<{ voice: string; ids: number[] }> = [];
    const seams: PiperSeams = {
      ensureAssets: async () => {},
      settings,
      phonemize: async (text) => (text.includes("!") ? [1, 0, 55, 0, 2, 1, 0, 31, 0, 2] : [1, 0, 55, 0, 2]),
      infer: async (voice, ids) => {
        seen.push({ voice, ids });
        return Float32Array.from([0.25, -0.25, 0.5]);
      },
    };
    const audio = await synthesizePiper("hello there!", "en_GB-alan-medium", seams);
    expect(audio.mime).toBe("audio/wav");
    expect(audio.bytes.byteLength).toBe(44 + 6 * 2); // six samples across two sentences
    expect(seen).toEqual([
      { voice: "en_GB-alan-medium", ids: [1, 0, 55, 0, 2] },
      { voice: "en_GB-alan-medium", ids: [1, 0, 31, 0, 2] },
    ]);
  });

  it("refuses a voice outside the curated catalogue before touching assets", async () => {
    let ensured = false;
    await expect(
      synthesizePiper("hi", "en_US-notacatalogue-medium", {
        ensureAssets: async () => {
          ensured = true;
        },
        settings,
        phonemize: async () => [1, 0, 2],
        infer: async () => Float32Array.from([0]),
      }),
    ).rejects.toThrow("unknown Piper voice");
    expect(ensured).toBe(false);
  });

  it("rejects text that phonemizes to nothing", async () => {
    await expect(
      synthesizePiper("... !?", "en_US-lessac-medium", {
        ensureAssets: async () => {},
        settings,
        phonemize: async () => [],
        infer: async () => Float32Array.from([0]),
      }),
    ).rejects.toThrow("phonemized to nothing");
  });

  it("exposes the curated list as the voice list", () => {
    expect(listPiperVoices()).toBe(PIPER_VOICES);
    expect(PIPER_VOICES.map((v) => v.id)).toContain("en_US-lessac-medium");
  });
});
