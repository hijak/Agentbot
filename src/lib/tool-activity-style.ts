/** Dashboard-matched tool-activity presentation: keyword emojis and short
 * "Using …" copy. Shared by live presence, single chips, and folded runs. */

/** Keyword-based emoji describing what a tool does, independent of run state. */
export function emojiForToolContent(toolName: string | undefined, message = ""): string {
  // Underscores are word characters in JS regexes, so normalize them to spaces
  // before keyword matching (web_search → web search).
  const haystack = `${toolName ?? ""} ${message}`.toLowerCase().replace(/[_-]+/g, " ");
  if (/\b(search|lookup|find|query|grep|glob)\b/.test(haystack)) return "🔍";
  if (/\b(browser|page|open browser|navigate|url|web|fetch)\b/.test(haystack)) return "🌐";
  if (/\b(save|deliverable|file|write|read|upload|download|edit|patch)\b/.test(haystack)) return "💾";
  if (/\b(bash|shell|terminal|exec|command)\b/.test(haystack)) return "💻";
  if (/\b(click|mouse)\b/.test(haystack)) return "🖱️";
  if (/\b(type|key|keyboard|input|fill)\b/.test(haystack)) return "⌨️";
  if (/\b(screenshot|image|photo|camera|screen)\b/.test(haystack)) return "📸";
  if (/\b(scroll)\b/.test(haystack)) return "🛞";
  if (/\b(memory|remember)\b/.test(haystack)) return "🧠";
  if (/\b(goal|plan|task|delegate|handoff)\b/.test(haystack)) return "🎯";
  if (/\b(ask|message|post|room|teammate|bots?)\b/.test(haystack)) return "💬";
  return "🔨";
}

export function displayToolName(toolName: string): string {
  return toolName.replace(/^mcp__[^_]+__/, "").split(":", 1)[0]?.trim() || toolName;
}

/** Distinct content emojis for a collapsed run chip, capped for width. */
export function summaryEmojisForTools(
  tools: Array<{ name?: string; summary?: string }>,
  max = 5,
): string[] {
  const emojis: string[] = [];
  for (const tool of tools) {
    const emoji = emojiForToolContent(tool.name, tool.summary ?? "");
    if (!emojis.includes(emoji)) emojis.push(emoji);
    if (emojis.length >= max) break;
  }
  return emojis;
}
