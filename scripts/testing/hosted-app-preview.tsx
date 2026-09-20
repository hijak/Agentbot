// Browser mock of the new hosted (Andromeda) interface for UI editing.
//
// Serves the REAL HostedApp with an in-memory fake backend: window.ogb is
// stubbed so isHostedMode() is true, and every fetch to the mock apiURL is
// answered from local fixtures. Nothing leaves the browser; no Electron,
// no dashboard, no live data.
//
// Run: node --experimental-strip-types scripts/verify-hosted-app.ts
// then open the printed URL. Vite HMR applies src/ edits live.
import { createRoot } from "react-dom/client";
import { App } from "../../src/App";
import { DesktopCapabilitiesProvider } from "../../src/components/DesktopCapabilities";
import "../../src/styles.css";

const MOCK_API = "https://preview.agenthosting.local";
const AGENT_ID = "preview-agent";

type MockMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

// --- In-memory fake backend -------------------------------------------------

const now = new Date().toISOString();
const agent = {
  id: AGENT_ID,
  name: "Pulse",
  status: "online",
  modelProvider: "anthropic",
  modelName: "claude-sonnet-4-5",
  createdAt: now,
  updatedAt: now,
};

let bots = [
  {
    name: "researcher",
    title: "Researcher",
    description: "Digs up docs and prior art.",
    soul: "Curious, thorough, cites sources.",
    routines: [{ name: "Morning brief", schedule: "0 9 * * *", prompt: "Summarize overnight mentions." }],
  },
  {
    name: "engineer",
    title: "Engineer",
    description: "Writes and reviews code.",
    soul: "Pragmatic, terse, tests everything.",
    routines: [],
  },
];

let chatSessions = [
  {
    id: "sess-welcome",
    agentId: AGENT_ID,
    title: "Welcome walkthrough",
    source: null as string | null,
    sourceLabel: null as string | null,
    createdAt: now,
    updatedAt: now,
    messageCount: 2,
  },
];

const chatMessages: Record<string, MockMessage[]> = {
  "sess-welcome": [
    {
      id: "m1",
      role: "user",
      content: "What can you do?",
      createdAt: now,
    },
    {
      id: "m2",
      role: "assistant",
      content:
        "I'm **Pulse**, a mock agent for editing the hosted UI.\n\n- Send a message below to see the fake SSE stream\n- Open **Bots**, **Rooms**, or **Schedule** in the sidebar\n- Edits under `src/pair/` hot-reload here",
      createdAt: now,
    },
  ],
};

let schedules = [
  {
    id: "job-morning",
    name: "Morning brief",
    schedule: "0 9 * * *",
    prompt: "Summarize overnight mentions.",
    enabled: true,
    nextRun: null as string | null,
    lastStatus: null as string | null,
  },
];

const templates = [
  {
    id: "tpl-standup",
    name: "Standup crew",
    category: "team",
    scenario: "Daily async standup",
    description: "A facilitator plus a scribe for async standups.",
    bots: [
      {
        name: "facilitator",
        title: "Facilitator",
        description: "Runs the standup.",
        soul: "Warm, organized, keeps it short.",
        routines: [],
      },
    ],
  },
];

