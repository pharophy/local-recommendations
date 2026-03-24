import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface CachedRestaurantMention {
  name: string;
  city?: string;
  url?: string;
  summary: string;
}

export interface SearchPageCacheEntry {
  url: string;
  contentHash?: string;
  mentions: CachedRestaurantMention[];
  updatedAt: string;
  etag?: string;
  lastModified?: string;
  fetchFailedAt?: string;
}

export interface CachedCanonicalRestaurantEntry {
  key: string;
  url: string | null;
  updatedAt: string;
}

interface SearchPageCacheFile {
  version: 1;
  entries: SearchPageCacheEntry[];
  canonicalEntries?: CachedCanonicalRestaurantEntry[];
}

export interface SearchPageCache {
  get(url: string): Promise<SearchPageCacheEntry | null>;
  set(entry: SearchPageCacheEntry): Promise<void>;
  getCanonical(key: string): Promise<CachedCanonicalRestaurantEntry | null>;
  setCanonical(entry: CachedCanonicalRestaurantEntry): Promise<void>;
}

export function createContentHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function createDisabledSearchPageCache(): SearchPageCache {
  return {
    async get() {
      return null;
    },
    async set() {
      return undefined;
    },
    async getCanonical() {
      return null;
    },
    async setCanonical() {
      return undefined;
    },
  };
}

export function createFileSearchPageCache(filePath: string): SearchPageCache {
  const state = new FileSearchPageCache(filePath);
  return {
    get(url) {
      return state.get(url);
    },
    set(entry) {
      return state.set(entry);
    },
    getCanonical(key) {
      return state.getCanonical(key);
    },
    setCanonical(entry) {
      return state.setCanonical(entry);
    },
  };
}

class FileSearchPageCache {
  private loaded = false;
  private entries = new Map<string, SearchPageCacheEntry>();
  private canonicalEntries = new Map<string, CachedCanonicalRestaurantEntry>();

  public constructor(private readonly filePath: string) {}

  public async get(url: string): Promise<SearchPageCacheEntry | null> {
    await this.load();
    return this.entries.get(url) ?? null;
  }

  public async set(entry: SearchPageCacheEntry): Promise<void> {
    await this.load();
    this.entries.set(entry.url, entry);
    await this.persist();
  }

  public async getCanonical(key: string): Promise<CachedCanonicalRestaurantEntry | null> {
    await this.load();
    return this.canonicalEntries.get(key) ?? null;
  }

  public async setCanonical(entry: CachedCanonicalRestaurantEntry): Promise<void> {
    await this.load();
    this.canonicalEntries.set(entry.key, entry);
    await this.persist();
  }

  private async load(): Promise<void> {
    if (this.loaded) {
      return;
    }
    this.loaded = true;

    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<SearchPageCacheFile>;
      for (const entry of parsed.entries ?? []) {
        if (!entry?.url || !Array.isArray(entry.mentions)) {
          continue;
        }
        const hydrated: SearchPageCacheEntry = {
          url: entry.url,
          mentions: entry.mentions,
          updatedAt: entry.updatedAt ?? new Date(0).toISOString(),
        };
        if (typeof entry.contentHash === 'string' && entry.contentHash.length > 0) {
          hydrated.contentHash = entry.contentHash;
        }
        if (typeof entry.etag === 'string') {
          hydrated.etag = entry.etag;
        }
        if (typeof entry.lastModified === 'string') {
          hydrated.lastModified = entry.lastModified;
        }
        if (typeof entry.fetchFailedAt === 'string') {
          hydrated.fetchFailedAt = entry.fetchFailedAt;
        }
        this.entries.set(entry.url, hydrated);
      }
      for (const entry of parsed.canonicalEntries ?? []) {
        if (!entry?.key || typeof entry.updatedAt !== 'string') {
          continue;
        }
        this.canonicalEntries.set(entry.key, {
          key: entry.key,
          url: typeof entry.url === 'string' ? entry.url : null,
          updatedAt: entry.updatedAt,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('ENOENT')) {
        throw error;
      }
    }
  }

  private async persist(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const payload: SearchPageCacheFile = {
      version: 1,
      entries: [...this.entries.values()].sort((left, right) => left.url.localeCompare(right.url)),
      canonicalEntries: [...this.canonicalEntries.values()].sort((left, right) => left.key.localeCompare(right.key)),
    };
    await writeFile(this.filePath, JSON.stringify(payload, null, 2), 'utf8');
  }
}
