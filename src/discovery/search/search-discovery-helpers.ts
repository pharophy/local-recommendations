import { load } from 'cheerio';

import type { HttpClientOptions } from '../../utils/http.js';
import { fetchWithRetry } from '../../utils/http.js';
import { normalizeText, normalizeWhitespace } from '../../utils/strings.js';
import type { Logger } from '../../utils/logger.js';
import type { RawDiscoveryRecord } from '../../domain/experience.js';
import type { SearchMetadata } from '../../domain/search-metadata.js';
import {
  createContentHash,
  type CachedRestaurantMention,
  type SearchPageCacheEntry,
  type SearchPageCache,
} from './search-page-cache.js';

export interface SearchDiscoverySeed {
  title: string;
  url: string;
  summary: string;
  rawDateText: string;
  extraSnippets?: string[];
}

export interface SearchProviderSource {
  id: string;
  name: string;
  url: string;
}

const BLOCKED_DISCOVERY_DOMAINS = [
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'mapquest.com',
  'maps.apple.com',
  'pinterest.com',
  'tripadvisor.com',
  'x.com',
  'yelp.com',
  'youtube.com',
];
const BLOCKED_ENRICHMENT_DOMAINS = [
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'maps.apple.com',
  'pinterest.com',
  'x.com',
  'youtube.com',
];
const LOW_SIGNAL_PATTERNS = [
  /\btop \d+\b/i,
  /\bbest\b/i,
  /\bguide\b/i,
  /\bthings to do\b/i,
  /\blist\b/i,
];
const RESTAURANT_SEED_TITLE_PATTERNS = [
  /\bgood places to eat\b/i,
  /\bmust try\b/i,
  /\bfine dining\b/i,
  /\bclassic\b/i,
  /\bwhere to eat\b/i,
  /\beat(?:ing)? in\b/i,
  /\beateries\b/i,
  /\bfood in\b/i,
  /\bdining spots\b/i,
];
const RESTAURANT_SEED_DOMAINS = [
  'reddit.com',
  'quora.com',
  'eater.com',
  'visitanaheim.org',
  'mylocaloc.com',
  'gastronomyblog.com',
  'ocfoodies.com',
  'orangecoast.com',
  'lamag.com',
  'localemagazine.com',
  'ocregister.com',
  'losangelesmagazine.com',
];
const RESTAURANT_COMMUNITY_EDITORIAL_DOMAINS = [
  'reddit.com',
  'quora.com',
  'eater.com',
  'visitanaheim.org',
  'mylocaloc.com',
  'gastronomyblog.com',
  'ocfoodies.com',
  'orangecoast.com',
  'lamag.com',
  'localemagazine.com',
  'ocregister.com',
  'losangelesmagazine.com',
];
const RESTAURANT_MARKETPLACE_DOMAINS = [
  'grubhub.com',
  'doordash.com',
  'postmates.com',
  'ezcater.com',
  'alohaorderonline.com',
  'linkedin.com',
  'muckrack.com',
  'tripadvisor.com',
  'yelp.com',
  'opentable.com',
  'resy.com',
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'nextdoor.com',
  'guide.michelin.com',
];
const RESTAURANT_EDITORIAL_URL_PATTERNS = [
  /\/neighborhood\//i,
  /\/tag\//i,
  /\/tags\//i,
  /\/maps\//i,
  /\/category\//i,
  /\/author\//i,
  /\/writers?\//i,
  /\/blog\//i,
  /\/food\//i,
  /\/eat-drink\//i,
];
const GENERIC_RESTAURANT_NAME_PATTERNS = [
  /\bwebsite\b/i,
  /\borange county\b/i,
  /\bcalifornia\b/i,
  /\breddit\b/i,
  /\bquora\b/i,
  /\bcomment\b/i,
  /\bskip\b/i,
  /\bnavigation\b/i,
  /\bmain content\b/i,
  /\bprofessional writer\b/i,
  /\bgood quality food\b/i,
  /\bhey\b/i,
  /\bthanks\b/i,
  /\bgo to\b/i,
  /\bif money\b/i,
  /\bpin\b/i,
  /\bmust try food\b/i,
  /\bgood places to eat\b/i,
  /\bfine dining\b/i,
  /\bnew american\b/i,
  /\bbrunch\b/i,
  /\bdesserts?\b/i,
  /\bsteak\b/i,
  /\bpizza\b/i,
  /\bitalian\b/i,
  /\bvietnamese\b/i,
  /\bmexican restaurant\b/i,
];
const RESTAURANT_CONTEXT_TERMS = [
  'restaurant',
  'dining',
  'dinner',
  'lunch',
  'brunch',
  'dessert',
  'soft serve',
  'ice cream',
  'gelato',
  'boba',
  'tea',
  'cocktails',
  'bar',
  'bistro',
  'cafe',
  'chef',
  'tasting',
  'menu',
  'omakase',
  'speakeasy',
  'themed',
  'immersive',
  'presentation',
  'tableside',
];
const NON_VENUE_LOCATION_NAMES = new Set(
  [
    'anaheim',
    'anaheim hills',
    'brea',
    'costa mesa',
    'cypress',
    'dana point',
    'fullerton',
    'huntington beach',
    'irvine',
    'laguna beach',
    'newport beach',
    'orange',
    'orange county',
    'san clemente',
    'san juan capistrano',
    'santa ana',
    'tustin',
  ],
);
const MAX_EXPANDED_RESTAURANTS_PER_PAGE = 5;
const MAX_TEXT_BLOCKS = 60;

