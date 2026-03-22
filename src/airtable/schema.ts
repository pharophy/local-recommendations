import type { ExperienceCategory } from '../domain/categories.js';
import { defaultSearchMetadataRows } from '../domain/search-metadata.js';

export const EXPERIENCE_TABLE_FIELDS: Record<ExperienceCategory, readonly string[]> = {
  Activities: [
    'Name',
    'Subcategory',
    'City',
    'Region',
    'Venue / Operator',
    'WhyUnique',
    'Themes',
    'Kid Appeal',
    'Age Notes',
    'Indoor / Outdoor',
    'Price Tier',
    'Reservation Needed',
    'Best For',
    'Website',
    'Source URL',
    'Address',
    'Start Date',
    'End Date',
    'Hours / Availability',
    'Discovery Date',
    'Last Verified',
    'Status',
    'Bot Score',
    'Bot Notes',
    'My Rating',
    'My Comments',
    'Tried On',
    'Duplicate Key',
  ],
  Restaurants: [
    'Name',
    'Cuisine / Style',
    'City',
    'Region',
    'Venue / Operator',
    'WhyUnique',
    'Themes',
    'Kid Friendly',
    'Age Notes',
    'Price Tier',
    'Reservation Needed',
    'Meal Type',
    'Signature Experience',
    'Website',
    'Source URL',
    'Address',
    'Start Date',
    'End Date',
    'Hours / Availability',
    'Discovery Date',
    'Last Verified',
    'Status',
    'Bot Score',
    'Bot Notes',
    'My Rating',
    'My Comments',
    'Tried On',
    'Duplicate Key',
  ],
  Nature: [
    'Name',
    'Nature Type',
    'City / Area',
    'Region',
    'Managing Agency',
    'WhyUnique',
    'Features',
    'Kid Appeal',
    'Difficulty',
    'Distance',
    'Access / Elevation Notes',
    'Parking / Permit Notes',
    'Best Time',
    'Website',
    'Source URL',
    'Trailhead / Address',
    'Start Date',
    'End Date',
    'Discovery Date',
    'Last Verified',
    'Status',
    'Bot Score',
    'Bot Notes',
    'My Rating',
    'My Comments',
    'Tried On',
    'Duplicate Key',
  ],
  SpecialEvents: [
    'Name',
    'Event Type',
    'City',
    'Region',
    'Venue / Organizer',
    'Themes',
    'Kid Friendly',
    'Age Notes',
    'Price Tier',
    'Reservation Needed',
    'Start Date',
    'End Date',
    'Event Times',
    'WhyUnique',
    'Website',
    'Source URL',
    'Address',
    'Discovery Date',
    'Last Verified',
    'Status',
    'Bot Score',
    'Bot Notes',
    'My Rating',
    'My Comments',
    'Attended On',
    'Duplicate Key',
  ],
};

export const SEARCH_METADATA_FIELDS = [
  'Table Name',
  'Table Purpose',
  'Active',
  'Daily Target New Items',
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
