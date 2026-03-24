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
  contentHash: string;
  mentions: CachedRestaurantMention[];
  updatedAt: string;
  etag?: string;
  lastModified?: string;
}

interface SearchPageCacheFile {
  version: 1;
  entries: SearchPageCacheEntry[];
}

export interface SearchPageCache {
  get(url: string): Promise<SearchPageCacheEntry | null>;
  set(entry: SearchPageCacheEntry): Promise<void>;
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
  };
}

class FileSearchPageCache {
  private loaded = false;
  private entries = new Map<string, SearchPageCacheEntry>();

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

  private async load(): Promise<void> {
    if (this.loaded) {
      return;
    }
    this.loaded = true;

    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<SearchPageCacheFile>;
      for (const entry of parsed.entries ?? []) {
        if (!entry?.url || !entry.contentHash || !Array.isArray(entry.mentions)) {
          continue;
        }
        const hydrated: SearchPageCacheEntry = {
          url: entry.url,
          contentHash: entry.contentHash,
          mentions: entry.mentions,
          updatedAt: entry.updatedAt ?? new Date(0).toISOString(),
        };
        if (typeof entry.etag === 'string') {
          hydrated.etag = entry.etag;
        }
        if (typeof entry.lastModified === 'string') {
          hydrated.lastModified = entry.lastModified;
        }
        this.entries.set(entry.url, hydrated);
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
    };
    await writeFile(this.filePath, JSON.stringify(payload, null, 2), 'utf8');
  }
}