interface ExtractedRestaurantMention {
  name: string;
  city?: string;
  url?: string;
  summary: string;
}

export function isAcceptedDiscoveryResult(
  url: string,
  title: string,
  category: SearchMetadata['tableName'],
): boolean {
  const domain = extractDomain(url);
  if (!url || !title || !domain) {
    return false;
  }
  if (BLOCKED_DISCOVERY_DOMAINS.some((blocked) => domain.includes(blocked))) {
    return false;
  }
  if (category === 'Restaurants' && shouldExpandRestaurantSeed(url, title)) {
    return true;
  }
  if (LOW_SIGNAL_PATTERNS.some((pattern) => pattern.test(title))) {
    return false;
  }
  if (category === 'SpecialEvents' && /\btickets?\b/i.test(title) && !/\bevent\b/i.test(title)) {
    return false;
  }
  return true;
}

export function isAcceptedEnrichmentResult(url: string, title: string): boolean {
  const domain = extractDomain(url);
  if (!url || !title || !domain) {
    return false;
  }
  return !BLOCKED_ENRICHMENT_DOMAINS.some((blocked) => domain.includes(blocked));
}

export async function buildDiscoveryRecordsFromSeed(
  seed: SearchDiscoverySeed,
  metadata: SearchMetadata,
  source: SearchProviderSource,
  httpOptions: HttpClientOptions,
  logger: Logger,
  cache: SearchPageCache,
): Promise<RawDiscoveryRecord[]> {
  if (metadata.tableName === 'Restaurants' && shouldExpandRestaurantSeed(seed.url, seed.title)) {
    return expandRestaurantSeed(seed, metadata, source, httpOptions, logger, cache);
  }

  return [mapSearchSeedToRawRecord(seed, metadata, source)];
}

export function extractDomain(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function dedupeByUrl(records: RawDiscoveryRecord[]): RawDiscoveryRecord[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (!record.url || seen.has(record.url)) {
      return false;
    }
    seen.add(record.url);
    return true;
  });
}

export function shouldCanonicalizeRestaurantRecord(record: RawDiscoveryRecord): boolean {
  if (record.category !== 'Restaurants') {
    return false;
  }

  const domain = extractDomain(record.url);
  return (
    (record.tags ?? []).includes('editorial-mention') &&
    RESTAURANT_COMMUNITY_EDITORIAL_DOMAINS.some((value) => domain.includes(value))
  );
}

export function isRejectedRestaurantCandidateUrl(url: string, candidateName?: string): boolean {
  const domain = extractDomain(url);
  const lowerUrl = url.toLowerCase();
  return (
    RESTAURANT_COMMUNITY_EDITORIAL_DOMAINS.some((value) => domain.includes(value)) ||
    RESTAURANT_MARKETPLACE_DOMAINS.some((value) => domain.includes(value)) ||
    RESTAURANT_EDITORIAL_URL_PATTERNS.some((pattern) => pattern.test(lowerUrl)) ||
    (Boolean(candidateName) && looksLikePersonName(candidateName!) && !hasVenueKeyword(url))
  );
}

export function isAcceptedCanonicalRestaurantResult(
  resultUrl: string,
  resultTitle: string,
  resultSummary: string,
  candidateName: string,
): boolean {
  if (!resultUrl || !resultTitle || isRejectedRestaurantCandidateUrl(resultUrl, candidateName)) {
    return false;
  }

  const haystack = `${resultTitle} ${resultSummary} ${resultUrl}`.toLowerCase();
  const tokens = tokenizeRestaurantName(candidateName);
  if (tokens.length === 0) {
    return false;
  }

  const matchedTokens = tokens.filter((token) => haystack.includes(token)).length;
  return matchedTokens >= Math.min(2, tokens.length);
}

