const {
  toHourBucket,
  parseDate,
  distributeHoursTooBuckets,
  daysBetween,
  getDateRange
} = require('../src/utils/timeBucketing');

describe('Time Bucketing Utilities', () => {
  describe('toHourBucket', () => {
    test('truncates timestamp to top of hour', () => {
      const result = toHourBucket('2024-01-15T08:47:32');
      expect(result).toMatch(/2024-01-15T08:00:00/);
    });

    test('handles midnight correctly', () => {
      const result = toHourBucket('2024-01-15T00:30:00');
      expect(result).toMatch(/2024-01-15T00:00:00/);
    });

    test('returns null for invalid timestamp', () => {
      const result = toHourBucket('invalid-date');
      expect(result).toBeNull();
    });

    test('returns null for null input', () => {
      const result = toHourBucket(null);
      expect(result).toBeNull();
    });

    test('handles various date formats', () => {
      const result1 = toHourBucket('2024-01-15 14:30:00');
      expect(result1).toMatch(/2024-01-15T14:00:00/);
    });
  });

  describe('parseDate', () => {
    test('parses ISO format', () => {
      const result = parseDate('2024-01-15T08:30:00');
      expect(result).not.toBeNull();
      expect(result.year).toBe(2024);
      expect(result.month).toBe(1);
      expect(result.day).toBe(15);
    });

    test('parses date-only format', () => {
      const result = parseDate('2024-01-15');
      expect(result).not.toBeNull();
      expect(result.toISODate()).toBe('2024-01-15');
    });

    test('parses US date format', () => {
      const result = parseDate('01/15/2024');
      expect(result).not.toBeNull();
      expect(result.toISODate()).toBe('2024-01-15');
    });

    test('returns null for invalid date', () => {
      const result = parseDate('not-a-date');
      expect(result).toBeNull();
    });

    test('handles Date objects', () => {
      const date = new Date('2024-01-15T08:30:00Z');
      const result = parseDate(date);
      expect(result).not.toBeNull();
    });
  });

  describe('distributeHoursTooBuckets', () => {
    test('distributes hours across multiple buckets', () => {
      const buckets = distributeHoursTooBuckets(
        '2024-01-15T08:30:00',
        '2024-01-15T11:15:00'
      );

      expect(buckets.length).toBe(4);
      expect(buckets[0].hours).toBeCloseTo(0.5, 2); // 08:30-09:00
      expect(buckets[1].hours).toBeCloseTo(1.0, 2); // 09:00-10:00
      expect(buckets[2].hours).toBeCloseTo(1.0, 2); // 10:00-11:00
      expect(buckets[3].hours).toBeCloseTo(0.25, 2); // 11:00-11:15
    });

    test('handles single hour span', () => {
      const buckets = distributeHoursTooBuckets(
        '2024-01-15T08:15:00',
        '2024-01-15T08:45:00'
      );

      expect(buckets.length).toBe(1);
      expect(buckets[0].hours).toBeCloseTo(0.5, 2);
    });

    test('returns empty array for invalid times', () => {
      const buckets = distributeHoursTooBuckets('invalid', 'also-invalid');
      expect(buckets).toEqual([]);
    });

    test('returns empty array when end before start', () => {
      const buckets = distributeHoursTooBuckets(
        '2024-01-15T10:00:00',
        '2024-01-15T08:00:00'
      );
      expect(buckets).toEqual([]);
    });

    test('handles cross-midnight span', () => {
      const buckets = distributeHoursTooBuckets(
        '2024-01-15T23:30:00',
        '2024-01-16T01:30:00'
      );

      expect(buckets.length).toBe(3);
      expect(buckets[0].hour_bucket_ts).toMatch(/2024-01-15T23:00:00/);
      expect(buckets[2].hour_bucket_ts).toMatch(/2024-01-16T01:00:00/);
    });
  });

  describe('daysBetween', () => {
    test('calculates days between two dates', () => {
      const days = daysBetween('2024-01-10', '2024-01-15');
      expect(days).toBe(5);
    });

    test('returns 0 for same date', () => {
      const days = daysBetween('2024-01-15', '2024-01-15');
      expect(days).toBe(0);
    });

    test('returns null for invalid date', () => {
      const days = daysBetween('invalid', '2024-01-15');
      expect(days).toBeNull();
    });
  });

  describe('getDateRange', () => {
    test('returns correct range for today', () => {
      const range = getDateRange('today');
      expect(range.start).toBe(range.end);
    });

    test('returns correct range for last7', () => {
      const range = getDateRange('last7');
      const start = new Date(range.start);
      const end = new Date(range.end);
      const diff = (end - start) / (1000 * 60 * 60 * 24);
      expect(diff).toBe(6);
    });

    test('returns correct range for last14', () => {
      const range = getDateRange('last14');
      const start = new Date(range.start);
      const end = new Date(range.end);
      const diff = (end - start) / (1000 * 60 * 60 * 24);
      expect(diff).toBe(13);
    });
  });
});

