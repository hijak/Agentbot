import type { CSSProperties } from "react";
import { PanelLeftOpen } from "lucide-react";
import { BlobAvatar } from "./BlobAvatar";

export function SidebarHeader({
  agentId, agentName, collapsed, macInset, winCaption, onToggle,
}: {
  agentId: string;
  agentName: string;
  collapsed: boolean;
  macInset: boolean;
  winCaption: boolean;
  onToggle: () => void;
}) {
  const drag = macInset || winCaption
    ? { WebkitAppRegion: "drag" } as CSSProperties : undefined;
  const noDrag = macInset || winCaption
    ? { WebkitAppRegion: "no-drag" } as CSSProperties : undefined;

  if (collapsed) {
    return (
      <div className="shrink-0 border-b border-[var(--ah-border-subtle)]" style={drag}>
        {/* A narrow rail cannot share a row with native window controls.
            Reserve the entire title row before placing any content. */}
        {(macInset || winCaption) && <div className="h-14" aria-hidden="true" />}
        <div className="flex flex-col items-center gap-2 px-1 py-3">
          <div role="img" aria-label={`${agentName} avatar`} title={agentName}>
            <BlobAvatar seed={agentId} label={agentName} size={36} />
          </div>
          <button
            type="button"
            className="ah-btn ah-btn-ghost ah-sidebar-expand"
            style={noDrag}
            onClick={onToggle}
            aria-label="Expand sidebar"
            aria-expanded={false}
            title="Expand sidebar"
          >
            <PanelLeftOpen size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative h-14 shrink-0 border-b border-[var(--ah-border-subtle)] px-3 ${
        macInset ? "pt-3" : winCaption ? "min-h-[56px] pt-[28px] pb-2" : ""
      }`}
      style={drag}
    >
      <div
        className={`flex h-full min-w-0 items-center gap-1.5 ${
          macInset ? "pl-[78px]" : ""
        }`}
      >
        <div className="flex min-w-0 flex-1 justify-end overflow-visible" style={noDrag}>
          <div className="ah-mono whitespace-nowrap text-sm font-semibold uppercase tracking-widest">
            {agentName}
          </div>
        </div>
        <button
          type="button"
          className="ah-btn ah-btn-ghost ah-btn-sm shrink-0 px-2"
          style={noDrag}
          onClick={onToggle}
          aria-label="Collapse sidebar"
          aria-expanded
          title="Collapse sidebar"
        >
          «
        </button>
      </div>
    </div>
  );
}
