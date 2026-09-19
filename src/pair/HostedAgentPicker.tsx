import { useCallback, useEffect, useMemo, useState } from "react";
import {
  isHostedMode,
  listHostedAgents,
  openComputerSurface,
  readHostedSession,
  type HostedAgent,
  type HostedSession,
} from "@/lib/agenthosting/client";
import { AndromedaShell } from "./andromeda/Shell";
import { BlobAvatar } from "./andromeda/BlobAvatar";
import { CornerMarkers } from "./andromeda/CornerMarkers";
import { StatusBadge, statusBadgeFor } from "./andromeda/StatusBadge";

/** After AgentHosting sign-in: choose which cloud agent to open. */
export function HostedAgentPicker({
  onSelected,
}: {
  onSelected: (agent: HostedAgent, session: HostedSession) => void;
}) {
  const [session, setSession] = useState<HostedSession | null>(null);
  const [agents, setAgents] = useState<HostedAgent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await readHostedSession();
      if (!next) {
        setError("Not signed in.");
        setAgents([]);
        setSession(null);
        return;
      }
      setSession(next);
      const list = await listHostedAgents(next);
      setAgents(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sorted = useMemo(
    () => [...agents].sort((a, b) => a.name.localeCompare(b.name)),
    [agents],
  );

  const pick = async (agent: HostedAgent) => {
    if (!session) return;
    await window.ogb?.agentHosting?.selectAgent(agent.id);
    onSelected(agent, session);
  };

  if (!isHostedMode()) return null;

  return (
    <AndromedaShell className="items-center justify-center px-4">
      <div className="ah-card w-full max-w-lg space-y-5 p-8">
        <CornerMarkers />
        <div className="relative space-y-2">
          <p className="ah-micro">Agents</p>
          <h1 className="ah-page-title text-[22px] leading-tight">Choose an agent</h1>
          <p className="text-sm text-[var(--ah-text-secondary)]">
            Settings and models live on the AgentHosting dashboard. This app loads one agent at a
            time.
          </p>
        </div>

        {error && (
          <div className="relative border border-[var(--ah-fault-400)] bg-[var(--ah-fault-alpha)] px-3 py-2 text-sm text-[var(--ah-fault-100)]">
            {error}
          </div>
        )}

        {loading ? (
          <p className="relative text-sm text-[var(--ah-text-secondary)]">
            Loading agents<span className="blink-cursor" />
          </p>
        ) : sorted.length === 0 ? (
          <div className="relative space-y-3 text-sm text-[var(--ah-text-secondary)]">
            <p>No agents on this account yet.</p>
            {session?.dashboardURL && (
              <button
                type="button"
                className="ah-link text-sm"
                onClick={() => void window.ogb?.openExternal?.(`${session.dashboardURL}/agents`)}
              >
                Open dashboard to create one
              </button>
            )}
          </div>
        ) : (
          <ul className="relative max-h-[50vh] space-y-2 overflow-y-auto">
            {sorted.map((agent) => {
              const computer = openComputerSurface(agent);
              const badge = statusBadgeFor(agent.status);
              return (
                <li key={agent.id}>
                  <button
                    type="button"
                    onClick={() => void pick(agent)}
                    className="ah-card-bordered flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-[border-color,background] duration-[140ms] hover:border-[var(--ah-accent-400)] hover:bg-[var(--ah-surface-hover)]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <BlobAvatar seed={agent.id} label={agent.name} size={40} />
                      <div className="min-w-0 space-y-1.5">
                        <div className="ah-mono truncate text-sm font-semibold uppercase tracking-wider">
                          {agent.name}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge variant={badge.variant} label={badge.label} />
                          {agent.modelName && (
                            <span className="truncate text-[11px] text-[var(--ah-text-faint)]">
                              {agent.modelName}
                            </span>
                          )}
                          {computer && (
                            <span className="ah-micro text-[var(--ah-accent-300)]">Open Computer</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="ah-mono shrink-0 text-xs font-semibold uppercase tracking-wider text-[var(--ah-accent-300)]">
                      Open
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="relative flex items-center justify-between gap-3 pt-1 text-xs text-[var(--ah-text-secondary)]">
          <button type="button" className="ah-link" onClick={() => void refresh()}>
            Refresh
          </button>
          <button
            type="button"
            className="ah-link"
            onClick={() => {
              void window.ogb?.agentHosting?.signOut().then(() => location.replace("/"));
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </AndromedaShell>
  );
}
