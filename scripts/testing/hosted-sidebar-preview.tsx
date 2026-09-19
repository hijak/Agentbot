import { useState } from "react";
import { createRoot } from "react-dom/client";
import { SidebarHeader } from "../../src/pair/andromeda/SidebarHeader";
import { AndromedaShell } from "../../src/pair/andromeda/Shell";
import "../../src/styles.css";

function Fixture() {
  const [collapsed, setCollapsed] = useState(true);
  return (
    <AndromedaShell className="h-dvh flex-row">
      {/* Simulates the native controls' reserved bounds; no live account/API. */}
      <div data-traffic-lights className="pointer-events-none fixed left-4 top-4 z-50 flex gap-2">
        {["#ff5f57", "#febc2e", "#28c840"].map((color) => (
          <span key={color} style={{ background: color }} className="size-3 rounded-full" />
        ))}
      </div>
      <aside className={`shrink-0 border-r border-[var(--ah-border-subtle)] ${collapsed ? "w-[76px]" : "w-60"}`}>
        <SidebarHeader
          agentId="fixture-pulse"
          agentName="Pulse"
          collapsed={collapsed}
          macInset
          winCaption={false}
          onToggle={() => setCollapsed((value) => !value)}
        />
      </aside>
      <main className="min-w-0 flex-1">
        <header className="h-14 border-b border-[var(--ah-border-subtle)] px-4 py-2">
          <p>Fixture conversation</p>
          <p className="text-xs text-[var(--ah-text-muted)]">Main agent · Fixture model</p>
        </header>
      </main>
    </AndromedaShell>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
