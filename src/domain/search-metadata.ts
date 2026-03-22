import { DEFAULT_REGION_PRIORITY, EXPERIENCE_CATEGORIES, type ExperienceCategory } from './categories.js';

export interface SearchMetadata {
  tableName: ExperienceCategory;
  enabled: boolean;
  dailyTargetNewItems: number;
  searchFocus: string[];
  includeTerms: string[];
  excludeTerms: string[];
  audienceBias: string[];
  kidFocus: boolean;
  indoorOutdoorBias: string | null;
  priceBias: string | null;
  regionPriority: string[];
  dateWindowDays: number | null;
  sourcePriorityNotes: string | null;
  notes: string | null;
  updatedAt: string | null;
}

export const DEFAULT_DAILY_TARGET = 5;
export const DEFAULT_SPECIAL_EVENTS_WINDOW_DAYS = 30;

export function buildDefaultSearchMetadata(
  tableName: ExperienceCategory,
  overrides: Partial<SearchMetadata> = {},
): SearchMetadata {
  return {
    tableName,
    enabled: true,
    dailyTargetNewItems: DEFAULT_DAILY_TARGET,
    searchFocus: [],
    includeTerms: [],
    excludeTerms: [],
    audienceBias: [],
    kidFocus: false,
    indoorOutdoorBias: null,
    priceBias: null,
    regionPriority: [...DEFAULT_REGION_PRIORITY],
    dateWindowDays:
      tableName === 'SpecialEvents' ? DEFAULT_SPECIAL_EVENTS_WINDOW_DAYS : null,
    sourcePriorityNotes: null,
    notes: null,
    updatedAt: null,
    ...overrides,
  };
}

export function defaultSearchMetadataRows(): SearchMetadata[] {
  return EXPERIENCE_CATEGORIES.map((category) =>
    buildDefaultSearchMetadata(category, {
      searchFocus:
        category === 'Activities'
          ? ['immersive', 'quirky', 'hands-on']
          : category === 'Restaurants'
            ? ['themed dining', 'immersive dining', 'hidden gem']
            : category === 'Nature'
              ? ['waterfalls', 'caves', 'scenic overlooks']
              : ['pop-up', 'limited-run', 'festival'],
      includeTerms:
        category === 'Activities'
          ? ['fantasy themed', 'sci-fi', 'classic rock']
          : category === 'Restaurants'
            ? ['immersive dining', 'themed bar']
            : category === 'Nature'
              ? ['kid STEM', 'rock mining', 'trains']
              : ['live shows', 'fandom'],
    }),
  );
}
