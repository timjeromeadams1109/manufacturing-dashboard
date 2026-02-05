const express = require('express');
const { db } = require('../models/database');
const { today, daysBetween } = require('../utils/timeBucketing');

const router = express.Router();

/**
 * GET /api/work-orders
 * Get work orders with filters
 */
router.get('/', async (req, res, next) => {
  try {
    const startTime = Date.now();
    const {
      status,
      late_only,
      cost_center,
      area,
      work_center,
      due_date_start,
      due_date_end,
      search,
      limit = 100,
      offset = 0,
      sort_by = 'due_date',
      sort_dir = 'asc'
    } = req.query;

    let query = db('wo_dim');

    // Apply filters
    if (status) {
      const statuses = status.split(',').map(s => s.toUpperCase());
      query = query.whereIn(db.raw('UPPER(status)'), statuses);
    }

    if (late_only === 'true') {
      const terminalStatuses = await db('status_config')
        .where('is_terminal', true)
        .pluck('status_code');

      query = query
        .where('due_date', '<', today())
        .whereNotIn(db.raw('UPPER(status)'), terminalStatuses.map(s => s.toUpperCase()));
    }

    if (cost_center) {
      query = query.whereIn('cost_center', cost_center.split(','));
    }

    if (area) {
      query = query.whereIn('area', area.split(','));
    }

    if (work_center) {
      query = query.whereIn('work_center', work_center.split(','));
    }

    if (due_date_start) {
      query = query.where('due_date', '>=', due_date_start);
    }

    if (due_date_end) {
      query = query.where('due_date', '<=', due_date_end);
    }

    if (search) {
      query = query.where(function() {
        this.where('wo_number', 'like', `%${search}%`)
          .orWhere('material', 'like', `%${search}%`);
      });
    }

    // Count total
    const countQuery = query.clone();
    const totalResult = await countQuery.count('* as count').first();
    const total = totalResult.count;

    // Apply sorting and pagination
    const validSortColumns = ['wo_number', 'status', 'due_date', 'created_date', 'released_date', 'cost_center', 'work_center'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'due_date';
    const sortDirection = sort_dir === 'desc' ? 'desc' : 'asc';

    const workOrders = await query
      .orderBy(sortColumn, sortDirection)
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    // Add computed fields
    const todayDate = today();
    const enrichedWOs = workOrders.map(wo => {
      const isLate = wo.due_date < todayDate && !['CLOSED', 'CLSD', 'TECO', 'DLT'].includes((wo.status || '').toUpperCase());
      const lateDays = isLate ? daysBetween(wo.due_date, todayDate) : 0;

      return {
        ...wo,
        is_late: isLate,
        late_days: lateDays,
        late_bucket: isLate ? getLateBucket(lateDays) : null
      };
    });

    res.json({
      data: enrichedWOs,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: parseInt(offset) + workOrders.length < total
      },
      metadata: {
        query_time_ms: Date.now() - startTime
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/work-orders/summary
 * Get work order summary counts
 */
router.get('/summary', async (req, res, next) => {
  try {
    const startTime = Date.now();
    const todayDate = today();

    const terminalStatuses = await db('status_config')
      .where('is_terminal', true)
      .pluck('status_code');

    const releasedStatuses = await db('status_config')
      .where('is_released', true)
      .pluck('status_code');

    // Total work orders
    const totalCount = await db('wo_dim').count('* as count').first();

    // Late work orders
    const lateCount = await db('wo_dim')
      .where('due_date', '<', todayDate)
      .whereNotIn(db.raw('UPPER(status)'), terminalStatuses.map(s => s.toUpperCase()))
      .count('* as count')
      .first();

    // Released today
    const releasedToday = await db('wo_dim')
      .where(db.raw('DATE(released_date)'), todayDate)
      .count('* as count')
      .first();

    // Created today
    const createdToday = await db('wo_dim')
      .where(db.raw('DATE(created_date)'), todayDate)
      .count('* as count')
      .first();

    // Currently released (open)
    const currentlyReleased = await db('wo_dim')
      .whereIn(db.raw('UPPER(status)'), releasedStatuses.map(s => s.toUpperCase()))
      .count('* as count')
      .first();

    // Status distribution
    const statusDistribution = await db('wo_dim')
      .select('status')
      .count('* as count')
      .groupBy('status')
      .orderBy('count', 'desc');

    // Late age buckets
    const lateWOs = await db('wo_dim')
      .select('wo_number', 'due_date')
      .where('due_date', '<', todayDate)
      .whereNotIn(db.raw('UPPER(status)'), terminalStatuses.map(s => s.toUpperCase()));

    const lateBuckets = {
      '1-3 days': 0,
      '4-7 days': 0,
      '8-14 days': 0,
      '15-30 days': 0,
      '30+ days': 0
    };

    for (const wo of lateWOs) {
      const days = daysBetween(wo.due_date, todayDate);
      const bucket = getLateBucket(days);
      if (bucket) lateBuckets[bucket]++;
    }

    res.json({
      total: totalCount.count,
      late: lateCount.count,
      released_today: releasedToday.count,
      created_today: createdToday.count,
      currently_released: currentlyReleased.count,
      status_distribution: statusDistribution,
      late_buckets: lateBuckets,
      metadata: {
        query_time_ms: Date.now() - startTime
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/work-orders/:wo_number
 * Get single work order with details
 */
router.get('/:wo_number', async (req, res, next) => {
  try {
    const startTime = Date.now();
    const { wo_number } = req.params;

    const workOrder = await db('wo_dim').where('wo_number', wo_number).first();

    if (!workOrder) {
      return res.status(404).json({ error: { message: 'Work order not found', code: 'NOT_FOUND' } });
    }

    // Get confirmations
    const confirmations = await db('confirmations_fact')
      .where('wo_number', wo_number)
      .orderBy('confirmation_ts', 'desc')
      .limit(50);

    // Get scan events
    const scans = await db('scan_fact')
      .where('wo_number', wo_number)
      .orderBy('scan_in', 'desc')
      .limit(50);

    // Calculate totals
    const totalPounds = confirmations.reduce((sum, c) => sum + parseFloat(c.pounds || 0), 0);
    const totalScanHours = scans.reduce((sum, s) => sum + parseFloat(s.scanning_hours || 0), 0);

    // Compute late status
    const todayDate = today();
    const isLate = workOrder.due_date < todayDate &&
      !['CLOSED', 'CLSD', 'TECO', 'DLT'].includes((workOrder.status || '').toUpperCase());
    const lateDays = isLate ? daysBetween(workOrder.due_date, todayDate) : 0;

    res.json({
      work_order: {
        ...workOrder,
        is_late: isLate,
        late_days: lateDays,
        late_bucket: isLate ? getLateBucket(lateDays) : null
      },
      confirmations,
      scans,
      totals: {
        pounds: Math.round(totalPounds * 100) / 100,
        scan_hours: Math.round(totalScanHours * 100) / 100,
        confirmation_count: confirmations.length,
        scan_count: scans.length
      },
      metadata: {
        query_time_ms: Date.now() - startTime
      }
    });
  } catch (error) {
    next(error);
  }
});

function getLateBucket(days) {
  if (days <= 3) return '1-3 days';
  if (days <= 7) return '4-7 days';
  if (days <= 14) return '8-14 days';
  if (days <= 30) return '15-30 days';
  return '30+ days';
}

module.exports = router;
