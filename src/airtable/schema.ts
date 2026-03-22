import type { ExperienceCategory } from '../domain/categories.js';
import { defaultSearchMetadataRows } from '../domain/search-metadata.js';

export const EXPERIENCE_TABLE_FIELDS: Record<ExperienceCategory, readonly string[]> = {
  Activities: [
    'Name',
    'Region',
    'City',
    'NeighborhoodOrArea',
    'ShortDescription',
    'WhyUnique',
    'Themes',
    'Audience',
    'KidFriendly',
    'IndoorOutdoor',
    'PriceLevel',
    'ReservationRecommended',
    'Website',
    'SourceName',
    'SourceUrl',
    'CanonicalUrl',
    'BotScore',
    'LastVerifiedAt',
    'DuplicateKey',
    'SearchFocusSnapshot',
    'DiscoveryNotes',
    'Status',
    'MyRating',
    'MyComments',
    'Visited',
    'CreatedByBotAt',
  ],
  Restaurants: [
    'Name',
    'Region',
    'City',
    'NeighborhoodOrArea',
    'Cuisine',
    'ShortDescription',
    'WhyUnique',
    'Themes',
    'Audience',
    'KidFriendly',
    'IndoorOutdoor',
    'PriceLevel',
    'ReservationRecommended',
    'Website',
    'SourceName',
    'SourceUrl',
    'CanonicalUrl',
    'BotScore',
    'LastVerifiedAt',
    'DuplicateKey',
    'SearchFocusSnapshot',
    'DiscoveryNotes',
    'Status',
    'MyRating',
    'MyComments',
    'Visited',
    'CreatedByBotAt',
  ],
  Nature: [
    'Name',
    'Region',
    'City',
    'AreaType',
    'ShortDescription',
    'WhyUnique',
    'Features',
    'Difficulty',
    'KidFriendly',
    'OutdoorType',
    'ParkingNotes',
    'FeeNotes',
    'BestTime',
    'Website',
    'SourceName',
    'SourceUrl',
    'CanonicalUrl',
    'BotScore',
    'LastVerifiedAt',
    'DuplicateKey',
    'SearchFocusSnapshot',
    'DiscoveryNotes',
    'Status',
    'MyRating',
    'MyComments',
    'Visited',
    'CreatedByBotAt',
  ],
  SpecialEvents: [
    'Name',
    'Region',
    'City',
    'Venue',
    'StartDate',
    'EndDate',
    'ShortDescription',
    'WhyUnique',
    'Themes',
    'Audience',
    'KidFriendly',
    'IndoorOutdoor',
    'PriceLevel',
    'ReservationRecommended',
    'Website',
    'SourceName',
    'SourceUrl',
    'CanonicalUrl',
    'BotScore',
    'LastVerifiedAt',
    'DuplicateKey',
    'SearchFocusSnapshot',
    'DiscoveryNotes',
    'Status',
    'MyRating',
    'MyComments',
    'Visited',
    'CreatedByBotAt',
  ],
};

export const SEARCH_METADATA_FIELDS = [
  'Table Name',
  'Table Purpose',
  'Active',
  'OC Priority',
  'Search Focus',
  'Include Terms',
  'Exclude Terms',
  'Audience Bias',
  'Kid Focus',
  'Indoor / Outdoor Bias',
  'Price Bias',
  'Date Window Days',
  'Region Notes',
  'Search Notes',
  'Last Updated',
] as const;

export function renderSchemaMarkdown(): string {
  const sections = Object.entries(EXPERIENCE_TABLE_FIELDS).map(([table, fields]) => {
    const lines = fields.map((field) => `- ${field}`).join('\n');
    return `## ${table}\n\n${lines}`;
  });

  return [
    '# Airtable Schema',
    '',
    ...sections,
    '',
    '## Search Metadata',
    '',
    ...SEARCH_METADATA_FIELDS.map((field) => `- ${field}`),
  ].join('\n');
}

export function renderSchemaCsvHeaders(): string {
  const blocks = Object.entries(EXPERIENCE_TABLE_FIELDS).map(
    ([table, fields]) => `${table}\n${fields.join(',')}`,
  );
  blocks.push(`Search Metadata\n${SEARCH_METADATA_FIELDS.join(',')}`);
  return blocks.join('\n\n');
}

export function renderSeedMetadataJson(): string {
  return JSON.stringify(defaultSearchMetadataRows(), null, 2);
}
