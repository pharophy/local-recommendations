import type { RequestMetrics } from '../domain/experience.js';

export interface HttpClientOptions {
  timeoutMs: number;
  retryCount: number;
  metrics?: RequestMetrics | undefined;
  requestCounterKey?:
    | 'braveSearchRequests'
    | 'googleSearchRequests'
    | 'searchPageFetchRequests'
    | 'curatedPageFetchRequests'
    | 'airtableRequests'
    | undefined;
}

export async function fetchWithRetry(
  input: string | URL,
  init: RequestInit,
  options: HttpClientOptions,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= options.retryCount; attempt += 1) {
    if (options.metrics && options.requestCounterKey) {
      options.metrics[options.requestCounterKey] += 1;
      if (attempt > 0) {
        options.metrics.httpRetries += 1;
      }
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok && response.status >= 500 && attempt < options.retryCount) {
        lastError = new Error(`Received ${response.status} from ${String(input)}`);
        continue;
      }

      return response;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (attempt === options.retryCount) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unknown fetch failure');
}
