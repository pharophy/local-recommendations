import type { RuntimeConfig } from '../../config/runtime.js';
import { CURATED_HTML_SOURCES } from '../sources/curated-sources.js';
import { HtmlSourceProvider } from './html-source-provider.js';

export function createDiscoveryProviders(config: RuntimeConfig): HtmlSourceProvider[] {
  return [
    new HtmlSourceProvider(CURATED_HTML_SOURCES, {
      timeoutMs: config.env.HTTP_TIMEOUT_MS,
      retryCount: config.env.HTTP_RETRY_COUNT,
    }),
  ];
}
