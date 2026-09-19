import { StrictMode, useCallback, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { readSessionState, takePairingCodeFromLocation, takeInvitedEmailFromLocation } from "./lib/session";
import { bootstrapBrand } from "./lib/brand";
import { applySkin, readSkin } from "./lib/skins";
import { isHostedMode, readHostedSession } from "./lib/agenthosting/client";
import { PairPage } from "./pair/PairPage";
import { HostedSignInPage } from "./pair/HostedSignInPage";
import { HostedAgentPicker } from "./pair/HostedAgentPicker";
import { HostedApp } from "./pair/HostedApp";
import { AndromedaShell } from "./pair/andromeda/Shell";
import {
  DesktopCapabilitiesProvider,
  useDesktopCapabilities,
} from "./components/DesktopCapabilities";
import { WindowCaptionButtons } from "./components/WindowCaptionButtons";
import "./styles.css";

if (!isHostedMode()) {
  applySkin(readSkin());
} else {
  document.documentElement.classList.add("dark");
  document.documentElement.style.colorScheme = "dark";
}

function HostedChrome({ children }: { children: ReactNode }) {
  const { capabilities } = useDesktopCapabilities();
  return (
    <div className="relative h-dvh min-h-0 overflow-hidden">
      {children}
      <WindowCaptionButtons
        visible={capabilities.windowChrome === "win-caption" && Boolean(window.ogb?.windowControls)}
      />
    </div>
  );
}

function HostedRoot() {
  const [phase, setPhase] = useState<"loading" | "signin" | "picker" | "app">("loading");
  const [agentId, setAgentId] = useState<string | null>(null);

  const boot = useCallback(async () => {
    const session = await readHostedSession();
    if (!session) {
      setPhase("signin");
      return;
    }
    if (session.selectedAgentId) {
      setAgentId(session.selectedAgentId);
      setPhase("app");
      return;
    }
    setPhase("picker");
  }, []);

  useEffect(() => {
    void boot();
    return window.ogb?.agentHosting?.onState?.((state) => {
      if (!state.signedIn) {
        setAgentId(null);
        setPhase("signin");
      }
    });
  }, [boot]);

  let body: React.ReactNode;
  if (phase === "loading") {
    body = (
      <AndromedaShell className="items-center justify-center text-sm text-[var(--ah-text-secondary)]">
        Loading<span className="blink-cursor" />
      </AndromedaShell>
    );
  } else if (phase === "signin") {
    body = <HostedSignInPage />;
  } else if (phase === "picker") {
    body = (
      <HostedAgentPicker
        onSelected={(agent) => {
          setAgentId(agent.id);
          setPhase("app");
        }}
      />
    );
  } else if (!agentId) {
    body = <HostedSignInPage reason="Pick an agent to continue." />;
  } else {
    body = (
      <HostedApp
        agentId={agentId}
        onChangeAgent={() => {
          void window.ogb?.agentHosting?.selectAgent("").then(() => {
            setAgentId(null);
            setPhase("picker");
          });
        }}
      />
    );
  }

  return (
    <DesktopCapabilitiesProvider>
      <HostedChrome>{body}</HostedChrome>
    </DesktopCapabilitiesProvider>
  );
}

async function chooseRoot(): Promise<React.ReactNode> {
  if (isHostedMode()) return <HostedRoot />;
  if (location.pathname === "/pair") {
    return <PairPage initialCode={takePairingCodeFromLocation()} initialEmail={takeInvitedEmailFromLocation()} />;
  }
  const session = await readSessionState();
  if (session.kind === "unauthenticated") return <PairPage initialCode={null} reason={session.error} />;
  return <App />;
}

void Promise.all([bootstrapBrand(), chooseRoot()]).then(([, root]) => {
  createRoot(document.getElementById("root")!).render(<StrictMode>{root}</StrictMode>);
});
