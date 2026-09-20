import { cn } from "@/lib/cn";

type BadgeVariant = "default" | "accent" | "warning" | "fault" | "subtle" | "outline";

const DOT: Record<BadgeVariant, string> = {
  default: "var(--ah-text-muted)",
  accent: "var(--ah-accent-300)",
  warning: "var(--ah-orange-300)",
  fault: "var(--ah-fault-300)",
  subtle: "var(--ah-text-faint)",
  outline: "var(--ah-border-bright)",
};

const BG: Record<BadgeVariant, string> = {
  default: "bg-[var(--ah-surface-active)]",
  accent: "bg-[var(--ah-accent-500)]",
  warning: "bg-[var(--ah-orange-500)]",
  fault: "bg-[var(--ah-fault-500)]",
  subtle: "bg-[var(--ah-surface-overlay)]",
  outline: "border border-[var(--ah-border-bright)] bg-transparent",
};

/** Map agent/runtime status strings to Andromeda badge vocabulary. */
export function statusBadgeFor(status: string | null | undefined): {
  variant: BadgeVariant;
  label: string;
} {
  const s = (status ?? "").toLowerCase();
  if (s === "running" || s === "active" || s === "ready" || s === "online") {
    return { variant: "accent", label: "Active" };
  }
  if (s === "stopped" || s === "paused" || s === "offline" || s === "idle") {
    return { variant: "subtle", label: "Paused" };
  }
  if (s === "pending" || s === "starting" || s === "provisioning" || s === "creating") {
    return { variant: "warning", label: status ?? "Pending" };
  }
  if (s === "error" || s === "failed" || s === "suspended" || s === "fault") {
    return { variant: "fault", label: "Needs a look" };
  }
  return { variant: "default", label: status?.trim() || "Unknown" };
}

export function StatusBadge({
  variant,
  label,
  className,
}: {
  variant: BadgeVariant;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "ah-mono inline-flex max-w-full items-center gap-[5px] px-2 py-[2px] text-xs font-medium uppercase tracking-wider text-[var(--ah-text-primary)]",
        BG[variant],
        className,
      )}
    >
      <span className="ah-badge-dot" style={{ backgroundColor: DOT[variant] }} />
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}
