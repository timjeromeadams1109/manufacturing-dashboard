const { db } = require('../models/database');
const { today, startOfWeek, getDateRange, now } = require('../utils/timeBucketing');

/**
 * Get KPI summary cards
 */
async function getKPISummary(filters = {}) {
  const todayDate = today();
  const weekStart = startOfWeek();

  // Build base query conditions
  const baseConditions = buildFilterConditions(filters);

  // Today PPLH
  const todayPPLH = await db('kpi_hourly')
    .where('hour_bucket_ts', '>=', todayDate)
    .where('hour_bucket_ts', '<', todayDate + 'T23:59:59')
    .modify(qb => applyFilters(qb, baseConditions))
    .sum('pounds as total_pounds')
    .sum('kronos_hours as total_hours')
    .first();

  // WTD PPLH
  const wtdPPLH = await db('kpi_hourly')
    .where('hour_bucket_ts', '>=', weekStart)
    .where('hour_bucket_ts', '<=', todayDate + 'T23:59:59')
    .modify(qb => applyFilters(qb, baseConditions))
    .sum('pounds as total_pounds')
    .sum('kronos_hours as total_hours')
    .first();

  // Today Variance
  const todayVariance = await db('kpi_hourly')
    .where('hour_bucket_ts', '>=', todayDate)
    .where('hour_bucket_ts', '<', todayDate + 'T23:59:59')
    .modify(qb => applyFilters(qb, baseConditions))
    .sum('scanning_hours as total_scan')
    .sum('kronos_hours as total_kronos')
    .first();

  // Late WO count
  const terminalStatuses = await db('status_config')
    .where('is_terminal', true)
    .pluck('status_code');

  const lateWOQuery = db('wo_dim')
    .where('due_date', '<', todayDate)
    .whereNotIn(db.raw('UPPER(status)'), terminalStatuses.map(s => s.toUpperCase()));

  if (filters.cost_centers?.length) {
    lateWOQuery.whereIn('cost_center', filters.cost_centers);
  }
  if (filters.areas?.length) {
    lateWOQuery.whereIn('area', filters.areas);
  }

  const lateWOCount = await lateWOQuery.count('* as count').first();

  // Released Today
  const releasedToday = await db('wo_dim')
    .where(db.raw('DATE(released_date)'), todayDate)
    .count('* as count')
    .first();

  // Created Today
  const createdToday = await db('wo_dim')
    .where(db.raw('DATE(created_date)'), todayDate)
    .count('* as count')
    .first();

  // Join coverage
  const coverage = await getJoinCoverage();

  // Calculate values
  const todayPPLHValue = todayPPLH.total_hours > 0
    ? Math.round((todayPPLH.total_pounds / todayPPLH.total_hours) * 10) / 10
    : null;

  const wtdPPLHValue = wtdPPLH.total_hours > 0
    ? Math.round((wtdPPLH.total_pounds / wtdPPLH.total_hours) * 10) / 10
    : null;

  const varianceValue = todayVariance.total_scan - todayVariance.total_kronos;
  const variancePctValue = todayVariance.total_kronos > 0
    ? Math.round((varianceValue / todayVariance.total_kronos) * 1000) / 10
    : null;

  return {
    today_pplh: {
      value: todayPPLHValue,
      unit: 'lb/hr',
      pounds: todayPPLH.total_pounds || 0,
      hours: todayPPLH.total_hours || 0,
      confidence: getConfidence(coverage.min_coverage)
    },
    wtd_pplh: {
      value: wtdPPLHValue,
      unit: 'lb/hr',
      pounds: wtdPPLH.total_pounds || 0,
      hours: wtdPPLH.total_hours || 0,
      confidence: getConfidence(coverage.min_coverage)
    },
    variance_pct: {
      value: variancePctValue,
      unit: '%',
      scanning_hours: todayVariance.total_scan || 0,
      kronos_hours: todayVariance.total_kronos || 0,
      variance: varianceValue || 0,
      confidence: getConfidence(coverage.min_coverage)
    },
    late_wo_count: {
      value: lateWOCount.count || 0,
      confidence: 'high'
    },
    released_today: {
      value: releasedToday.count || 0,
      confidence: 'high'
    },
    created_today: {
      value: createdToday.count || 0,
      confidence: 'high'
    },
    join_coverage: {
      value: coverage.min_coverage,
      unit: '%',
      details: coverage
    }
  };
}

