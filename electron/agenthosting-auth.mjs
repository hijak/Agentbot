import { createServer } from "node:http";

export const AGENTHOSTING_TOKEN_FIELD = "agentHostingToken";
export const AGENTHOSTING_AGENT_ID_FIELD = "agentHostingSelectedAgentId";
export const AGENTHOSTING_TENANT_NAME_FIELD = "agentHostingTenantName";

export const DEFAULT_AGENTHOSTING_DASHBOARD_URL = "https://dashboard.agenthosting.app";
export const DEFAULT_AGENTHOSTING_API_URL = "https://api.agenthosting.app";

const TOKEN_RE = /^ah_[0-9a-f]{64}$/i;

const ownString = (document, field) =>
  typeof document?.[field] === "string" ? document[field] : "";

/** Hosted thin-client mode is on unless explicitly disabled. */
export function agentHostingHostedEnabled(environment = process.env) {
  const raw = (environment.AGENTHOSTING_HOSTED ?? "1").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

export function resolveAgentHostingDashboardURL(environment = process.env) {
  const raw = (environment.AGENTHOSTING_DASHBOARD_URL ?? DEFAULT_AGENTHOSTING_DASHBOARD_URL).trim();
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return DEFAULT_AGENTHOSTING_DASHBOARD_URL;
    return url.origin;
  } catch {
    return DEFAULT_AGENTHOSTING_DASHBOARD_URL;
  }
}

export function resolveAgentHostingApiURL(environment = process.env) {
  const raw = (environment.AGENTHOSTING_API_URL ?? DEFAULT_AGENTHOSTING_API_URL).trim();
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return DEFAULT_AGENTHOSTING_API_URL;
    return url.origin;
  } catch {
    return DEFAULT_AGENTHOSTING_API_URL;
  }
}

export function storedAgentHostingToken(credentials) {
  const token = ownString(credentials, AGENTHOSTING_TOKEN_FIELD);
  return TOKEN_RE.test(token) ? token : "";
}

export function storedAgentHostingAgentId(credentials) {
  const id = ownString(credentials, AGENTHOSTING_AGENT_ID_FIELD).trim();
  return id.length > 0 && id.length <= 128 ? id : "";
}

function withoutAgentHostingAuth(credentials) {
  const next = { ...credentials };
  delete next[AGENTHOSTING_TOKEN_FIELD];
  delete next[AGENTHOSTING_AGENT_ID_FIELD];
  delete next[AGENTHOSTING_TENANT_NAME_FIELD];
  return next;
}

function withAgentHostingToken(credentials, token, tenantName = "") {
  const next = {
    ...credentials,
    [AGENTHOSTING_TOKEN_FIELD]: token,
  };
  if (tenantName) next[AGENTHOSTING_TENANT_NAME_FIELD] = tenantName;
  return next;
}

function withSelectedAgent(credentials, agentId) {
  const next = { ...credentials };
  if (agentId) next[AGENTHOSTING_AGENT_ID_FIELD] = agentId;
  else delete next[AGENTHOSTING_AGENT_ID_FIELD];
  return next;
}