describe('PPLH Calculation Edge Cases', () => {
  test('PPLH with zero hours returns null', () => {
    const pounds = 1000;
    const hours = 0;
    const pplh = hours > 0 ? pounds / hours : null;
    expect(pplh).toBeNull();
  });

  test('PPLH with negative pounds returns negative', () => {
    const pounds = -500;
    const hours = 10;
    const pplh = hours > 0 ? pounds / hours : null;
    expect(pplh).toBe(-50);
  });

  test('PPLH calculates correctly', () => {
    const pounds = 1250;
    const hours = 10;
    const pplh = hours > 0 ? pounds / hours : null;
    expect(pplh).toBe(125);
  });
});

describe('Variance Calculation', () => {
  test('variance with zero kronos returns null for percentage', () => {
    const scanning = 8;
    const kronos = 0;
    const variance = scanning - kronos;
    const variancePct = kronos > 0 ? (variance / kronos) * 100 : null;

    expect(variance).toBe(8);
    expect(variancePct).toBeNull();
  });

  test('positive variance indicates more scanning than kronos', () => {
    const scanning = 10;
    const kronos = 8;
    const variance = scanning - kronos;

    expect(variance).toBe(2);
    expect(variance > 0).toBe(true);
  });

  test('negative variance indicates less scanning than kronos', () => {
    const scanning = 6;
    const kronos = 8;
    const variance = scanning - kronos;

    expect(variance).toBe(-2);
    expect(variance < 0).toBe(true);
  });

  test('variance percentage calculates correctly', () => {
    const scanning = 10;
    const kronos = 8;
    const variance = scanning - kronos;
    const variancePct = (variance / kronos) * 100;

    expect(variancePct).toBe(25);
  });
});

describe('Late WO Logic', () => {
  const terminalStatuses = ['CLOSED', 'CLSD', 'TECO', 'DLT', 'DELETED'];

  test('WO is late when past due and not terminal', () => {
    const dueDate = '2024-01-10';
    const today = '2024-01-15';
    const status = 'REL';

    const isPastDue = dueDate < today;
    const isTerminal = terminalStatuses.includes(status.toUpperCase());
    const isLate = isPastDue && !isTerminal;

    expect(isLate).toBe(true);
  });

  test('WO is not late when closed', () => {
    const dueDate = '2024-01-10';
    const today = '2024-01-15';
    const status = 'CLOSED';

    const isPastDue = dueDate < today;
    const isTerminal = terminalStatuses.includes(status.toUpperCase());
    const isLate = isPastDue && !isTerminal;

    expect(isLate).toBe(false);
  });

  test('WO is not late when due in future', () => {
    const dueDate = '2024-01-20';
    const today = '2024-01-15';
    const status = 'REL';

    const isPastDue = dueDate < today;
    const isLate = isPastDue;

    expect(isLate).toBe(false);
  });

  test('status comparison is case insensitive', () => {
    const status1 = 'closed';
    const status2 = 'CLOSED';
    const status3 = 'Closed';

    expect(terminalStatuses.includes(status1.toUpperCase())).toBe(true);
    expect(terminalStatuses.includes(status2.toUpperCase())).toBe(true);
    expect(terminalStatuses.includes(status3.toUpperCase())).toBe(true);
  });
});
