// A stand-in for the control plane for tests of email sign-in: the email-OTP
// routes the server's account-signin client uses, answering in the shapes its
// validators accept. Records every call so a test can assert what the client
// did, not only what it got.
import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";

export interface ControlPlaneStub {
  url: string;
  otp: string;
  /** "METHOD /path", in order. */
  calls: string[];
  close(): Promise<void>;
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const parsed: unknown = raw ? JSON.parse(raw) : {};
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? Object.fromEntries(Object.entries(parsed)) : {};
}

export async function startControlPlaneStub(options: { otp?: string } = {}): Promise<ControlPlaneStub> {
  const otp = options.otp ?? "24681357";
  const calls: string[] = [];

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://stub");
    const method = req.method ?? "GET";
    const path = url.pathname;
    calls.push(`${method} ${path}`);
    const send = (status: number, body?: unknown, headers: Record<string, string> = {}) => {
      res.writeHead(status, { "content-type": "application/json", ...headers });
      res.end(body === undefined ? "" : JSON.stringify(body));
    };

    if (method === "POST" && path === "/api/auth/email-otp/send-verification-otp") {
      await readJson(req);
      return send(200, { success: true });
    }
    if (method === "POST" && path === "/api/auth/sign-in/email-otp") {
      const body = await readJson(req);
      if (body.otp !== otp) return send(401, { error: "invalid_otp", message: "Invalid code" });
      const token = `acct_${randomBytes(24).toString("base64url")}`;
      return send(200, { token: "db-token-never-used", user: { id: "user_stub", email: body.email, name: "stub", emailVerified: true } }, { "set-auth-token": token });
    }
    if (method === "POST" && path === "/api/auth/sign-out") return send(200, { success: true });
    return send(404, { error: "not_found" });
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    otp,
    calls,
    close: () => new Promise<void>((done) => server.close(() => done())),
  };
}