function mapSearchSeedToRawRecord(
  seed: SearchDiscoverySeed,
  metadata: SearchMetadata,
  source: SearchProviderSource,
): RawDiscoveryRecord {
  return {
    category: metadata.tableName,
    source,
    title:
      metadata.tableName === 'Restaurants'
        ? normalizeRestaurantResultTitle(seed.title)
        : normalizeWhitespace(seed.title),
    url: seed.url,
    summary: normalizeWhitespace([seed.summary, ...(seed.extraSnippets ?? [])].join(' ')).slice(0, 320),
    rawDateText: normalizeWhitespace(seed.rawDateText),
    provenance: 'search',
    tags: ['search-derived', extractDomain(seed.url)].filter(Boolean),
  };
}

function normalizeRestaurantResultTitle(value: string): string {
  let title = normalizeWhitespace(value);
  title = title.replace(/^Home\s*-\s*/i, '');
  title = title.replace(/\s*\|\s*Official Site.*$/i, '');
  title = title.replace(/\s*-\s*Official Site.*$/i, '');
  title = title.replace(/\s*-\s*Restaurant in .+$/i, '');
  title = title.replace(/\s*-\s*Orange County,\s*CA$/i, '');
  return normalizeWhitespace(title);
}

function shouldExpandRestaurantSeed(url: string, title: string): boolean {
  const domain = extractDomain(url);
  if (!domain) {
    return false;
  }

  return (
    RESTAURANT_SEED_DOMAINS.some((seedDomain) => domain.includes(seedDomain)) ||
    RESTAURANT_SEED_TITLE_PATTERNS.some((pattern) => pattern.test(title))
  );
}

async function expandRestaurantSeed(
  seed: SearchDiscoverySeed,
  metadata: SearchMetadata,
  source: SearchProviderSource,
  httpOptions: HttpClientOptions,
  logger: Logger,
  cache: SearchPageCache,
): Promise<RawDiscoveryRecord[]> {
  const cached = await cache.get(seed.url);
  const mentions: ExtractedRestaurantMention[] = [];

  try {
    const headers: Record<string, string> = {
      Accept: 'text/html,application/xhtml+xml',
      'user-agent': 'socal-discovery-agent/0.1',
    };
    if (cached?.etag) {
      headers['If-None-Match'] = cached.etag;
    }
    if (cached?.lastModified) {
      headers['If-Modified-Since'] = cached.lastModified;
    }
    const response = await fetchWithRetry(
      seed.url,
      {
        headers,
      },
      httpOptions,
    );

    if (response.status === 304 && cached) {
      mentions.push(...cached.mentions.map(toExtractedRestaurantMention));
    } else if (!response.ok) {
      throw new Error(`Received ${response.status} from ${seed.url}`);
    } else {
      const html = await response.text();
      const contentHash = createContentHash(html);
      if (cached && cached.contentHash === contentHash) {
        mentions.push(...cached.mentions.map(toExtractedRestaurantMention));
      } else {
        mentions.push(...extractRestaurantMentionsFromHtml(html, seed.url));
      }
      await cache.set(buildUpdatedCacheEntry(seed.url, response, contentHash, mentions, cached));
    }
  } catch (error) {
    logger.warn('Discovery source failed', {
      sourceId: source.id,
      error: `Failed to expand restaurant seed ${seed.url}: ${error instanceof Error ? error.message : String(error)}`,
    });
    if (cached) {
      mentions.push(...cached.mentions.map(toExtractedRestaurantMention));
    }
  }

  if (mentions.length === 0) {
    const fallbackText = normalizeWhitespace([seed.summary, ...(seed.extraSnippets ?? [])].join(' '));
    for (const sentence of splitIntoSentences(fallbackText)) {
      mentions.push(...extractMentionsFromText(sentence));
    }
  }

  return mentions
    .map((mention) => convertMentionToRawRecord(mention, seed, metadata, source))
    .filter((record): record is RawDiscoveryRecord => record !== null)
    .slice(0, MAX_EXPANDED_RESTAURANTS_PER_PAGE);
}

