import { load } from 'cheerio';

import type { RawDiscoveryRecord } from '../../domain/experience.js';
import { fetchWithRetry, type HttpClientOptions } from '../../utils/http.js';
import { normalizeWhitespace } from '../../utils/strings.js';
import type { DiscoveryContext, DiscoveryProvider } from '../provider.js';
import type { HtmlSourceDefinition } from '../source-definition.js';

const GENERIC_TITLE_PATTERNS = [
  'skip to main content',
  'book your trip',
  'featured',
  'facebook',
  'twitter',
  'youtube',
  'instagram',
  'tiktok',
  'linkedin',
  'pinterest',
  'contact us',
  'meetings',
  'travel trade',
  'partners',
  'media',
  'accessibility',
  'english',
] as const;

function scoreLinkText(text: string, metadataTerms: string[]): number {
  const lower = text.toLowerCase();
  return metadataTerms.reduce(
    (total, term) => (lower.includes(term.toLowerCase()) ? total + 1 : total),
    0,
  );
}

function isRejectedTitle(title: string, source: HtmlSourceDefinition): boolean {
  const lower = title.toLowerCase();

  return [...GENERIC_TITLE_PATTERNS, ...(source.excludeTitlePatterns ?? [])].some((pattern) =>
    lower.includes(pattern.toLowerCase()),
  );
}

function matchesConfiguredPatterns(
  value: string,
  patterns: string[] | undefined,
  defaultResult: boolean,
): boolean {
  if (!patterns || patterns.length === 0) {
    return defaultResult;
  }

  return patterns.some((pattern) => value.includes(pattern));
}

function isAllowedCity(source: HtmlSourceDefinition, city: string | undefined): boolean {
  if (!source.allowedCities || source.allowedCities.length === 0) {
    return true;
  }

  if (!city) {
    return false;
  }

  const normalized = city.toLowerCase();
  return source.allowedCities.some((allowedCity) => normalized.includes(allowedCity.toLowerCase()));
}

export function shouldIgnoreLink(
  source: HtmlSourceDefinition,
  absoluteUrl: string,
  title: string,
  contextSummary: string,
): boolean {
  const lowerUrl = absoluteUrl.toLowerCase();
  const lowerTitle = title.toLowerCase();
  const lowerContext = contextSummary.toLowerCase();

  if (
    lowerUrl === source.url.toLowerCase() ||
    lowerUrl.startsWith(`${source.url.toLowerCase()}#`) ||
    lowerUrl.startsWith('javascript:') ||
    lowerUrl.includes('twitter.com/share') ||
    lowerUrl.includes('facebook.com/sharer') ||
    lowerUrl.includes('instagram.com') ||
    lowerUrl.includes('pinterest.com')
  ) {
    return true;
  }

  if (
    !source.allowNavigationLinks &&
    (
      lowerContext.includes('nav') ||
      lowerContext.includes('menu') ||
      lowerContext.includes('header') ||
      lowerContext.includes('footer') ||
      lowerContext.includes('social')
    )
  ) {
    return true;
  }

  if (isRejectedTitle(lowerTitle, source)) {
    return true;
  }

  if (
    !matchesConfiguredPatterns(absoluteUrl, source.includeUrlPatterns, true) ||
    matchesConfiguredPatterns(absoluteUrl, source.excludeUrlPatterns, false)
  ) {
    return true;
  }

  return false;
}

