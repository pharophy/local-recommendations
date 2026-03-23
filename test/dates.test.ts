import { describe, expect, it } from 'vitest';

import { parseLooseDate } from '../src/utils/dates.js';

describe('parseLooseDate', () => {
  it('parses day-month ranges used by event listings', () => {
    const parsed = parseLooseDate('22 Mar - 30 Apr From $53.98');

    expect(parsed).not.toBeNull();
    expect(parsed?.getMonth()).toBe(2);
    expect(parsed?.getDate()).toBe(22);
  });

  it('parses day ranges that end with a month name', () => {
    const parsed = parseLooseDate('24 - 26 Apr $54.00');

    expect(parsed).not.toBeNull();
    expect(parsed?.getMonth()).toBe(3);
    expect(parsed?.getDate()).toBe(24);
  });
});
