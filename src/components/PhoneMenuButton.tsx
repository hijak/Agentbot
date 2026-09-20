import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Phone, PhoneOff, Settings, Volume2, X } from "lucide-react";

import { api, useStore, type Bot } from "@/state/store";
import { endCall, startCall, useOnCall } from "@/lib/call";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { useDesktopCapabilities } from "./DesktopCapabilities";
import { callCapabilityHelp } from "@/lib/call-capability";
import { localSystemVoiceActive } from "@/lib/local-voice";
import { VoiceSettings } from "./VoiceSettings";

export interface PhoneMenuButtonProps {
  bot: Bot;
  className?: string;
  defaultMenuOpen?: boolean;
  defaultSettingsOpen?: boolean;
}

/**
 * Chat title bar phone button with dropdown menu and TTS options modal overlay.
 * Clicking opens a menu to start/end a call or open the Voice & TTS settings modal.
 */
export function PhoneMenuButton({
  bot,
  className,
  defaultMenuOpen = false,
  defaultSettingsOpen = false,
}: PhoneMenuButtonProps) {
  const { state, dispatch } = useStore();
  const { capabilities, ready: capabilitiesReady } = useDesktopCapabilities();
  const active = useOnCall() === bot.id;

  const [menuOpen, setMenuOpen] = useState(defaultMenuOpen);
  const [settingsOpen, setSettingsOpen] = useState(defaultSettingsOpen);

  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const capabilityHelp = capabilitiesReady
    ? callCapabilityHelp(capabilities, typeof window !== "undefined" ? Boolean(window.ogb?.speechStart) : false)
    : null;
  const supported = capabilitiesReady && !capabilityHelp;
  const localVoice = localSystemVoiceActive();
  const voiceReady = localVoice || Boolean(state.config?.tts?.ready || bot.voice);
  const voiceSetupRequired = capabilitiesReady && supported && !voiceReady;

  // Handle click-outside and Escape to close dropdown menu
  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        buttonRef.current?.focus();
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  // Handle Escape to close TTS settings modal
  useEffect(() => {
    if (!settingsOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSettingsOpen(false);
        buttonRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [settingsOpen]);

  const handleCallAction = () => {
    setMenuOpen(false);
    if (active) {
      endCall(bot.id);
      return;
    }
    if (!voiceReady) {
      // Prompt user with TTS options modal to configure voice first
      setSettingsOpen(true);
      return;
    }
    track("call_started", { driver: bot.modelSelection?.instanceId });
    startCall(bot.id);
  };

  const handleOpenSettings = () => {
    setMenuOpen(false);
    setSettingsOpen(true);
  };

  const handlePatch = (patch: Partial<Pick<Bot, "voice" | "speakReplies">>) => {
    if (typeof window !== "undefined" && window.ogb?.remoteClient?.active) {
      void api(`/api/bots/${bot.id}/profile`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      })
        .then(({ bot: updated }) => dispatch({ type: "botPatched", bot: updated }))
        .catch((cause) => dispatch({ type: "error", message: cause instanceof Error ? cause.message : String(cause) }));
    } else {
      dispatch({ type: "updateBot", botId: bot.id, patch });
    }
  };

  const buttonTitle = active
    ? `End call with ${bot.name}`
    : voiceSetupRequired
      ? `Phone call options (voice setup recommended)`
      : `Phone call and voice settings`;

  return (
    <div className={cn("relative inline-flex items-center", className)} ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={buttonTitle}
        title={buttonTitle}
        className={cn(
          "relative flex size-8 items-center justify-center rounded-md transition-colors",
          active
            ? "bg-danger text-white hover:brightness-110"
            : menuOpen
              ? "bg-raised text-accent"
              : "text-ink-secondary hover:bg-raised hover:text-ink",
        )}
      >
        {active ? <PhoneOff size={17} /> : <Phone size={17} />}
        {!active && voiceSetupRequired && (
          <span
            className="absolute right-1 top-1 size-1.5 rounded-full bg-warning ring-2 ring-app"
            aria-hidden="true"
          />
        )}
      </button>

      {/* Dropdown Menu */}
      {menuOpen && (
        <div
          role="menu"
          aria-label="Phone and voice options"
          className="animate-pop-in absolute right-0 top-full z-40 mt-1.5 w-[220px] overflow-hidden rounded-xl border border-hairline/50 bg-card py-1.5 shadow-2xl shadow-black/50"
        >
          <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary/70">
            Phone & Voice
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={handleCallAction}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors hover:bg-raised/70",
              active ? "text-danger hover:bg-danger/10" : "text-ink",
            )}
          >
            {active ? (
              <PhoneOff size={15} className="shrink-0 text-danger" />
            ) : (
              <Phone size={15} className="shrink-0 text-ink-secondary" />
            )}
            <span className="flex-1 truncate">
              {active ? "End phonecall" : "Start a phonecall"}
            </span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={handleOpenSettings}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-ink transition-colors hover:bg-raised/70"
          >
            <Settings size={15} className="shrink-0 text-ink-secondary" />
            <span className="flex-1 truncate">Settings</span>
          </button>
        </div>
      )}

      {/* TTS Options Modal Overlay */}
      {settingsOpen && (() => {
        const modal = (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-xs animate-fade-in"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setSettingsOpen(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="tts-modal-title"
              className="relative flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl border border-hairline/60 bg-panel shadow-2xl overflow-hidden animate-pop-in"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-hairline/40 px-5 py-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                    <Volume2 size={18} />
                  </div>
                  <div className="min-w-0">
                    <h2 id="tts-modal-title" className="truncate text-[15px] font-semibold text-ink">
                      Voice & TTS Settings
                    </h2>
                    <p className="truncate text-[12px] text-ink-secondary">
                      Configure voice engine, character voices, and audio options for {bot.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  aria-label="Close voice settings"
                  className="rounded-lg p-1.5 text-ink-secondary hover:bg-raised hover:text-ink transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6">
                <VoiceSettings
                  bot={bot}
                  onPatch={handlePatch}
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end border-t border-hairline/40 bg-app/30 px-5 py-3">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="rounded-xl bg-accent px-4 py-1.5 text-[13px] font-medium text-white shadow-xs hover:brightness-110 transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
        return typeof document !== "undefined" && document.body ? createPortal(modal, document.body) : modal;
      })()}
    </div>
  );
}