function buildContextSummary(
  wrapper: ReturnType<ReturnType<typeof load>>,
  linkElement: ReturnType<ReturnType<typeof load>>,
): string {
  return [
    wrapper.prop('tagName'),
    wrapper.attr('class'),
    wrapper.parent().prop('tagName'),
    wrapper.parent().attr('class'),
    linkElement.attr('class'),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

interface JsonLdThing {
  '@type'?: string | string[];
  '@graph'?: JsonLdThing[];
  itemListElement?: Array<{
    item?: {
      url?: string;
      name?: string;
      description?: string;
      servesCuisine?: string;
      priceRange?: string;
      address?: {
        addressLocality?: string;
      };
    };
  }>;
}

function extractItemLists(node: JsonLdThing): JsonLdThing[] {
  const lists: JsonLdThing[] = [];
  const type = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];

  if (type.includes('ItemList') && Array.isArray(node.itemListElement)) {
    lists.push(node);
  }

  for (const child of node['@graph'] ?? []) {
    lists.push(...extractItemLists(child));
  }

  return lists;
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
            'user-agent': 'socal-discovery-agent/0.1',
          },
        },
        {
          ...this.httpOptions,
          retryCount: source.retryCount ?? this.httpOptions.retryCount,
          timeoutMs: source.timeoutMs ?? this.httpOptions.timeoutMs,
        },
      );
      const html = await response.text();
      if (source.parser === 'jsonLdItemList') {
        return this.discoverFromJsonLd(source, html);
      }

      const $ = load(html);
      const selector = source.itemSelector ?? 'a';
      const records: RawDiscoveryRecord[] = [];
      const seenUrls = new Set<string>();

      $(selector).each((_, element) => {
        if (records.length >= (source.maxItems ?? 15)) {
          return false;
        }

        const wrapper = $(element);
        const linkElement = source.linkSelector ? wrapper.find(source.linkSelector).first() : wrapper;
        const href = linkElement.attr('href') ?? wrapper.attr('href');
        const title = normalizeWhitespace(
          source.titleSelector
            ? wrapper.find(source.titleSelector).first().text()
            : linkElement.text() || wrapper.text(),
        );
        const description = source.descriptionSelector
          ? normalizeWhitespace(wrapper.find(source.descriptionSelector).first().text())
          : normalizeWhitespace(wrapper.parent().text().replace(title, ''));

        if (!href || !title || title.length < 4) {
          return;
        }

        const absoluteUrl = new URL(href, source.url).toString();
        const contextSummary = buildContextSummary(wrapper, linkElement);

        if (
          seenUrls.has(absoluteUrl) ||
          shouldIgnoreLink(source, absoluteUrl, title, contextSummary)
        ) {
          return;
        }

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

        seenUrls.add(absoluteUrl);
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

  private discoverFromJsonLd(source: HtmlSourceDefinition, html: string): RawDiscoveryRecord[] {
    const $ = load(html);
    const records: RawDiscoveryRecord[] = [];
    const seenUrls = new Set<string>();

    $('script[type="application/ld+json"]').each((_, element) => {
      const raw = $(element).html();
      if (!raw) {
        return;
      }

      try {
        const parsed = JSON.parse(raw) as JsonLdThing;
        for (const list of extractItemLists(parsed)) {
          for (const entry of list.itemListElement ?? []) {
            const item = entry.item;
            if (!item?.url || !item.name) {
              continue;
            }

            const absoluteUrl = new URL(item.url, source.url).toString();
            if (
              seenUrls.has(absoluteUrl) ||
              shouldIgnoreLink(source, absoluteUrl, item.name, 'jsonld itemlist')
            ) {
              continue;
            }

            const record: RawDiscoveryRecord = {
              category: source.category,
              source: {
                id: source.id,
                name: source.name,
                url: source.url,
              },
              title: normalizeWhitespace(item.name),
              url: absoluteUrl,
              summary: normalizeWhitespace(item.description ?? '').slice(0, 320),
              region: source.region,
              rawDateText: normalizeWhitespace(item.description ?? item.name),
            };

            const city = source.city ?? item.address?.addressLocality;
            if (!isAllowedCity(source, city)) {
              continue;
            }

            if (city) {
              record.city = city;
            }
            if (source.tags) {
              record.tags = source.tags;
            }

            seenUrls.add(absoluteUrl);
            records.push(record);

            if (records.length >= (source.maxItems ?? 15)) {
              return false;
            }
          }
        }
      } catch {
        return;
      }
    });

    return records;
  }
}
