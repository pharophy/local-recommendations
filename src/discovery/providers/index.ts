import type { CandidateEnricher, DiscoveryProvider } from '../provider.js';
import type { RuntimeConfig } from '../../config/runtime.js';
import { CURATED_HTML_SOURCES } from '../sources/curated-sources.js';
import { HtmlSourceProvider } from './html-source-provider.js';
import { BraveSearchProvider } from '../search/brave-search-provider.js';
import { GoogleCustomSearchProvider } from '../search/google-custom-search-provider.js';
import {
  createDisabledSearchPageCache,
  createFileSearchPageCache,
} from '../search/search-page-cache.js';

export interface DiscoveryServices {
  discoveryProviders: DiscoveryProvider[];
  enrichers: CandidateEnricher[];
}

export function createDiscoveryProviders(config: RuntimeConfig): DiscoveryServices {
  const discoveryProviders: DiscoveryProvider[] = [];
  const enrichers: CandidateEnricher[] = [];
  const searchPageCache = config.webSearch.pageCacheEnabled
    ? createFileSearchPageCache(config.webSearch.pageCacheFile)
    : createDisabledSearchPageCache();

  if (config.curatedSources.enabled) {
    const enabledCuratedSources = CURATED_HTML_SOURCES.filter(
      (source) => !config.curatedSources.disabledSourceIds.includes(source.id),
    );
    const htmlProvider = new HtmlSourceProvider(enabledCuratedSources, {
      timeoutMs: config.env.HTTP_TIMEOUT_MS,
      retryCount: config.env.HTTP_RETRY_COUNT,
    });
    discoveryProviders.push(htmlProvider);
  }

  if (config.webSearch.enabled && config.webSearch.provider === 'brave') {
    const braveProvider = new BraveSearchProvider(config, {
      timeoutMs: config.env.HTTP_TIMEOUT_MS,
      retryCount: config.env.HTTP_RETRY_COUNT,
    }, searchPageCache);
    discoveryProviders.push(braveProvider);
    enrichers.push(braveProvider);
  }

  if (config.webSearch.enabled && config.webSearch.provider === 'google') {
    const googleProvider = new GoogleCustomSearchProvider(config, {
      timeoutMs: config.env.HTTP_TIMEOUT_MS,
      retryCount: config.env.HTTP_RETRY_COUNT,
    }, searchPageCache);
    discoveryProviders.push(googleProvider);
    enrichers.push(googleProvider);
  }

  return { discoveryProviders, enrichers };
}
