import type { SearchMetadata } from '../domain/search-metadata.js';
import type { RawDiscoveryRecord } from '../domain/experience.js';
import type { Logger } from '../utils/logger.js';

export interface DiscoveryContext {
  metadata: SearchMetadata;
  logger: Logger;
}

export interface DiscoveryProvider {
  discover(context: DiscoveryContext): Promise<RawDiscoveryRecord[]>;
}
