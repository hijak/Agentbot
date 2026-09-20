import { describe, expect, it } from "vitest";
import { teachTaskElapsed, teachTaskStatusLabel } from "./teach-a-task";

describe("Teach a Task host recording", () => {
  it("describes host-side lifecycle states", () => {
    expect(teachTaskStatusLabel("recording")).toBe("Recording on the hosted desktop");
    expect(teachTaskStatusLabel("processing")).toBe("Reconstructing and generalizing");
    expect(teachTaskStatusLabel("completed")).toBe("Skill ready");
  });

  it("formats elapsed recording time", () => {
    expect(teachTaskElapsed("2026-09-20T12:00:00.000Z", Date.parse("2026-09-20T12:01:05.000Z"))).toBe("1m 05s");
  });
});
