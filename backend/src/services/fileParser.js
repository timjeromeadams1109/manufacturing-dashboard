const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const path = require('path');

/**
 * Parse a file (CSV or XLSX) and return rows as objects
 * @param {string} filePath - Path to the file
 * @param {string} originalFilename - Original filename to determine type
 * @returns {Object} { headers: string[], rows: object[], rawRows: number }
 */
function parseFile(filePath, originalFilename) {
  const ext = path.extname(originalFilename).toLowerCase();

  if (ext === '.csv') {
    return parseCSV(filePath);
  } else if (ext === '.xlsx' || ext === '.xls') {
    return parseXLSX(filePath);
  } else {
    throw new Error(`Unsupported file type: ${ext}. Please upload CSV or XLSX.`);
  }
}

/**
 * Parse CSV file
 */
function parseCSV(filePath) {
  const fs = require('fs');
  const content = fs.readFileSync(filePath, 'utf-8');

  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  });

  const headers = records.length > 0 ? Object.keys(records[0]) : [];

  return {
    headers,
    rows: records,
    rawRows: records.length
  };
}

/**
 * Parse XLSX file
 */
function parseXLSX(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: null,
    raw: false
  });

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

  return {
    headers,
    rows,
    rawRows: rows.length
  };
}

/**
 * Apply column mapping to transform rows
 * @param {Array} rows - Raw rows from file
 * @param {Object} mapping - Column mapping { sourceColumn: targetField }
 * @returns {Array} Transformed rows with target field names
 */
function applyMapping(rows, mapping) {
  return rows.map((row, index) => {
    const mapped = { _row_index: index + 1 };

    for (const [sourceCol, targetField] of Object.entries(mapping)) {
      if (targetField && targetField !== '--skip--') {
        // Handle case-insensitive header matching
        const sourceValue = row[sourceCol] ??
          row[sourceCol.toLowerCase()] ??
          row[sourceCol.toUpperCase()];
        mapped[targetField] = sourceValue;
      }
    }

    return mapped;
  });
}

/**
 * Get a preview of the file (first N rows)
 * @param {Array} rows - All rows
 * @param {number} limit - Number of rows to preview
 * @returns {Array} Preview rows
 */
function getPreview(rows, limit = 20) {
  return rows.slice(0, limit);
}

/**
 * Auto-detect column mappings based on common aliases
 */
function autoDetectMapping(headers, datasetType) {
  const aliases = getAliasesForDataset(datasetType);
  const mapping = {};

  for (const header of headers) {
    const normalizedHeader = header.toLowerCase().replace(/[_\s-]/g, '');

    for (const [targetField, aliasList] of Object.entries(aliases)) {
      for (const alias of aliasList) {
        const normalizedAlias = alias.toLowerCase().replace(/[_\s-]/g, '');
        if (normalizedHeader === normalizedAlias || normalizedHeader.includes(normalizedAlias)) {
          mapping[header] = targetField;
          break;
        }
      }
      if (mapping[header]) break;
    }

    if (!mapping[header]) {
      mapping[header] = '--skip--';
    }
  }

  return mapping;
}

/**
 * Get column aliases for a dataset type
 */
