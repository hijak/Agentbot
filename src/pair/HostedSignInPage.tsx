import { useCallback, useEffect, useState } from "react";
import type { AgentHostingAuthState } from "@/types/ogb";
import { AndromedaShell } from "./andromeda/Shell";

/** Sign-in gate for the AgentHosting desktop thin client. */
export function HostedSignInPage({ reason }: { reason?: string | null }) {
  const [state, setState] = useState<AgentHostingAuthState | null>(null);
  const [error, setError] = useState<string | null>(reason ?? null);
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ah = window.ogb?.agentHosting;
    if (!ah) return;
    void ah.state().then(setState).catch(() => {});
    return ah.onState?.(setState);
  }, []);

  const beginLogin = useCallback(async () => {
    const ah = window.ogb?.agentHosting;
    if (!ah) {
      setError("Open this app in the AgentHosting desktop shell to sign in.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await ah.beginLogin();
      setState(next);
      if (next.signedIn) location.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const submitPaste = useCallback(async () => {
    const ah = window.ogb?.agentHosting;
    if (!ah) return;
    setBusy(true);
    setError(null);
    try {
      const next = await ah.pasteToken(paste.trim());
      setState(next);
      if (next.signedIn) location.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [paste]);

  return (
    <AndromedaShell className="items-center justify-center px-4">
      <div className="ah-card-glow w-full max-w-md space-y-6 p-8">
        <div className="space-y-3 text-center">
          <p className="ah-micro">AgentHosting</p>
          <h1 className="ah-page-title text-[22px] leading-tight">Sign in</h1>
          <p className="text-sm text-[var(--ah-text-secondary)]">
            Authenticate in your browser with the dashboard, then pick which agent to load.
          </p>
        </div>

        {error && (
          <div className="border border-[var(--ah-fault-400)] bg-[var(--ah-fault-alpha)] px-3 py-2 text-sm text-[var(--ah-fault-100)]">
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={busy || state?.loginBusy}
          onClick={() => void beginLogin()}
          className="ah-btn ah-btn-block"
        >
          {busy || state?.loginBusy ? "Waiting for browser…" : "Sign in with AgentHosting"}
        </button>

        <div className="space-y-2">
          <p className="text-xs text-[var(--ah-text-secondary)]">
            If the browser does not return automatically, paste the{" "}
            <code className="ah-mono text-[var(--ah-accent-200)]">ah_</code> token here:
          </p>
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={3}
            className="ah-textarea ah-mono text-xs"
            placeholder="ah_…"
            spellCheck={false}
          />
          <button
            type="button"
            disabled={busy || paste.trim().length < 10}
            onClick={() => void submitPaste()}
            className="ah-btn ah-btn-outline ah-btn-block"
          >
            Use pasted token
          </button>
        </div>
      </div>
    </AndromedaShell>
  );
}
