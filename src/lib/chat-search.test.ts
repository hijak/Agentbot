import { describe, expect, it } from "vitest";
import { fuzzyMessageMatch, fuzzySearch, fuzzyTitleScore } from "./chat-search";

describe("hosted chat fuzzy search", () => {
  it("finds case- and accent-insensitive substring matches", () => {
    expect(fuzzyTitleScore("Résumé review", "resume")).not.toBeNull();
    expect(fuzzySearch(["Release review", "Planning"], "REVIEW", (title) => title)).toEqual([
      "Release review",
    ]);
  });

  it("finds abbreviations as ordered character subsequences", () => {
    expect(fuzzySearch(["Fix sidebar regression", "Ship release"], "fsr", (title) => title)).toEqual([
      "Fix sidebar regression",
    ]);
  });

  it("ranks exact and word-start matches ahead of weaker fuzzy matches", () => {
    expect(
      fuzzySearch(
        ["Deploy release notes", "Release deployment", "Deep release discussion"],
        "release",
        (title) => title,
      ),
    ).toEqual(["Release deployment", "Deep release discussion", "Deploy release notes"]);
  });

  it("requires every term and preserves the original order for ties", () => {
    expect(
      fuzzySearch(["Fix sidebar regression", "Sidebar polish", "Fix prompts"], "fix sidebar", (title) => title),
    ).toEqual(["Fix sidebar regression"]);
    expect(fuzzySearch(["Alpha", "Bravo"], "a", (title) => title)).toEqual(["Alpha", "Bravo"]);
  });

  it("finds a matching message and returns a compact preview", () => {
    const messages = [
      { content: "I have started the deployment." },
      { content: "The production migration is complete and verified." },
    ];
    expect(fuzzyMessageMatch(messages, "prod migration")).toEqual({
      snippet: "The production migration is complete and verified.",
    });
  });

  it("limits a long message preview and omits non-matches", () => {
    const content = `Found deployment details: ${"a".repeat(120)}`;
    expect(fuzzyMessageMatch([{ content }], "deployment")).toEqual({
      snippet: `${content.slice(0, 100).trimEnd()}…`,
    });
    expect(fuzzyMessageMatch([{ content }], "missing")).toBeNull();
  });
});
