import { describe, expect, it } from "vitest";

import { liveActivityLabel } from "./live-activity";
import type { Message } from "@/state/store";

const activity = (name: string, extra: Partial<NonNullable<Message["tool"]>> = {}): Message => ({
  id: "activity",
  at: 1,
  role: "bot",
  kind: "activity",
  tool: { ...extra, name },
});

describe("liveActivityLabel", () => {
  it("shows thinking before a tool starts and after it settles", () => {
    expect(liveActivityLabel()).toBe("Thinking…");
    expect(liveActivityLabel(activity("Read", { ok: true }))).toBe("Thinking…");
  });

  it("uses the server's narration for the exact live action", () => {
    expect(liveActivityLabel(activity("Edit", { spoken: "editing a file" }))).toBe(
      "Editing a file",
    );
  });

  it("mirrors the dashboard Using … copy for live tool names", () => {
    expect(liveActivityLabel(activity("Bash: pnpm test"))).toBe("Using Bash…");
    expect(liveActivityLabel(activity("mcp__computer__click"))).toBe("Using click…");
    expect(liveActivityLabel(activity("web_search"))).toBe("Using web_search…");
    expect(liveActivityLabel(activity("delegate_bot"))).toBe("Using delegate_bot…");
  });

  it("does not present bot-to-bot communication chips as the active action", () => {
    expect(
      liveActivityLabel({
        ...activity("ask_bot"),
        comm: { groupId: "room", withBotId: "bot", withName: "Peer", withColor: "blue" },
      }),
    ).toBe("Thinking…");
  });
});
