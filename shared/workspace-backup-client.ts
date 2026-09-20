// Exact app-owned browser state that belongs in an encrypted full backup.
// Never include cookies, authentication tokens, connection caches or unknown keys.
export const WORKSPACE_BACKUP_CLIENT_KEYS = [
  "agentbot-drafts",
  "agentbot-draft-attachments",
  "agentbot-draft-send-ids",
  "agentbot-draft-channel-modes",
  "agentbot-skin",
  "agentbot-show-threads",
  "agentbot.sidebarDensity",
  "agentbot.sidebarCollapsedSections.v1",
  "agentbot.sidebarSectionOrder.v1",
  "agentbot-analytics-opt-out",
  "agentbot.remote-voice.v1",
] as const;

export type WorkspaceBackupClientState = Partial<Record<(typeof WORKSPACE_BACKUP_CLIENT_KEYS)[number], string>>;
