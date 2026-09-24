import { describe, expect, it } from "vitest";
import { cleanForSpeech, takeSpeakableChunks } from "./speech-chunks";

describe("takeSpeakableChunks", () => {
  it("returns finished sentences and holds back the one still streaming", () => {
    const text = "Sure, I can help with that. The meeting is at three. And the";
    const { chunks, consumed } = takeSpeakableChunks(text, false);
    expect(chunks).toEqual(["Sure, I can help with that.", "The meeting is at three."]);
    expect(text.slice(consumed)).toBe(" And the");
  });

  it("waits for whitespace after punctuation before splitting", () => {
    // "3." could still become "3.5" on the next delta.
    expect(takeSpeakableChunks("The price went up by 3.", false).chunks).toEqual([]);
  });

  it("flushes the remainder once the reply is final", () => {
    const { chunks, consumed } = takeSpeakableChunks("Sure thing. Done", true);
    expect(chunks).toEqual(["Sure thing. Done"]);
    expect(consumed).toBe("Sure thing. Done".length);
  });

  it("merges short fragments into the next sentence", () => {
    expect(takeSpeakableChunks("Hi. Here is what I found today. ", false).chunks).toEqual([
      "Hi. Here is what I found today.",
    ]);
  });

  it("does not split numbered list markers or years", () => {
    const { chunks } = takeSpeakableChunks("1. Book the flight for May 2024. Then\n", false);
    expect(chunks).toEqual(["Book the flight for May 2024. Then"]);
  });

  it("treats line breaks as boundaries", () => {
    const { chunks } = takeSpeakableChunks("- Milk and eggs\n- Bread and butter\n", false);
    expect(chunks).toEqual(["Milk and eggs", "Bread and butter"]);
  });

  it("returns nothing for an empty tail", () => {
    expect(takeSpeakableChunks("", true)).toEqual({ chunks: [], consumed: 0 });
  });
});

describe("cleanForSpeech", () => {
  it("drops markdown symbols and keeps link text", () => {
    expect(cleanForSpeech("## **Bold** and `code` see [docs](https://x.y)")).toBe(
      "Bold and code see docs",
    );
  });

  it("removes fenced code blocks", () => {
    expect(cleanForSpeech("Run this:\n```sh\nls -la\n```\nthen check.")).toBe("Run this: then check.");
  });
});
