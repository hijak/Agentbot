// Splits a streaming assistant reply into sentence-sized pieces so a call can
// start speaking the first sentence while the rest is still being generated.

/** Pieces shorter than this merge into the next one, so list markers and
 * one-word fragments don't each become a separate synthesis request. */
const MIN_CHUNK_CHARS = 12;

// Sentence punctuation followed by whitespace, or a line break. A digit
// before the period is excluded so "1. First item" and "in 2024. Then" don't
// split on the number.
const BOUNDARY = /(?<!\d)[.!?…]+["')\]]*(?=\s)|\n+/g;

/** Strips markdown that would otherwise be read aloud as symbols. */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*(?:[-*+•]|\d+[.)])\s+/gm, "")
    .replace(/[*_`~]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Takes the speakable sentences from the unspoken tail of a reply.
 * `consumed` is how many characters of `pending` the returned chunks cover;
 * the caller keeps the rest until more text arrives. When `final` is true the
 * whole remainder is returned.
 */
export function takeSpeakableChunks(
  pending: string,
  final: boolean,
): { chunks: string[]; consumed: number } {
  const chunks: string[] = [];
  let consumed = 0;
  BOUNDARY.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BOUNDARY.exec(pending))) {
    const end = match.index + match[0].length;
    const piece = cleanForSpeech(pending.slice(consumed, end));
    if (piece.length < MIN_CHUNK_CHARS) continue;
    chunks.push(piece);
    consumed = end;
  }
  if (final && consumed < pending.length) {
    const rest = cleanForSpeech(pending.slice(consumed));
    if (rest) chunks.push(rest);
    consumed = pending.length;
  }
  return { chunks, consumed };
}
