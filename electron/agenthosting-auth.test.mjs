import { describe, expect, it } from "vitest";
import {
  agentHostingHostedEnabled,
  resolveAgentHostingApiURL,
  resolveAgentHostingDashboardURL,
  storedAgentHostingToken,
} from "./agenthosting-auth.mjs";

describe("agenthosting-auth helpers", () => {
  it("defaults hosted mode on", () => {
    expect(agentHostingHostedEnabled({})).toBe(true);
    expect(agentHostingHostedEnabled({ AGENTHOSTING_HOSTED: "0" })).toBe(false);
    expect(agentHostingHostedEnabled({ AGENTHOSTING_HOSTED: "false" })).toBe(false);
  });

  it("resolves dashboard and API origins", () => {
    expect(resolveAgentHostingDashboardURL({})).toBe("https://dashboard.agenthosting.app");
    expect(resolveAgentHostingApiURL({})).toBe("https://api.agenthosting.app");
    expect(resolveAgentHostingApiURL({ AGENTHOSTING_API_URL: "http://127.0.0.1:8787/" })).toBe(
      "http://127.0.0.1:8787",
    );
  });

  it("only accepts ah_ tokens", () => {
    const good = `ah_${"a".repeat(64)}`;
    expect(storedAgentHostingToken({ agentHostingToken: good })).toBe(good);
    expect(storedAgentHostingToken({ agentHostingToken: "nope" })).toBe("");
  });
});
