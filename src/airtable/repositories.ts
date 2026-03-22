import type { RuntimeConfig } from '../config/runtime.js';
import type { ExperienceCategory } from '../domain/categories.js';
import { isExperienceCategory } from '../domain/categories.js';
import type { ExistingExperienceRef, ExperienceCandidate } from '../domain/experience.js';
import {
  buildDefaultSearchMetadata,
  DEFAULT_DAILY_TARGET,
  DEFAULT_SPECIAL_EVENTS_WINDOW_DAYS,
} from '../domain/search-metadata.js';
import type { SearchMetadata } from '../domain/search-metadata.js';
import { splitListField } from '../utils/strings.js';
import type { AirtableClient } from './client.js';
import { EXPERIENCE_TABLE_FIELDS, SEARCH_METADATA_FIELDS } from './schema.js';

export interface AirtableFields {
  [key: string]: unknown;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readField(fields: AirtableFields, ...names: string[]): unknown {
  for (const name of names) {
    if (name in fields) {
      return fields[name];
    }
  }

  return undefined;
}

function normalizeMetadataCategory(value: string): ExperienceCategory | null {
  const normalized = value.trim();
  if (normalized === 'Special Events') {
    return 'SpecialEvents';
  }

  return isExperienceCategory(normalized) ? normalized : null;
}

function categoryToMetadataTableName(category: ExperienceCategory): string {
  return category === 'SpecialEvents' ? 'Special Events' : category;
}

export class SearchMetadataRepository {
  public constructor(
    private readonly client: AirtableClient,
    private readonly config: RuntimeConfig,
  ) { }

  public async getMetadata(): Promise<SearchMetadata[]> {
    const rows = await this.client.listRecords<AirtableFields>(
      this.config.tableNames.SearchMetadata,
      {
        fields: [...SEARCH_METADATA_FIELDS],
      },
    );

    return rows
      .map((row) => parseSearchMetadataRecord(row.fields, this.config.defaultRegionPriority))
      .filter((row): row is SearchMetadata => row !== null);
  }

  public async seedDefaults(dryRun: boolean): Promise<SearchMetadata[]> {
    const defaults = [
      buildDefaultSearchMetadata('Activities'),
      buildDefaultSearchMetadata('Restaurants'),
      buildDefaultSearchMetadata('Nature'),
      buildDefaultSearchMetadata('SpecialEvents'),
    ];

    if (!dryRun) {
      await this.client.createRecords(
        this.config.tableNames.SearchMetadata,
        defaults.map((row) => searchMetadataToFields(row)),
      );
    }

    return defaults;
  }
}

export class ExperienceRepository {
  public constructor(
    private readonly client: AirtableClient,
    private readonly config: RuntimeConfig,
  ) { }

  public async getExisting(category: ExperienceCategory): Promise<ExistingExperienceRef[]> {
    const rows = await this.client.listRecords<AirtableFields>(this.config.tableNames[category], {
      fields: ['Name', 'City', 'Region', 'DuplicateKey'],
    });

    return rows.map((row) => ({
      duplicateKey: readString(row.fields['DuplicateKey']),
      name: readString(row.fields['Name']),
      city: readString(row.fields['City']),
      region: readString(row.fields['Region']),
    }));
  }

