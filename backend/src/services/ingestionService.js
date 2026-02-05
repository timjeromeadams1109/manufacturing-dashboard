const { db } = require('../models/database');
const { toHourBucket, parseDate, distributeHoursTooBuckets, now } = require('../utils/timeBucketing');

/**
 * Ingest Work Order data into wo_dim
 */
async function ingestWorkOrders(rows, uploadId) {
  const results = { inserted: 0, updated: 0, errors: [] };

  for (const row of rows) {
    try {
      const woData = {
        wo_number: String(row.wo_number).trim(),
        status: row.status ? String(row.status).trim().toUpperCase() : null,
        due_date: parseDate(row.due_date)?.toISODate() || null,
        created_date: parseDate(row.created_date)?.toISO() || null,
        released_date: row.released_date ? parseDate(row.released_date)?.toISO() : null,
        closed_date: row.closed_date ? parseDate(row.closed_date)?.toISO() : null,
        work_center: row.work_center || null,
        cost_center: row.cost_center || null,
        area: row.area || null,
        material: row.material || null,
        order_type: row.order_type || null,
        planned_qty: row.planned_qty ? parseFloat(row.planned_qty) : null,
        unit: row.unit || null,
        upload_id: uploadId,
        updated_at: now().toISO()
      };

      // Upsert logic
      const existing = await db('wo_dim').where('wo_number', woData.wo_number).first();

      if (existing) {
        await db('wo_dim')
          .where('wo_number', woData.wo_number)
          .update(woData);
        results.updated++;
      } else {
        await db('wo_dim').insert(woData);
        results.inserted++;
      }
    } catch (error) {
      results.errors.push({
        row_index: row._row_index,
        error: error.message,
        wo_number: row.wo_number
      });
    }
  }

  return results;
}

/**
 * Ingest Confirmations data
 */
async function ingestConfirmations(rows, uploadId) {
  const results = { inserted: 0, updated: 0, errors: [], exceptions: [] };

  for (const row of rows) {
    try {
      const confirmationTs = parseDate(row.confirmation_ts);
      if (!confirmationTs) {
        results.errors.push({
          row_index: row._row_index,
          error: 'Invalid confirmation timestamp',
          data: row
        });
        continue;
      }

      const hourBucket = toHourBucket(row.confirmation_ts);
      const pounds = parseFloat(row.pounds);

      if (isNaN(pounds)) {
        results.errors.push({
          row_index: row._row_index,
          error: 'Invalid pounds value',
          data: row
        });
        continue;
      }

      // Derive cost center from WO if not provided
      let costCenter = row.cost_center;
      if (!costCenter && row.wo_number) {
        const wo = await db('wo_dim').where('wo_number', row.wo_number).first();
        if (wo) {
          costCenter = wo.cost_center;
        } else {
          // Log exception for unknown WO
          results.exceptions.push({
            exception_type: 'UNKNOWN_WO',
            source_table: 'confirmations_fact',
            business_key: row.wo_number,
            details: JSON.stringify({ confirmation_ts: confirmationTs.toISO(), pounds })
          });
        }
      }

      const confData = {
        wo_number: String(row.wo_number).trim(),
        operation: row.operation || null,
        confirmation_ts: confirmationTs.toISO(),
        hour_bucket_ts: hourBucket,
        pounds,
        work_center: row.work_center || null,
        cost_center: costCenter || null,
        employee_id: row.employee_id || null,
        confirmation_number: row.confirmation_number || null,
        upload_id: uploadId
      };

      // Upsert based on unique key
      const existing = await db('confirmations_fact')
        .where({
          wo_number: confData.wo_number,
          confirmation_ts: confData.confirmation_ts,
          operation: confData.operation
        })
        .first();

      if (existing) {
        await db('confirmations_fact')
          .where('id', existing.id)
          .update(confData);
        results.updated++;
      } else {
        await db('confirmations_fact').insert(confData);
        results.inserted++;
      }
    } catch (error) {
      results.errors.push({
        row_index: row._row_index,
        error: error.message,
        wo_number: row.wo_number
      });
    }
  }

  // Log exceptions
  if (results.exceptions.length > 0) {
    await db('exceptions_log').insert(
      results.exceptions.map(e => ({ ...e, upload_id: uploadId }))
    );
  }

  return results;
}

