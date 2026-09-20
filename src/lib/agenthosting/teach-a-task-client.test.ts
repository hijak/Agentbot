import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cancelHostedTeachSession,
  getActiveHostedTeachSession,
  getHostedTeachSession,
  startHostedTeachSession,
  stopHostedTeachSession,
  type HostedSession,
} from "./client";

const session: HostedSession = {
  hosted: true,
  token: "test-token",
  apiURL: "https://api.example.test",
  dashboardURL: "https://dashboard.example.test",
  selectedAgentId: "agent-1",
};

afterEach(() => vi.unstubAllGlobals());

describe("hosted Teach a Task API", () => {
  it("uses the Open Computer host recording endpoints", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push([url, init]);
      return new Response(JSON.stringify({
        id: "teach-1",
        name: "File report",
        notes: "",
        status: "recording",
        startedAt: "2026-09-20T12:00:00.000Z",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    await startHostedTeachSession(session, "surface/1", { name: "File report" });
    await getActiveHostedTeachSession(session, "surface/1");
    await getHostedTeachSession(session, "surface/1", "teach 1");
    await stopHostedTeachSession(session, "surface/1", "teach 1");
    await cancelHostedTeachSession(session, "surface/1", "teach 1");

    expect(calls.map(([url, init]) => [url, init?.method ?? "GET"])).toEqual([
      ["https://api.example.test/agent-extensions/open-computer/surface%2F1/api/v1/teach-sessions", "POST"],
      ["https://api.example.test/agent-extensions/open-computer/surface%2F1/api/v1/teach-sessions/active", "GET"],
      ["https://api.example.test/agent-extensions/open-computer/surface%2F1/api/v1/teach-sessions/teach%201", "GET"],
      ["https://api.example.test/agent-extensions/open-computer/surface%2F1/api/v1/teach-sessions/teach%201/stop", "POST"],
      ["https://api.example.test/agent-extensions/open-computer/surface%2F1/api/v1/teach-sessions/teach%201", "DELETE"],
    ]);
    expect(new Headers(calls[0]![1]?.headers).get("Authorization")).toBe("Bearer test-token");
  });
});
