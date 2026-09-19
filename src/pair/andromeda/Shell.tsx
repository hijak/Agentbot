import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import "../andromeda.css";

/** Full-viewport Andromeda skin wrapper for AgentHosting thin-client pages. */
export function AndromedaShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("andromeda flex min-h-dvh flex-col", className)}>
      {children}
    </div>
  );
}
