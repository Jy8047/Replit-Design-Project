export const BLS_HISTORY_MAX_RETRIES = 3;
export const BLS_HISTORY_RETRY_DELAY_MS = 2_000;

type RetryOptions = {
  signal: AbortSignal;
  fetcher?: typeof fetch;
  onRetry?: (attempt: number) => void;
  maxRetries?: number;
  delayMs?: number;
};

function waitForRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, delayMs);
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', abort, { once: true });
  });
}

export async function fetchOccupationHistoryWithRetries(
  url: string,
  {
    signal,
    fetcher = fetch,
    onRetry,
    maxRetries = BLS_HISTORY_MAX_RETRIES,
    delayMs = BLS_HISTORY_RETRY_DELAY_MS,
  }: RetryOptions,
): Promise<unknown> {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (signal.aborted) {
      throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    }

    let response: Response;
    try {
      response = await fetcher(url, { signal, cache: 'no-store' });
    } catch (error) {
      if (signal.aborted || attempt === maxRetries) throw error;
      onRetry?.(attempt + 1);
      await waitForRetry(delayMs, signal);
      continue;
    }

    if (response.status >= 500 && response.status < 600) {
      if (attempt === maxRetries) throw new Error('BLS_HISTORY_UNAVAILABLE');
      onRetry?.(attempt + 1);
      await waitForRetry(delayMs, signal);
      continue;
    }
    if (!response.ok) throw new Error(`HISTORY_REQUEST_FAILED_${response.status}`);
    return response.json();
  }

  throw new Error('BLS_HISTORY_UNAVAILABLE');
}
