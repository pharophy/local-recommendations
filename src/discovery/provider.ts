import type { SearchMetadata } from '../domain/search-metadata.js';
import type { CandidateEnrichment, ExperienceCandidate, RawDiscoveryRecord, RequestMetrics } from '../domain/experience.js';
import type { Logger } from '../utils/logger.js';

export interface DiscoveryContext {
  metadata: SearchMetadata;
  logger: Logger;
  metrics?: RequestMetrics;
}

export interface DiscoveryProvider {
  discover(context: DiscoveryContext): Promise<RawDiscoveryRecord[]>;
}

export interface EnrichmentContext {
  metadata: SearchMetadata;
  logger: Logger;
  metrics?: RequestMetrics;
}

export interface CandidateEnricher {
  enrich(
    candidate: Omit<ExperienceCandidate, 'botScore' | 'duplicateKey'>,
    context: EnrichmentContext,
  ): Promise<CandidateEnrichment | null>;
}