/**
 * Ingest Kronos hours data
 */
async function ingestKronosHours(rows, uploadId) {
  const results = { inserted: 0, errors: [], exceptions: [] };

  for (const row of rows) {
    try {
      const punchIn = parseDate(row.punch_in);
      const punchOut = parseDate(row.punch_out);

      if (!punchIn || !punchOut) {
        results.errors.push({
          row_index: row._row_index,
          error: 'Invalid punch timestamps',
          data: row
        });
        continue;
      }

      if (punchOut <= punchIn) {
        results.errors.push({
          row_index: row._row_index,
          error: 'Punch out must be after punch in',
          data: row
        });
        continue;
      }

      const totalHours = parseFloat(row.hours);
      if (isNaN(totalHours) || totalHours < 0 || totalHours > 24) {
        results.errors.push({
          row_index: row._row_index,
          error: 'Invalid hours value (must be 0-24)',
          data: row
        });
        continue;
      }

      // Check for unmapped cost center
      const ccMapping = await db('cost_center_mapping')
        .where('cost_center', row.cost_center)
        .first();

      if (!ccMapping) {
        results.exceptions.push({
          exception_type: 'UNMAPPED_COST_CENTER',
          source_table: 'kronos_fact',
          business_key: row.cost_center,
          details: JSON.stringify({ employee_id: row.employee_id, punch_date: row.punch_date })
        });
      }

      // Distribute hours to buckets
      const hourBuckets = distributeHoursTooBuckets(
        punchIn.toISO(),
        punchOut.toISO(),
        totalHours
      );

      // Scale distributed hours to match total (handles rounding)
      const distributedTotal = hourBuckets.reduce((sum, b) => sum + b.hours, 0);
      const scaleFactor = distributedTotal > 0 ? totalHours / distributedTotal : 1;

      for (const bucket of hourBuckets) {
        const kronosData = {
          punch_date: parseDate(row.punch_date)?.toISODate() || punchIn.toISODate(),
          punch_in: punchIn.toISO(),
          punch_out: punchOut.toISO(),
          hour_bucket_ts: bucket.hour_bucket_ts,
          hours: Math.round(bucket.hours * scaleFactor * 10000) / 10000,
          cost_center: row.cost_center,
          employee_id: row.employee_id || null,
          employee_name: row.employee_name || null,
          shift: row.shift || null,
          pay_type: row.pay_type || null,
          upload_id: uploadId
        };

        await db('kronos_fact').insert(kronosData);
        results.inserted++;
      }
    } catch (error) {
      results.errors.push({
        row_index: row._row_index,
        error: error.message,
        data: row
      });
    }
  }

  // Log exceptions (deduplicated)
  const uniqueExceptions = Array.from(
    new Map(results.exceptions.map(e => [e.business_key, e])).values()
  );
  if (uniqueExceptions.length > 0) {
    await db('exceptions_log').insert(
      uniqueExceptions.map(e => ({ ...e, upload_id: uploadId }))
    );
  }

  return results;
}

/**
 * Ingest Scanning data
 */
