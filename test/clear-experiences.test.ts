import { describe, expect, it, vi } from 'vitest';

import { createRuntimeConfig } from '../src/config/runtime.js';
import { ExperienceRepository } from '../src/airtable/repositories.js';

function buildConfig() {
  return createRuntimeConfig({
    AIRTABLE_PAT: 'pat',
    AIRTABLE_BASE_ID: 'app123',
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    SMTP_USER: 'user',
    SMTP_PASS: 'pass',
    EMAIL_FROM: 'bot@example.com',
    EMAIL_TO: 'shawn.souto@gmail.com',
    DEFAULT_REGION_PRIORITY: 'Orange County,Los Angeles,Temecula,San Diego',
    DEFAULT_SPECIAL_EVENTS_WINDOW_DAYS: '30',
    LOG_LEVEL: 'info',
    HTTP_TIMEOUT_MS: '10000',
    HTTP_RETRY_COUNT: '1',
    DISCOVERY_CONCURRENCY: '2',
  });
}

describe('ExperienceRepository.clearCategory', () => {
  it('deletes experience records in Airtable-sized batches', async () => {
    const listRecords = vi.fn().mockResolvedValue(
      Array.from({ length: 12 }, (_, index) => ({
        id: `rec${index + 1}`,
        fields: {},
      })),
    );
    const deleteRecords = vi.fn().mockResolvedValue(undefined);
    const repository = new ExperienceRepository(
      { listRecords, deleteRecords } as never,
      buildConfig(),
    );

    const deletedCount = await repository.clearCategory('Restaurants', false);

    expect(deletedCount).toBe(12);
    expect(deleteRecords).toHaveBeenCalledTimes(2);
    expect(deleteRecords).toHaveBeenNthCalledWith(
      1,
      'Restaurants',
      ['rec1', 'rec2', 'rec3', 'rec4', 'rec5', 'rec6', 'rec7', 'rec8', 'rec9', 'rec10'],
    );
    expect(deleteRecords).toHaveBeenNthCalledWith(2, 'Restaurants', ['rec11', 'rec12']);
  });

  it('supports dry-run mode without deleting records', async () => {
    const listRecords = vi.fn().mockResolvedValue([
      { id: 'rec1', fields: {} },
      { id: 'rec2', fields: {} },
    ]);
    const deleteRecords = vi.fn().mockResolvedValue(undefined);
    const repository = new ExperienceRepository(
      { listRecords, deleteRecords } as never,
      buildConfig(),
    );

    const deletedCount = await repository.clearCategory('Nature', true);

    expect(deletedCount).toBe(2);
    expect(deleteRecords).not.toHaveBeenCalled();
  });
});