function convertMentionToRawRecord(
  mention: ExtractedRestaurantMention,
  seed: SearchDiscoverySeed,
  metadata: SearchMetadata,
  source: SearchProviderSource,
): RawDiscoveryRecord | null {
  const name = normalizeWhitespace(mention.name);
  if (!isLikelyRestaurantName(name)) {
    return null;
  }

  const summary = buildMentionSummary(mention, seed);
  if (mention.url && shouldIgnoreMentionUrl(mention.url, seed.url)) {
    return null;
  }
  const url = mention.url ?? `${seed.url}#${slugify(name)}`;
  const domain = extractDomain(url);
  const tags = ['search-derived', 'editorial-mention', domain].filter(Boolean);
  if (!domain || BLOCKED_DISCOVERY_DOMAINS.some((blocked) => domain.includes(blocked))) {
    return null;
  }
  const record: RawDiscoveryRecord = {
    category: metadata.tableName,
    source,
    title: name,
    url,
    summary,
    rawDateText: normalizeWhitespace([name, summary].join(' ')),
    provenance: 'search',
    tags,
  };

  if (mention.city) {
    record.city = mention.city;
  }

  return record;
}

function buildMentionSummary(mention: ExtractedRestaurantMention, seed: SearchDiscoverySeed): string {
  const localSummary = normalizeWhitespace(mention.summary);
  if (localSummary.length >= 80) {
    return localSummary.slice(0, 320);
  }

  const nameTokens = tokenizeRestaurantName(mention.name);
  const supportingSnippet = [seed.summary, ...(seed.extraSnippets ?? [])]
    .map((value) => normalizeWhitespace(value))
    .find((value) => nameTokens.some((token) => value.toLowerCase().includes(token)));

  return normalizeWhitespace([localSummary, supportingSnippet].filter(Boolean).join(' ')).slice(0, 320);
}

function extractRestaurantMentionsFromHtml(html: string, pageUrl: string): ExtractedRestaurantMention[] {
  const $ = load(html);
  const candidates = [$('main').first(), $('article').first(), $('[role="main"]').first(), $('body').first()];
  const contentRoot = candidates.find((candidate) => candidate.length > 0) ?? $('body').first();
  const blocks: string[] = [];
  const seenBlocks = new Set<string>();

  contentRoot.find('li, p, h2, h3, h4, strong, b, a').each((_, element) => {
    if (blocks.length >= MAX_TEXT_BLOCKS) {
      return false;
    }

    const text = normalizeWhitespace($(element).text());
    if (!text || text.length < 4 || seenBlocks.has(text.toLowerCase())) {
      return;
    }
    seenBlocks.add(text.toLowerCase());
    blocks.push(text);
  });

  const mentions = new Map<string, ExtractedRestaurantMention>();
  contentRoot.find('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    const name = normalizeWhitespace($(element).text());
    if (!href || !isLikelyRestaurantName(name)) {
      return;
    }

    const absoluteUrl = new URL(href, pageUrl).toString();
    if (extractDomain(absoluteUrl) === extractDomain(pageUrl)) {
      return;
    }
    if (shouldIgnoreMentionUrl(absoluteUrl, pageUrl)) {
      return;
    }
    const summary = normalizeWhitespace($(element).parent().text());
    const city = inferCityFromText(summary);
    const key = name.toLowerCase();
    if (!mentions.has(key)) {
      const mention: ExtractedRestaurantMention = { name, url: absoluteUrl, summary };
      if (city) {
        mention.city = city;
      }
      mentions.set(key, mention);
    }
  });

  contentRoot.find('strong, b, h2, h3, h4').each((_, element) => {
    const name = normalizeWhitespace($(element).text());
    if (!isLikelyRestaurantName(name)) {
      return;
    }

    const context = normalizeWhitespace($(element).parent().text());
    if (!hasRestaurantContext(context) && !hasVenueKeyword(name)) {
      return;
    }

    const city = inferCityFromText(context);
    const key = name.toLowerCase();
    if (!mentions.has(key)) {
      const mention: ExtractedRestaurantMention = { name, summary: context || name };
      if (city) {
        mention.city = city;
      }
      mentions.set(key, mention);
    }
  });

  for (const block of blocks) {
    for (const mention of extractMentionsFromText(block)) {
      const key = mention.name.toLowerCase();
      if (!mentions.has(key)) {
        mentions.set(key, mention);
      }
    }
  }

  return [...mentions.values()].slice(0, MAX_EXPANDED_RESTAURANTS_PER_PAGE);
}

