const express = require('express');
const { db } = require('../models/database');

const router = express.Router();

/**
 * GET /api/mappings/cost-centers
 * Get all cost center mappings
 */
router.get('/cost-centers', async (req, res, next) => {
  try {
    const mappings = await db('cost_center_mapping').orderBy('cost_center');
    res.json({ data: mappings });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/mappings/cost-centers
 * Add or update a cost center mapping
 */
router.post('/cost-centers', async (req, res, next) => {
  try {
    const { cost_center, area, department, description } = req.body;

    if (!cost_center) {
      return res.status(400).json({
        error: { message: 'cost_center is required', code: 'MISSING_FIELD' }
      });
    }

    const existing = await db('cost_center_mapping')
      .where('cost_center', cost_center)
      .first();

    if (existing) {
      await db('cost_center_mapping')
        .where('cost_center', cost_center)
        .update({
          area: area || existing.area,
          department: department || existing.department,
          description: description || existing.description,
          updated_at: new Date().toISOString()
        });
    } else {
      await db('cost_center_mapping').insert({
        cost_center,
        area,
        department,
        description
      });
    }

    // Resolve related exceptions
    await db('exceptions_log')
      .where('exception_type', 'UNMAPPED_COST_CENTER')
      .where('business_key', cost_center)
      .whereNull('resolved_at')
      .update({
        resolved_at: new Date().toISOString(),
        resolution_notes: 'Mapping added via UI'
      });

    res.json({ success: true, cost_center });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/mappings/cost-centers/:cost_center
 * Delete a cost center mapping
 */
router.delete('/cost-centers/:cost_center', async (req, res, next) => {
  try {
    const { cost_center } = req.params;

    await db('cost_center_mapping')
      .where('cost_center', cost_center)
      .delete();

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/mappings/work-centers
 * Get all work center mappings
 */
router.get('/work-centers', async (req, res, next) => {
  try {
    const mappings = await db('work_center_mapping').orderBy('work_center');
    res.json({ data: mappings });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/mappings/work-centers
 * Add or update a work center mapping
 */
router.post('/work-centers', async (req, res, next) => {
  try {
    const { work_center, cost_center, area, description } = req.body;

    if (!work_center) {
      return res.status(400).json({
        error: { message: 'work_center is required', code: 'MISSING_FIELD' }
      });
    }

    const existing = await db('work_center_mapping')
      .where('work_center', work_center)
      .first();

    if (existing) {
      await db('work_center_mapping')
        .where('work_center', work_center)
        .update({
          cost_center: cost_center || existing.cost_center,
          area: area || existing.area,
          description: description || existing.description,
          updated_at: new Date().toISOString()
        });
    } else {
      await db('work_center_mapping').insert({
        work_center,
        cost_center,
        area,
        description
      });
    }

    // Resolve related exceptions
    await db('exceptions_log')
      .where('exception_type', 'UNMAPPED_WORK_CENTER')
      .where('business_key', work_center)
      .whereNull('resolved_at')
      .update({
        resolved_at: new Date().toISOString(),
        resolution_notes: 'Mapping added via UI'
      });

    res.json({ success: true, work_center });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/mappings/statuses
 * Get status configuration
 */
router.get('/statuses', async (req, res, next) => {
  try {
    const statuses = await db('status_config').orderBy('status_code');
    res.json({ data: statuses });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/mappings/statuses
 * Add or update a status configuration
 */
router.post('/statuses', async (req, res, next) => {
  try {
    const { status_code, status_label, is_terminal, is_released } = req.body;

    if (!status_code) {
      return res.status(400).json({
        error: { message: 'status_code is required', code: 'MISSING_FIELD' }
      });
    }

    const existing = await db('status_config')
      .where('status_code', status_code)
      .first();

    if (existing) {
      await db('status_config')
        .where('status_code', status_code)
        .update({
          status_label: status_label ?? existing.status_label,
          is_terminal: is_terminal ?? existing.is_terminal,
          is_released: is_released ?? existing.is_released
        });
    } else {
      await db('status_config').insert({
        status_code,
        status_label,
        is_terminal: is_terminal || false,
        is_released: is_released || false
      });
    }

    res.json({ success: true, status_code });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/mappings/unmapped
 * Get list of unmapped values from data
 */
router.get('/unmapped', async (req, res, next) => {
  try {
    // Get unmapped cost centers from Kronos
    const unmappedCC = await db('kronos_fact as kf')
      .select('kf.cost_center')
      .leftJoin('cost_center_mapping as ccm', 'kf.cost_center', 'ccm.cost_center')
      .whereNull('ccm.cost_center')
      .whereNotNull('kf.cost_center')
      .groupBy('kf.cost_center')
      .count('* as usage_count');

    // Get unmapped work centers
    const unmappedWC = await db('wo_dim as wd')
      .select('wd.work_center')
      .leftJoin('work_center_mapping as wcm', 'wd.work_center', 'wcm.work_center')
      .whereNull('wcm.work_center')
      .whereNotNull('wd.work_center')
      .groupBy('wd.work_center')
      .count('* as usage_count');

    res.json({
      unmapped_cost_centers: unmappedCC,
      unmapped_work_centers: unmappedWC
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/mappings/areas
 * Get distinct areas
 */
router.get('/areas', async (req, res, next) => {
  try {
    const areas = await db('cost_center_mapping')
      .distinct('area')
      .whereNotNull('area')
      .orderBy('area');

    res.json({ data: areas.map(a => a.area) });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/mappings/shifts
 * Get distinct shifts
 */
router.get('/shifts', async (req, res, next) => {
  try {
    const shifts = await db('kronos_fact')
      .distinct('shift')
      .whereNotNull('shift')
      .orderBy('shift');

    res.json({ data: shifts.map(s => s.shift) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
