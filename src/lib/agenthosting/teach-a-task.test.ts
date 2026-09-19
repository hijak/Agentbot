import { describe, expect, it } from "vitest";
import {
  buildTeachTaskPrompt,
  describeDesktopClick,
  describeDesktopKey,
} from "./teach-a-task";

describe("Teach a Task demonstration", () => {
  it("records relative click evidence", () => {
    expect(
      describeDesktopClick(150, 75, { left: 50, top: 25, width: 400, height: 200 }),
    ).toBe("Clicked near 25% from the left and 25% from the top.");
  });

  it("withholds typed text but keeps navigation and shortcuts", () => {
    expect(describeDesktopKey({ key: "s" })).toBe("Typed text (content withheld).");
    expect(describeDesktopKey({ key: "Enter" })).toBe("Pressed Enter.");
    expect(describeDesktopKey({ key: "v", metaKey: true })).toBe("Pressed Command+V.");
  });

  it("asks for a semantic skill without leaking typed values", () => {
    const secret = "correct horse battery staple";
    const prompt = buildTeachTaskPrompt({
      name: "Submit the weekly report",
      notes: "Use the Finance workspace",
      durationMs: 12_450,
      events: [
        { atMs: 100, description: "Clicked near 20% from the left and 30% from the top." },
        { atMs: 200, description: "Typed text (content withheld)." },
      ],
      screenshots: [
        new File(["image"], "teach-start.jpg", { type: "image/jpeg" }),
      ],
    });

    expect(prompt).toContain("I demonstrated this task in Open Computer: Submit the weekly report");
    expect(prompt).toContain("Finance workspace");
    expect(prompt).toContain("never write a coordinate-replay macro");
    expect(prompt).toContain("teach-start.jpg");
    expect(prompt).not.toContain(secret);
  });
});
