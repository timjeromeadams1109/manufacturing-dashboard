const express = require('express');
const { db } = require('../models/database');
const { today, daysBetween } = require('../utils/timeBucketing');

const router = express.Router();

/**
 * GET /api/mrp/summary
 * Get MRP summary
 */
router.get('/summary', async (req, res, next) => {
  try {
    const startTime = Date.now();

    // Get latest snapshot date
    const latestSnapshot = await db('mrp_fact')
      .max('extracted_ts as latest')
      .first();

    if (!latestSnapshot.latest) {
      return res.json({
        message: 'No MRP data available',
        data: null
      });
    }

    // Get summary from latest snapshot
    const summary = await db('mrp_fact')
      .where('extracted_ts', latestSnapshot.latest)
      .select(
        db.raw('SUM(pounds_required) as total_required'),
        db.raw('SUM(pounds_available) as total_available'),
        db.raw('SUM(CASE WHEN shortage < 0 THEN ABS(shortage) ELSE 0 END) as total_shortage'),
        db.raw('COUNT(*) as total_items'),
        db.raw('COUNT(CASE WHEN is_late = 1 THEN 1 END) as late_items')
      )
      .first();

    // Get late by aging bucket
    const todayDate = today();
    const lateItems = await db('mrp_fact')
      .select('material', 'requirement_date', 'shortage')
      .where('extracted_ts', latestSnapshot.latest)
      .where('is_late', true);

    const lateBuckets = {
      '1-3 days': 0,
      '4-7 days': 0,
      '8-14 days': 0,
      '15+ days': 0
    };

    for (const item of lateItems) {
      const days = daysBetween(item.requirement_date, todayDate);
      if (days <= 3) lateBuckets['1-3 days']++;
      else if (days <= 7) lateBuckets['4-7 days']++;
      else if (days <= 14) lateBuckets['8-14 days']++;
      else lateBuckets['15+ days']++;
    }

    // Get by area
    const byArea = await db('mrp_fact')
      .select('area')
      .sum('pounds_required as required')
      .sum('pounds_available as available')
      .sum(db.raw('CASE WHEN shortage < 0 THEN ABS(shortage) ELSE 0 END as shortage'))
      .count('* as items')
      .where('extracted_ts', latestSnapshot.latest)
      .groupBy('area')
      .orderBy('shortage', 'desc');

    res.json({
      snapshot_date: latestSnapshot.latest,
      totals: {
        required: parseFloat(summary.total_required) || 0,
        available: parseFloat(summary.total_available) || 0,
        shortage: parseFloat(summary.total_shortage) || 0,
        items: summary.total_items,
        late_items: summary.late_items
      },
      late_buckets: lateBuckets,
      by_area: byArea,
      metadata: {
        query_time_ms: Date.now() - startTime
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/mrp/items
 * Get MRP items with filters
 */
router.get('/items', async (req, res, next) => {
  try {
    const startTime = Date.now();
    const {
      area,
      late_only,
      shortage_only,
      material,
      limit = 100,
      offset = 0,
      sort_by = 'requirement_date',
      sort_dir = 'asc'
    } = req.query;

    // Get latest snapshot
    const latestSnapshot = await db('mrp_fact')
      .max('extracted_ts as latest')
      .first();

    if (!latestSnapshot.latest) {
      return res.json({ data: [], pagination: { total: 0 } });
    }

    let query = db('mrp_fact').where('extracted_ts', latestSnapshot.latest);

    if (area) {
      query = query.whereIn('area', area.split(','));
    }

    if (late_only === 'true') {
      query = query.where('is_late', true);
    }

    if (shortage_only === 'true') {
      query = query.where('shortage', '<', 0);
    }

    if (material) {
      query = query.where('material', 'like', `%${material}%`);
    }

    // Count
    const countQuery = query.clone();
    const totalResult = await countQuery.count('* as count').first();

    // Sort and paginate
    const validSortColumns = ['material', 'requirement_date', 'pounds_required', 'pounds_available', 'shortage', 'area'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'requirement_date';

    const items = await query
      .orderBy(sortColumn, sort_dir === 'desc' ? 'desc' : 'asc')
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    // Enrich with late days
    const todayDate = today();
    const enrichedItems = items.map(item => ({
      ...item,
      late_days: item.is_late ? daysBetween(item.requirement_date, todayDate) : 0
    }));

    res.json({
      data: enrichedItems,
      snapshot_date: latestSnapshot.latest,
      pagination: {
        total: totalResult.count,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: parseInt(offset) + items.length < totalResult.count
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
 * GET /api/mrp/trend
 * Get MRP trend over time
 */
router.get('/trend', async (req, res, next) => {
  try {
    const startTime = Date.now();
    const { days = 14 } = req.query;

    const trend = await db('mrp_fact')
      .select(db.raw('DATE(extracted_ts) as date'))
      .sum('pounds_required as required')
      .sum('pounds_available as available')
      .sum(db.raw('CASE WHEN shortage < 0 THEN ABS(shortage) ELSE 0 END as shortage'))
      .count('CASE WHEN is_late = 1 THEN 1 END as late_count')
      .groupBy(db.raw('DATE(extracted_ts)'))
      .orderBy('date', 'desc')
      .limit(parseInt(days));

    res.json({
      data: trend.reverse(),
      metadata: {
        query_time_ms: Date.now() - startTime
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
