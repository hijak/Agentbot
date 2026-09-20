import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Settings } from "lucide-react";

export interface PhoneMenuProps {
  onCall: boolean;
  onStartCall: () => void;
  onEndCall: () => void;
  onOpenSettings: () => void;
  agentName?: string;
  className?: string;
  defaultMenuOpen?: boolean;
}

export function PhoneMenu({
  onCall,
  onStartCall,
  onEndCall,
  onOpenSettings,
  agentName = "Agent",
  className = "",
  defaultMenuOpen = false,
}: PhoneMenuProps) {
  const [open, setOpen] = useState(defaultMenuOpen);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !menuRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className={`relative inline-flex items-center ${className}`} ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={onCall ? `End call with ${agentName}` : `Phone call options for ${agentName}`}
        title={onCall ? `End call with ${agentName}` : `Phone call options for ${agentName}`}
        className={`relative flex size-8 items-center justify-center rounded-lg transition-colors ${
          onCall
            ? "bg-[var(--ah-fault-400)] text-white hover:brightness-110"
            : open
              ? "bg-[var(--ah-surface-hover)] text-[var(--ah-accent-300)]"
              : "text-[var(--ah-text-secondary)] hover:bg-[var(--ah-surface-hover)] hover:text-[var(--ah-text-primary)]"
        }`}
      >
        {onCall ? <PhoneOff size={16} /> : <Phone size={16} />}
        {onCall && (
          <span
            className="absolute right-1 top-1 size-1.5 rounded-full bg-white animate-ping"
            aria-hidden="true"
          />
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Phone and voice options"
          className="absolute right-0 top-full z-30 mt-1.5 w-48 overflow-hidden rounded-xl border border-[var(--ah-border-subtle)] bg-[var(--ah-surface-overlay)] py-1 shadow-2xl backdrop-blur animate-pop-in"
        >
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--ah-text-faint)]">
            Phone & Voice
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              if (onCall) onEndCall();
              else onStartCall();
            }}
            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--ah-surface-hover)] ${
              onCall ? "text-[var(--ah-fault-300)]" : "text-[var(--ah-text-primary)]"
            }`}
          >
            {onCall ? (
              <PhoneOff size={14} className="shrink-0 text-[var(--ah-fault-400)]" />
            ) : (
              <Phone size={14} className="shrink-0 text-[var(--ah-accent-300)]" />
            )}
            <span className="flex-1 truncate">
              {onCall ? "End phonecall" : "Start a phonecall"}
            </span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onOpenSettings();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-[var(--ah-text-primary)] transition-colors hover:bg-[var(--ah-surface-hover)]"
          >
            <Settings size={14} className="shrink-0 text-[var(--ah-text-muted)]" />
            <span className="flex-1 truncate">Settings</span>
          </button>
        </div>
      )}
    </div>
  );
}
