const express = require('express');
const {
  getKPISummary,
  getPPLHTimeseries,
  getProductivityByCostCenter,
  getTopVarianceDrivers,
  getJoinCoverage
} = require('../services/kpiService');

const router = express.Router();

/**
 * Parse filter query params
 */
function parseFilters(query) {
  return {
    start_date: query.start_date || null,
    end_date: query.end_date || null,
    period: query.period || 'last14',
    cost_centers: query.cost_centers ? query.cost_centers.split(',') : [],
    areas: query.areas ? query.areas.split(',') : [],
    work_centers: query.work_centers ? query.work_centers.split(',') : [],
    shifts: query.shifts ? query.shifts.split(',') : [],
    hour_start: query.hour_start ? parseInt(query.hour_start) : null,
    hour_end: query.hour_end ? parseInt(query.hour_end) : null,
    granularity: query.granularity || 'daily'
  };
}

/**
 * GET /api/kpi/summary
 * Get KPI summary cards
 */
router.get('/summary', async (req, res, next) => {
  try {
    const startTime = Date.now();
    const filters = parseFilters(req.query);
    const summary = await getKPISummary(filters);

    res.json({
      kpis: summary,
      filters_applied: filters,
      metadata: {
        query_time_ms: Date.now() - startTime,
        data_freshness: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/kpi/timeseries
 * Get PPLH timeseries data
 */
router.get('/timeseries', async (req, res, next) => {
  try {
    const startTime = Date.now();
    const filters = parseFilters(req.query);
    const timeseries = await getPPLHTimeseries(filters);

    res.json({
      data: timeseries,
      filters_applied: filters,
      metadata: {
        query_time_ms: Date.now() - startTime,
        data_points: timeseries.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/kpi/productivity
 * Get productivity breakdown by cost center
 */
router.get('/productivity', async (req, res, next) => {
  try {
    const startTime = Date.now();
    const filters = parseFilters(req.query);
    const productivity = await getProductivityByCostCenter(filters);

    res.json({
      data: productivity,
      filters_applied: filters,
      metadata: {
        query_time_ms: Date.now() - startTime,
        row_count: productivity.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/kpi/top-drivers
 * Get top variance drivers
 */
router.get('/top-drivers', async (req, res, next) => {
  try {
    const startTime = Date.now();
    const filters = parseFilters(req.query);
    const limit = parseInt(req.query.limit) || 5;
    const drivers = await getTopVarianceDrivers(filters, limit);

    res.json({
      data: drivers,
      filters_applied: filters,
      metadata: {
        query_time_ms: Date.now() - startTime
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/kpi/coverage
 * Get join coverage metrics
 */
router.get('/coverage', async (req, res, next) => {
  try {
    const startTime = Date.now();
    const coverage = await getJoinCoverage();

    res.json({
      data: coverage,
      metadata: {
        query_time_ms: Date.now() - startTime
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