function htmlPage(title, body) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0E0E0F;color:#e8e8ea;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{max-width:420px;padding:32px;border:1px solid #2a2a2e;text-align:center}h1{font-size:18px;margin:0 0 12px}p{color:#9a9aa3;font-size:14px;line-height:1.5;margin:0}</style>
</head><body><div class="card"><h1>${title}</h1><p>${body}</p></div></body></html>`;
}

/**
 * @param {{
 *   readCredentials: () => Record<string, unknown>,
 *   updateCredentials: (derive: (doc: Record<string, unknown>) => Record<string, unknown>) => Promise<unknown>,
 *   broadcast?: (channel: string, payload: unknown) => void,
 *   openExternal?: (url: string) => Promise<void>,
 *   environment?: NodeJS.ProcessEnv,
 * }} options
 */
export function createAgentHostingAuthService(options) {
  const {
    readCredentials,
    updateCredentials,
    broadcast = () => {},
    openExternal,
    environment = process.env,
  } = options;

  async function defaultOpenExternal(url) {
    const { shell } = await import("electron");
    const { externalWebUrl } = await import("./app-permissions.mjs");
    await shell.openExternal(externalWebUrl(url));
  }

  const openBrowser = openExternal ?? defaultOpenExternal;

  let loginServer = null;
  let loginServerPort = 0;
  let loginWaiters = [];
  let loginBusy = false;

  const dashboardURL = () => resolveAgentHostingDashboardURL(environment);
  const apiURL = () => resolveAgentHostingApiURL(environment);

  function publicState() {
    const credentials = readCredentials() ?? {};
    const token = storedAgentHostingToken(credentials);
    return {
      hosted: true,
      signedIn: Boolean(token),
      tenantName: ownString(credentials, AGENTHOSTING_TENANT_NAME_FIELD) || null,
      selectedAgentId: storedAgentHostingAgentId(credentials) || null,
      dashboardURL: dashboardURL(),
      apiURL: apiURL(),
      loginBusy,
    };
  }

  function emit() {
    broadcast("agenthosting-auth:state", publicState());
  }

  async function persistToken(token, tenantName = "") {
    await updateCredentials((doc) => withAgentHostingToken(doc, token, tenantName));
    emit();
  }

  async function fetchMe(token) {
    const res = await fetch(`${apiURL()}/api/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `me failed (${res.status})`);
    }
    return res.json();
  }

  async function stopLoginServer() {
    const server = loginServer;
    loginServer = null;
    loginServerPort = 0;
    if (!server) return;
    await new Promise((resolve) => {
      try {
        server.close(() => resolve());
      } catch {
        resolve();
      }
    });
  }

  function rejectWaiters(error) {
    const waiters = loginWaiters;
    loginWaiters = [];
    for (const waiter of waiters) waiter.reject(error);
  }

  function resolveWaiters(token) {
    const waiters = loginWaiters;
    loginWaiters = [];
    for (const waiter of waiters) waiter.resolve(token);
  }

  async function startLoginServer() {
    if (loginServer && loginServerPort) return loginServerPort;

    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url ?? "/", `http://127.0.0.1:${loginServerPort || 0}`);
        if (url.pathname !== "/callback") {
          res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
          res.end(htmlPage("Not found", "This page is only used for AgentHosting sign-in."));
          return;
        }
        const token = url.searchParams.get("token") ?? "";
        if (!TOKEN_RE.test(token)) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(htmlPage("Sign-in failed", "The authorization token was missing or invalid. Return to the app and try again."));
          rejectWaiters(new Error("Invalid authorization token"));
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(htmlPage("Signed in", "You can close this tab and return to the AgentHosting desktop app."));
        void (async () => {
          try {
            let tenantName = "";
            try {
              const me = await fetchMe(token);
              tenantName = typeof me?.tenant?.name === "string" ? me.tenant.name : "";
            } catch {
              // Token may still be usable; tenant name is optional chrome.
            }
            await persistToken(token, tenantName);
            resolveWaiters(token);
          } catch (err) {
            rejectWaiters(err instanceof Error ? err : new Error(String(err)));
          } finally {
            loginBusy = false;
            emit();
            void stopLoginServer();
          }
        })();
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
        res.end(htmlPage("Sign-in error", "Something went wrong capturing the token."));
        rejectWaiters(err instanceof Error ? err : new Error(String(err)));
        loginBusy = false;
        emit();
      }
    });

    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      throw new Error("Failed to bind AgentHosting login callback");
    }
    loginServer = server;
    loginServerPort = address.port;
    return loginServerPort;
  }

  return {
    state: publicState,
    getToken: () => storedAgentHostingToken(readCredentials() ?? {}),
    getApiURL: apiURL,
    getDashboardURL: dashboardURL,

    async beginLogin() {
      if (loginBusy) return publicState();
      loginBusy = true;
      emit();
      try {
        const port = await startLoginServer();
        const redirectUri = `http://127.0.0.1:${port}/callback`;
        const authorize = new URL("/cli-authorize", dashboardURL());
        authorize.searchParams.set("redirect_uri", redirectUri);
        await openBrowser(authorize.toString());

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Sign-in timed out. Try again."));
          }, 10 * 60 * 1000);
          loginWaiters.push({
            resolve: (token) => {
              clearTimeout(timeout);
              resolve(token);
            },
            reject: (err) => {
              clearTimeout(timeout);
              reject(err);
            },
          });
        });
      } catch (err) {
        loginBusy = false;
        await stopLoginServer();
        emit();
        throw err;
      }
      loginBusy = false;
      emit();
      return publicState();
    },

    async acceptPastedToken(rawToken) {
      const token = String(rawToken ?? "").trim();
      if (!TOKEN_RE.test(token)) throw new Error("Token must look like ah_…");
      let tenantName = "";
      try {
        const me = await fetchMe(token);
        tenantName = typeof me?.tenant?.name === "string" ? me.tenant.name : "";
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : "Token was rejected by AgentHosting");
      }
      await persistToken(token, tenantName);
      return publicState();
    },

    async selectAgent(agentId) {
      const id = typeof agentId === "string" ? agentId.trim() : "";
      await updateCredentials((doc) => withSelectedAgent(doc, id));
      emit();
      return publicState();
    },

    async signOut() {
      await stopLoginServer();
      rejectWaiters(new Error("Signed out"));
      loginBusy = false;
      await updateCredentials((doc) => withoutAgentHostingAuth(doc));
      emit();
      return publicState();
    },

    async dispose() {
      await stopLoginServer();
      rejectWaiters(new Error("App shutting down"));
    },
  };
}
