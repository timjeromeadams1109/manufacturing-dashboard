const { DateTime } = require('luxon');

const TIMEZONE = 'America/Los_Angeles';

/**
 * Truncate a timestamp to the top of the hour in the configured timezone
 * @param {string|Date} timestamp - Input timestamp
 * @returns {string} ISO string of hour bucket
 */
function toHourBucket(timestamp) {
  if (!timestamp) return null;

  const dt = typeof timestamp === 'string'
    ? DateTime.fromISO(timestamp, { zone: TIMEZONE })
    : DateTime.fromJSDate(timestamp, { zone: TIMEZONE });

  if (!dt.isValid) {
    // Try parsing common formats
    const formats = [
      'yyyy-MM-dd HH:mm:ss',
      'MM/dd/yyyy HH:mm:ss',
      'M/d/yyyy H:mm:ss',
      'yyyy-MM-dd\'T\'HH:mm:ss',
      'yyyy-MM-dd\'T\'HH:mm:ssZZ'
    ];

    for (const format of formats) {
      const parsed = DateTime.fromFormat(String(timestamp), format, { zone: TIMEZONE });
      if (parsed.isValid) {
        return parsed.startOf('hour').toISO();
      }
    }
    return null;
  }

  return dt.startOf('hour').toISO();
}

/**
 * Parse a date string and return a DateTime object in the configured timezone
 * @param {string|Date} dateStr - Input date
 * @returns {DateTime|null} Luxon DateTime or null if invalid
 */
function parseDate(dateStr) {
  if (!dateStr) return null;

  if (dateStr instanceof Date) {
    return DateTime.fromJSDate(dateStr, { zone: TIMEZONE });
  }

  // Try ISO first
  let dt = DateTime.fromISO(dateStr, { zone: TIMEZONE });
  if (dt.isValid) return dt;

  // Try common formats
  const formats = [
    'yyyy-MM-dd',
    'MM/dd/yyyy',
    'M/d/yyyy',
    'yyyy-MM-dd HH:mm:ss',
    'MM/dd/yyyy HH:mm:ss',
    'M/d/yyyy H:mm:ss'
  ];

  for (const format of formats) {
    dt = DateTime.fromFormat(String(dateStr), format, { zone: TIMEZONE });
    if (dt.isValid) return dt;
  }

  return null;
}

/**
 * Distribute hours across hour buckets for a time span
 * @param {string|Date} startTime - Start of time span
 * @param {string|Date} endTime - End of time span
 * @param {number} totalHours - Optional pre-calculated hours (will calculate if not provided)
 * @returns {Array} Array of {hour_bucket_ts, hours} objects
 */
function distributeHoursTooBuckets(startTime, endTime, totalHours = null) {
  const start = parseDate(startTime);
  const end = parseDate(endTime);

  if (!start || !end || end <= start) {
    return [];
  }

  const buckets = [];
  let current = start.startOf('hour');

  while (current < end) {
    const bucketEnd = current.plus({ hours: 1 });
    const overlapStart = current > start ? current : start;
    const overlapEnd = bucketEnd < end ? bucketEnd : end;

    const hours = overlapEnd.diff(overlapStart, 'hours').hours;

    if (hours > 0) {
      buckets.push({
        hour_bucket_ts: current.toISO(),
        hours: Math.round(hours * 10000) / 10000 // 4 decimal places
      });
    }

    current = bucketEnd;
  }

  return buckets;
}

/**
 * Get current datetime in configured timezone
 * @returns {DateTime} Current time in LA timezone
 */
function now() {
  return DateTime.now().setZone(TIMEZONE);
}

/**
 * Get today's date in configured timezone
 * @returns {string} Date string YYYY-MM-DD
 */
function today() {
  return now().toISODate();
}

/**
 * Get start of current week (Monday)
 * @returns {string} Date string YYYY-MM-DD
 */
function startOfWeek() {
  return now().startOf('week').toISODate();
}

/**
 * Calculate days between two dates
 * @param {string} date1 - First date
 * @param {string} date2 - Second date (defaults to today)
 * @returns {number} Number of days
 */
function daysBetween(date1, date2 = null) {
  const d1 = parseDate(date1);
  const d2 = date2 ? parseDate(date2) : now();

  if (!d1 || !d2) return null;

  return Math.floor(d2.diff(d1, 'days').days);
}

/**
 * Format a timestamp for display
 * @param {string|Date} timestamp - Input timestamp
 * @param {string} format - Output format
 * @returns {string} Formatted string
 */
function formatTimestamp(timestamp, format = 'yyyy-MM-dd HH:mm:ss') {
  const dt = parseDate(timestamp);
  return dt ? dt.toFormat(format) : null;
}

/**
 * Get date range for common periods
 * @param {string} period - 'today', 'yesterday', 'wtd', 'mtd', 'last7', 'last30'
 * @returns {Object} {start, end} date strings
 */
function getDateRange(period) {
  const n = now();

  switch (period) {
    case 'today':
      return { start: n.toISODate(), end: n.toISODate() };
    case 'yesterday':
      const yesterday = n.minus({ days: 1 });
      return { start: yesterday.toISODate(), end: yesterday.toISODate() };
    case 'wtd':
      return { start: n.startOf('week').toISODate(), end: n.toISODate() };
    case 'mtd':
      return { start: n.startOf('month').toISODate(), end: n.toISODate() };
    case 'last7':
      return { start: n.minus({ days: 6 }).toISODate(), end: n.toISODate() };
    case 'last14':
      return { start: n.minus({ days: 13 }).toISODate(), end: n.toISODate() };
    case 'last30':
      return { start: n.minus({ days: 29 }).toISODate(), end: n.toISODate() };
    default:
      return { start: n.toISODate(), end: n.toISODate() };
  }
}

module.exports = {
  TIMEZONE,
  toHourBucket,
  parseDate,
  distributeHoursTooBuckets,
  now,
  today,
  startOfWeek,
  daysBetween,
  formatTimestamp,
  getDateRange
};
