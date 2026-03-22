import { describe, expect, it } from 'vitest';

import { buildDuplicateKey } from '../src/dedupe/duplicates.js';

describe('buildDuplicateKey', () => {
  it('builds a stable normalized key', () => {
    const key = buildDuplicateKey(
      'Activities',
      'Fantasy Tavern',
      'Anaheim',
      'Orange County',
      'https://example.com/fantasy',
      'https://source.com/page',
    );

    expect(key).toBe('activities::fantasy-tavern::anaheim::https-example-com-fantasy');
  });
});
