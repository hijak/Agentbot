import { describe, expect, it } from "vitest";
import { fuzzySearch, fuzzyTitleScore } from "./hosted-chat-search";

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
});
