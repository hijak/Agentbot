import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { foldActivity, ActivityTrail } from "./ActivityTrail";

describe("foldActivity", () => {
  it("settles the live status row when the first text chunk lands", () => {
    const live = foldActivity([], { type: "status", message: "Thinking…" });
    expect(live).toHaveLength(1);
    const settled = foldActivity(live, { type: "finalize" });
    expect(settled).toHaveLength(0);
  });

  it("keeps tool receipts across finalize and marks them done", () => {
    let entries = foldActivity([], { type: "tool_call", toolName: "Bash", input: "echo hi" });
    entries = foldActivity(entries, { type: "tool_result", toolName: "Bash", output: "hi" });
    const settled = foldActivity(entries, { type: "finalize" });
    expect(settled).toHaveLength(1);
    expect(settled[0]).toMatchObject({ kind: "tool_result", toolName: "Bash", state: "done" });
  });

  it("folds failures as error rows that survive finalize", () => {
    let entries = foldActivity([], { type: "tool_call", toolName: "Read" });
    entries = foldActivity(entries, { type: "error", message: "boom" });
    const settled = foldActivity(entries, { type: "finalize" });
    expect(settled.some((entry) => entry.state === "error")).toBe(true);
  });
});

describe("ActivityTrail", () => {
  it("collapses a finished run into a step summary with tool emojis", () => {
    let entries = foldActivity([], { type: "tool_call", toolName: "Bash" });
    entries = foldActivity(entries, { type: "tool_result", toolName: "Bash", output: "ok" });
    entries = foldActivity(entries, { type: "finalize" });
    const html = renderToStaticMarkup(createElement(ActivityTrail, { entries }));
    expect(html).toContain("1 step");
    expect(html).toContain("💻");
    expect(html).not.toContain("Step 1");
    const liveHtml = renderToStaticMarkup(
      createElement(ActivityTrail, { entries, live: true }),
    );
    expect(liveHtml).toContain("Step 1");
  });
});
