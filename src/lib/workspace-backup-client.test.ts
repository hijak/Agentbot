import { describe, expect, it } from "vitest";
import { applyWorkspaceClientState, collectWorkspaceClientState } from "./workspace-backup-client";

function memory(values: Record<string, string>) {
  const entries = new Map(Object.entries(values));
  return { entries, getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); }, removeItem: (key: string) => { entries.delete(key); } };
}

describe("full-backup browser state", () => {
  it("exports exact app drafts/preferences, never saved webhook credentials or auth/cache keys", () => {
    const storage = memory({ "agentbot-drafts": "draft", "agentbot-webhook-credentials": "private URL", "agentbot-skin": "daylight", "auth-token": "secret", "agentbot-connected-apps": "cached accounts", "agentbot-email-gate": "identity", "agentbot-pending-workspace-restore": "old" });
    expect(collectWorkspaceClientState(storage)).toEqual({ "agentbot-drafts": "draft", "agentbot-skin": "daylight" });
  });

  it("replaces only allowlisted keys and clears old drafts absent from the backup", () => {
    const storage = memory({ "agentbot-drafts": "old", "agentbot-draft-attachments": "old attachment", "auth-token": "keep", "agentbot-webhook-credentials": "destination URL" });
    applyWorkspaceClientState({ "agentbot-drafts": "restored", "agentbot-show-threads": "false" }, storage);
    expect(Object.fromEntries(storage.entries)).toEqual({ "agentbot-drafts": "restored", "agentbot-show-threads": "false", "auth-token": "keep", "agentbot-webhook-credentials": "destination URL" });
  });

  it.each([null, [], { "auth-token": "injected" }, { "agentbot-webhook-credentials": "source URL" }, { "agentbot-drafts": 1 }])("rejects invalid client state before clearing anything (%j)", (value) => {
    const storage = memory({ "agentbot-drafts": "old", "auth-token": "keep" });
    expect(() => applyWorkspaceClientState(value, storage)).toThrow("Invalid backup browser state");
    expect(Object.fromEntries(storage.entries)).toEqual({ "agentbot-drafts": "old", "auth-token": "keep" });
  });

  it("rolls browser state back if restored values exceed storage quota", () => {
    const storage = memory({ "agentbot-drafts": "old", "agentbot-skin": "daylight", "auth-token": "keep" });
    const original = storage.setItem;
    storage.setItem = (key, value) => { if (value === "too large") throw new Error("quota"); original(key, value); };
    expect(() => applyWorkspaceClientState({ "agentbot-drafts": "too large" }, storage)).toThrow("quota");
    expect(Object.fromEntries(storage.entries)).toEqual({ "agentbot-drafts": "old", "agentbot-skin": "daylight", "auth-token": "keep" });
  });
});
