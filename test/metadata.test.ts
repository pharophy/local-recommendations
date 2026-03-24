import { describe, expect, it } from 'vitest';

import { parseSearchMetadataRecord } from '../src/airtable/repositories.js';

describe('parseSearchMetadataRecord', () => {
  it('applies defaults for daily target and region priority', () => {
    const metadata = parseSearchMetadataRecord(
      {
        TableName: 'Nature',
        Enabled: true,
        SearchFocus: 'waterfalls, caves',
      },
      ['Orange County', 'Los Angeles', 'Temecula', 'San Diego'],
    );

    expect(metadata?.dailyTargetNewItems).toBe(5);
    expect(metadata?.regionPriority[0]).toBe('Orange County');
  });

  it('normalizes region priority labels from Airtable notes', () => {
    const metadata = parseSearchMetadataRecord(
      {
        TableName: 'Restaurants',
        RegionPriority: 'Orange County first, Los Angeles second',
      },
      ['Orange County', 'Los Angeles', 'Temecula', 'San Diego'],
    );

    expect(metadata?.regionPriority).toEqual(['Orange County', 'Los Angeles']);
  });
});
