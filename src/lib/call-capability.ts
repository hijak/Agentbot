export type CallCapabilityHelp = {
  label: string;
  reason: string;
  action?: "choose-local-workspace";
};

export function browserSpeechRecognitionAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/** Explain why this renderer cannot start a call. Keep the remote-workspace
 * case distinct: the installed Mac app is already present, but this page is
 * intentionally denied access to the Mac microphone. */
export function callCapabilityHelp(
  capabilities: DesktopCapabilities,
  speechServiceAvailable: boolean,
): CallCapabilityHelp | null {
  const hasSpeech = speechServiceAvailable || browserSpeechRecognitionAvailable();
  if (!capabilities.dictation.available && !browserSpeechRecognitionAvailable()) {
    switch (capabilities.dictation.reasonCode) {
      case "remote-server":
        return {
          label: "Calls are available on This computer",
          reason:
            "You're viewing a hosted workspace. Calls use the microphone and on-device speech recognition on your Mac.",
          action: "choose-local-workspace",
        };
      case "desktop-app-required":
        return {
          label: "Calls need the macOS desktop app",
          reason: "Open this workspace in Agentbot for macOS to make calls with on-device speech recognition.",
        };
      case "unsupported-platform":
        return {
          label: "Calls currently need macOS",
          reason: "Calls are available on macOS for now because speech recognition runs on-device.",
        };
      default:
        return {
          label: "Calls aren't available on this device",
          reason: "This device doesn't currently provide the on-device speech recognition needed for calls.",
        };
    }
  }
  if (!hasSpeech) {
    return {
      label: "The call service is unavailable",
      reason: "The speech service is unavailable in this app build. Restart or update Agentbot.",
    };
  }
  return null;
}