/**
 * Get PPLH timeseries
 */
async function getPPLHTimeseries(filters = {}) {
  const { start, end } = getDateRangeFromFilters(filters);
  const granularity = filters.granularity || 'daily';

  let query = db('kpi_hourly')
    .where('hour_bucket_ts', '>=', start)
    .where('hour_bucket_ts', '<=', end + 'T23:59:59');

  // Apply filters
  if (filters.cost_centers?.length) {
    query = query.whereIn('cost_center', filters.cost_centers);
  }
  if (filters.areas?.length) {
    query = query.whereIn('area', filters.areas);
  }

  if (granularity === 'hourly') {
    const data = await query
      .select('hour_bucket_ts')
      .sum('pounds as pounds')
      .sum('kronos_hours as kronos_hours')
      .sum('scanning_hours as scanning_hours')
      .groupBy('hour_bucket_ts')
      .orderBy('hour_bucket_ts');

    return data.map(row => ({
      timestamp: row.hour_bucket_ts,
      pounds: parseFloat(row.pounds) || 0,
      kronos_hours: parseFloat(row.kronos_hours) || 0,
      scanning_hours: parseFloat(row.scanning_hours) || 0,
      pplh: row.kronos_hours > 0
        ? Math.round((row.pounds / row.kronos_hours) * 10) / 10
        : null
    }));
  } else {
    // Daily aggregation
    const data = await query
      .select(db.raw('DATE(hour_bucket_ts) as date'))
      .sum('pounds as pounds')
      .sum('kronos_hours as kronos_hours')
      .sum('scanning_hours as scanning_hours')
      .groupBy(db.raw('DATE(hour_bucket_ts)'))
      .orderBy('date');

    return data.map(row => ({
      date: row.date,
      pounds: parseFloat(row.pounds) || 0,
      kronos_hours: parseFloat(row.kronos_hours) || 0,
      scanning_hours: parseFloat(row.scanning_hours) || 0,
      pplh: row.kronos_hours > 0
        ? Math.round((row.pounds / row.kronos_hours) * 10) / 10
        : null
    }));
  }
}

/**
 * Get productivity breakdown by cost center
 */
async function getProductivityByCostCenter(filters = {}) {
  const { start, end } = getDateRangeFromFilters(filters);

  let query = db('kpi_hourly')
    .select('cost_center')
    .sum('pounds as pounds')
    .sum('kronos_hours as kronos_hours')
    .sum('scanning_hours as scanning_hours')
    .where('hour_bucket_ts', '>=', start)
    .where('hour_bucket_ts', '<=', end + 'T23:59:59')
    .whereNotNull('cost_center')
    .groupBy('cost_center')
    .orderBy('pounds', 'desc');

  if (filters.cost_centers?.length) {
    query = query.whereIn('cost_center', filters.cost_centers);
  }

  const data = await query;

  // Join with cost center mapping for area info
  const result = await Promise.all(data.map(async row => {
    const mapping = await db('cost_center_mapping')
      .where('cost_center', row.cost_center)
      .first();

    const pounds = parseFloat(row.pounds) || 0;
    const kronosHours = parseFloat(row.kronos_hours) || 0;
    const scanningHours = parseFloat(row.scanning_hours) || 0;
    const variance = scanningHours - kronosHours;

    return {
      cost_center: row.cost_center,
      area: mapping?.area || 'Unmapped',
      pounds,
      kronos_hours: kronosHours,
      scanning_hours: scanningHours,
      pplh: kronosHours > 0 ? Math.round((pounds / kronosHours) * 10) / 10 : null,
      variance,
      variance_pct: kronosHours > 0 ? Math.round((variance / kronosHours) * 1000) / 10 : null
    };
  }));

  return result;
}

