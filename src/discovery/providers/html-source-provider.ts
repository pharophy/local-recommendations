import { load } from 'cheerio';

import type { RawDiscoveryRecord } from '../../domain/experience.js';
import { fetchWithRetry, type HttpClientOptions } from '../../utils/http.js';
import { normalizeWhitespace } from '../../utils/strings.js';
import type { DiscoveryContext, DiscoveryProvider } from '../provider.js';
import type { HtmlSourceDefinition } from '../source-definition.js';

function scoreLinkText(text: string, metadataTerms: string[]): number {
  const lower = text.toLowerCase();
  return metadataTerms.reduce(
    (total, term) => (lower.includes(term.toLowerCase()) ? total + 1 : total),
    0,
  );
}

export class HtmlSourceProvider implements DiscoveryProvider {
  public constructor(
    private readonly sources: HtmlSourceDefinition[],
    private readonly httpOptions: HttpClientOptions,
  ) {}

  public async discover(context: DiscoveryContext): Promise<RawDiscoveryRecord[]> {
    const metadataTerms = [
      ...context.metadata.searchFocus,
      ...context.metadata.includeTerms,
      ...context.metadata.audienceBias,
    ].map((term) => term.toLowerCase());

    const applicableSources = this.sources.filter(
      (source) => source.category === context.metadata.tableName,
    );

    const records = await Promise.all(
      applicableSources.map(async (source) =>
        this.discoverFromSource(source, metadataTerms, context),
      ),
    );

    return records.flat();
  }

  private async discoverFromSource(
    source: HtmlSourceDefinition,
    metadataTerms: string[],
    context: DiscoveryContext,
  ): Promise<RawDiscoveryRecord[]> {
    try {
      const response = await fetchWithRetry(
        source.url,
        {
          headers: {
            'user-agent': 'socal-discovery-agent/0.1 (+https://example.invalid)',
          },
        },
        this.httpOptions,
      );
      const html = await response.text();
      const $ = load(html);
      const selector = source.itemSelector ?? 'a';
      const records: RawDiscoveryRecord[] = [];

      $(selector).each((_, element) => {
        if (records.length >= (source.maxItems ?? 15)) {
          return false;
        }

        const wrapper = $(element);
        const linkElement = source.linkSelector ? wrapper.find(source.linkSelector).first() : wrapper;
        const href = linkElement.attr('href') ?? wrapper.attr('href');
        const title = normalizeWhitespace(linkElement.text() || wrapper.text());
        const description = source.descriptionSelector
          ? normalizeWhitespace(wrapper.find(source.descriptionSelector).first().text())
          : normalizeWhitespace(wrapper.parent().text().replace(title, ''));

        if (!href || !title || title.length < 4) {
          return;
        }

        const absoluteUrl = new URL(href, source.url).toString();
        const textScore = scoreLinkText(`${title} ${description}`, metadataTerms);
        const hasRelevantKeyword = textScore > 0 || metadataTerms.length === 0;

        if (!hasRelevantKeyword && records.length >= 5) {
          return;
        }

        const record: RawDiscoveryRecord = {
          category: source.category,
          source: {
            id: source.id,
            name: source.name,
            url: source.url,
          },
          title,
          url: absoluteUrl,
          summary: description.slice(0, 320),
          region: source.region,
          rawDateText: `${title} ${description}`.trim(),
        };

        if (source.city) {
          record.city = source.city;
        }
        if (source.venue) {
          record.venue = source.venue;
        }
        if (source.tags) {
          record.tags = source.tags;
        }

        records.push(record);
      });

      return records;
    } catch (error) {
      context.logger.warn('Discovery source failed', {
        sourceId: source.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}