function extractMentionsFromText(text: string): ExtractedRestaurantMention[] {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return [];
  }

  const mentions: ExtractedRestaurantMention[] = [];
  const addMention = (name: string, context = normalized, city?: string) => {
    const cleaned = cleanCandidateName(name);
    if (!isLikelyRestaurantName(cleaned)) {
      return;
    }
    mentions.push({
      name: cleaned,
      summary: context,
    });
    const inferredCity = city ?? inferCityFromText(context);
    if (inferredCity) {
      mentions[mentions.length - 1]!.city = inferredCity;
    }
  };

  const parentheticalMatches = normalized.matchAll(
    /\b([A-Z][A-Za-z0-9'&.-]+(?:\s+[A-Z][A-Za-z0-9'&.-]+){0,5})\s*\(([^)]{2,40})\)/g,
  );
  for (const match of parentheticalMatches) {
    addMention(match[1] ?? '', normalized, inferCityFromText(normalizeWhitespace(match[2] ?? '')));
  }

  const verbLeadMatch = normalized.match(
    /^([A-Z][A-Za-z0-9'&.-]+(?:\s+[A-Z][A-Za-z0-9'&.-]+){0,5})(?:\s+in\s+[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})?(?:,\s*which)?\s+(?:is|are|was|offers|serve(?:s)?|has)\b/,
  );
  if (verbLeadMatch) {
    const inferredCity = inferCityFromText(normalized);
    const candidateName = verbLeadMatch[1] ?? '';
    const wordCount = candidateName.trim().split(/\s+/).length;
    if (hasVenueKeyword(candidateName) || wordCount >= 2 || hasRestaurantContext(normalized)) {
      addMention(candidateName, normalized, inferredCity);
    }
  }

  const venueKeywordMatches = normalized.matchAll(
    /\b([A-Z][A-Za-z0-9'&.-]+(?:\s+[A-Z][A-Za-z0-9'&.-]+){0,5}\s+(?:Restaurant|Tavern|Cafe|Bar|Bistro|Kitchen|Grill|House|Steakhouse|Chophouse|Diner|BBQ|Pizzeria|Cantina))\b/g,
  );
  for (const match of venueKeywordMatches) {
    addMention(match[1] ?? '', normalized, inferCityFromText(normalized));
  }

  const contextualMatches = normalized.matchAll(
    /\b(?:inside|at|try|visit|head to|check out)\s+([A-Z][A-Za-z0-9'&.-]+(?:\s+[A-Z][A-Za-z0-9'&.-]+){0,4})\b/g,
  );
  for (const match of contextualMatches) {
    if (hasRestaurantContext(normalized)) {
      addMention(match[1] ?? '', normalized, inferCityFromText(normalized));
    }
  }

  return dedupeMentions(mentions);
}