/**
 * Get top variance drivers
 */
async function getTopVarianceDrivers(filters = {}, limit = 5) {
  const { start, end } = getDateRangeFromFilters(filters);

  const data = await db('kpi_hourly')
    .select('cost_center')
    .sum('scanning_hours as scanning_hours')
    .sum('kronos_hours as kronos_hours')
    .where('hour_bucket_ts', '>=', start)
    .where('hour_bucket_ts', '<=', end + 'T23:59:59')
    .whereNotNull('cost_center')
    .groupBy('cost_center')
    .having(db.raw('ABS(SUM(scanning_hours) - SUM(kronos_hours)) > 0'))
    .orderBy(db.raw('ABS(SUM(scanning_hours) - SUM(kronos_hours))'), 'desc')
    .limit(limit);

  return Promise.all(data.map(async row => {
    const mapping = await db('cost_center_mapping')
      .where('cost_center', row.cost_center)
      .first();

    const variance = (parseFloat(row.scanning_hours) || 0) - (parseFloat(row.kronos_hours) || 0);

    return {
      cost_center: row.cost_center,
      area: mapping?.area || 'Unmapped',
      variance,
      variance_pct: row.kronos_hours > 0
        ? Math.round((variance / row.kronos_hours) * 1000) / 10
        : null
    };
  }));
}

/**
 * Get join coverage metrics
 */
async function getJoinCoverage() {
  // Confirmations to WO coverage
  const confTotal = await db('confirmations_fact').count('* as count').first();
  const confMatched = await db('confirmations_fact as cf')
    .join('wo_dim as wd', 'cf.wo_number', 'wd.wo_number')
    .count('* as count')
    .first();

  // Kronos to cost center coverage
  const kronosTotal = await db('kronos_fact').count('* as count').first();
  const kronosMatched = await db('kronos_fact as kf')
    .join('cost_center_mapping as ccm', 'kf.cost_center', 'ccm.cost_center')
    .count('* as count')
    .first();

  // Scan to WO coverage
  const scanTotal = await db('scan_fact').count('* as count').first();
  const scanMatched = await db('scan_fact as sf')
    .join('wo_dim as wd', 'sf.wo_number', 'wd.wo_number')
    .count('* as count')
    .first();

  const confCoverage = confTotal.count > 0
    ? Math.round((confMatched.count / confTotal.count) * 1000) / 10
    : 100;

  const kronosCoverage = kronosTotal.count > 0
    ? Math.round((kronosMatched.count / kronosTotal.count) * 1000) / 10
    : 100;

  const scanCoverage = scanTotal.count > 0
    ? Math.round((scanMatched.count / scanTotal.count) * 1000) / 10
    : 100;

  return {
    confirmations_to_wo: confCoverage,
    kronos_to_cost_center: kronosCoverage,
    scan_to_wo: scanCoverage,
    min_coverage: Math.min(confCoverage, kronosCoverage, scanCoverage)
  };
}

// Helper functions
function buildFilterConditions(filters) {
  return {
    cost_centers: filters.cost_centers || [],
    areas: filters.areas || [],
    shifts: filters.shifts || []
  };
}

function applyFilters(query, conditions) {
  if (conditions.cost_centers?.length) {
    query.whereIn('cost_center', conditions.cost_centers);
  }
  if (conditions.areas?.length) {
    query.whereIn('area', conditions.areas);
  }
  return query;
}

function getDateRangeFromFilters(filters) {
  if (filters.start_date && filters.end_date) {
    return { start: filters.start_date, end: filters.end_date };
  }
  return getDateRange(filters.period || 'last14');
}

function getConfidence(coverage) {
  if (coverage >= 95) return 'high';
  if (coverage >= 85) return 'medium';
  return 'low';
}

module.exports = {
  getKPISummary,
  getPPLHTimeseries,
  getProductivityByCostCenter,
  getTopVarianceDrivers,
  getJoinCoverage
};
