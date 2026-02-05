const express = require('express');
const { db } = require('../models/database');
const { getJoinCoverage } = require('../services/kpiService');

const router = express.Router();

/**
 * GET /api/data-quality/summary
 * Get data quality summary
 */
router.get('/summary', async (req, res, next) => {
  try {
    const startTime = Date.now();

    // Get join coverage
    const coverage = await getJoinCoverage();

    // Get exception counts by type
    const exceptionCounts = await db('exceptions_log')
      .select('exception_type', 'severity')
      .count('* as count')
      .whereNull('resolved_at')
      .groupBy('exception_type', 'severity')
      .orderBy('count', 'desc');

    // Get recent uploads
    const recentUploads = await db('uploads')
      .orderBy('created_at', 'desc')
      .limit(10);

    // Get record counts
    const recordCounts = await Promise.all([
      db('wo_dim').count('* as count').first(),
      db('confirmations_fact').count('* as count').first(),
      db('kronos_fact').count('* as count').first(),
      db('scan_fact').count('* as count').first(),
      db('mrp_fact').count('* as count').first()
    ]);

    // Total unresolved exceptions
    const totalExceptions = await db('exceptions_log')
      .whereNull('resolved_at')
      .count('* as count')
      .first();

    res.json({
      coverage,
      exception_summary: exceptionCounts,
      total_unresolved_exceptions: totalExceptions.count,
      record_counts: {
        work_orders: recordCounts[0].count,
        confirmations: recordCounts[1].count,
        kronos_hours: recordCounts[2].count,
        scans: recordCounts[3].count,
        mrp: recordCounts[4].count
      },
      recent_uploads: recentUploads,
      overall_health: getOverallHealth(coverage, totalExceptions.count),
      metadata: {
        query_time_ms: Date.now() - startTime
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/data-quality/exceptions
 * Get exceptions list with pagination
 */
router.get('/exceptions', async (req, res, next) => {
  try {
    const {
      exception_type,
      severity,
      resolved,
      limit = 50,
      offset = 0
    } = req.query;

    let query = db('exceptions_log').orderBy('created_at', 'desc');

    if (exception_type) {
      query = query.where('exception_type', exception_type);
    }

    if (severity) {
      query = query.where('severity', severity);
    }

    if (resolved === 'true') {
      query = query.whereNotNull('resolved_at');
    } else if (resolved === 'false') {
      query = query.whereNull('resolved_at');
    }

    // Get count
    const countQuery = query.clone();
    const totalResult = await countQuery.count('* as count').first();

    // Get data
    const exceptions = await query
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    res.json({
      data: exceptions.map(e => ({
        ...e,
        details: JSON.parse(e.details || '{}')
      })),
      pagination: {
        total: totalResult.count,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: parseInt(offset) + exceptions.length < totalResult.count
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/data-quality/exceptions/:id/resolve
 * Resolve an exception
 */
router.post('/exceptions/:id/resolve', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { resolution_notes } = req.body;

    const exception = await db('exceptions_log').where('id', id).first();

    if (!exception) {
      return res.status(404).json({
        error: { message: 'Exception not found', code: 'NOT_FOUND' }
      });
    }

    await db('exceptions_log')
      .where('id', id)
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: 'user',
        resolution_notes
      });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/data-quality/duplicates
 * Find potential duplicate records
 */
router.get('/duplicates', async (req, res, next) => {
  try {
    // Find potential duplicate confirmations
    const duplicateConf = await db('confirmations_fact')
      .select('wo_number', 'confirmation_ts', 'operation')
      .count('* as count')
      .groupBy('wo_number', 'confirmation_ts', 'operation')
      .having('count', '>', 1)
      .limit(50);

    // Find potential duplicate scans
    const duplicateScans = await db('scan_fact')
      .select('wo_number', 'scan_in')
      .count('* as count')
      .groupBy('wo_number', 'scan_in')
      .having('count', '>', 1)
      .limit(50);

    res.json({
      duplicate_confirmations: duplicateConf,
      duplicate_scans: duplicateScans
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/data-quality/anomalies
 * Find data anomalies
 */
router.get('/anomalies', async (req, res, next) => {
  try {
    // Future timestamps
    const futureConfirmations = await db('confirmations_fact')
      .where('confirmation_ts', '>', new Date().toISOString())
      .count('* as count')
      .first();

    // Negative pounds
    const negativePounds = await db('confirmations_fact')
      .where('pounds', '<', 0)
      .count('* as count')
      .first();

    // Orphan scans
    const orphanScans = await db('scan_fact')
      .where('is_orphan', true)
      .count('* as count')
      .first();

    // Unusual hours (> 12 in a single bucket)
    const unusualHours = await db('kronos_fact')
      .where('hours', '>', 12)
      .count('* as count')
      .first();

    // WOs with status issues (released date but not released status)
    const statusMismatch = await db('wo_dim')
      .whereNotNull('released_date')
      .whereNotIn(db.raw('UPPER(status)'), ['REL', 'RELEASED', 'PCNF', 'CNF', 'TECO', 'CLSD', 'CLOSED'])
      .count('* as count')
      .first();

    res.json({
      future_timestamps: futureConfirmations.count,
      negative_pounds: negativePounds.count,
      orphan_scans: orphanScans.count,
      unusual_hours: unusualHours.count,
      status_mismatch: statusMismatch.count
    });
  } catch (error) {
    next(error);
  }
});

function getOverallHealth(coverage, exceptionCount) {
  const minCoverage = coverage.min_coverage;

  if (minCoverage >= 95 && exceptionCount < 10) {
    return { status: 'healthy', label: 'Good', color: 'green' };
  } else if (minCoverage >= 85 && exceptionCount < 50) {
    return { status: 'warning', label: 'Needs Attention', color: 'yellow' };
  } else {
    return { status: 'critical', label: 'Issues Detected', color: 'red' };
  }
}

module.exports = router;