let chatroomState = {
  activeRoomId: "room-standup",
  roomsColumnCollapsed: false,
  rooms: [
    {
      id: "room-standup",
      name: "Standup",
      selectedIds: [`${AGENT_ID}:bot:researcher`, `${AGENT_ID}:bot:engineer`],
      input: "",
      messages: [
        {
          id: "rm1",
          role: "agent",
          agentId: AGENT_ID,
          agentName: "Pulse",
          content: "Mock room message — the chatroom view renders here.",
          createdAt: Date.now(),
        },
      ],
      discussionRounds: 1 as const,
      sessionIds: {} as Record<string, string>,
    },
  ],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function sseReply(sessionId: string): Response {
  const encoder = new TextEncoder();
  const frames = [
    { type: "status", status: "Thinking…" },
    { type: "text", content: "Mock reply: the hosted prompt bar, " },
    { type: "text", content: "SSE streaming, and transcript bubbles all work in this preview." },
    { type: "done", sessionId },
  ];
  const stream = new ReadableStream({
    start(controller) {
      for (const frame of frames) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "x-chat-session-id": sessionId },
  });
}

const realFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith(MOCK_API)) return realFetch(input, init);
  const method = (init?.method ?? "GET").toUpperCase();
  const path = url.slice(MOCK_API.length);
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;

  const sessionMatch = path.match(/^\/api\/agents\/([^/]+)\/chat\/sessions(?:\/([^/]+))?$/);

  if (method === "GET" && path === `/api/agents/${AGENT_ID}`) return json({ agent });
  if (method === "GET" && path === "/api/keys") {
    return json({
      keys: [
        { provider: "anthropic", defaultModel: "claude-sonnet-4-5", extraModels: ["claude-opus-4-1"] },
        { provider: "openai", defaultModel: "gpt-5", extraModels: [] },
      ],
    });
  }
  if (method === "GET" && path === `/api/agents/${AGENT_ID}/chat/sessions`) {
    return json({ sessions: chatSessions });
  }
  if (method === "POST" && path === `/api/agents/${AGENT_ID}/chat/sessions`) {
    const created = {
      id: `sess-${Math.random().toString(36).slice(2, 8)}`,
      agentId: AGENT_ID,
      title: null,
      source: (body?.context as string | undefined) ?? null,
      sourceLabel: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 0,
    };
    chatSessions = [created, ...chatSessions];
    chatMessages[created.id] = [];
    return json({ session: created });
  }
  if (sessionMatch && method === "GET" && sessionMatch[2]) {
    const id = sessionMatch[2];
    const session = chatSessions.find((s) => s.id === id);
    if (!session) return json({ error: "not found" }, 404);
    return json({ session, messages: chatMessages[id] ?? [] });
  }
  if (sessionMatch && method === "DELETE" && sessionMatch[2]) {
    const id = sessionMatch[2];
    chatSessions = chatSessions.filter((s) => s.id !== id);
    delete chatMessages[id];
    return json({});
  }
  if (method === "POST" && path === `/api/agents/${AGENT_ID}/chat`) {
    const target = (body?.sessionId as string | undefined) ?? "sess-welcome";
    return sseReply(target);
  }
  if (method === "POST" && path === `/api/agents/${AGENT_ID}/chat/stop`) return json({});
  if (method === "GET" && path === `/api/agents/${AGENT_ID}/bots`) {
    return json({ ok: true, bots, maxBots: 6, tier: "preview" });
  }
  if (method === "POST" && path === `/api/agents/${AGENT_ID}/bots`) {
    const created = {
      name: (body?.name as string | undefined) ?? `bot-${bots.length + 1}`,
      title: (body?.title as string | undefined) ?? "Untitled",
      description: body?.description as string | undefined,
      soul: body?.soul as string | undefined,
      routines: (body?.routines as typeof bots[number]["routines"] | undefined) ?? [],
    };
    bots = [...bots, created];
    return json({ bot: created });
  }
  const botMatch = path.match(/^\/api\/agents\/([^/]+)\/bots\/([^/]+)$/);
  if (botMatch && (method === "PATCH" || method === "DELETE")) {
    const name = decodeURIComponent(botMatch[2]);
    if (method === "DELETE") {
      bots = bots.filter((b) => b.name !== name);
      return json({});
    }
    bots = bots.map((b) => (b.name === name ? { ...b, ...body } : b));
    return json({ bot: bots.find((b) => b.name === name) });
  }
  if (method === "POST" && path === `/api/agents/${AGENT_ID}/bots/apply-template`) {
    return json({ added: 0, bots });
  }
  if (method === "GET" && path === "/api/bot-templates") return json({ templates });
  if (method === "GET" && path === `/api/agents/${AGENT_ID}/schedules`) {
    return json({ schedules });
  }
  if (method === "POST" && path === `/api/agents/${AGENT_ID}/schedules`) {
    const created = {
      id: `job-${Math.random().toString(36).slice(2, 8)}`,
      name: (body?.name as string | undefined) ?? "Untitled",
      schedule: (body?.schedule as string | undefined) ?? "0 9 * * *",
      prompt: (body?.prompt as string | undefined) ?? "",
      enabled: true,
      nextRun: null as string | null,
      lastStatus: null as string | null,
    };
    schedules = [...schedules, created];
    return json({});
  }
  const jobMatch = path.match(/^\/api\/agents\/([^/]+)\/schedules\/([^/]+?)(?:\/(run|pause|resume))?$/);
  if (jobMatch && (method === "PATCH" || method === "DELETE" || method === "POST")) {
    const id = decodeURIComponent(jobMatch[2]);
    const action = jobMatch[3];
    if (method === "DELETE") {
      schedules = schedules.filter((j) => j.id !== id);
      return json({});
    }
    schedules = schedules.map((j) =>
      j.id !== id
        ? j
        : action === "pause"
          ? { ...j, enabled: false }
          : action === "resume"
            ? { ...j, enabled: true }
            : { ...j, ...body },
    );
    return json({});
  }
  if (method === "GET" && path === "/api/ai-chatroom/state") return json({ state: chatroomState });
  if (method === "PUT" && path === "/api/ai-chatroom/state") {
    chatroomState = body as typeof chatroomState;
    return json({ state: chatroomState });
  }
  if (method === "GET" && path === `/api/agents/${AGENT_ID}/kanban`) return json({ cards: [] });
  return json({ error: `mock: unhandled ${method} ${path}` }, 501);
}) as typeof fetch;