  public async insert(category: ExperienceCategory, experiences: ExperienceCandidate[]): Promise<void> {
    await this.client.createRecords(
      this.config.tableNames[category],
      experiences.map((experience) => experienceToAirtableFields(category, experience)),
    );
  }
}

export function parseSearchMetadataRecord(
  fields: AirtableFields,
  defaultRegionPriority: string[],
): SearchMetadata | null {
  const tableNameValue = normalizeMetadataCategory(
    readString(readField(fields, 'Table Name', 'TableName')),
  );
  if (!tableNameValue) {
    return null;
  }

  const defaultDateWindow =
    tableNameValue === 'SpecialEvents' ? DEFAULT_SPECIAL_EVENTS_WINDOW_DAYS : null;

  return buildDefaultSearchMetadata(tableNameValue, {
    enabled:
      readField(fields, 'Active', 'Enabled') === undefined
        ? true
        : Boolean(readField(fields, 'Active', 'Enabled')),
    dailyTargetNewItems: Number(
      readField(fields, 'DailyTargetNewItems') ?? DEFAULT_DAILY_TARGET,
    ),
    searchFocus: splitListField(readField(fields, 'Search Focus', 'SearchFocus')),
    includeTerms: splitListField(readField(fields, 'Include Terms', 'IncludeTerms')),
    excludeTerms: splitListField(readField(fields, 'Exclude Terms', 'ExcludeTerms')),
    audienceBias: splitListField(readField(fields, 'Audience Bias', 'AudienceBias')),
    kidFocus: Boolean(readField(fields, 'Kid Focus', 'KidFocus') ?? false),
    indoorOutdoorBias:
      readField(fields, 'Indoor / Outdoor Bias', 'IndoorOutdoorBias') === undefined
        ? null
        : readString(readField(fields, 'Indoor / Outdoor Bias', 'IndoorOutdoorBias')),
    priceBias:
      readField(fields, 'Price Bias', 'PriceBias') === undefined
        ? null
        : readString(readField(fields, 'Price Bias', 'PriceBias')),
    regionPriority:
      splitListField(readField(fields, 'Region Notes', 'RegionPriority')).length > 0
        ? splitListField(readField(fields, 'Region Notes', 'RegionPriority'))
        : defaultRegionPriority,
    dateWindowDays:
      readField(fields, 'Date Window Days', 'DateWindowDays') === undefined
        ? defaultDateWindow
        : Number(readField(fields, 'Date Window Days', 'DateWindowDays')),
    sourcePriorityNotes:
      readField(fields, 'Search Notes', 'SourcePriorityNotes') === undefined
        ? null
        : readString(readField(fields, 'Search Notes', 'SourcePriorityNotes')),
    notes:
      readField(fields, 'Table Purpose', 'Notes') === undefined
        ? null
        : readString(readField(fields, 'Table Purpose', 'Notes')),
    updatedAt:
      readField(fields, 'Last Updated', 'UpdatedAt') === undefined
        ? null
        : readString(readField(fields, 'Last Updated', 'UpdatedAt')),
  });
}

export function searchMetadataToFields(metadata: SearchMetadata): AirtableFields {
  return {
    'Table Name': categoryToMetadataTableName(metadata.tableName),
    'Table Purpose': metadata.notes,
    Active: metadata.enabled,
    'Search Focus': metadata.searchFocus.join(', '),
    'Include Terms': metadata.includeTerms.join(', '),
    'Exclude Terms': metadata.excludeTerms.join(', '),
    'Audience Bias': metadata.audienceBias.join(', '),
    'Kid Focus': metadata.kidFocus,
    'Indoor / Outdoor Bias': metadata.indoorOutdoorBias,
    'Price Bias': metadata.priceBias,
    'Date Window Days': metadata.dateWindowDays,
    'Region Notes': metadata.regionPriority.join(', '),
    'Search Notes': metadata.sourcePriorityNotes,
    'Last Updated': metadata.updatedAt ?? new Date().toISOString(),
  };
}

export function experienceToAirtableFields(
  category: ExperienceCategory,
  experience: ExperienceCandidate,
): AirtableFields {
  const common = {
    Name: experience.name,
    Region: experience.region,
    City: experience.city,
    ShortDescription: experience.shortDescription,
    WhyUnique: experience.whyUnique,
    Themes: experience.themes.join(', '),
    Audience: experience.audience.join(', '),
    KidFriendly: experience.kidFriendly,
    IndoorOutdoor: experience.indoorOutdoor,
    PriceLevel: experience.priceLevel,
    ReservationRecommended: experience.reservationRecommended,
    Website: experience.website,
    SourceName: experience.sourceName,
    SourceUrl: experience.sourceUrl,
    CanonicalUrl: experience.canonicalUrl,
    BotScore: experience.botScore,
    LastVerifiedAt: experience.lastVerifiedAt,
    DuplicateKey: experience.duplicateKey,
    SearchFocusSnapshot: experience.searchFocusSnapshot,
    DiscoveryNotes: experience.discoveryNotes,
    Status: experience.status,
    MyRating: experience.myRating,
    MyComments: experience.myComments,
    Visited: experience.visited,
    CreatedByBotAt: experience.createdByBotAt,
  };

  if (category === 'Activities') {
    return {
      ...common,
      NeighborhoodOrArea: experience.neighborhoodOrArea,
    };
  }

  if (category === 'Restaurants') {
    return {
      ...common,
      NeighborhoodOrArea: experience.neighborhoodOrArea,
      Cuisine: experience.cuisine,
    };
  }

  if (category === 'Nature') {
    return {
      ...common,
      AreaType: experience.areaType,
      Features: experience.features?.join(', '),
      Difficulty: experience.difficulty,
      OutdoorType: experience.outdoorType,
      ParkingNotes: experience.parkingNotes,
      FeeNotes: experience.feeNotes,
      BestTime: experience.bestTime,
    };
  }

  return {
    ...common,
    Venue: experience.venue,
    StartDate: experience.startDate,
    EndDate: experience.endDate,
  };
}

export function getTableFields(category: ExperienceCategory): readonly string[] {
  return EXPERIENCE_TABLE_FIELDS[category];
}