async function ingestScanning(rows, uploadId) {
  const results = { inserted: 0, updated: 0, errors: [], exceptions: [] };

  for (const row of rows) {
    try {
      const scanIn = parseDate(row.scan_in);
      if (!scanIn) {
        results.errors.push({
          row_index: row._row_index,
          error: 'Invalid scan_in timestamp',
          data: row
        });
        continue;
      }

      const scanOut = row.scan_out ? parseDate(row.scan_out) : null;
      const isOrphan = !scanOut;

      let scanningHours = null;
      if (row.scanning_hours) {
        scanningHours = parseFloat(row.scanning_hours);
      } else if (scanOut) {
        scanningHours = scanOut.diff(scanIn, 'hours').hours;
        scanningHours = Math.round(scanningHours * 10000) / 10000;
      }

      // Derive cost center
      let costCenter = row.cost_center;
      if (!costCenter) {
        const wo = await db('wo_dim').where('wo_number', row.wo_number).first();
        if (wo) {
          costCenter = wo.cost_center;

          if (!costCenter && wo.work_center) {
            const wcMapping = await db('work_center_mapping')
              .where('work_center', wo.work_center)
              .first();
            if (wcMapping) {
              costCenter = wcMapping.cost_center;
            }
          }
        } else {
          results.exceptions.push({
            exception_type: 'UNKNOWN_WO',
            source_table: 'scan_fact',
            business_key: row.wo_number,
            details: JSON.stringify({ scan_in: scanIn.toISO() })
          });
        }
      }

      if (isOrphan) {
        results.exceptions.push({
          exception_type: 'ORPHAN_SCAN',
          source_table: 'scan_fact',
          business_key: `${row.wo_number}|${scanIn.toISO()}`,
          details: JSON.stringify({ wo_number: row.wo_number, scan_in: scanIn.toISO() })
        });
      }

      const scanData = {
        wo_number: String(row.wo_number).trim(),
        scan_in: scanIn.toISO(),
        scan_out: scanOut?.toISO() || null,
        hour_bucket_ts: toHourBucket(scanIn.toISO()),
        scanning_hours: scanningHours,
        station: row.station || null,
        employee_id: row.employee_id || null,
        cost_center: costCenter || null,
        work_center: row.work_center || null,
        is_orphan: isOrphan,
        upload_id: uploadId
      };

      // Upsert
      const existing = await db('scan_fact')
        .where({ wo_number: scanData.wo_number, scan_in: scanData.scan_in })
        .first();

      if (existing) {
        await db('scan_fact')
          .where('id', existing.id)
          .update(scanData);
        results.updated++;
      } else {
        await db('scan_fact').insert(scanData);
        results.inserted++;
      }
    } catch (error) {
      results.errors.push({
        row_index: row._row_index,
        error: error.message,
        data: row
      });
    }
  }

  // Log exceptions
  const uniqueExceptions = Array.from(
    new Map(results.exceptions.map(e => [e.business_key, e])).values()
  );
  if (uniqueExceptions.length > 0) {
    await db('exceptions_log').insert(
      uniqueExceptions.map(e => ({ ...e, upload_id: uploadId }))
    );
  }

  return results;
}

/**
 * Ingest MRP data
 */
async function ingestMRP(rows, uploadId) {
  const results = { inserted: 0, errors: [] };
  const extractedTs = now().toISO();

  for (const row of rows) {
    try {
      const requirementDate = parseDate(row.requirement_date);
      if (!requirementDate) {
        results.errors.push({
          row_index: row._row_index,
          error: 'Invalid requirement_date',
          data: row
        });
        continue;
      }

      const poundsRequired = parseFloat(row.pounds_required);
      const poundsAvailable = parseFloat(row.pounds_available);

      if (isNaN(poundsRequired) || isNaN(poundsAvailable)) {
        results.errors.push({
          row_index: row._row_index,
          error: 'Invalid pounds values',
          data: row
        });
        continue;
      }

      const shortage = poundsAvailable - poundsRequired;
      const rowExtractedTs = row.extracted_ts
        ? parseDate(row.extracted_ts)?.toISO() || extractedTs
        : extractedTs;

      // Determine if late: requirement_date < extracted_ts date AND shortage < 0
      const extractedDate = parseDate(rowExtractedTs);
      const isLate = requirementDate < extractedDate.startOf('day') && shortage < 0;

      const mrpData = {
        material: String(row.material).trim(),
        requirement_date: requirementDate.toISODate(),
        pounds_required: poundsRequired,
        pounds_available: poundsAvailable,
        plant: row.plant || null,
        area: row.area || null,
        shortage,
        mrp_controller: row.mrp_controller || null,
        extracted_ts: rowExtractedTs,
        is_late: isLate,
        upload_id: uploadId
      };

      await db('mrp_fact').insert(mrpData);
      results.inserted++;
    } catch (error) {
      results.errors.push({
        row_index: row._row_index,
        error: error.message,
        data: row
      });
    }
  }

  return results;
}

