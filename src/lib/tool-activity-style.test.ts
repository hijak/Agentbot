import { describe, expect, it } from "vitest";

import { displayToolName, emojiForToolContent, summaryEmojisForTools } from "./tool-activity-style";

describe("tool-activity-style", () => {
  it("picks content emojis from tool names the way the dashboard does", () => {
    expect(emojiForToolContent("Bash")).toBe("💻");
    expect(emojiForToolContent("web_search")).toBe("🔍");
    expect(emojiForToolContent("Read")).toBe("💾");
    expect(emojiForToolContent("screenshot")).toBe("📸");
    expect(emojiForToolContent("mystery_tool")).toBe("🔨");
  });

  it("strips MCP prefixes and command suffixes for display", () => {
    expect(displayToolName("mcp__computer__click")).toBe("click");
    expect(displayToolName("Bash: pnpm test")).toBe("Bash");
  });

  it("caps distinct emojis on a folded run chip", () => {
    expect(
      summaryEmojisForTools([
        { name: "Bash" },
        { name: "Read" },
        { name: "web_search" },
        { name: "Write" },
        { name: "screenshot" },
        { name: "click" },
      ]),
    ).toEqual(["💻", "💾", "🔍", "📸", "🖱️"]);
  });
});
