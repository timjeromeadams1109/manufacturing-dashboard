const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const { db } = require('../models/database');
const { parseFile, applyMapping, autoDetectMapping, validateRows } = require('../services/fileParser');
const {
  ingestWorkOrders,
  ingestConfirmations,
  ingestKronosHours,
  ingestScanning,
  ingestMRP,
  refreshKPIHourly
} = require('../services/ingestionService');

const router = express.Router();

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '..', '..', 'data', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.csv', '.xlsx', '.xls'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and XLSX files are allowed'));
    }
  }
});

/**
 * POST /api/upload/parse
 * Parse uploaded file and return preview
 */
router.post('/parse', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { message: 'No file uploaded', code: 'NO_FILE' } });
    }

    const datasetType = req.body.dataset_type;
    if (!datasetType) {
      return res.status(400).json({ error: { message: 'dataset_type is required', code: 'MISSING_TYPE' } });
    }

    const validTypes = ['SAP_WO_EXPORT', 'SAP_CONFIRMATIONS_EXPORT', 'KRONOS_HOURS_EXPORT', 'WO_SCANNING_EXPORT', 'SAP_MRP_EXPORT'];
    if (!validTypes.includes(datasetType)) {
      return res.status(400).json({ error: { message: `Invalid dataset_type. Must be one of: ${validTypes.join(', ')}`, code: 'INVALID_TYPE' } });
    }

    // Parse file
    const { headers, rows, rawRows } = parseFile(req.file.path, req.file.originalname);

    // Auto-detect mapping
    const suggestedMapping = autoDetectMapping(headers, datasetType);

    // Create upload record
    const [uploadId] = await db('uploads').insert({
      filename: req.file.filename,
      original_filename: req.file.originalname,
      dataset_type: datasetType,
      status: 'preview',
      total_rows: rawRows
    });

    res.json({
      upload_id: uploadId,
      filename: req.file.originalname,
      dataset_type: datasetType,
      total_rows: rawRows,
      headers,
      preview: rows.slice(0, 20),
      suggested_mapping: suggestedMapping
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/upload/ingest
 * Process the uploaded file with provided mapping
 */
router.post('/ingest', async (req, res, next) => {
  try {
    const { upload_id, mapping, save_template, template_name } = req.body;

    if (!upload_id || !mapping) {
      return res.status(400).json({
        error: { message: 'upload_id and mapping are required', code: 'MISSING_PARAMS' }
      });
    }

    // Get upload record
    const uploadRecord = await db('uploads').where('id', upload_id).first();
    if (!uploadRecord) {
      return res.status(404).json({ error: { message: 'Upload not found', code: 'NOT_FOUND' } });
    }

    // Update status
    await db('uploads').where('id', upload_id).update({ status: 'processing' });

    // Read and parse file again
    const filePath = path.join(uploadDir, uploadRecord.filename);
    const { rows } = parseFile(filePath, uploadRecord.original_filename);

    // Apply mapping
    const mappedRows = applyMapping(rows, mapping);

    // Validate
    const { valid, errors } = validateRows(mappedRows, uploadRecord.dataset_type);

    // Ingest based on dataset type
    let result;
    switch (uploadRecord.dataset_type) {
      case 'SAP_WO_EXPORT':
        result = await ingestWorkOrders(valid, upload_id);
        break;
      case 'SAP_CONFIRMATIONS_EXPORT':
        result = await ingestConfirmations(valid, upload_id);
        break;
      case 'KRONOS_HOURS_EXPORT':
        result = await ingestKronosHours(valid, upload_id);
        break;
      case 'WO_SCANNING_EXPORT':
        result = await ingestScanning(valid, upload_id);
        break;
      case 'SAP_MRP_EXPORT':
        result = await ingestMRP(valid, upload_id);
        break;
      default:
        throw new Error('Unknown dataset type');
    }

    // Update upload record
    await db('uploads').where('id', upload_id).update({
      status: 'completed',
      processed_rows: (result.inserted || 0) + (result.updated || 0),
      error_rows: errors.length + (result.errors?.length || 0),
      mapping_template: JSON.stringify(mapping),
      error_summary: JSON.stringify([...errors, ...(result.errors || [])].slice(0, 100)),
      completed_at: new Date().toISOString()
    });

    // Save mapping template if requested
    if (save_template && template_name) {
      await db('mapping_templates')
        .insert({
          name: template_name,
          dataset_type: uploadRecord.dataset_type,
          mappings: JSON.stringify(mapping)
        })
        .onConflict('name')
        .merge();
    }

    // Refresh KPI hourly aggregates (async, don't wait)
    refreshKPIHourly('2000-01-01', '2099-12-31').catch(err => {
      console.error('Error refreshing KPI hourly:', err);
    });

    res.json({
      upload_id,
      status: 'completed',
      total_rows: uploadRecord.total_rows,
      processed_rows: (result.inserted || 0) + (result.updated || 0),
      inserted: result.inserted || 0,
      updated: result.updated || 0,
      error_rows: errors.length + (result.errors?.length || 0),
      validation_errors: errors.slice(0, 20),
      ingestion_errors: (result.errors || []).slice(0, 20),
      exceptions_logged: result.exceptions?.length || 0
    });
  } catch (error) {
    if (req.body.upload_id) {
      await db('uploads').where('id', req.body.upload_id).update({
        status: 'failed',
        error_summary: JSON.stringify({ message: error.message })
      });
    }
    next(error);
  }
});

/**
 * GET /api/upload/templates
 * Get saved mapping templates
 */
router.get('/templates', async (req, res, next) => {
  try {
    const { dataset_type } = req.query;

    let query = db('mapping_templates').orderBy('name');
    if (dataset_type) {
      query = query.where('dataset_type', dataset_type);
    }

    const templates = await query;

    res.json(templates.map(t => ({
      ...t,
      mappings: JSON.parse(t.mappings || '{}')
    })));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/upload/history
 * Get upload history
 */
router.get('/history', async (req, res, next) => {
  try {
    const { limit = 50, offset = 0, dataset_type, status } = req.query;

    let query = db('uploads').orderBy('created_at', 'desc');

    if (dataset_type) {
      query = query.where('dataset_type', dataset_type);
    }
    if (status) {
      query = query.where('status', status);
    }

    const uploads = await query.limit(parseInt(limit)).offset(parseInt(offset));

    res.json(uploads);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/upload/:id
 * Get single upload details
 */
router.get('/:id', async (req, res, next) => {
  try {
    const upload = await db('uploads').where('id', req.params.id).first();

    if (!upload) {
      return res.status(404).json({ error: { message: 'Upload not found', code: 'NOT_FOUND' } });
    }

    res.json({
      ...upload,
      mapping_template: JSON.parse(upload.mapping_template || '{}'),
      error_summary: JSON.parse(upload.error_summary || '[]')
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