/**
 * Refresh KPI hourly aggregates for affected time range
 */
async function refreshKPIHourly(startDate, endDate) {
  // Clear existing aggregates for the date range
  await db('kpi_hourly')
    .where('hour_bucket_ts', '>=', startDate)
    .where('hour_bucket_ts', '<=', endDate + 'T23:59:59')
    .delete();

  // Aggregate confirmations
  const confAgg = await db('confirmations_fact')
    .select('hour_bucket_ts', 'cost_center')
    .sum('pounds as pounds')
    .whereNotNull('hour_bucket_ts')
    .groupBy('hour_bucket_ts', 'cost_center');

  // Aggregate kronos hours
  const kronosAgg = await db('kronos_fact')
    .select('hour_bucket_ts', 'cost_center')
    .sum('hours as kronos_hours')
    .whereNotNull('hour_bucket_ts')
    .groupBy('hour_bucket_ts', 'cost_center');

  // Aggregate scanning hours
  const scanAgg = await db('scan_fact')
    .select('hour_bucket_ts', 'cost_center')
    .sum('scanning_hours as scanning_hours')
    .where('is_orphan', false)
    .whereNotNull('hour_bucket_ts')
    .groupBy('hour_bucket_ts', 'cost_center');

  // Merge aggregates
  const mergedMap = new Map();

  for (const row of confAgg) {
    const key = `${row.hour_bucket_ts}|${row.cost_center || 'NULL'}`;
    if (!mergedMap.has(key)) {
      mergedMap.set(key, {
        hour_bucket_ts: row.hour_bucket_ts,
        cost_center: row.cost_center,
        pounds: 0,
        kronos_hours: 0,
        scanning_hours: 0
      });
    }
    mergedMap.get(key).pounds = parseFloat(row.pounds) || 0;
  }

  for (const row of kronosAgg) {
    const key = `${row.hour_bucket_ts}|${row.cost_center || 'NULL'}`;
    if (!mergedMap.has(key)) {
      mergedMap.set(key, {
        hour_bucket_ts: row.hour_bucket_ts,
        cost_center: row.cost_center,
        pounds: 0,
        kronos_hours: 0,
        scanning_hours: 0
      });
    }
    mergedMap.get(key).kronos_hours = parseFloat(row.kronos_hours) || 0;
  }

  for (const row of scanAgg) {
    const key = `${row.hour_bucket_ts}|${row.cost_center || 'NULL'}`;
    if (!mergedMap.has(key)) {
      mergedMap.set(key, {
        hour_bucket_ts: row.hour_bucket_ts,
        cost_center: row.cost_center,
        pounds: 0,
        kronos_hours: 0,
        scanning_hours: 0
      });
    }
    mergedMap.get(key).scanning_hours = parseFloat(row.scanning_hours) || 0;
  }

  // Calculate PPLH and variance for each bucket
  const kpiRows = Array.from(mergedMap.values()).map(row => {
    const pplh = row.kronos_hours > 0
      ? Math.round((row.pounds / row.kronos_hours) * 10000) / 10000
      : null;
    const variance = row.scanning_hours - row.kronos_hours;
    const variancePct = row.kronos_hours > 0
      ? Math.round((variance / row.kronos_hours) * 10000) / 100
      : null;

    // Look up area from cost center mapping
    return {
      ...row,
      pplh,
      variance,
      variance_pct: variancePct,
      updated_at: now().toISO()
    };
  });

  // Batch insert
  if (kpiRows.length > 0) {
    const batchSize = 500;
    for (let i = 0; i < kpiRows.length; i += batchSize) {
      const batch = kpiRows.slice(i, i + batchSize);
      await db('kpi_hourly').insert(batch);
    }
  }

  return kpiRows.length;
}

module.exports = {
  ingestWorkOrders,
  ingestConfirmations,
  ingestKronosHours,
  ingestScanning,
  ingestMRP,
  refreshKPIHourly
};
