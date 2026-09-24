const DEFAULT_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_RETRY_DELAY_MS = 1_000;

function describeError(error) {
  const cause = error?.cause;
  const code = cause && typeof cause.code === "string" ? ` (${cause.code})` : "";
  return `${error instanceof Error ? error.message : String(error)}${code}`;
}

export async function downloadAndroidToolsArchive(
  url,
  {
    fetchImpl = fetch,
    attempts = DEFAULT_ATTEMPTS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    onRetry = () => {},
  } = {},
) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        if (response.status < 500) {
          error.retryable = false;
          throw error;
        }
        lastError = error;
      } else {
        return Buffer.from(await response.arrayBuffer());
      }
    } catch (error) {
      if (error?.retryable === false) {
        throw new Error(`could not download Android Platform Tools: ${describeError(error)}`, { cause: error });
      }
      lastError = error;
    }

    if (attempt < attempts) {
      const delayMs = retryDelayMs * 2 ** (attempt - 1);
      onRetry({ attempt, maxAttempts: attempts, delayMs, error: lastError });
      await sleep(delayMs);
    }
  }

  throw new Error(
    `could not download Android Platform Tools from ${url} after ${attempts} attempts: ${describeError(lastError)}`,
    { cause: lastError },
  );
}
