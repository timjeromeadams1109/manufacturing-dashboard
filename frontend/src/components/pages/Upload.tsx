import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { CloudArrowUpIcon, DocumentIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { uploadApi } from '../../services/api';
import { DatasetType, UploadParseResult, UploadIngestResult } from '../../types';

const DATASET_TYPES: { value: DatasetType; label: string; description: string }[] = [
  { value: 'SAP_WO_EXPORT', label: 'Work Orders (SAP)', description: 'Work order master data' },
  { value: 'SAP_CONFIRMATIONS_EXPORT', label: 'Confirmations (SAP)', description: 'Production confirmations with pounds' },
  { value: 'KRONOS_HOURS_EXPORT', label: 'Labor Hours (Kronos)', description: 'Employee time and attendance' },
  { value: 'WO_SCANNING_EXPORT', label: 'WO Scanning', description: 'Work order scan-in/scan-out events' },
  { value: 'SAP_MRP_EXPORT', label: 'MRP Export (SAP)', description: 'Material requirements planning data' },
];

type Step = 'select' | 'upload' | 'mapping' | 'result';

export function UploadPage() {
  const [step, setStep] = useState<Step>('select');
  const [datasetType, setDatasetType] = useState<DatasetType | null>(null);
  const [parseResult, setParseResult] = useState<UploadParseResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [ingestResult, setIngestResult] = useState<UploadIngestResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [saveTemplate, setSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!datasetType || acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      setLoading(true);

      try {
        const result = await uploadApi.parseFile(file, datasetType);
        setParseResult(result);
        setMapping(result.suggested_mapping);
        setStep('mapping');
        toast.success(`Parsed ${result.total_rows} rows`);
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [datasetType]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    disabled: !datasetType,
  });

  const handleSelectType = (type: DatasetType) => {
    setDatasetType(type);
    setStep('upload');
  };

  const handleMappingChange = (sourceCol: string, targetField: string) => {
    setMapping((prev) => ({ ...prev, [sourceCol]: targetField }));
  };

  const handleIngest = async () => {
    if (!parseResult) return;

    setLoading(true);
    try {
      const result = await uploadApi.ingestFile(
        parseResult.upload_id,
        mapping,
        saveTemplate,
        saveTemplate ? templateName : undefined
      );
      setIngestResult(result);
      setStep('result');
      toast.success(`Processed ${result.processed_rows} rows`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('select');
    setDatasetType(null);
    setParseResult(null);
    setMapping({});
    setIngestResult(null);
    setSaveTemplate(false);
    setTemplateName('');
  };

  // Get target fields for the selected dataset type
  const targetFields = datasetType ? getTargetFields(datasetType) : [];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Upload Data</h1>
        <p className="text-sm text-gray-500 mt-1">
          Import data from SAP, Kronos, and other systems
        </p>
      </div>

      {/* Progress steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[
            { key: 'select', label: 'Select Type' },
            { key: 'upload', label: 'Upload File' },
            { key: 'mapping', label: 'Map Columns' },
            { key: 'result', label: 'Complete' },
          ].map((s, i) => (
            <React.Fragment key={s.key}>
              <div className="flex items-center">
                <div
                  className={clsx(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                    step === s.key
                      ? 'bg-sst-orange-500 text-white'
                      : ['select', 'upload', 'mapping', 'result'].indexOf(step) >
                        ['select', 'upload', 'mapping', 'result'].indexOf(s.key as Step)
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  )}
                >
                  {i + 1}
                </div>
                <span className="ml-2 text-sm font-medium text-gray-700">{s.label}</span>
              </div>
              {i < 3 && <div className="flex-1 h-0.5 bg-gray-200 mx-4" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {/* Step 1: Select dataset type */}
        {step === 'select' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Dataset Type</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DATASET_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => handleSelectType(type.value)}
                  className="p-4 border border-gray-200 rounded-lg text-left hover:border-sst-orange-300 hover:bg-sst-orange-50 transition-colors"
                >
                  <h3 className="font-medium text-gray-900">{type.label}</h3>
                  <p className="text-sm text-gray-500 mt-1">{type.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Upload file */}
        {step === 'upload' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Upload {DATASET_TYPES.find((t) => t.value === datasetType)?.label} File
            </h2>

            <div
              {...getRootProps()}
              className={clsx(
                'border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors',
                isDragActive
                  ? 'border-sst-orange-500 bg-sst-orange-50'
                  : 'border-gray-300 hover:border-gray-400'
              )}
            >
              <input {...getInputProps()} />
              <CloudArrowUpIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              {loading ? (
                <p className="text-gray-600">Processing file...</p>
              ) : isDragActive ? (
                <p className="text-sst-orange-600">Drop the file here</p>
              ) : (
                <>
                  <p className="text-gray-600">Drag and drop a CSV or XLSX file here</p>
                  <p className="text-sm text-gray-400 mt-2">or click to select a file</p>
                </>
              )}
            </div>

            <button
              onClick={() => setStep('select')}
              className="btn-ghost mt-4"
            >
              Back
            </button>
          </div>
        )}

        {/* Step 3: Column mapping */}
        {step === 'mapping' && parseResult && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Map Columns</h2>
            <p className="text-sm text-gray-500 mb-4">
              Map your file columns to the expected fields. Required fields are marked with *.
            </p>

            {/* Preview */}
            <div className="mb-6 overflow-x-auto">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Preview (first 5 rows)</h3>
              <table className="min-w-full text-xs border border-gray-200 rounded">
                <thead className="bg-gray-50">
                  <tr>
                    {parseResult.headers.map((h) => (
                      <th key={h} className="px-2 py-1 text-left font-medium text-gray-600">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {parseResult.preview.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      {parseResult.headers.map((h) => (
                        <td key={h} className="px-2 py-1 text-gray-600 max-w-[150px] truncate">
                          {row[h] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mapping form */}
            <div className="space-y-3 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-4">
              {parseResult.headers.map((header) => (
                <div key={header} className="flex items-center gap-4">
                  <div className="w-1/3">
                    <span className="text-sm font-medium text-gray-700">{header}</span>
                  </div>
                  <span className="text-gray-400">→</span>
                  <select
                    value={mapping[header] || '--skip--'}
                    onChange={(e) => handleMappingChange(header, e.target.value)}
                    className="flex-1 text-sm border-gray-300 rounded-md focus:ring-sst-orange-500 focus:border-sst-orange-500"
                  >
                    <option value="--skip--">-- Skip --</option>
                    {targetFields.map((field) => (
                      <option key={field.key} value={field.key}>
                        {field.label} {field.required ? '*' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Save template option */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={saveTemplate}
                  onChange={(e) => setSaveTemplate(e.target.checked)}
                  className="rounded border-gray-300 text-sst-orange-500 focus:ring-sst-orange-500"
                />
                <span className="text-sm text-gray-700">Save mapping as template</span>
              </label>
              {saveTemplate && (
                <input
                  type="text"
                  placeholder="Template name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="mt-2 w-full text-sm border-gray-300 rounded-md focus:ring-sst-orange-500 focus:border-sst-orange-500"
                />
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-between mt-6">
              <button onClick={() => setStep('upload')} className="btn-ghost">
                Back
              </button>
              <button
                onClick={handleIngest}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? 'Processing...' : 'Import Data'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Result */}
        {step === 'result' && ingestResult && (
          <div className="text-center py-8">
            {ingestResult.error_rows === 0 ? (
              <CheckCircleIcon className="w-16 h-16 mx-auto text-green-500 mb-4" />
            ) : (
              <XCircleIcon className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
            )}

            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {ingestResult.error_rows === 0 ? 'Import Complete' : 'Import Completed with Errors'}
            </h2>

            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{ingestResult.total_rows}</p>
                <p className="text-sm text-gray-500">Total Rows</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{ingestResult.processed_rows}</p>
                <p className="text-sm text-gray-500">Processed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{ingestResult.error_rows}</p>
                <p className="text-sm text-gray-500">Errors</p>
              </div>
            </div>

            {(ingestResult.validation_errors.length > 0 || ingestResult.ingestion_errors.length > 0) && (
              <div className="mt-6 text-left max-w-lg mx-auto">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Error Details</h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-48 overflow-y-auto text-sm">
                  {[...ingestResult.validation_errors, ...ingestResult.ingestion_errors]
                    .slice(0, 10)
                    .map((err, i) => (
                      <div key={i} className="text-red-700 mb-1">
                        Row {err.row_index || 'N/A'}: {err.error}
                      </div>
                    ))}
                </div>
              </div>
            )}

            <button onClick={handleReset} className="btn-primary mt-8">
              Upload Another File
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function getTargetFields(datasetType: DatasetType): { key: string; label: string; required: boolean }[] {
  const fields: Record<DatasetType, { key: string; label: string; required: boolean }[]> = {
    SAP_WO_EXPORT: [
      { key: 'wo_number', label: 'Work Order Number', required: true },
      { key: 'status', label: 'Status', required: true },
      { key: 'due_date', label: 'Due Date', required: true },
      { key: 'created_date', label: 'Created Date', required: true },
      { key: 'released_date', label: 'Released Date', required: false },
      { key: 'closed_date', label: 'Closed Date', required: false },
      { key: 'work_center', label: 'Work Center', required: false },
      { key: 'cost_center', label: 'Cost Center', required: false },
      { key: 'area', label: 'Area', required: false },
      { key: 'material', label: 'Material', required: false },
      { key: 'order_type', label: 'Order Type', required: false },
      { key: 'planned_qty', label: 'Planned Quantity', required: false },
      { key: 'unit', label: 'Unit', required: false },
    ],
    SAP_CONFIRMATIONS_EXPORT: [
      { key: 'wo_number', label: 'Work Order Number', required: true },
      { key: 'confirmation_ts', label: 'Confirmation Timestamp', required: true },
      { key: 'pounds', label: 'Pounds', required: true },
      { key: 'operation', label: 'Operation', required: false },
      { key: 'work_center', label: 'Work Center', required: false },
      { key: 'cost_center', label: 'Cost Center', required: false },
      { key: 'employee_id', label: 'Employee ID', required: false },
      { key: 'confirmation_number', label: 'Confirmation Number', required: false },
    ],
    KRONOS_HOURS_EXPORT: [
      { key: 'punch_date', label: 'Punch Date', required: true },
      { key: 'punch_in', label: 'Punch In', required: true },
      { key: 'punch_out', label: 'Punch Out', required: true },
      { key: 'hours', label: 'Hours', required: true },
      { key: 'cost_center', label: 'Cost Center', required: true },
      { key: 'employee_id', label: 'Employee ID', required: false },
      { key: 'employee_name', label: 'Employee Name', required: false },
      { key: 'shift', label: 'Shift', required: false },
      { key: 'pay_type', label: 'Pay Type', required: false },
    ],
    WO_SCANNING_EXPORT: [
      { key: 'wo_number', label: 'Work Order Number', required: true },
      { key: 'scan_in', label: 'Scan In', required: true },
      { key: 'scan_out', label: 'Scan Out', required: false },
      { key: 'scanning_hours', label: 'Scanning Hours', required: false },
      { key: 'station', label: 'Station', required: false },
      { key: 'employee_id', label: 'Employee ID', required: false },
      { key: 'cost_center', label: 'Cost Center', required: false },
      { key: 'work_center', label: 'Work Center', required: false },
    ],
    SAP_MRP_EXPORT: [
      { key: 'material', label: 'Material', required: true },
      { key: 'requirement_date', label: 'Requirement Date', required: true },
      { key: 'pounds_required', label: 'Pounds Required', required: true },
      { key: 'pounds_available', label: 'Pounds Available', required: true },
      { key: 'plant', label: 'Plant', required: false },
      { key: 'area', label: 'Area', required: false },
      { key: 'shortage', label: 'Shortage', required: false },
      { key: 'mrp_controller', label: 'MRP Controller', required: false },
      { key: 'extracted_ts', label: 'Extracted Timestamp', required: false },
    ],
  };

  return fields[datasetType] || [];
}
