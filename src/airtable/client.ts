import type { HttpClientOptions } from '../utils/http.js';
import { fetchWithRetry } from '../utils/http.js';

interface AirtableListResponse<TFields> {
  records: Array<{ id: string; fields: TFields }>;
  offset?: string;
}

export class AirtableClient {
  private readonly baseUrl: string;

  public constructor(
    private readonly personalAccessToken: string,
    private readonly baseId: string,
    private readonly httpOptions: HttpClientOptions,
  ) {
    this.baseUrl = `https://api.airtable.com/v0/${this.baseId}`;
  }

  public async listRecords<TFields extends Record<string, unknown>>(
    tableName: string,
    options: {
      fields?: string[];
      filterByFormula?: string;
      maxRecords?: number;
    } = {},
  ): Promise<Array<{ id: string; fields: TFields }>> {
    const records: Array<{ id: string; fields: TFields }> = [];
    let offset: string | undefined;

    do {
      const url = new URL(`${this.baseUrl}/${encodeURIComponent(tableName)}`);
      if (offset) {
        url.searchParams.set('offset', offset);
      }
      if (options.filterByFormula) {
        url.searchParams.set('filterByFormula', options.filterByFormula);
      }
      if (options.maxRecords) {
        url.searchParams.set('maxRecords', String(options.maxRecords));
      }
      for (const field of options.fields ?? []) {
        url.searchParams.append('fields[]', field);
      }

      const response = await fetchWithRetry(
        url,
        {
          headers: this.headers(),
        },
        this.httpOptions,
      );

      if (!response.ok) {
        throw new Error(`Airtable list failed with status ${response.status}`);
      }

      const json = (await response.json()) as AirtableListResponse<TFields>;
      records.push(...json.records);
      offset = json.offset;
    } while (offset);

    return records;
  }

  public async createRecords<TFields extends Record<string, unknown>>(
    tableName: string,
    records: TFields[],
  ): Promise<void> {
    if (records.length === 0) {
      return;
    }

    const response = await fetchWithRetry(
      `${this.baseUrl}/${encodeURIComponent(tableName)}`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          records: records.map((fields) => ({ fields })),
          typecast: true,
        }),
      },
      this.httpOptions,
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Airtable create failed with status ${response.status}: ${body}`);
    }
  }

  public async verifyTable(tableName: string): Promise<void> {
    await this.listRecords(tableName, { maxRecords: 1 });
  }

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.personalAccessToken}`,
      'Content-Type': 'application/json',
    };
  }
}