function getAliasesForDataset(datasetType) {
  const allAliases = {
    SAP_WO_EXPORT: {
      wo_number: ['wo_number', 'order', 'work_order', 'aufnr', 'order_number', 'workorder'],
      status: ['status', 'system_status', 'order_status', 'stat'],
      due_date: ['due_date', 'finish_date', 'basic_finish', 'end_date', 'scheduled_finish', 'duedate'],
      created_date: ['created_date', 'created_on', 'creation_date', 'erdat', 'createdon'],
      released_date: ['released_date', 'release_date', 'released_on', 'releasedon'],
      closed_date: ['closed_date', 'actual_finish', 'closed_on', 'completion_date', 'closedon'],
      work_center: ['work_center', 'workcenter', 'arbpl', 'wc'],
      cost_center: ['cost_center', 'costcenter', 'kostl', 'cc'],
      area: ['area', 'department', 'production_area', 'dept'],
      material: ['material', 'material_number', 'matnr', 'part_number', 'partnumber'],
      order_type: ['order_type', 'type', 'auart', 'ordertype'],
      planned_qty: ['planned_qty', 'target_qty', 'plan_qty', 'gamng', 'plannedqty'],
      unit: ['unit', 'uom', 'unit_of_measure', 'gmein']
    },
    SAP_CONFIRMATIONS_EXPORT: {
      wo_number: ['wo_number', 'order', 'work_order', 'aufnr', 'ordernumber'],
      operation: ['operation', 'op', 'operation_number', 'vornr'],
      confirmation_ts: ['confirmation_ts', 'posting_date', 'budat', 'confirm_date', 'production_ts', 'confirmationdate', 'postingdate'],
      pounds: ['pounds', 'quantity', 'yield', 'lmnga', 'confirmed_qty', 'qty', 'weight'],
      work_center: ['work_center', 'workcenter', 'arbpl'],
      cost_center: ['cost_center', 'costcenter', 'kostl'],
      employee_id: ['employee_id', 'pernr', 'user', 'entered_by', 'employeeid'],
      confirmation_number: ['confirmation_number', 'ruession', 'conf_no', 'confnumber']
    },
    KRONOS_HOURS_EXPORT: {
      punch_date: ['punch_date', 'work_date', 'date', 'pay_date', 'workdate'],
      punch_in: ['punch_in', 'clock_in', 'start_time', 'in_time', 'clockin', 'starttime'],
      punch_out: ['punch_out', 'clock_out', 'end_time', 'out_time', 'clockout', 'endtime'],
      hours: ['hours', 'worked_hours', 'total_hours', 'net_hours', 'workedhours'],
      cost_center: ['cost_center', 'costcenter', 'home_cost_center', 'labor_account', 'homecostcenter'],
      employee_id: ['employee_id', 'badge', 'emp_id', 'pernr', 'employee_number', 'employeeid'],
      employee_name: ['employee_name', 'name', 'full_name', 'employeename'],
      shift: ['shift', 'shift_code', 'schedule'],
      pay_type: ['pay_type', 'pay_code', 'earnings_code', 'paytype']
    },
    WO_SCANNING_EXPORT: {
      wo_number: ['wo_number', 'order', 'work_order', 'barcode', 'workorder'],
      scan_in: ['scan_in', 'start_scan', 'scan_start', 'begin_time', 'scanin', 'starttime'],
      scan_out: ['scan_out', 'end_scan', 'scan_end', 'finish_time', 'scanout', 'endtime'],
      scanning_hours: ['scanning_hours', 'duration', 'elapsed_hours', 'scanhours'],
      station: ['station', 'workstation', 'terminal', 'scan_location'],
      employee_id: ['employee_id', 'badge', 'operator', 'user', 'employeeid'],
      cost_center: ['cost_center', 'costcenter'],
      work_center: ['work_center', 'workcenter']
    },
    SAP_MRP_EXPORT: {
      material: ['material', 'material_number', 'matnr', 'part', 'partnumber'],
      requirement_date: ['requirement_date', 'req_date', 'need_date', 'mf_date', 'requirementdate'],
      pounds_required: ['pounds_required', 'qty_required', 'demand', 'requirement_qty', 'poundsrequired'],
      pounds_available: ['pounds_available', 'qty_available', 'supply', 'available_qty', 'poundsavailable'],
      plant: ['plant', 'werks', 'facility'],
      area: ['area', 'mrp_area', 'department'],
      shortage: ['shortage', 'deficit'],
      mrp_controller: ['mrp_controller', 'controller', 'dispo'],
      extracted_ts: ['extracted_ts', 'extract_date', 'snapshot_date', 'run_date', 'extractdate']
    }
  };

  return allAliases[datasetType] || {};
}

/**
 * Validate mapped rows against required fields
 * @param {Array} rows - Mapped rows
 * @param {string} datasetType - Type of dataset
 * @returns {Object} { valid: Array, errors: Array }
 */
function validateRows(rows, datasetType) {
  const requiredFields = getRequiredFields(datasetType);
  const valid = [];
  const errors = [];

  for (const row of rows) {
    const missingFields = [];

    for (const field of requiredFields) {
      if (row[field] === null || row[field] === undefined || row[field] === '') {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      errors.push({
        row_index: row._row_index,
        error: `Missing required fields: ${missingFields.join(', ')}`,
        data: row
      });
    } else {
      valid.push(row);
    }
  }

  return { valid, errors };
}

function getRequiredFields(datasetType) {
  const required = {
    SAP_WO_EXPORT: ['wo_number', 'status', 'due_date', 'created_date'],
    SAP_CONFIRMATIONS_EXPORT: ['wo_number', 'confirmation_ts', 'pounds'],
    KRONOS_HOURS_EXPORT: ['punch_date', 'punch_in', 'punch_out', 'hours', 'cost_center'],
    WO_SCANNING_EXPORT: ['wo_number', 'scan_in'],
    SAP_MRP_EXPORT: ['material', 'requirement_date', 'pounds_required', 'pounds_available']
  };

  return required[datasetType] || [];
}

module.exports = {
  parseFile,
  applyMapping,
  getPreview,
  autoDetectMapping,
  validateRows,
  getRequiredFields,
  getAliasesForDataset
};
