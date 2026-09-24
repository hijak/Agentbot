import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { foldActivity } from "./ActivityTrail";
import { isHollowThought, ThoughtTrail } from "./ThoughtTrail";

function markup(entries: ReturnType<typeof foldActivity>, live = false) {
  return renderToStaticMarkup(createElement(ThoughtTrail, { entries, live }));
}

describe("ThoughtTrail", () => {
  it("renders the thinking disclosure and a running tool card while live", () => {
    let entries = foldActivity([], { type: "status", message: "Thinking…" });
    entries = foldActivity(entries, {
      type: "tool_call",
      toolName: "Bash",
      message: "Running a command",
      input: "echo hi",
    });
    const html = markup(entries, true);
    expect(html).toContain("Thinking");
    expect(html).toContain("Bash");
    expect(html).toContain("Running");
  });

  it("renders finished tool calls as done cards with receipts", () => {
    let entries = foldActivity([], { type: "tool_call", toolName: "Bash", input: "echo hi" });
    entries = foldActivity(entries, { type: "tool_result", toolName: "Bash", output: "hi" });
    entries = foldActivity(entries, { type: "finalize" });
    const html = markup(entries);
    expect(html).toContain("Bash");
    expect(html).toContain("Done");
    expect(html).toContain("bg-emerald-500");
    expect(html).not.toContain("Thinking");
  });

  it("marks failed steps as Failed", () => {
    let entries = foldActivity([], { type: "tool_call", toolName: "Read" });
    entries = foldActivity(entries, { type: "error", message: "boom" });
    entries = foldActivity(entries, { type: "finalize" });
    const html = markup(entries);
    expect(html).toContain("Failed");
    expect(html).toContain("bg-red-500");
    expect(html).toContain("boom");
  });

  it("renders steps without input or output as static, non-expandable rows", () => {
    let entries = foldActivity([], { type: "tool_call", toolName: "WebSearch", message: "Looking it up" });
    entries = foldActivity(entries, { type: "tool_result", toolName: "WebSearch", message: "Found it" });
    entries = foldActivity(entries, { type: "finalize" });
    const html = markup(entries);
    expect(html).toContain("WebSearch");
    expect(html).toContain("Done");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("aria-expanded");
  });

  it("renders nothing for an empty, non-live run", () => {
    expect(markup([])).toBe("");
  });

  it("hides the placeholder thinking row once the reply is streaming", () => {
    const entries = foldActivity([], { type: "status", message: "Thinking…" });
    const html = renderToStaticMarkup(
      createElement(ThoughtTrail, { entries, live: true, reply: "Here is the answer." }),
    );
    expect(html).toBe("");
  });
});

describe("isHollowThought", () => {
  const reply = "Sure — the build failed because the **lockfile** is out of date. Run `pnpm install` and retry.";

  it("treats the seeded placeholder as hollow", () => {
    expect(isHollowThought("Thinking…")).toBe(true);
    expect(isHollowThought("Working...")).toBe(true);
  });

  it("treats status lines that repeat the reply as hollow", () => {
    expect(isHollowThought(reply, reply)).toBe(true);
    expect(isHollowThought("Sure — the build failed because the lockfile is out of date…", reply)).toBe(true);
    expect(isHollowThought(`${reply} Let me know if that helps.`, reply)).toBe(true);
  });

  it("keeps genuine reasoning", () => {
    expect(isHollowThought("Checking the CI logs for the failing step", reply)).toBe(false);
    expect(isHollowThought("Reading the diff…", "")).toBe(false);
  });
});
