import { formatElapsed } from "@/lib/working-time";

export function teachTaskStatusLabel(status: string): string {
  switch (status) {
    case "recording":
      return "Recording on the hosted desktop";
    case "queued":
      return "Queued for reconstruction";
    case "processing":
      return "Reconstructing and generalizing";
    case "completed":
      return "Skill ready";
    case "failed":
      return "Teaching failed";
    default:
      return "Preparing";
  }
}

export function teachTaskElapsed(startedAt: string, now = Date.now()): string {
  return formatElapsed(Math.max(0, now - Date.parse(startedAt)));
}