// --- Minimal Electron bridge stub -------------------------------------------
// Enough for isHostedMode() + readHostedSession(). DesktopCapabilities falls
// back to browser defaults (no getCapabilities stubbed on purpose: the
// preview keeps native window chrome so drag regions never trap clicks).

(window as unknown as { ogb: unknown }).ogb = {
  agentHosting: {
    active: true,
    state: async () => ({
      hosted: true,
      signedIn: true,
      tenantName: "Preview",
      selectedAgentId: AGENT_ID,
      dashboardURL: "https://dashboard.agenthosting.app",
      apiURL: MOCK_API,
      loginBusy: false,
    }),
    beginLogin: async () => ({
      hosted: true,
      signedIn: false,
      tenantName: null,
      selectedAgentId: null,
      dashboardURL: null,
      apiURL: null,
      loginBusy: false,
    }),
    pasteToken: async () => ({
      hosted: true,
      signedIn: true,
      tenantName: "Preview",
      selectedAgentId: AGENT_ID,
      dashboardURL: "https://dashboard.agenthosting.app",
      apiURL: MOCK_API,
      loginBusy: false,
    }),
    selectAgent: async () => ({
      hosted: true,
      signedIn: true,
      tenantName: "Preview",
      selectedAgentId: AGENT_ID,
      dashboardURL: "https://dashboard.agenthosting.app",
      apiURL: MOCK_API,
      loginBusy: false,
    }),
    signOut: async () => {
      location.reload();
      return {
        hosted: true,
        signedIn: false,
        tenantName: null,
        selectedAgentId: null,
        dashboardURL: null,
        apiURL: null,
        loginBusy: false,
      };
    },
    session: async () => ({
      hosted: true,
      token: "preview-token",
      apiURL: MOCK_API,
      dashboardURL: "https://dashboard.agenthosting.app",
      selectedAgentId: AGENT_ID,
    }),
    onState: () => () => {},
  },
  openExternal: async (url: string) => {
    window.open(url, "_blank");
    return true;
  },
};

document.title = "App (mock) — Agentbot";

createRoot(document.getElementById("root")!).render(
  <DesktopCapabilitiesProvider>
    <App agentId={AGENT_ID} onChangeAgent={() => location.reload()} />
  </DesktopCapabilitiesProvider>,
);
