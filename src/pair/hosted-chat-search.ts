/** Normalize titles so search treats accents, case, and repeated whitespace
 * consistently. The displayed title stays untouched. */
function normalized(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .trim();
}

function isWordStart(value: string, index: number): boolean {
  return index === 0 || !/[\p{L}\p{N}]/u.test(value[index - 1] ?? "");
}

/** Score one search term against a title. Exact, early, and word-start
 * matches win, while a subsequence match keeps abbreviated typing useful. */
export function fuzzyTitleScore(title: string, query: string): number | null {
  const candidate = normalized(title);
  const needle = normalized(query);
  if (!needle) return 0;

  const exactIndex = candidate.indexOf(needle);
  if (exactIndex >= 0) {
    return (
      1_000 +
      (exactIndex === 0 ? 150 : 0) +
      (isWordStart(candidate, exactIndex) ? 200 : 0) -
      exactIndex * 2 -
      (candidate.length - needle.length)
    );
  }

  let score = 300;
  let previous = -1;
  for (const character of needle) {
    const index = candidate.indexOf(character, previous + 1);
    if (index < 0) return null;

    if (previous < 0) {
      score += Math.max(0, 40 - index * 2);
    } else {
      const gap = index - previous - 1;
      score += gap === 0 ? 32 : Math.max(0, 12 - gap * 2);
    }
    if (isWordStart(candidate, index)) score += 45;
    previous = index;
  }
  return score - candidate.length;
}

/** Filter and stably rank items by every whitespace-separated query term. */
export function fuzzySearch<T>(
  items: readonly T[],
  query: string,
  title: (item: T) => string,
): T[] {
  const terms = normalized(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...items];

  return items
    .map((item, index) => {
      const value = title(item);
      let score = 0;
      for (const term of terms) {
        const termScore = fuzzyTitleScore(value, term);
        if (termScore === null) return null;
        score += termScore;
      }
      return { item, index, score };
    })
    .filter((entry): entry is { item: T; index: number; score: number } => entry !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item);
}