function dedupeMentions(mentions: ExtractedRestaurantMention[]): ExtractedRestaurantMention[] {
  const seen = new Set<string>();
  return mentions.filter((mention) => {
    const key = mention.name.toLowerCase();
    if (!mention.name || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function cleanCandidateName(value: string): string {
  return normalizeWhitespace(value)
    .replace(/^r\/[a-z0-9_-]+\s+on\s+reddit:\s*/i, '')
    .replace(/^what are some good places to eat in\s+/i, '')
    .replace(/^[A-Za-z ]+:\s*/, '')
    .replace(/[.?!,:-]+$/g, '')
    .trim();
}

function isLikelyRestaurantName(value: string): boolean {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed || trimmed.length < 3 || trimmed.length > 80) {
    return false;
  }

  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 7) {
    return false;
  }

  if (!/[A-Z]/.test(trimmed) || !/[A-Za-z]/.test(trimmed)) {
    return false;
  }

  if (trimmed.includes('_')) {
    return false;
  }

  if (!hasVenueLikeCapitalization(trimmed)) {
    return false;
  }

  if (NON_VENUE_LOCATION_NAMES.has(trimmed.toLowerCase())) {
    return false;
  }

  if (GENERIC_RESTAURANT_NAME_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return false;
  }

  if (/^(home|menu|book|reservations?|login|share|save)$/i.test(trimmed)) {
    return false;
  }

  return true;
}

function hasRestaurantContext(value: string): boolean {
  const lower = value.toLowerCase();
  return RESTAURANT_CONTEXT_TERMS.some((term) => lower.includes(term));
}

function splitIntoSentences(value: string): string[] {
  return normalizeWhitespace(value)
    .split(/[.!?]\s+/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)
    .slice(0, 12);
}

function inferCityFromText(text: string): string | undefined {
  const match = text.match(
    /\b(Anaheim Hills|Anaheim|Brea|Costa Mesa|Fullerton|Huntington Beach|Irvine|Laguna Beach|Newport Beach|Orange|San Clemente|San Juan Capistrano|Santa Ana|Tustin)\b/i,
  );
  return match ? toTitleCase(normalizeWhitespace(match[1] ?? '').toLowerCase()) : undefined;
}

function toCachedRestaurantMention(mention: ExtractedRestaurantMention): CachedRestaurantMention {
  const cached: CachedRestaurantMention = {
    name: mention.name,
    summary: mention.summary,
  };
  if (mention.city) {
    cached.city = mention.city;
  }
  if (mention.url) {
    cached.url = mention.url;
  }
  return cached;
}

function toExtractedRestaurantMention(mention: CachedRestaurantMention): ExtractedRestaurantMention {
  const extracted: ExtractedRestaurantMention = {
    name: mention.name,
    summary: mention.summary,
  };
  if (mention.city) {
    extracted.city = mention.city;
  }
  if (mention.url) {
    extracted.url = mention.url;
  }
  return extracted;
}

function buildUpdatedCacheEntry(
  url: string,
  response: Response,
  contentHash: string,
  mentions: ExtractedRestaurantMention[],
  cached: SearchPageCacheEntry | null,
): SearchPageCacheEntry {
  const entry: SearchPageCacheEntry = {
    url,
    contentHash,
    mentions: mentions.map(toCachedRestaurantMention),
    updatedAt: new Date().toISOString(),
  };
  const etag = normalizeHeader(response.headers.get('etag')) ?? cached?.etag;
  const lastModified = normalizeHeader(response.headers.get('last-modified')) ?? cached?.lastModified;
  if (etag) {
    entry.etag = etag;
  }
  if (lastModified) {
    entry.lastModified = lastModified;
  }
  return entry;
}

function normalizeHeader(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function shouldIgnoreMentionUrl(url: string, pageUrl: string): boolean {
  const lowerUrl = url.toLowerCase();
  const pageDomain = extractDomain(pageUrl);
  const urlDomain = extractDomain(url);

  if (
    lowerUrl.startsWith(`${pageUrl.toLowerCase()}#`) ||
    lowerUrl.includes('/user/') ||
    lowerUrl.includes('/members/') ||
    lowerUrl.includes('/profile/') ||
    lowerUrl.includes('/pin/create/') ||
    lowerUrl.includes('/share') ||
    lowerUrl.includes('share=') ||
    lowerUrl.includes('login') ||
    lowerUrl.includes('signup')
  ) {
    return true;
  }

  if (pageDomain.includes('reddit.com') && urlDomain === pageDomain && !lowerUrl.includes('/comments/')) {
    return true;
  }

  return false;
}

function hasVenueLikeCapitalization(value: string): boolean {
  const connectors = new Set(['&', 'and', 'the', 'of', 'de', 'la', 'le', 'el', 'y', 'n']);
  const allowedLeadingArticles = new Set(['el', 'la', 'le']);
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return false;
  }

  return words.every((word, index) => {
    const cleaned = word.replace(/^[("'`]+|[)"'`,.;:!?-]+$/g, '');
    if (!cleaned) {
      return true;
    }
    const lower = cleaned.toLowerCase();
    if (connectors.has(lower)) {
      return index > 0 || allowedLeadingArticles.has(lower);
    }
    if (/^[A-Z][A-Za-z'&.-]*$/.test(cleaned)) {
      return true;
    }
    return /^[A-Z][A-Za-z0-9'&.-]*$/.test(cleaned);
  });
}

function hasVenueKeyword(value: string): boolean {
  return /\b(restaurant|tavern|cafe|bar|bistro|kitchen|grill|house|steakhouse|chophouse|chop house|diner|bbq|pizzeria|cantina|creamery|tea house)\b/i.test(value);
}

function tokenizeRestaurantName(value: string): string[] {
  return normalizeText(value)
    .split('-')
    .filter((token) => token.length >= 3 && !['the', 'and', 'bar', 'cafe', 'el', 'la'].includes(token));
}

function toTitleCase(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function looksLikePersonName(value: string): boolean {
  if (hasVenueKeyword(value)) {
    return false;
  }

  const words = normalizeWhitespace(value).split(/\s+/).filter(Boolean);
  if (words.length !== 2) {
    return false;
  }

  return words.every((word) => /^[A-Z][a-z]+$/.test(word));
}
